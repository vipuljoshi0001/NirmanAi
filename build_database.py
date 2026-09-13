"""Build project_monitoring.db from real baselines + synthetic project data.

Run order: generate_synthetic_projects.py -> build_database.py
Idempotent: drops & recreates derived tables, INSERT OR REPLACE real tables.
"""
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd

DB = Path("project_monitoring.db")
SCHEMA = Path("schema.sql")


def connect():
    conn = sqlite3.connect(DB)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))
    return conn


def load_baselines(conn):
    # --- sector_baselines (real) ---
    sec = pd.read_csv("sector_baselines_clean.csv")
    sec["avg_cost_overrun_pct"] = sec["cost_overrun_pct"]
    sec["avg_expenditure"] = sec["latest_expenditure"] / sec["project_count"].replace(0, np.nan)
    sec_clean = sec[["sector", "rank", "project_count", "latest_expenditure",
                     "original_cost", "anticipated_cost",
                     "avg_cost_overrun_pct", "avg_expenditure"]]
    sec_clean.to_sql("sector_baselines", conn, if_exists="replace", index=False)
    # re-apply schema (replace drops the FK definition)
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))

    # --- state_baselines (real, July snapshot as point-in-time baseline) ---
    st = pd.read_csv("state_report_tidy.csv")
    july = st[st["month"] == "July"].copy()
    state_base = july[["state", "project_count", "cost_overrun_pct"]].rename(
        columns={"cost_overrun_pct": "avg_cost_overrun_pct"})
    state_base.to_sql("state_baselines", conn, if_exists="replace", index=False)
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))

    # --- state_monthly_trends (real, NEW table) ---
    st[["state", "month", "project_count", "original_cost_cr",
        "revised_cost_cr", "expenditure_cr", "cost_overrun_pct"]].to_sql(
        "state_monthly_trends", conn, if_exists="replace", index=False)
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))

    # --- national_monthly_trends (real, NEW table) ---
    nat = pd.read_csv("cost_overview_tidy.csv")
    nat[["month", "original_cost_cr", "revised_cost_cr",
         "cumulative_expenditure_cr", "national_cost_overrun_pct"]].to_sql(
        "national_monthly_trends", conn, if_exists="replace", index=False)
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))

    # --- progress_buckets (real) ---
    phys = pd.read_csv("physical_progress_tidy.csv")
    phys[["month", "progress_bucket", "project_count", "original_cost_cr",
          "revised_cost_cr", "expenditure_cr", "cost_overrun_pct"]].to_sql(
        "progress_buckets", conn, if_exists="replace", index=False)
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))

    print(f"Loaded REAL tables: "
          f"{'sector_baselines':>22} {len(sec_clean):>5} rows, "
          f"state_baselines {len(state_base):>5}, "
          f"state_monthly_trends {len(st):>5}, "
          f"national_monthly_trends {len(nat):>5}, "
          f"progress_buckets {len(phys):>5}")


def load_synthetic(conn):
    proj = pd.read_csv("synthetic_projects_master.csv")
    snap = pd.read_csv("synthetic_project_timeline.csv")
    proj.to_sql("projects", conn, if_exists="replace", index=False)
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))
    snap.to_sql("project_snapshots", conn, if_exists="replace", index=False)
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))
    print(f"Loaded SYNTHETIC: projects {len(proj)}, snapshots {len(snap)}")


def build_features(conn):
    proj = pd.read_sql("SELECT * FROM projects", conn)
    snap = pd.read_sql("SELECT * FROM project_snapshots", conn)
    sec = pd.read_sql("SELECT sector, avg_cost_overrun_pct FROM sector_baselines", conn)
    sta = pd.read_sql("SELECT state, avg_cost_overrun_pct FROM state_baselines", conn)

    snap["snapshot_date"] = pd.to_datetime(snap["snapshot_date"])
    proj["sanctioned_date"] = pd.to_datetime(proj["sanctioned_date"])
    feats = snap.merge(
        proj[["project_id", "sector", "state", "sanctioned_date", "duration_months"]],
        on="project_id", how="left")

    months_elapsed = ((feats["snapshot_date"] - feats["sanctioned_date"])
                      .dt.days / 30.44)
    feats["expected_physical_pct"] = np.clip(100 * months_elapsed / feats["duration_months"], 0, 100)
    feats["financial_physical_gap"] = (
        feats["financial_progress_pct"] - feats["physical_progress_pct"]).round(3)
    feats["physical_schedule_gap"] = (
        feats["physical_progress_pct"] - feats["expected_physical_pct"]).round(3)
    feats["expenditure_rate"] = (
        feats["cumulative_expenditure"] / feats["revised_cost"].replace(0, np.nan) * 100).round(3)
    feats["snapshot_id"] = feats["project_id"] + "|" + feats["month"]

    # Normalize common sector aliases
    sector_map = {"Urban Transport": "Urban Public Transport", "Power & RE": "Electricity Generation"}
    feats["sector"] = feats["sector"].replace(sector_map)

    feats = feats.merge(sec.rename(columns={"avg_cost_overrun_pct": "sector_risk_baseline"}),
                        on="sector", how="left")
    feats = feats.merge(sta.rename(columns={"avg_cost_overrun_pct": "state_risk_baseline"}),
                        on="state", how="left")
    feats["sector_risk_baseline"] = feats["sector_risk_baseline"].fillna(8.0).round(3)
    feats["state_risk_baseline"] = feats["state_risk_baseline"].fillna(5.0).round(3)

    feats["prior_risk"] = (0.6 * feats["state_risk_baseline"] + 0.4 * feats["sector_risk_baseline"]).round(3)
    feats["cost_vs_prior"] = (feats["cost_overrun_to_date_pct"].fillna(0.0) - feats["prior_risk"]).round(3)
    feats["expected_slip"] = np.maximum(0.0, feats["cost_overrun_to_date_pct"].fillna(0.0) * 0.35 + (100.0 - feats["physical_progress_pct"].fillna(30.0)) * 0.12).round(3)
    feats["slip_vs_expected"] = (feats["schedule_slip_months"].fillna(0.0) - feats["expected_slip"]).round(3)
    feats["rem_work"] = np.maximum(0.0, 100.0 - feats["physical_progress_pct"].fillna(30.0)).round(3)
    feats["burn_ratio"] = (feats["financial_progress_pct"].fillna(35.0) / np.maximum(1.0, feats["physical_progress_pct"].fillna(30.0))).round(3)

    out_cols = ["project_id", "sector", "state", "month", "snapshot_id",
                "physical_progress_pct", "financial_progress_pct",
                "cost_overrun_to_date_pct", "schedule_slip_months",
                "financial_physical_gap", "expected_physical_pct",
                "physical_schedule_gap", "expenditure_rate",
                "sector_risk_baseline", "state_risk_baseline",
                "prior_risk", "cost_vs_prior", "expected_slip",
                "slip_vs_expected", "rem_work", "burn_ratio"]
    feats[out_cols].to_sql("project_features", conn, if_exists="replace", index=False)
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))
    print(f"Derived: project_features {len(feats)} rows")


def build_risk_and_warnings(conn):
    feats = pd.read_sql("SELECT * FROM project_features", conn)

    feats["cost_risk"] = np.clip(30 + feats["cost_overrun_to_date_pct"] * 0.7, 0, 100)
    feats["schedule_risk"] = np.clip(20 + feats["schedule_slip_months"] * 3.0, 0, 100)
    feats["progress_risk"] = np.clip(
        20 + (-feats["physical_schedule_gap"] * 0.6)
        + (-feats["financial_physical_gap"] * 1.2), 0, 100)
    feats["risk_score"] = (
        0.45 * feats["cost_risk"] + 0.35 * feats["schedule_risk"]
        + 0.20 * feats["progress_risk"]).round(1)

    def level(x):
        if x >= 80:
            return "Critical"
        if x >= 60:
            return "High"
        if x >= 40:
            return "Medium"
        return "Low"

    feats["risk_level"] = feats["risk_score"].apply(level)
    feats[["project_id", "snapshot_id", "month", "cost_risk", "schedule_risk",
           "progress_risk", "risk_score", "risk_level"]].to_sql(
        "risk_scores", conn, if_exists="replace", index=False)
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))

    warnings = []
    for _, r in feats.iterrows():
        pid, sid, mon = r["project_id"], r["snapshot_id"], r["month"]
        if r["schedule_slip_months"] > 6:
            warnings.append((pid, sid, mon, "schedule_slip", "High", r["schedule_slip_months"]))
        elif r["schedule_slip_months"] > 0:
            warnings.append((pid, sid, mon, "schedule_slip", "Medium", r["schedule_slip_months"]))
        if abs(r["financial_physical_gap"]) > 15:
            warnings.append((pid, sid, mon, "financial_physical_gap", "High", r["financial_physical_gap"]))
        elif abs(r["financial_physical_gap"]) > 8:
            warnings.append((pid, sid, mon, "financial_physical_gap", "Medium", r["financial_physical_gap"]))
        if r["cost_overrun_to_date_pct"] > 20:
            warnings.append((pid, sid, mon, "cost_overrun_breach", "High", r["cost_overrun_to_date_pct"]))
        elif r["cost_overrun_to_date_pct"] > 10:
            warnings.append((pid, sid, mon, "cost_overrun_breach", "Medium", r["cost_overrun_to_date_pct"]))
        if r["physical_schedule_gap"] < -20:
            warnings.append((pid, sid, mon, "behind_schedule", "High", r["physical_schedule_gap"]))
        elif r["physical_schedule_gap"] < -10:
            warnings.append((pid, sid, mon, "behind_schedule", "Medium", r["physical_schedule_gap"]))
        if r["physical_progress_pct"] < 10 and mon == "July":
            warnings.append((pid, sid, mon, "stalled", "High", r["physical_progress_pct"]))
        if r["sector_risk_baseline"] and r["sector_risk_baseline"] > 25:
            warnings.append((pid, sid, mon, "high_overrun_sector", "Medium", r["sector_risk_baseline"]))
        if r["state_risk_baseline"] and r["state_risk_baseline"] > 25:
            warnings.append((pid, sid, mon, "high_overrun_state", "Medium", r["state_risk_baseline"]))

    wdf = pd.DataFrame(warnings, columns=["project_id", "snapshot_id", "month",
                                          "warning_type", "severity", "signal_value"])
    wdf.to_sql("early_warnings", conn, if_exists="replace", index=False)
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))
    print(f"Derived: risk_scores {len(feats)} rows, early_warnings {len(wdf)} rows")


def main():
    conn = connect()
    load_baselines(conn)
    load_synthetic(conn)
    build_features(conn)
    build_risk_and_warnings(conn)

    # quick provenance demo
    print("\n--- Provenance check ---")
    row = pd.read_sql(
        "SELECT state, month, cost_overrun_pct FROM state_monthly_trends "
        "WHERE state='Maharashtra' ORDER BY month", conn)
    print("REAL Maharashtra monthly overrun:\n", row.round(2).to_string(index=False))
    n = pd.read_sql("SELECT * FROM national_monthly_trends ORDER BY month", conn)
    print("\nREAL national monthly overrun:\n", n.round(2).to_string(index=False))
    r = pd.read_sql("SELECT risk_level, COUNT(*) c FROM risk_scores GROUP BY risk_level", conn)
    print("\nDERIVED risk levels:\n", r.to_string(index=False))
    print("\nDB total tables:", len(pd.read_sql("SELECT name FROM sqlite_master WHERE type='table'", conn)))
    conn.close()


if __name__ == "__main__":
    main()