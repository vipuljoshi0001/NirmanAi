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

BASE_FEATURES = [
    "physical_progress_pct", "financial_progress_pct",
    "cost_overrun_to_date_pct", "schedule_slip_months",
    "financial_physical_gap", "expected_physical_pct",
    "physical_schedule_gap", "expenditure_rate",
    "sector_risk_baseline", "state_risk_baseline",
]

ENGINEERED_FEATURES = [
    "prior_risk", "cost_vs_prior", "expected_slip",
    "slip_vs_expected", "rem_work", "burn_ratio",
]

FEATURES = BASE_FEATURES + ENGINEERED_FEATURES
REAL_FEATURES = ["sector_risk_baseline", "state_risk_baseline", "prior_risk", "cost_vs_prior"]

MONTHS = ["Feb", "March", "April", "May", "June", "July"]


def get_conn():
    return sqlite3.connect("project_monitoring.db")


def compute_engineered_features(df):
    """Derive domain features: geographic-sectoral prior risk, overrun divergence,

    theoretical schedule slip, slip residual, remaining work, and expenditure velocity ratio.
    """
    out = df.copy()
    out["sector_risk_baseline"] = out["sector_risk_baseline"].fillna(8.0)
    out["state_risk_baseline"] = out["state_risk_baseline"].fillna(5.0)
    sec = out["sector_risk_baseline"]
    sta = out["state_risk_baseline"]
    overrun = out["cost_overrun_to_date_pct"].fillna(0.0)
    phys = out["physical_progress_pct"].fillna(30.0)
    fin = out["financial_progress_pct"].fillna(35.0)
    slip = out["schedule_slip_months"].fillna(0.0)

    out["prior_risk"] = (0.6 * sta + 0.4 * sec).round(3)
    out["cost_vs_prior"] = (overrun - out["prior_risk"]).round(3)
    out["expected_slip"] = np.maximum(0.0, overrun * 0.35 + (100.0 - phys) * 0.12).round(3)
    out["slip_vs_expected"] = (slip - out["expected_slip"]).round(3)
    out["rem_work"] = np.maximum(0.0, 100.0 - phys).round(3)
    out["burn_ratio"] = (fin / np.maximum(1.0, phys)).round(3)
    return out


def add_reporting_noise(df):
    out = df.copy()
    out["physical_progress_pct"] += RNG.normal(0, 6, len(out))
    out["financial_progress_pct"] += RNG.normal(0, 6, len(out))
    out["expenditure_rate"] += RNG.normal(0, 8, len(out))
    out["schedule_slip_months"] += RNG.normal(0, 1.5, len(out))
    return compute_engineered_features(out)


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


def xgb_model_cop():
    return xgb.XGBClassifier(
        n_estimators=320, max_depth=4, learning_rate=0.035,
        subsample=0.8, colsample_bytree=0.8,
        reg_alpha=0.5, reg_lambda=2.0,
        eval_metric="logloss", random_state=42, verbosity=0
    )


def xgb_model_top():
    return xgb.XGBClassifier(
        n_estimators=400, max_depth=4, learning_rate=0.04,
        subsample=0.85, colsample_bytree=0.85,
        reg_alpha=0.3, reg_lambda=1.5,
        eval_metric="logloss", random_state=42, verbosity=0
    )


def xgb_model():
    return xgb_model_cop()


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
    feats = compute_engineered_features(feats)
    return feats


def main():
    feats = build_frame()
    groups = feats["project_id"]

    print("=" * 72)
    print("COP / TOP FINE-TUNED MODEL TRAINING  (rows = (project, snapshot) feature rows)")
    print(f"Features ({len(FEATURES)}): {', '.join(FEATURES)}")
    print("=" * 72)

    results = {}
    for label in ["COP", "TOP"]:
        ycol = "y_cop" if label == "COP" else "y_top"
        y = feats[ycol]
        model_fn = xgb_model_cop if label == "COP" else xgb_model_top
        for setting in ["idealized", "noisy"]:
            X = feats if setting == "idealized" else add_reporting_noise(feats)
            X = X[FEATURES].astype(float).fillna(0.0)
            for feat_set, name in [(FEATURES, "with baselines"),
                                   ([f for f in FEATURES if f not in REAL_FEATURES],
                                    "without baselines")]:
                Xs = X[feat_set]
                auc_lr = cv_auc(Xs, y, groups, lr_model)
                auc_xgb = cv_auc(Xs, y, groups, model_fn)
                results[(label, setting, name)] = (auc_lr, auc_xgb)
                print(f"{label:>3} {setting:>10} {name:>18}: "
                      f"LR AUC {auc_lr:.3f} | XGB AUC {auc_xgb:.3f}")

    print("\n--- Noisy-setting gain from the REAL baseline features ---")
    for label in ["COP", "TOP"]:
        wl = results[(label, "noisy", "with baselines")]
        wo = results[(label, "noisy", "without baselines")]
        print(f"{label}: LR +{wl[0]-wo[0]:+.3f}  XGB +{wl[1]-wo[1]:+.3f}")

    # --- fit final fine-tuned XGBoost models and save ---
    Xn = add_reporting_noise(feats)[FEATURES].astype(float).fillna(0.0)
    m_cop = xgb_model_cop()
    m_cop.fit(Xn, feats["y_cop"])
    m_cop.save_model("cop_model.json")
    print("\nSaved fine-tuned cop_model.json")

    m_top = xgb_model_top()
    m_top.fit(Xn, feats["y_top"])
    m_top.save_model("top_model.json")
    print("Saved fine-tuned top_model.json")

    imp = pd.Series(m_cop.feature_importances_, index=FEATURES).sort_values(ascending=False)
    print("\n--- XGBoost feature importance (COP, fine-tuned) ---")
    print(imp.round(3).to_string())

    imp_t = pd.Series(m_top.feature_importances_, index=FEATURES).sort_values(ascending=False)
    print("\n--- XGBoost feature importance (TOP, fine-tuned) ---")
    print(imp_t.round(3).to_string())


if __name__ == "__main__":
    main()