"""End-to-end tests: DB integrity, scoring engine, API, baseline fidelity."""
import sqlite3

import pandas as pd
from fastapi.testclient import TestClient

import api
import scoring

DB = "project_monitoring.db"
PASS = 0


def check(name, cond):
    global PASS
    assert cond, f"FAILED: {name}"
    PASS += 1
    print(f"  PASS {name}")


def main():
    conn = sqlite3.connect(DB)
    tables = pd.read_sql("SELECT name FROM sqlite_master WHERE type='table'", conn)["name"].tolist()
    expected = ["sector_baselines", "state_baselines", "state_monthly_trends",
                "national_monthly_trends", "progress_buckets", "projects",
                "project_snapshots", "project_features", "risk_scores",
                "early_warnings", "model_risk_scores"]
    check("all 11 tables exist", all(t in tables for t in expected))

    n_proj = pd.read_sql("SELECT COUNT(*) c FROM projects", conn)["c"][0]
    check(">=300 projects", n_proj >= 300)
    n_snap = pd.read_sql("SELECT COUNT(*) c FROM project_snapshots", conn)["c"][0]
    # Synthetic projects carry a full 6-month history (Feb-Jul); projects added at
    # runtime via POST /api/projects start with a single snapshot, so the total is
    # >= projects*6 rather than exactly equal. Verify the shape directly instead.
    snap_counts = pd.read_sql(
        "SELECT project_id, COUNT(*) c FROM project_snapshots GROUP BY project_id",
        conn)["c"]
    check("every project has 1..6 snapshots",
          bool(((snap_counts >= 1) & (snap_counts <= 6)).all()))
    check(">=300 projects have full 6-month history", int((snap_counts == 6).sum()) >= 300)
    check("snapshot total == sum of per-project counts", n_snap == int(snap_counts.sum()))

    sec = pd.read_sql("SELECT COUNT(*) c FROM sector_baselines", conn)["c"][0]
    sta = pd.read_sql("SELECT COUNT(*) c FROM state_baselines", conn)["c"][0]
    check("22 real sectors", sec == 22)
    check("36 real states", sta == 36)

    nat = pd.read_sql("SELECT COUNT(*) c FROM national_monthly_trends", conn)["c"][0]
    check("6 national trend rows", nat == 6)

    # baseline fidelity: National July overrun ~10.1%
    july = pd.read_sql("SELECT national_cost_overrun_pct FROM national_monthly_trends "
                       "WHERE month='July'", conn)["national_cost_overrun_pct"][0]
    check("national July overrun ~10.1", abs(july - 10.1) < 0.05)

    # stalled calibration: real July 0-10 share ~13.2%, synthetic final close
    phys = pd.read_sql("SELECT * FROM progress_buckets WHERE month='July'", conn)
    real_stall = phys.loc[phys.progress_bucket == "0-10", "project_count"].sum() / phys["project_count"].sum()
    snaps = pd.read_sql("SELECT * FROM project_snapshots WHERE month='July'", conn)
    synth_stall = (snaps["physical_progress_pct"] < 10).mean()
    check(f"stalled share calibrated ({synth_stall*100:.1f}% vs real {real_stall*100:.1f}%)",
          abs(synth_stall - real_stall) < 0.05)

    # --- scoring engine ---
    eng = scoring.ScoreEngine()
    pid = pd.read_sql("SELECT project_id FROM projects LIMIT 1", conn)["project_id"][0]
    sc = eng.score_project(pid)
    check("score_project returns risk_level", sc and sc["risk_level"] in
          ("Low", "Medium", "High", "Critical"))
    check("score_project has SHAP drivers", len(sc["shap_drivers"]) == 5)
    check("score_project has warnings list", isinstance(sc["warnings"], list))

    tl = eng.timeline(pid)
    check("timeline has 6 snapshots", len(tl) == 6)

    # --- API ---
    client = TestClient(api.app)
    check("GET /api/health", client.get("/api/health").json()["status"] == "connected")
    check("GET /", client.get("/").status_code == 200)
    check("GET /api/projects", len(client.get("/api/projects").json()) == n_proj)
    check("GET /api/trends/national", len(client.get("/api/trends/national").json()) == 6)
    check("GET /api/baselines/sectors", len(client.get("/api/baselines/sectors").json()) == 22)
    check("GET /api/baselines/states", len(client.get("/api/baselines/states").json()) == 36)
    check("GET project detail", client.get(f"/api/projects/{pid}").status_code == 200)
    check("GET unknown project -> 404", client.get("/api/projects/PRJ-XXXX").status_code == 404)
    check("GET /api/warnings", len(client.get("/api/warnings").json()) > 0)

    # national trend via API is chronological
    nat_api = client.get("/api/trends/national").json()
    check("national trend chronological",
          [r["month"] for r in nat_api] == ["Feb", "March", "April", "May", "June", "July"])
    conn.close()
    print(f"\nALL {PASS} CHECKS PASSED")


if __name__ == "__main__":
    main()