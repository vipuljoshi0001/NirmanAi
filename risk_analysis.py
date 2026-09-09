"""Step 5 layer: model-based risk scores, SHAP interpretability, early warnings.

Run after build_database.py and train_models.py. Writes model_risk_scores,
adds model_high_risk warnings, saves SHAP figures.
"""
import sqlite3

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import xgboost as xgb
import shap

import train_models as T

DB = "project_monitoring.db"


def get_conn():
    conn = sqlite3.connect(DB)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def risk_level(x):
    if x >= 80:
        return "Critical"
    if x >= 60:
        return "High"
    if x >= 40:
        return "Medium"
    return "Low"


def main():
    conn = get_conn()
    feats = pd.read_sql("SELECT * FROM project_features", conn)
    if feats.empty:
        raise SystemExit("project_features empty -- run build_database.py first")

    # --- load trained models & score every (project, snapshot) row --------
    cop = xgb.XGBClassifier()
    cop.load_model("cop_model.json")
    top = xgb.XGBClassifier()
    top.load_model("top_model.json")

    X = feats[T.FEATURES].astype(float)
    cop_prob = cop.predict_proba(X)[:, 1]
    top_prob = top.predict_proba(X)[:, 1]
    model_score = 100 * 0.5 * (cop_prob + top_prob)

    rule = pd.read_sql("SELECT project_id, snapshot_id, risk_score FROM risk_scores", conn) \
        .set_index("snapshot_id")["risk_score"].reindex(feats["snapshot_id"]).to_numpy()
    final = np.clip(0.5 * model_score + 0.5 * rule, 0, 100)

    mrs = pd.DataFrame({
        "project_id": feats["project_id"],
        "snapshot_id": feats["snapshot_id"],
        "month": feats["month"],
        "cop_prob": np.round(cop_prob, 4),
        "top_prob": np.round(top_prob, 4),
        "model_risk_score": np.round(model_score, 1),
        "rule_risk_score": np.round(rule, 1),
        "final_risk_score": np.round(final, 1),
        "risk_level": [risk_level(v) for v in final],
    })
    mrs.to_sql("model_risk_scores", conn, if_exists="replace", index=False)

    # --- model_high_risk warnings (final >= 70) ---------------------------
    trig = mrs[mrs["final_risk_score"] >= 70]
    existing = pd.read_sql("SELECT * FROM early_warnings", conn)
    add = pd.DataFrame({
        "project_id": trig["project_id"],
        "snapshot_id": trig["snapshot_id"],
        "month": trig["month"],
        "warning_type": "model_high_risk",
        "severity": "High",
        "signal_value": trig["final_risk_score"],
    })
    merged = pd.concat([existing, add], ignore_index=True)
    merged.to_sql("early_warnings", conn, if_exists="replace", index=False)

    print("Scored model_risk_scores:", len(mrs), "| model_high_risk triggers:", len(add))

    # --- top risk summary --------------------------------------------------
    top = mrs.sort_values("final_risk_score", ascending=False).head(8)
    show = top.merge(feats[["snapshot_id", "sector", "state", "cost_overrun_to_date_pct"]],
                     on="snapshot_id", how="left")
    print("\n--- Top-risk (project, snapshot) rows ---")
    print(show[["project_id", "month", "sector", "state",
                "risk_level", "final_risk_score"]].to_string(index=False))

    # --- SHAP (TreeExplainer on the COP model) ------------------------------
    print("\nComputing SHAP on the COP model...")
    explainer = shap.TreeExplainer(cop)
    sh = explainer.shap_values(X)
    if isinstance(sh, list):
        sh = np.array(sh[1]) if len(sh) > 1 else np.array(sh[0])

    Xc = X.copy()
    plt.figure(figsize=(10, 7))
    shap.summary_plot(sh, Xc, show=False)
    plt.tight_layout()
    plt.savefig("shap_beeswarm_cop.png", dpi=120, bbox_inches="tight")
    plt.close()

    mean_abs = np.abs(sh).mean(axis=0)
    imp = pd.Series(mean_abs, index=T.FEATURES).sort_values(ascending=False)
    plt.figure(figsize=(8, 6))
    imp.plot.bar()
    plt.title("Mean |SHAP| - COP model")
    plt.ylabel("mean |SHAP value|")
    plt.tight_layout()
    plt.savefig("shap_importance_bar_cop.png", dpi=120, bbox_inches="tight")
    plt.close()

    print("\n--- Global feature importance (mean |SHAP|) ---")
    print(imp.round(3).to_string())

    # per-project explanation for the single top-risk snapshot
    top_id = mrs.sort_values("final_risk_score", ascending=False).iloc[0]["snapshot_id"]
    ridx = X.index[feats["snapshot_id"] == top_id][0]
    print(f"\n--- Per-project SHAP for top-risk snapshot {top_id} ---")
    for name, val in zip(T.FEATURES, sh[ridx]):
        if abs(val) > 0.05:
            print(f"  {name:<26} {val:+.3f}")

    conn.close()


if __name__ == "__main__":
    main()