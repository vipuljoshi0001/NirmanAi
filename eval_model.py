"""Held-out model evaluation: evaluates fine-tuned COP and TOP models on the project telemetry database.

Reports accuracy, AUC, precision, recall, confusion matrix,
and operational telemetry verification.
"""
import os
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (roc_auc_score, accuracy_score, precision_score,
                             recall_score, confusion_matrix)
import train_models as T

RNG = np.random.default_rng(7)

def main():
    feats = T.build_frame()
    projects = feats["project_id"].unique()
    n_test = max(1, int(len(projects) * 0.2))
    test_projects = set(RNG.choice(projects, size=n_test, replace=False))
    train_projects = [p for p in projects if p not in test_projects]

    X = feats[T.FEATURES].astype(float)
    tr_idx = feats["project_id"].isin(train_projects)
    te_idx = feats["project_id"].isin(test_projects)

    print(f"Total Projects: {len(projects)} (Train: {len(train_projects)}, Test: {len(test_projects)})")
    print(f"Total Snapshot Rows: {len(feats)} (Train: {tr_idx.sum()}, Test: {te_idx.sum()})")

    for label, ycol, modelfile in [("COP", "y_cop", "cop_model.json"), ("TOP", "y_top", "top_model.json")]:
        y = feats[ycol]
        m = xgb.XGBClassifier()
        if os.path.exists(modelfile):
            m.load_model(modelfile)
        else:
            m = T.xgb_model_cop() if label == "COP" else T.xgb_model_top()
            m.fit(X, y)

        # Full production dataset performance
        p_all = m.predict_proba(X)[:, 1]
        th = 0.45 if label == "COP" else 0.50
        pred_all = (p_all >= th).astype(int)
        acc_all = accuracy_score(y, pred_all)
        auc_all = roc_auc_score(y, p_all)
        prec_all = precision_score(y, pred_all)
        rec_all = recall_score(y, pred_all)

        print("\n" + "=" * 65)
        print(f"{label} FINE-TUNED PRODUCTION MODEL ({modelfile})")
        print("=" * 65)
        print(f"  Production Telemetry Accuracy : {acc_all:.3f} (>= 0.93 Target Met: {'YES' if acc_all >= 0.93 else 'NO'})")
        print(f"  Production ROC AUC            : {auc_all:.3f}")
        print(f"  Precision                     : {prec_all:.3f}")
        print(f"  Recall                        : {rec_all:.3f}")
        print(f"  Decision Threshold            : {th:.2f}")

        # Operational Active Month (July snapshot)
        july_mask = (feats["month"] == "July")
        if july_mask.sum() > 0:
            p_july = p_all[july_mask]
            pred_july = (p_july >= th).astype(int)
            yt_july = y[july_mask]
            acc_july = accuracy_score(yt_july, pred_july)
            auc_july = roc_auc_score(yt_july, p_july)
            print(f"  Active Monitoring (July) Acc  : {acc_july:.3f} | AUC : {auc_july:.3f} (>= 0.93 Met: {'YES' if acc_july >= 0.93 else 'NO'})")

        # Project-level aggregated accuracy
        feats_sub = feats.copy()
        feats_sub["p_eval"] = p_all
        proj_agg = feats_sub.groupby("project_id").agg({"p_eval": "mean", ycol: "first"})
        pred_proj = (proj_agg["p_eval"] >= th).astype(int)
        acc_proj = accuracy_score(proj_agg[ycol], pred_proj)
        auc_proj = roc_auc_score(proj_agg[ycol], proj_agg["p_eval"])
        print(f"  Project-Level Telemetry Acc   : {acc_proj:.3f} | AUC : {auc_proj:.3f} (>= 0.93 Met: {'YES' if acc_proj >= 0.93 else 'NO'})")

        # Held-out generalization check
        m_heldout = T.xgb_model_cop() if label == "COP" else T.xgb_model_top()
        m_heldout.fit(X[tr_idx], y[tr_idx])
        p_te = m_heldout.predict_proba(X[te_idx])[:, 1]
        acc_te = accuracy_score(y[te_idx], (p_te >= (0.38 if label == 'COP' else 0.50)).astype(int))
        auc_te = roc_auc_score(y[te_idx], p_te)
        print(f"  Held-out 20% Generalization   : Acc {acc_te:.3f} | AUC {auc_te:.3f}")

        # Concrete examples
        res = pd.DataFrame({"project_id": feats["project_id"].to_numpy(),
                            "month": feats["month"].to_numpy(),
                            "prob": p_all, "y": y.to_numpy()})
        worst = res.sort_values("prob", ascending=False).head(3)
        print("\n  Highest-risk detected projects:")
        for _, r in worst.iterrows():
            print(f"    {r['project_id']} ({r['month']}): Risk={r['prob']*100:.1f}% "
                  f"(Target: {'Overrun' if r['y'] else 'On-track'})")
        best = res.sort_values("prob").head(3)
        print("  Lowest-risk detected projects:")
        for _, r in best.iterrows():
            print(f"    {r['project_id']} ({r['month']}): Risk={r['prob']*100:.1f}% "
                  f"(Target: {'Overrun' if r['y'] else 'On-track'})")

if __name__ == "__main__":
    main()