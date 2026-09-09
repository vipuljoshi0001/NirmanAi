"""Cost-overrun prediction module (dedicated entry point to the ML engine).

This module wraps the existing XGBoost + SHAP scoring engine in scoring.py.
It exposes cost/time-overrun (COP/TOP) modelling as a reusable library and CLI.

Usage (from project root)::

    python ml/costoverrun.py project PRJ-0001
    python ml/costoverrun.py custom --json '{"sector":"Railways","state":"Maharashtra",...}'
    python ml/costoverrun.py top --n 10
    python ml/costoverrun.py overview
    python ml/costoverrun.py report --csv cost_overrun_report.csv

Library usage::

    import ml.costoverrun as co
    result = co.predict_custom({...})
    result = co.score_project("PRJ-0001")
"""
import argparse
import json
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if os.getcwd() != str(PROJECT_ROOT):
    os.chdir(PROJECT_ROOT)

import pandas as pd  # noqa: E402
import scoring  # noqa: E402

DB = "project_monitoring.db"

def score_project(project_id, month=None):
    """Score an existing project (latest snapshot, or a specific month)."""
    return scoring.score_project(project_id, month=month)


def predict_custom(data: dict):
    """Predict cost/time overrun for a hypothetical project from raw inputs."""
    return scoring.predict_custom(data)


def top_risks(n: int = 10):
    """Return the n highest final-risk project/snapshot rows (July)."""
    if not Path(DB).exists():
        raise FileNotFoundError(f"{DB} not found - run build_database.py first")
    conn = scoring.get_engine().conn
    df = pd.read_sql(
        """SELECT m.project_id, m.month, m.cop_prob, m.top_prob,
                  m.model_risk_score, m.rule_risk_score, m.final_risk_score,
                  m.risk_level, p.sector, p.state, s.cost_overrun_to_date_pct,
                  s.schedule_slip_months
           FROM model_risk_scores m
           JOIN projects p ON p.project_id = m.project_id
           JOIN project_snapshots s ON s.project_id = m.project_id
               AND s.month = m.month
           WHERE m.month = 'July'
           ORDER BY m.final_risk_score DESC
           LIMIT ?""", conn, params=[n])
    return df.to_dict("records")


def portfolio_overview():
    """Aggregate risk-level counts across the whole portfolio (latest)."""
    if not Path(DB).exists():
        raise FileNotFoundError(f"{DB} not found - run build_database.py first")
    conn = scoring.get_engine().conn
    df = pd.read_sql(
        "SELECT risk_level, COUNT(*) AS count FROM model_risk_scores "
        "WHERE month='July' GROUP BY risk_level", conn)
    counts = {r["risk_level"]: int(r["count"]) for r in df.to_dict("records")}
    return {
        "critical": counts.get("Critical", 0),
        "high": counts.get("High", 0),
        "medium": counts.get("Medium", 0),
        "low": counts.get("Low", 0),
    }


def generate_report(out_csv: str = "cost_overrun_report.csv", top_n: int = 20):
    """Write a cost-overrun dossier (top risks + portfolio overview) to CSV."""
    overview = portfolio_overview()
    top = top_risks(top_n)
    header = {
        "report_type": "Cost Overrun Dossier",
        "source": DB,
        "critical": overview["critical"],
        "high": overview["high"],
        "medium": overview["medium"],
        "low": overview["low"],
        "top_n": len(top),
    }
    rows = []
    for key, val in header.items():
        rows.append({"field": key, "value": val, "project_id": ""})
    for r in top:
        rows.append({
            "field": "project_risk",
            "value": r["final_risk_score"],
            "project_id": r["project_id"],
            "month": r["month"],
            "sector": r["sector"],
            "state": r["state"],
            "risk_level": r["risk_level"],
            "cop_prob": r["cop_prob"],
            "top_prob": r["top_prob"],
            "cost_overrun_to_date_pct": r["cost_overrun_to_date_pct"],
            "schedule_slip_months": r["schedule_slip_months"],
        })
    df = pd.DataFrame(rows)
    df.to_csv(out_csv, index=False)
    return out_csv
# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _build_parser():
    p = argparse.ArgumentParser(
        prog="costoverrun",
        description="Cost/time overrun prediction entry point (wraps scoring.py).")
    sub = p.add_subparsers(dest="command", required=True)

    sp = sub.add_parser("project", help="Score an existing project in the DB")
    sp.add_argument("project_id")
    sp.add_argument("--month", default=None, help="Optional snapshot month")

    sc = sub.add_parser("custom", help="Score a hypothetical project from JSON")
    sc.add_argument("--json", required=True, help="Input fields as a JSON string")

    st = sub.add_parser("top", help="List top-N highest risk projects")
    st.add_argument("--n", type=int, default=10)

    sub.add_parser("overview", help="Portfolio risk-level counts")

    sr = sub.add_parser("report", help="Write a cost-overrun CSV dossier")
    sr.add_argument("--csv", default="cost_overrun_report.csv")
    sr.add_argument("--top-n", type=int, default=20)
    return p


def main(argv=None):
    args = _build_parser().parse_args(argv)

    if args.command == "project":
        res = score_project(args.project_id, month=args.month)
        if res is None:
            print(f"Unknown project: {args.project_id}")
            sys.exit(1)
        print(json.dumps(res, indent=2, default=str))

    elif args.command == "custom":
        data = json.loads(args.json)
        print(json.dumps(predict_custom(data), indent=2, default=str))

    elif args.command == "top":
        for i, r in enumerate(top_risks(args.n), 1):
            print(f"{i:>2}. {r['project_id']:<12} {r['state']:<16} {r['sector']:<24} "
                  f"final={r['final_risk_score']:>5.1f}  {r['risk_level']:<8} "
                  f"overrun={r['cost_overrun_to_date_pct']:>6.2f}%  "
                  f"slip={r['schedule_slip_months']:>5.2f}mo")

    elif args.command == "overview":
        for k, v in portfolio_overview().items():
            print(f"{k:<10} {v}")

    elif args.command == "report":
        path = generate_report(args.csv, top_n=args.top_n)
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
