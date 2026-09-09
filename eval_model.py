"""Held-out model evaluation: train on 80% of projects, test on 20%.
Reports AUC, accuracy, precision/recall at the 0.5 threshold, confusion,
and concrete prediction examples. Uses the noisy reporting setting.
"""
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (roc_auc_score, accuracy_score, precision_score,
                             recall_score, confusion_matrix)
import train_models as T

RNG = np.random.default_rng(7)

feats = T.build_frame()
projects = feats["project_id"].unique()
n_test = max(1, int(len(projects) * 0.2))
test_projects = set(RNG.choice(projects, size=n_test, replace=False))
train_projects = [p for p in projects if p not in test_projects]

X = T.add_reporting_noise(feats)[T.FEATURES].astype(float)
tr_idx = feats["project_id"].isin(train_projects)
te_idx = feats["project_id"].isin(test_projects)

print(f"Projects: train {len(train_projects)}, test {len(test_projects)}")
print(f"Rows: train {tr_idx.sum()}, test {te_idx.sum()}")

for label, ycol in [("COP", "y_cop"), ("TOP", "y_top")]:
    y = feats[ycol]
    m = xgb.XGBClassifier(n_estimators=200, max_depth=4, learning_rate=0.08,
                          eval_metric="logloss", random_state=42, verbosity=0)
    m.fit(X[tr_idx], y[tr_idx])
    p = m.predict_proba(X[te_idx])[:, 1]
    pred = (p >= 0.5).astype(int)
    yt = y[te_idx]
    print("\n" + "=" * 56)
    print(f"{label} (held-out test set)")
    print("=" * 56)
    print(f"  AUC          : {roc_auc_score(yt, p):.3f}")
    print(f"  Accuracy     : {accuracy_score(yt, pred):.3f}")
    print(f"  Precision    : {precision_score(yt, pred):.3f}")
    print(f"  Recall       : {recall_score(yt, pred):.3f}")
    print(f"  Positive rate: {yt.mean():.3f}")
    print("  Confusion (TN FP / FN TP):")
    print("  " + np.array2string(confusion_matrix(yt, pred).T, separator="  "))

    # concrete examples: highest-confidence predictions
    res = pd.DataFrame({"project_id": feats.loc[te_idx, "project_id"].to_numpy(),
                        "month": feats.loc[te_idx, "month"].to_numpy(),
                        "prob": p, "y": yt.to_numpy()})
    worst = res.sort_values("prob", ascending=False).head(3)
    print("\n  Highest-risk predictions:")
    for _, r in worst.iterrows():
        print(f"    {r['project_id']} {r['month']}: P={r['prob']:.2f} "
              f"(outcome {'overrun' if r['y'] else 'no overrun'})")
    best = res.sort_values("prob").head(3)
    print("  Lowest-risk predictions:")
    for _, r in best.iterrows():
        print(f"    {r['project_id']} {r['month']}: P={r['prob']:.2f} "
              f"(outcome {'overrun' if r['y'] else 'no overrun'})")