"""FastAPI layer: real baselines + synthetic project predictions.

Endpoints:
  GET /                      -> static dashboard
  GET /api/health
  GET /api/projects
  GET /api/projects/{id}
  GET /api/projects/{id}/timeline
  GET /api/snapshots
  GET /api/baselines/sectors
  GET /api/baselines/states
  GET /api/trends/states
  GET /api/trends/national
  GET /api/warnings
  GET /api/projects?map=true    -> leaflet payload (additive, default unchanged)
  POST /api/verify-image        -> photo verification (EGPS/time/duplicate heuristics)
  GET /api/verification-records -> audit trail for verification checks
  GET /uploads/{filename}       -> serve uploaded photos back to the UI
"""
import json
import os
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import llm
import mock_data
import scoring
import verification_pipeline as verification

app = FastAPI(title="Infrastructure Oversight Co-Pilot API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DB = "project_monitoring.db"
MONTH_ORDER = ["Feb", "March", "April", "May", "June", "July"]

# ---------------------------------------------------------------------------
# Map & photo-verification bit (additive-only; ML pipeline stays untouched).
# ---------------------------------------------------------------------------
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)  # safe when the server starts from any cwd


def _ensure_verification_schema():
    """Idempotent guard; the table is also declared in schema.sql."""
    conn = sqlite3.connect(DB)
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS verification_records ("
            "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "  file_name TEXT NOT NULL,"
            "  upload_path TEXT NOT NULL,"
            "  project_id TEXT NOT NULL,"
            "  submitted_at TEXT NOT NULL,"
            "  status TEXT NOT NULL,"
            "  result_json TEXT NOT NULL"
            ")"
        )
        conn.commit()
    finally:
        conn.close()


def _ensure_contractor_schema():
    """Ensure contractors, contractor_assignments, and contractor_progress_reports tables exist."""
    _ensure_verification_schema()
    conn = sqlite3.connect(DB)
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS contractors ("
            "  contractor_id TEXT PRIMARY KEY,"
            "  company_name TEXT NOT NULL,"
            "  contact_person TEXT,"
            "  email TEXT,"
            "  phone TEXT,"
            "  rating NUMERIC DEFAULT 4.5,"
            "  active_contracts INT DEFAULT 0"
            ")"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS contractor_assignments ("
            "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "  project_id TEXT,"
            "  contractor_id TEXT,"
            "  package_name TEXT,"
            "  assigned_date TEXT,"
            "  contract_value_cr NUMERIC,"
            "  UNIQUE(project_id, contractor_id)"
            ")"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS contractor_progress_reports ("
            "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "  submission_id TEXT UNIQUE,"
            "  project_id TEXT NOT NULL,"
            "  contractor_id TEXT NOT NULL,"
            "  physical_progress_pct NUMERIC,"
            "  financial_expenditure_cr NUMERIC,"
            "  notes TEXT,"
            "  photo_url TEXT,"
            "  gps_lat NUMERIC,"
            "  gps_lng NUMERIC,"
            "  inside_geofence INT,"
            "  verification_status TEXT,"
            "  counts_towards_progress INT,"
            "  submitted_at TEXT NOT NULL,"
            "  details_json TEXT"
            ")"
        )
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM contractors")
        if cur.fetchone()[0] == 0:
            for c in mock_data.CONTRACTORS:
                cur.execute(
                    "INSERT OR REPLACE INTO contractors (contractor_id, company_name, contact_person, email, phone, rating, active_contracts) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (c["contractor_id"], c["company_name"], c["contact_person"], c["email"], c["phone"], c.get("rating", 4.5), c.get("active_contracts", 4))
                )
            for pid, cid in mock_data.EXPLICIT_ASSIGNMENTS.items():
                cur.execute(
                    "INSERT OR IGNORE INTO contractor_assignments (project_id, contractor_id, package_name, assigned_date, contract_value_cr) VALUES (?, ?, ?, ?, ?)",
                    (pid, cid, f"Civil Works Pkg - {pid}", "2024-01-15", 1250.0)
                )
        conn.commit()
    finally:
        conn.close()



def _status_from_risk(risk_level: str) -> str:
    """Map a model risk level back to the dashboard status vocabulary."""
    level = str(risk_level or "").strip()
    if level == "Low":
        return "On Track"
    if level == "Medium":
        return "Watch"
    return "At Risk"  # High / Critical


def _map_projects(limit: int = 200):
    """Enriched /api/projects payload for the Leaflet map.

    Returns a dict with ``mode`` ("db" | "demo") plus the project list. DB
    rows carry no coordinates, so each project is placed deterministically
    from its state centroid via ``mock_data.coordinates_for``. Unresolved
    states drop the point (never crash the request).
    """
    query = (
        "SELECT p.project_id, p.sector, p.state, p.sanctioned_cost, "
        "s.physical_progress_pct, s.cumulative_expenditure, "
        "m.cop_prob, m.top_prob, m.final_risk_score, m.risk_level "
        "FROM projects p "
        "LEFT JOIN project_snapshots s ON p.project_id = s.project_id AND s.month = 'July' "
        "LEFT JOIN model_risk_scores m ON p.project_id = m.project_id AND m.month = 'July' "
        "ORDER BY m.final_risk_score DESC LIMIT ?"
    )
    df = q(query, params=[limit])
    projects = []
    for r in df.to_dict("records"):
        if r.get("project_id") is None:
            continue
        coords = mock_data.coordinates_for(str(r["project_id"]), str(r.get("state", "")))
        if coords is None:
            continue
        risk = float(r.get("final_risk_score") or 50)
        level = str(r.get("risk_level") or ("Medium" if risk >= 40 else "Low"))
        projects.append({
            "id": str(r["project_id"]),
            "name": f"{r.get('state')} {r.get('sector')} Project ({r['project_id']})",
            "project_id": str(r["project_id"]),
            "sector": str(r.get("sector") or "Infrastructure"),
            "state": str(r.get("state") or "India"),
            "lat": coords[0],
            "lng": coords[1],
            "cost_cr": round(float(r.get("sanctioned_cost") or 0), 2),
            "physical_progress_pct": round(float(r.get("physical_progress_pct") or 0), 1),
            "expenditure_cr": round(float(r.get("cumulative_expenditure") or 0), 2),
            "status": _status_from_risk(level),
            "risk_score": round(risk, 1),
            "risk_level": level,
        })
    return {"mode": "db", "projects": projects}


def q(sql, params=None):
    conn = sqlite3.connect(DB)
    df = pd.read_sql(sql, conn, params=params)
    conn.close()
    return df


def month_sorted(df, col="month"):
    if col in df.columns:
        df[col] = pd.Categorical(df[col], categories=MONTH_ORDER, ordered=True)
        df = df.sort_values(col)
    return df

from typing import Optional
from pydantic import BaseModel

MINISTRY_MAP = {
    "Railways": "Ministry of Railways",
    "Roads & Highways": "Ministry of Road Transport & Highways",
    "Urban Transport": "Ministry of Housing & Urban Affairs",
    "Power & RE": "Ministry of Power & New Renewable Energy",
    "Oil & Gas": "Ministry of Petroleum & Natural Gas",
    "Aviation & Aviation Infrastructure": "Ministry of Civil Aviation",
    "Ports & Shipping": "Ministry of Ports, Shipping & Waterways",
    "Telecommunications": "Department of Telecommunications",
    "Coal": "Ministry of Coal",
    "Atomic Energy": "Department of Atomic Energy",
}


def format_project_card(row):
    pid = str(row.get("project_id", ""))
    sec = str(row.get("sector", "Infrastructure"))
    st = str(row.get("state", "India"))
    sanctioned = float(row.get("sanctioned_cost", 0) or 0)
    exp = float(row.get("cumulative_expenditure", 0) or 0)
    phys = float(row.get("physical_progress_pct", 0) or 0)
    fin = float(row.get("financial_progress_pct", 0) or 0)
    slip = float(row.get("schedule_slip_months", 0) or 0)
    overrun = float(row.get("cost_overrun_to_date_pct", 0) or 0)
    cop_p = float(row.get("cop_prob", 0) or 0)
    top_p = float(row.get("top_prob", 0) or 0)
    final_risk = float(row.get("final_risk_score", 50) or 50)
    risk_lvl = str(row.get("risk_level", "Medium"))

    status = "On Track" if risk_lvl == "Low" else ("Watch" if risk_lvl == "Medium" else "At Risk")
    health = max(0, min(100, round(100 - final_risk, 1)))

    flags = []
    if slip > 4:
        flags.append({"label": f"Schedule slip +{round(slip, 1)} mo", "tone": "negative"})
    if overrun > 10:
        flags.append({"label": f"Cost escalation +{round(overrun, 1)}%", "tone": "negative"})
    elif overrun < 0:
        flags.append({"label": f"Cost savings {round(abs(overrun), 1)}%", "tone": "positive"})
    if abs(fin - phys) > 10:
        flags.append({"label": f"Fin/Phys gap {round(abs(fin - phys), 1)}%", "tone": "negative"})
    if phys >= 70:
        flags.append({"label": "High physical execution", "tone": "positive"})
    elif phys < 15:
        flags.append({"label": "Early execution phase", "tone": "neutral"})

    return {
        "id": pid,
        "project_id": pid,
        "name": f"{st} {sec} Project ({pid})",
        "ministry": MINISTRY_MAP.get(sec, f"Ministry of {sec}"),
        "sector": sec,
        "state": st,
        "status": status,
        "physicalProgress": round(phys, 1),
        "financialProgress": round(fin, 1),
        "health": health,
        "costOverrunRisk": round(cop_p * 100, 1),
        "timeOverrunRisk": round(top_p * 100, 1),
        "originalCompletion": str(row.get("original_end_date") or "31 Dec 2028"),
        "predictedCompletion": str(row.get("revised_end_date") or "30 Jun 2030"),
        "expenditure": f"₹ {round(exp, 1):,} Cr" if exp > 0 else f"₹ {round(sanctioned, 1):,} Cr",
        "costVariance": round(overrun, 1),
        "timeVariance": round(slip, 1),
        "currentStageIndex": min(4, max(0, int(phys // 25))),
        "reviewReason": (
            f"The predictive ML model estimates a {round(cop_p*100, 1)}% probability of cost overrun and "
            f"{round(top_p*100, 1)}% probability of schedule overrun. "
            f"Current schedule slip is {round(slip, 1)} months with cost variance at {round(overrun, 1)}%."
        ),
        "flags": flags,
        "final_risk_score": final_risk,
        "risk_level": risk_lvl,
        "contractor": mock_data.get_contractor_for_project(pid),
    }



class PredictRequest(BaseModel):
    sector: str = "Roads & Highways"
    state: str = "Maharashtra"
    sanctioned_cost: float = 1000.0
    duration_months: float = 36.0
    months_elapsed: float = 12.0
    physical_progress_pct: float = 30.0
    financial_progress_pct: float = 35.0
    cost_overrun_to_date_pct: float = 5.0
    schedule_slip_months: float = 2.0
    cumulative_expenditure: float = 350.0
    revised_cost: float = 1050.0


class RegisterProjectRequest(BaseModel):
    name: Optional[str] = None
    ministry: Optional[str] = None
    sector: str = "Roads & Highways"
    state: str = "Maharashtra"
    sanctioned_cost: float = 1000.0
    revised_cost: Optional[float] = None
    duration_months: float = 36.0
    months_elapsed: float = 12.0
    physical_progress_pct: float = 30.0
    financial_progress_pct: float = 30.0
    cost_overrun_to_date_pct: float = 0.0
    schedule_slip_months: float = 0.0
    cumulative_expenditure: Optional[float] = None
    sanctioned_date: Optional[str] = "2024-01-01"
    original_end_date: Optional[str] = "2027-01-01"


@app.get("/", include_in_schema=False)
def index():
    dist = Path("frontend/dist/index.html")
    resp = FileResponse(dist if dist.is_file() else Path("static/index.html"))
    # Dashboard/SPA reads live DOM + API each load; never let browsers serve a stale copy.
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.get("/api/health")
def health():
    tables_df = q("SELECT name FROM sqlite_master WHERE type='table'")
    proj_df = q("SELECT count(*) as n FROM projects")
    snap_df = q("SELECT count(*) as n FROM project_snapshots")
    return {
        "status": "connected",
        "database": "project_monitoring.db",
        "tables_count": len(tables_df),
        "total_projects": int(proj_df.iloc[0]["n"]) if not proj_df.empty else 0,
        "total_snapshots": int(snap_df.iloc[0]["n"]) if not snap_df.empty else 0,
        "models": {
            "cost_overrun_model": "cop_model.json (XGBoost Loaded)",
            "time_overrun_model": "top_model.json (XGBoost Loaded)",
            "explainability": "SHAP TreeExplainer Active"
        }
    }


@app.get("/api/projects")
def projects(sector: Optional[str] = None, state: Optional[str] = None,
             risk_level: Optional[str] = None, limit: int = 500,
             map: Optional[bool] = None):
    # Enriched leaflet payload used by the interactive map; the default
    # JSON-card response below is byte-for-byte identical to the original.
    if map:
        return _map_projects(limit=max(1, min(limit, 2000)))
    query = """
    SELECT 
        p.project_id, p.sector, p.state, p.sanctioned_cost, p.sanctioned_date, p.original_end_date, p.duration_months,
        s.physical_progress_pct, s.financial_progress_pct, s.cumulative_expenditure, s.revised_cost,
        s.cost_overrun_to_date_pct, s.schedule_slip_months, s.revised_end_date,
        m.cop_prob, m.top_prob, m.model_risk_score, m.rule_risk_score, m.final_risk_score, m.risk_level
    FROM projects p
    LEFT JOIN project_snapshots s ON p.project_id = s.project_id AND s.month = 'July'
    LEFT JOIN model_risk_scores m ON p.project_id = m.project_id AND m.month = 'July'
    WHERE 1=1
    """
    params = []
    if sector and sector != "All Sectors":
        query += " AND p.sector = ?"
        params.append(sector)
    if state:
        query += " AND p.state = ?"
        params.append(state)
    if risk_level:
        query += " AND m.risk_level = ?"
        params.append(risk_level)
    
    query += " ORDER BY m.final_risk_score DESC LIMIT ?"
    params.append(limit)

    df = q(query, params=params if params else None)
    records = df.to_dict("records")
    return [format_project_card(r) for r in records]


@app.get("/api/portfolio/summary")
def portfolio_summary():
    df = q("""
    SELECT 
        p.project_id, p.sector, p.state, p.sanctioned_cost,
        s.physical_progress_pct, s.financial_progress_pct, s.cost_overrun_to_date_pct, s.schedule_slip_months,
        m.cop_prob, m.top_prob, m.model_risk_score, m.final_risk_score, m.risk_level
    FROM projects p
    LEFT JOIN project_snapshots s ON p.project_id = s.project_id AND s.month = 'July'
    LEFT JOIN model_risk_scores m ON p.project_id = m.project_id AND m.month = 'July'
    """)
    if df.empty:
        return {}

    total = len(df)
    critical_c = int((df["risk_level"] == "Critical").sum())
    high_c = int((df["risk_level"] == "High").sum())
    medium_c = int((df["risk_level"] == "Medium").sum())
    low_c = int((df["risk_level"] == "Low").sum())

    at_risk = critical_c + high_c
    avg_final_risk = float(df["final_risk_score"].mean())
    avg_health = round(100 - avg_final_risk, 1)
    avg_cop = round(float(df["cop_prob"].mean()) * 100, 1)
    avg_top = round(float(df["top_prob"].mean()) * 100, 1)
    avg_overrun = round(float(df["cost_overrun_to_date_pct"].mean()), 2)

    top_risk_df = df.sort_values("final_risk_score", ascending=False).head(6)
    top_risk_projects = [format_project_card(r) for r in top_risk_df.to_dict("records")]

    return {
        "total_projects": total,
        "projects_at_risk": at_risk,
        "projects_watch": medium_c,
        "projects_on_track": low_c,
        "avg_health": avg_health,
        "avg_cost_overrun_pct": avg_overrun,
        "avg_cop_prob": avg_cop,
        "avg_top_prob": avg_top,
        "critical_count": critical_c,
        "high_count": high_c,
        "medium_count": medium_c,
        "low_count": low_c,
        "top_risk_projects": top_risk_projects,
    }


@app.get("/api/snapshots")
def snapshots():
    return q("SELECT COUNT(*) AS n_snapshots, COUNT(DISTINCT project_id) AS n_projects "
             "FROM project_snapshots").to_dict("records")[0]


@app.get("/api/projects/{project_id}")
def project_detail(project_id: str):
    engine = scoring.get_engine()
    result = engine.score_project(project_id)
    if result is None:
        raise HTTPException(404, f"unknown project {project_id}")

    sec = result["sector"]
    st = result["state"]
    result["id"] = project_id
    result["name"] = f"{st} {sec} Project ({project_id})"
    result["ministry"] = MINISTRY_MAP.get(sec, f"Ministry of {sec}")
    result["status"] = "On Track" if result["risk_level"] == "Low" else ("Watch" if result["risk_level"] == "Medium" else "At Risk")
    result["costOverrunRisk"] = round(result["cop_prob"] * 100, 1)
    result["timeOverrunRisk"] = round(result["top_prob"] * 100, 1)
    result["costVariance"] = round(result["cost_overrun_to_date_pct"], 1)
    result["timeVariance"] = round(result["schedule_slip_months"], 1)
    result["physicalProgress"] = round(result["physical_progress_pct"], 1)
    result["financialProgress"] = round(result["financial_progress_pct"], 1)
    result["expenditure"] = f"₹ {round(result.get('cumulative_expenditure', 0), 1):,} Cr"
    result["originalCompletion"] = str(result.get("original_end_date") or "31 Dec 2028")
    result["predictedCompletion"] = str(result.get("revised_end_date") or "30 Jun 2030")
    result["currentStageIndex"] = min(4, max(0, int(result["physical_progress_pct"] // 25)))

    top_drivers = result.get("shap_drivers", [])
    driver_texts = []
    for d in top_drivers[:3]:
        feat = d["feature"].replace("_", " ")
        val = d["shap_value"]
        if val > 0:
            driver_texts.append(f"{feat} (+{val})")
        else:
            driver_texts.append(f"{feat} ({val})")

    warn_texts = [w["warning_type"].replace("_", " ") for w in result.get("warnings", [])[:2]]

    reason = (
        f"The predictive XGBoost model evaluates this project at {result['final_risk_score']}/100 composite risk ({result['risk_level']}). "
        f"Top SHAP risk drivers: {', '.join(driver_texts) if driver_texts else 'Baseline drift'}. "
    )
    if warn_texts:
        reason += f"Active warning flags triggered: {', '.join(warn_texts)}."

    result["reviewReason"] = reason

    flags = []
    if result["schedule_slip_months"] > 4:
        flags.append({"label": f"Schedule slip +{round(result['schedule_slip_months'], 1)} mo", "tone": "negative"})
    if result["cost_overrun_to_date_pct"] > 10:
        flags.append({"label": f"Cost escalation +{round(result['cost_overrun_to_date_pct'], 1)}%", "tone": "negative"})
    elif result["cost_overrun_to_date_pct"] < 0:
        flags.append({"label": f"Under budget {round(abs(result['cost_overrun_to_date_pct']), 1)}%", "tone": "positive"})
    if abs(result["financial_progress_pct"] - result["physical_progress_pct"]) > 10:
        flags.append({"label": "Financial-physical execution gap", "tone": "negative"})
    if result["physical_progress_pct"] >= 70:
        flags.append({"label": "Strong physical delivery", "tone": "positive"})

    result["flags"] = flags
    return result


@app.post("/api/predict")
def predict_project(req: PredictRequest):
    engine = scoring.get_engine()
    res = engine.predict_custom(req.dict())
    return res


@app.post("/api/projects")
def register_project(req: RegisterProjectRequest):
    conn = sqlite3.connect(DB)
    c = conn.cursor()

    # Determine next PRJ-XXXX identifier
    c.execute("SELECT project_id FROM projects WHERE project_id LIKE 'PRJ-%' ORDER BY project_id DESC LIMIT 1")
    last_row = c.fetchone()
    if last_row:
        try:
            num = int(last_row[0].replace("PRJ-", ""))
            new_id = f"PRJ-{num + 1:04d}"
        except Exception:
            new_id = "PRJ-9001"
    else:
        new_id = "PRJ-0001"

    engine = scoring.get_engine()
    pred_data = req.dict()
    pred_data["project_id"] = new_id
    pred_res = engine.predict_custom(pred_data)

    revised_cost = req.revised_cost if req.revised_cost is not None else round(req.sanctioned_cost * (1 + req.cost_overrun_to_date_pct / 100.0), 2)
    cum_exp = req.cumulative_expenditure if req.cumulative_expenditure is not None else round(revised_cost * (req.physical_progress_pct / 100.0), 2)

    # Persist in projects table
    c.execute(
        "INSERT OR REPLACE INTO projects (project_id, sector, state, sanctioned_cost, sanctioned_date, original_end_date, duration_months) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (new_id, req.sector, req.state, req.sanctioned_cost, req.sanctioned_date, req.original_end_date, req.duration_months)
    )

    # Persist in project_snapshots table for 'July'
    c.execute(
        "INSERT OR REPLACE INTO project_snapshots (project_id, month, snapshot_date, physical_progress_pct, financial_progress_pct, cumulative_expenditure, revised_cost, cost_overrun_to_date_pct, revised_end_date, schedule_slip_months) "
        "VALUES (?, 'July', '2026-07-31', ?, ?, ?, ?, ?, ?, ?)",
        (new_id, req.physical_progress_pct, req.financial_progress_pct, cum_exp, revised_cost, req.cost_overrun_to_date_pct, req.original_end_date, req.schedule_slip_months)
    )

    # Persist in model_risk_scores table for 'July'
    c.execute(
        "INSERT OR REPLACE INTO model_risk_scores (project_id, snapshot_id, month, cop_prob, top_prob, model_risk_score, rule_risk_score, final_risk_score, risk_level) "
        "VALUES (?, ?, 'July', ?, ?, ?, ?, ?, ?)",
        (new_id, f"{new_id}_July", pred_res["cop_prob"], pred_res["top_prob"], pred_res["model_risk_score"], pred_res["rule_risk_score"], pred_res["final_risk_score"], pred_res["risk_level"])
    )

    conn.commit()
    conn.close()

    row = {
        "project_id": new_id,
        "name": req.name or f"{req.state} {req.sector} Project ({new_id})",
        "ministry": req.ministry or MINISTRY_MAP.get(req.sector, f"Ministry of {req.sector}"),
        "sector": req.sector,
        "state": req.state,
        "sanctioned_cost": req.sanctioned_cost,
        "cumulative_expenditure": cum_exp,
        "physical_progress_pct": req.physical_progress_pct,
        "financial_progress_pct": req.financial_progress_pct,
        "schedule_slip_months": req.schedule_slip_months,
        "cost_overrun_to_date_pct": req.cost_overrun_to_date_pct,
        "cop_prob": pred_res["cop_prob"],
        "top_prob": pred_res["top_prob"],
        "final_risk_score": pred_res["final_risk_score"],
        "risk_level": pred_res["risk_level"],
        "original_end_date": req.original_end_date,
        "revised_end_date": req.original_end_date,
    }
    card = format_project_card(row)
    if req.name:
        card["name"] = req.name
    if req.ministry:
        card["ministry"] = req.ministry
    card["prediction"] = pred_res
    return card


@app.get("/api/projects/{project_id}/timeline")
def project_timeline(project_id: str):
    engine = scoring.get_engine()
    tl = engine.timeline(project_id)
    if not tl:
        raise HTTPException(404, f"unknown project {project_id}")
    return tl


@app.get("/api/baselines/sectors")
def sector_baselines():
    return month_sorted(q(
        "SELECT sector, project_count, avg_cost_overrun_pct, avg_expenditure "
        "FROM sector_baselines ORDER BY project_count DESC")).to_dict("records")


@app.get("/api/baselines/states")
def state_baselines():
    return q("SELECT state, project_count, avg_cost_overrun_pct "
             "FROM state_baselines ORDER BY project_count DESC").to_dict("records")


@app.get("/api/trends/states")
def state_trends():
    return month_sorted(q(
        "SELECT state, month, project_count, original_cost_cr, revised_cost_cr, expenditure_cr, cost_overrun_pct "
        "FROM state_monthly_trends")).to_dict("records")


@app.get("/api/states/{state_name}")
def state_detail(state_name: str):
    # Try exact match first, then case-insensitive, then partial / alias match
    base = q("SELECT state, project_count, avg_cost_overrun_pct FROM state_baselines WHERE LOWER(state) = LOWER(?)", params=[state_name])
    if base.empty:
        # Check common aliases
        alias_map = {
            "andaman and nicobar islands": "Andaman & Nicobar",
            "jammu and kashmir": "Jammu & Kashmir",
            "dadra and nagar haveli": "Dadra & Nagar Haveli and Daman & Diu",
            "daman and diu": "Dadra & Nagar Haveli and Daman & Diu",
            "dadra & nagar haveli": "Dadra & Nagar Haveli and Daman & Diu",
            "orissa": "Odisha",
            "pondicherry": "Puducherry",
        }
        resolved = alias_map.get(state_name.lower().strip())
        if resolved:
            base = q("SELECT state, project_count, avg_cost_overrun_pct FROM state_baselines WHERE LOWER(state) = LOWER(?)", params=[resolved])
        if base.empty:
            base = q("SELECT state, project_count, avg_cost_overrun_pct FROM state_baselines WHERE LOWER(state) LIKE LOWER(?)", params=[f"%{state_name.strip()[:5]}%"])
        
    if base.empty:
        raise HTTPException(404, f"Unknown state {state_name}")

    b_row = base.iloc[0]
    matched_state = str(b_row["state"])
    total_projects = int(b_row["project_count"])
    avg_overrun = round(float(b_row["avg_cost_overrun_pct"]), 2)
    health = max(0, min(100, round(100 - max(0, avg_overrun), 1)))

    trends_df = q(
        "SELECT month, project_count, original_cost_cr, revised_cost_cr, expenditure_cr, cost_overrun_pct "
        "FROM state_monthly_trends WHERE state = ?", params=[matched_state])
    trends_sorted = month_sorted(trends_df).to_dict("records")

    latest_revised = float(trends_df["revised_cost_cr"].iloc[-1]) if not trends_df.empty else 0
    latest_exp = float(trends_df["expenditure_cr"].iloc[-1]) if not trends_df.empty else 0

    sec_mix_df = q(
        "SELECT sector, COUNT(*) as cnt FROM projects WHERE state = ? GROUP BY sector", params=[matched_state])
    total_state_proj = sec_mix_df["cnt"].sum() if not sec_mix_df.empty else 1
    sector_mix = [
        {"sector": r["sector"], "count": int(r["cnt"]), "pct": round(int(r["cnt"]) / total_state_proj * 100, 1)}
        for r in sec_mix_df.to_dict("records")
    ] if not sec_mix_df.empty else [
        {"sector": "Roads & Highways", "count": 10, "pct": 40.0},
        {"sector": "Railways", "count": 8, "pct": 32.0},
        {"sector": "Power & RE", "count": 7, "pct": 28.0}
    ]

    proj_query = """
    SELECT 
        p.project_id, p.sector, p.state, p.sanctioned_cost, p.sanctioned_date, p.original_end_date, p.duration_months,
        s.physical_progress_pct, s.financial_progress_pct, s.cumulative_expenditure, s.revised_cost,
        s.cost_overrun_to_date_pct, s.schedule_slip_months, s.revised_end_date,
        m.cop_prob, m.top_prob, m.model_risk_score, m.rule_risk_score, m.final_risk_score, m.risk_level
    FROM projects p
    LEFT JOIN project_snapshots s ON p.project_id = s.project_id AND s.month = 'July'
    LEFT JOIN model_risk_scores m ON p.project_id = m.project_id AND m.month = 'July'
    WHERE p.state = ?
    ORDER BY m.final_risk_score DESC LIMIT 3
    """
    p_df = q(proj_query, params=[matched_state])
    priority_projects = [format_project_card(r) for r in p_df.to_dict("records")]

    return {
        "name": matched_state,
        "health": health,
        "projects": total_projects,
        "investment": f"₹ {round(latest_revised / 1000, 2)}L Cr" if latest_revised > 1000 else f"₹ {round(latest_revised, 1)} Cr",
        "expenditure": f"₹ {round(latest_exp / 1000, 2)}L Cr" if latest_exp > 1000 else f"₹ {round(latest_exp, 1)} Cr",
        "atRisk": max(0, avg_overrun),
        "timeExposure": f"{round(abs(avg_overrun) * 0.8, 1)} months",
        "sectorMix": sector_mix,
        "monthlyTrends": trends_sorted,
        "priorityProjects": priority_projects,
    }


@app.get("/api/trends/national")
def national_trend():
    return month_sorted(q(
        "SELECT month, original_cost_cr, revised_cost_cr, cumulative_expenditure_cr, "
        "national_cost_overrun_pct FROM national_monthly_trends")).to_dict("records")


@app.get("/api/warnings")
def warnings(limit: int = 50):
    return q(
        "SELECT project_id, month, warning_type, severity, signal_value "
        "FROM early_warnings ORDER BY CASE month WHEN 'Feb' THEN 1 WHEN 'March' THEN 2 "
        "WHEN 'April' THEN 3 WHEN 'May' THEN 4 WHEN 'June' THEN 5 WHEN 'July' THEN 6 END "
        "DESC, signal_value DESC LIMIT ?", params=[limit]).to_dict("records")


@app.post("/api/verify-image")
async def verify_image_upload(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    project_lat: Optional[float] = Form(None),
    project_lng: Optional[float] = Form(None),
    captured_at: Optional[str] = Form(None),
    max_distance_km: float = Form(10.0),
    max_age_days: float = Form(30.0),
):
    """Accept an on-site photo and run the local heuristic verification.

    Additive feature - the ML risk models and /api/projects default response
    are untouched. If the imaging libraries are missing this endpoint still
    answers with ``status: "unverifiable"`` instead of crashing.
    """
    _ensure_verification_schema()

    # Resolve expected site coordinates unless the client supplied them.
    coords = None
    if project_lat is not None and project_lng is not None:
        coords = (project_lat, project_lng)
    else:
        demo = mock_data.demo_by_id(project_id)
        if demo:
            coords = (demo["lat"], demo["lng"])
        else:
            row = q("SELECT state FROM projects WHERE project_id = ?",
                    params=[project_id])
            if not row.empty:
                coords = mock_data.coordinates_for(project_id, str(row.iloc[0]["state"]))
    if coords is None:
        raise HTTPException(422, "could not resolve coordinates for this project")

    ext = Path(file.filename or "upload.jpg").suffix.lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}:
        raise HTTPException(415, "unsupported image type - use JPEG/PNG/WebP")

    safe_name = (
        f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')}_"
        f"{project_id.replace('/', '_')[:40]}{ext}"
    )
    target = UPLOAD_DIR / safe_name
    with target.open("wb") as fh:
        shutil.copyfileobj(file.file, fh)

    # Feed previously accepted hashes so re-uploads are caught.
    known = []
    hist = q(
        "SELECT result_json FROM verification_records "
        "WHERE status = 'accepted' AND project_id = ?",
        params=[project_id],
    )
    for rec in hist.to_dict("records"):
        try:
            phash = json.loads(rec["result_json"]).get("checks", {}).get("perceptual_hash")
        except Exception:
            phash = None
        if phash:
            known.append(phash)

    result = verification.verify_image(
        target,
        project_lat=coords[0],
        project_lng=coords[1],
        max_distance_km=max_distance_km,
        max_age_days=max_age_days,
        duplicate_hashes=known,
        captured_at=captured_at or None,
    )
    result["file_url"] = f"/uploads/{safe_name}"
    result["project_id"] = project_id
    result["project_coords"] = {"lat": coords[0], "lng": coords[1]}

    conn = sqlite3.connect(DB)
    try:
        conn.execute(
            "INSERT INTO verification_records "
            "(file_name, upload_path, project_id, submitted_at, status, result_json) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (file.filename or safe_name, safe_name, project_id,
             result["submitted_at"], result["status"], json.dumps(result)),
        )
        conn.commit()
    finally:
        conn.close()
    return result


@app.get("/uploads/{filename}")
def serve_upload(filename: str):
    """Serve uploaded photos back to the Leaflet side-panel / popups."""
    safe = Path(filename).name  # strip any path separators
    fp = UPLOAD_DIR / safe
    if not fp.exists():
        raise HTTPException(404, "file not found")
    return FileResponse(fp)


@app.get("/api/verification-records")
def verification_records(project_id: Optional[str] = None, limit: int = 50):
    """Recent verification decisions (audit trail used by the demo UI)."""
    conn = sqlite3.connect(DB)
    try:
        if project_id:
            rows = conn.execute(
                "SELECT id, file_name, project_id, submitted_at, status, result_json "
                "FROM verification_records WHERE project_id = ? ORDER BY id DESC LIMIT ?",
                (project_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, file_name, project_id, submitted_at, status, result_json "
                "FROM verification_records ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
    finally:
        conn.close()
    out = []
    for row in rows:
        try:
            res = json.loads(row[5])
        except Exception:
            continue
        out.append({
            "id": row[0],
            "file_name": row[1],
            "project_id": row[2],
            "submitted_at": row[3],
            "status": row[4],
            "file_url": res.get("file_url", f"/uploads/{row[1]}"),
            "gps": res.get("gps"),
            "distance_km": res.get("distance_km"),
            "timestamp_gap_days": res.get("timestamp_gap_days"),
            "ela_score": res.get("ela_score"),
            "reasons": res.get("reasons", []),
        })
    return out


class LLMExplainRequest(BaseModel):
    """Request for the OpenRouter narrative endpoint.

    Provide exactly one of:
      - ``project_id``: score the project from the DB, then explain it.
      - ``data``:      a raw scored/custom payload to explain directly.
    """
    project_id: Optional[str] = None
    data: Optional[dict] = None


@app.get("/api/llm/status")
def llm_status():
    cfg = llm.get_config()
    return {"available": llm.is_available(), "model": cfg["model"]}


@app.post("/api/llm/explain")
def llm_explain(req: LLMExplainRequest):
    if req.project_id:
        engine = scoring.get_engine()
        score = engine.score_project(req.project_id)
        if score is None:
            raise HTTPException(404, f"unknown project {req.project_id}")
        # Enrich with display fields so the prompt reads like the dashboard.
        enriched = dict(score)
        enriched["project_id"] = req.project_id
        enriched["name"] = f"{score['state']} {score['sector']} Project ({req.project_id})"
        enriched["ministry"] = MINISTRY_MAP.get(score["sector"], f"Ministry of {score['sector']}")
        context = llm.build_context(enriched)
    elif req.data:
        context = llm.build_context(dict(req.data))
    else:
        raise HTTPException(422, "provide either 'project_id' or 'data'")

    out = llm.generate_narrative(context)
    source = "openrouter" if out.get("narrative") else "template"
    return {
        "project_id": req.project_id,
        "narrative": out["narrative"],
        "model": out["model"],
        "available": out["available"],
        "error": out["error"],
        "source": source,
    }


# ---------------------------------------------------------------------------
# Contractor Portal, Geofence Verification & Unified Auth
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    role: str = "contractor"  # "admin" | "contractor"
    contractor_id: Optional[str] = "CNT-LT-01"
    username: Optional[str] = None
    password: Optional[str] = None


@app.post("/api/auth/login")
def auth_login(req: LoginRequest):
    _ensure_contractor_schema()
    if req.role == "admin":
        return {
            "status": "success",
            "role": "admin",
            "user": {
                "id": "ADM-DG-01",
                "name": "Director General",
                "company": "Govt of India (MoSPI Oversight)",
                "role": "admin",
                "title": "Director General / Oversight Administrator",
                "email": "dg.oversight@gov.in",
                "agency": "National Infrastructure Monitoring Authority"
            },
            "token": "admin_session_token_xyz"
        }
    else:
        cid = req.contractor_id or "CNT-LT-01"
        c = mock_data.get_contractor(cid)
        if not c:
            c = mock_data.CONTRACTORS[0]
        return {
            "status": "success",
            "role": "contractor",
            "user": {
                "id": c["contractor_id"],
                "name": c["contact_person"],
                "company": c["company_name"],
                "role": "contractor",
                "email": c["email"],
                "phone": c["phone"],
                "rating": c.get("rating", 4.5),
            },
            "token": f"contractor_session_{c['contractor_id']}"
        }


@app.get("/api/contractors")
def list_contractors():
    _ensure_contractor_schema()
    return mock_data.CONTRACTORS


@app.get("/api/contractors/{contractor_id}/projects")
def contractor_projects(contractor_id: str):
    _ensure_contractor_schema()
    c = mock_data.get_contractor(contractor_id)
    if not c:
        raise HTTPException(404, "Contractor not found")

    assigned_pids = [pid for pid, cid in mock_data.EXPLICIT_ASSIGNMENTS.items() if cid.upper() == contractor_id.upper()]
    if not assigned_pids:
        assigned_pids = ["PRJ-0001", "PRJ-0006", "DM-MH-001"]

    res = []
    for pid in assigned_pids:
        p_row = q("""
        SELECT p.project_id, p.sector, p.state, p.sanctioned_cost, p.sanctioned_date, p.original_end_date, p.duration_months,
               s.physical_progress_pct, s.financial_progress_pct, s.cumulative_expenditure, s.revised_cost,
               s.cost_overrun_to_date_pct, s.schedule_slip_months, s.revised_end_date,
               m.cop_prob, m.top_prob, m.model_risk_score, m.rule_risk_score, m.final_risk_score, m.risk_level
        FROM projects p
        LEFT JOIN project_snapshots s ON p.project_id = s.project_id AND s.month = 'July'
        LEFT JOIN model_risk_scores m ON p.project_id = m.project_id AND m.month = 'July'
        WHERE p.project_id = ?
        """, params=[pid])

        st = p_row.iloc[0]["state"] if not p_row.empty else "Maharashtra"
        geofence = mock_data.geofence_for_project(pid, state=st)

        if not p_row.empty:
            card = format_project_card(p_row.iloc[0].to_dict())
        else:
            demo = mock_data.demo_by_id(pid)
            if demo:
                card = {
                    "id": demo["id"],
                    "project_id": demo["id"],
                    "name": demo["name"],
                    "sector": demo["sector"],
                    "state": demo["state"],
                    "status": demo["status"],
                    "physicalProgress": 62.0,
                    "financialProgress": 58.0,
                    "expenditure": f"₹ {demo.get('cost_cr', 5000):,} Cr",
                    "health": 100 - demo.get("risk_score", 40),
                    "sanctioned_cost": demo.get("cost_cr", 5000),
                }
            else:
                card = {
                    "id": pid,
                    "project_id": pid,
                    "name": f"Civil Package Project ({pid})",
                    "sector": "Roads & Highways",
                    "state": "Maharashtra",
                    "status": "On Track",
                    "physicalProgress": 55.0,
                    "financialProgress": 50.0,
                    "health": 85.0,
                }
        card["contractor"] = c
        card["geofence"] = geofence
        res.append(card)
    return res


@app.get("/api/projects/{project_id}/geofence")
def project_geofence(project_id: str):
    p_row = q("SELECT state FROM projects WHERE project_id = ?", params=[project_id])
    state = str(p_row.iloc[0]["state"]) if not p_row.empty else "Maharashtra"
    return mock_data.geofence_for_project(project_id, state=state)


@app.post("/api/contractor/submit-progress")
async def contractor_submit_progress(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    contractor_id: str = Form(...),
    physical_progress_pct: Optional[float] = Form(None),
    financial_expenditure_cr: Optional[float] = Form(None),
    notes: Optional[str] = Form(""),
    gps_lat: Optional[float] = Form(None),
    gps_lng: Optional[float] = Form(None),
    captured_at: Optional[str] = Form(None),
):
    _ensure_verification_schema()
    _ensure_contractor_schema()

    p_row = q("SELECT state FROM projects WHERE project_id = ?", params=[project_id])
    state = str(p_row.iloc[0]["state"]) if not p_row.empty else "Maharashtra"
    geofence = mock_data.geofence_for_project(project_id, state=state)

    ext = Path(file.filename or "site.jpg").suffix.lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}:
        raise HTTPException(415, "unsupported image type - use JPEG/PNG/WebP")

    sub_id = f"SUB-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')[:17]}"
    safe_name = f"{sub_id}_{project_id.replace('/', '_')}{ext}"
    target = UPLOAD_DIR / safe_name
    with target.open("wb") as fh:
        shutil.copyfileobj(file.file, fh)

    result = verification.verify_image(
        target,
        project_lat=geofence["center_lat"],
        project_lng=geofence["center_lng"],
        boundary_polygon=geofence["boundary_lamina"],
        max_distance_km=geofence.get("radius_km", 3.5),
        client_lat=gps_lat,
        client_lng=gps_lng,
        captured_at=captured_at,
    )

    is_inside = (result["status"] == "accepted")
    counts_towards_progress = 1 if is_inside else 0

    updated_progress = None
    if is_inside and physical_progress_pct is not None:
        conn = sqlite3.connect(DB)
        try:
            conn.execute("""
            UPDATE project_snapshots
            SET physical_progress_pct = ?,
                cumulative_expenditure = COALESCE(?, cumulative_expenditure)
            WHERE project_id = ? AND month = 'July'
            """, (physical_progress_pct, financial_expenditure_cr, project_id))
            conn.commit()
            updated_progress = physical_progress_pct
        finally:
            conn.close()

    conn = sqlite3.connect(DB)
    try:
        conn.execute("""
        INSERT INTO contractor_progress_reports
        (submission_id, project_id, contractor_id, physical_progress_pct, financial_expenditure_cr, notes, photo_url, gps_lat, gps_lng, inside_geofence, verification_status, counts_towards_progress, submitted_at, details_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            sub_id, project_id, contractor_id,
            physical_progress_pct, financial_expenditure_cr, notes,
            f"/uploads/{safe_name}",
            result.get("gps", {}).get("lat") if result.get("gps") else gps_lat,
            result.get("gps", {}).get("lng") if result.get("gps") else gps_lng,
            1 if is_inside else 0,
            result["status"],
            counts_towards_progress,
            result["submitted_at"],
            json.dumps(result),
        ))
        conn.execute("""
        INSERT INTO verification_records
        (file_name, upload_path, project_id, submitted_at, status, result_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            file.filename or safe_name, safe_name, project_id,
            result["submitted_at"], result["status"], json.dumps(result),
        ))
        conn.commit()
    finally:
        conn.close()

    dist_val = result.get("distance_km")
    dist_str = f"{dist_val:.2f} km" if dist_val is not None else "on-site"
    msg = (
        f"Verified inside construction area ({dist_str} to site center). Progress successfully credited to project!"
        if is_inside
        else f"GEOFENCE VIOLATION: Photo coordinates fall outside the designated construction area lamina. This report does NOT count!"
    )

    return {
        "submission_id": sub_id,
        "project_id": project_id,
        "contractor_id": contractor_id,
        "status": result["status"],
        "counts": bool(counts_towards_progress),
        "inside_geofence": is_inside,
        "message": msg,
        "verification": result,
        "photo_url": f"/uploads/{safe_name}",
        "physical_progress_pct": updated_progress if updated_progress is not None else physical_progress_pct,
        "geofence": geofence,
    }


@app.get("/api/contractor/{contractor_id}/submissions")
def contractor_submissions(contractor_id: str, limit: int = 50):
    _ensure_contractor_schema()
    conn = sqlite3.connect(DB)
    try:
        df = pd.read_sql("""
        SELECT * FROM contractor_progress_reports
        WHERE contractor_id = ?
        ORDER BY id DESC LIMIT ?
        """, conn, params=[contractor_id, limit])
        return df.to_dict("records")
    finally:
        conn.close()



# ---------------------------------------------------------------------------
# React frontend (built dashboard + /map SPA). Additive — every /api and
# /uploads route above keeps priority. Falls back to the legacy static
# dashboard when frontend/dist is absent (e.g. API-only deployments).
# ---------------------------------------------------------------------------
FRONTEND_DIST = Path("frontend/dist")


def _frontend_index() -> Path:
    candidate = FRONTEND_DIST / "index.html"
    return candidate if candidate.is_file() else Path("static/index.html")


def _spa_response(target: Path) -> FileResponse:
    resp = FileResponse(target)
    # SPA reads live DOM + API each load; never serve stale copies.
    resp.headers["Cache-Control"] = "no-store"
    return resp


if (FRONTEND_DIST / "assets").is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIST / "assets")),
        name="frontend-assets",
    )


@app.get("/{full_path:path}", include_in_schema=False)
async def spa(full_path: str):
    if FRONTEND_DIST.is_dir():
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return _spa_response(candidate)
        return _spa_response(_frontend_index())
    return _spa_response(_frontend_index())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))