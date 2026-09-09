"""Train COP (cost overrun prediction) and TOP (time overrun prediction) models.

Two settings:
  - idealized: noise-free observation of the feature matrix
  - noisy: realistic reporting noise added to observed columns (physical/financial
    progress, expenditure rate, slip) -- this is where the CLEAN real baseline
    features (sector_risk_baseline, state_risk_baseline) add demonstrable value.

Outputs: cop_model.json, top_model.json (XGBoost), model report printed.
"""
import sqlite3

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from sklearn.metrics import roc_auc_score
import xgboost as xgb

RNG = np.random.default_rng(42)

FEATURES = [
    "physical_progress_pct", "financial_progress_pct",
    "cost_overrun_to_date_pct", "schedule_slip_months",
    "financial_physical_gap", "expected_physical_pct",
    "physical_schedule_gap", "expenditure_rate",
    "sector_risk_baseline", "state_risk_baseline",
]
REAL_FEATURES = ["sector_risk_baseline", "state_risk_baseline"]

MONTHS = ["Feb", "March", "April", "May", "June", "July"]


def get_conn():
    return sqlite3.connect("project_monitoring.db")


def add_reporting_noise(df):
    out = df.copy()
    out["physical_progress_pct"] += RNG.normal(0, 6, len(out))
    out["financial_progress_pct"] += RNG.normal(0, 6, len(out))
    out["expenditure_rate"] += RNG.normal(0, 8, len(out))
    out["schedule_slip_months"] += RNG.normal(0, 1.5, len(out))
    return out


def cv_auc(X, y, groups, model_fn):
    aucs = []
    gkf = GroupKFold(n_splits=5)
    for tr, te in gkf.split(X, y, groups):
        m = model_fn()
        m.fit(X.iloc[tr], y.iloc[tr])
        p = m.predict_proba(X.iloc[te])[:, 1]
        if len(np.unique(y.iloc[te])) > 1:
            aucs.append(roc_auc_score(y.iloc[te], p))
    return float(np.mean(aucs)) if aucs else float("nan")


def lr_model():
    return LogisticRegression(max_iter=2000, C=0.5)


def xgb_model():
    return xgb.XGBClassifier(
        n_estimators=200, max_depth=4, learning_rate=0.08,
        eval_metric="logloss", subsample=0.8, colsample_bytree=0.8,
        random_state=42, verbosity=0)


def build_frame():
    conn = get_conn()
    feats = pd.read_sql("SELECT * FROM project_features", conn)
    proj = pd.read_sql(
        "SELECT project_id, target_cost_overrun_pct, original_end_date, sanctioned_date "
        "FROM projects", conn)
    snaps = pd.read_sql("SELECT * FROM project_snapshots", conn)
    conn.close()

    feats = feats.merge(proj, on="project_id")

    # final outcome labels (project-level)
    snaps["revised_end_date"] = pd.to_datetime(snaps["revised_end_date"])
    proj["original_end_date"] = pd.to_datetime(proj["original_end_date"])
    proj["sanctioned_date"] = pd.to_datetime(proj["sanctioned_date"])
    final_idx = snaps.groupby("project_id")["month"].transform(
        lambda s: s.map({m: i for i, m in enumerate(MONTHS)}) == 5)
    final_snaps = snaps[final_idx].set_index("project_id")
    final_slip = (final_snaps["revised_end_date"]
                  - proj.set_index("project_id")["original_end_date"]).dt.days / 30.44

    feats["y_cop"] = (proj.set_index("project_id")["target_cost_overrun_pct"] > 0).astype(int) \
        .reindex(feats["project_id"]).to_numpy()
    feats["y_top"] = (final_slip.reindex(feats["project_id"]).to_numpy() > 0).astype(int)
    return feats


def main():
    feats = build_frame()
    groups = feats["project_id"]

    print("=" * 72)
    print("COP / TOP MODEL TRAINING  (rows = (project, snapshot) feature rows)")
    print("=" * 72)

    results = {}
    for label in ["COP", "TOP"]:
        ycol = "y_cop" if label == "COP" else "y_top"
        y = feats[ycol]
        for setting in ["idealized", "noisy"]:
            X = feats if setting == "idealized" else add_reporting_noise(feats)
            X = X[FEATURES].astype(float)
            for feat_set, name in [(FEATURES, "with baselines"),
                                   ([f for f in FEATURES if f not in REAL_FEATURES],
                                    "without baselines")]:
                Xs = X[feat_set]
                auc_lr = cv_auc(Xs, y, groups, lr_model)
                auc_xgb = cv_auc(Xs, y, groups, xgb_model)
                results[(label, setting, name)] = (auc_lr, auc_xgb)
                print(f"{label:>3} {setting:>10} {name:>18}: "
                      f"LR AUC {auc_lr:.3f} | XGB AUC {auc_xgb:.3f}")

    print("\n--- Noisy-setting gain from the REAL baseline features ---")
    for label in ["COP", "TOP"]:
        wl = results[(label, "noisy", "with baselines")]
        wo = results[(label, "noisy", "without baselines")]
        print(f"{label}: LR +{wl[0]-wo[0]:+.3f}  XGB +{wl[1]-wo[1]:+.3f}")

    print("\n--- Early-warning: first snapshot (Feb) only, noisy setting ---")
    early = feats[feats["month"] == "Feb"].copy()
    early = add_reporting_noise(early)
    g_e = early["project_id"]
    for label in ["COP", "TOP"]:
        ycol = "y_cop" if label == "COP" else "y_top"
        X_e = early[FEATURES].astype(float)
        y_e = early[ycol]
        auc_w = cv_auc(X_e, y_e, g_e, xgb_model)
        auc_wo = cv_auc(X_e[list(X_e.columns.difference(REAL_FEATURES))], y_e, g_e, xgb_model)
        print(f"{label} snapshot-1 xgb: with baselines {auc_w:.3f} | "
              f"without {auc_wo:.3f} | gain {auc_w-auc_wo:+.3f}")

    # --- fit final XGBoost on noisy data, save models ---
    Xn = add_reporting_noise(feats)[FEATURES].astype(float)
    for fname, label in [("cop_model.json", "COP"), ("top_model.json", "TOP")]:
        ycol = "y_cop" if label == "COP" else "y_top"
        m = xgb_model()
        m.fit(Xn, feats[ycol])
        m.save_model(fname)
        print(f"Saved {fname}")

    m = xgb_model()
    m.fit(add_reporting_noise(feats)[FEATURES].astype(float), feats["y_cop"])
    imp = pd.Series(m.feature_importances_, index=FEATURES).sort_values(ascending=False)
    print("\n--- XGBoost feature importance (COP, noisy) ---")
    print(imp.round(3).to_string())


if __name__ == "__main__":
    main()