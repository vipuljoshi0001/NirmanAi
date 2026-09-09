"""score_project() engine: latest-snapshot features, COP/TOP probabilities,
risk scores, SHAP drivers, active warnings."""
import sqlite3

import numpy as np
import pandas as pd
import xgboost as xgb
import shap

import train_models as T

DB = "project_monitoring.db"


def risk_level(x):
    if x >= 80:
        return "Critical"
    if x >= 60:
        return "High"
    if x >= 40:
        return "Medium"
    return "Low"


class ScoreEngine:
    def __init__(self):
        self.conn = sqlite3.connect(DB, check_same_thread=False)
        self.cop = xgb.XGBClassifier()
        self.cop.load_model("cop_model.json")
        self.top = xgb.XGBClassifier()
        self.top.load_model("top_model.json")
        self.feats = pd.read_sql("SELECT * FROM project_features", self.conn)
        self.explainer = None

    # --- helpers ---------------------------------------------------------
    def _row(self, snapshot_id):
        m = self.feats[self.feats["snapshot_id"] == snapshot_id]
        if m.empty:
            return None
        return m.iloc[0]

    def _features_df(self, rows):
        return rows[T.FEATURES].astype(float)

    def _prob(self, row_df):
        cp = float(self.cop.predict_proba(row_df)[0, 1])
        tp = float(self.top.predict_proba(row_df)[0, 1])
        return cp, tp

    def _shap_drivers(self, row_df, top_n=5):
        if self.explainer is None:
            self.explainer = shap.TreeExplainer(self.cop)
        sh = self.explainer.shap_values(row_df)
        if isinstance(sh, list):
            sh = np.array(sh[1]) if len(sh) > 1 else np.array(sh[0])
        vals = sh[0]
        idx = np.argsort(-np.abs(vals))[:top_n]
        return [{"feature": T.FEATURES[i], "shap_value": round(float(vals[i]), 3)}
                for i in idx]

    def _warnings(self, snapshot_id):
        q = ("SELECT warning_type, severity, signal_value FROM early_warnings "
             "WHERE snapshot_id=?")
        rows = pd.read_sql(q, self.conn, params=[snapshot_id])
        return rows.to_dict("records")

    # --- main entry --------------------------------------------------------
    def score_project(self, project_id, month=None):
        m = self.feats[self.feats["project_id"] == project_id]
        if m.empty:
            dyn = pd.read_sql("""
            SELECT p.project_id, p.sector, p.state, p.sanctioned_cost, p.sanctioned_date, p.original_end_date, p.duration_months,
                   s.month, s.physical_progress_pct, s.financial_progress_pct, s.cumulative_expenditure, s.revised_cost,
                   s.cost_overrun_to_date_pct, s.schedule_slip_months, s.revised_end_date,
                   m.cop_prob, m.top_prob, m.model_risk_score, m.rule_risk_score, m.final_risk_score, m.risk_level
            FROM projects p
            JOIN project_snapshots s ON p.project_id = s.project_id
            JOIN model_risk_scores m ON p.project_id = m.project_id AND s.month = m.month
            WHERE p.project_id = ?
            ORDER BY CASE s.month WHEN 'Feb' THEN 1 WHEN 'March' THEN 2 WHEN 'April' THEN 3 WHEN 'May' THEN 4 WHEN 'June' THEN 5 WHEN 'July' THEN 6 END DESC
            LIMIT 1
            """, self.conn, params=[project_id])
            if dyn.empty:
                return None
            d = dyn.iloc[0]
            pred_data = {
                "sector": d["sector"],
                "state": d["state"],
                "sanctioned_cost": d["sanctioned_cost"],
                "revised_cost": d["revised_cost"],
                "duration_months": d["duration_months"],
                "physical_progress_pct": d["physical_progress_pct"],
                "financial_progress_pct": d["financial_progress_pct"],
                "cost_overrun_to_date_pct": d["cost_overrun_to_date_pct"],
                "schedule_slip_months": d["schedule_slip_months"],
                "cumulative_expenditure": d["cumulative_expenditure"],
            }
            pred_res = self.predict_custom(pred_data)
            return {
                "project_id": project_id,
                "sector": d["sector"],
                "state": d["state"],
                "month": d["month"],
                "snapshot_id": f"{project_id}_{d['month']}",
                "physical_progress_pct": round(float(d["physical_progress_pct"]), 2),
                "financial_progress_pct": round(float(d["financial_progress_pct"]), 2),
                "cost_overrun_to_date_pct": round(float(d["cost_overrun_to_date_pct"]), 2),
                "schedule_slip_months": round(float(d["schedule_slip_months"]), 2),
                "sector_risk_baseline": pred_res["sector_risk_baseline"],
                "state_risk_baseline": pred_res["state_risk_baseline"],
                "cop_prob": round(float(d["cop_prob"]), 4),
                "top_prob": round(float(d["top_prob"]), 4),
                "model_risk_score": round(float(d["model_risk_score"]), 1),
                "rule_risk_score": round(float(d["rule_risk_score"]), 1),
                "final_risk_score": round(float(d["final_risk_score"]), 1),
                "risk_level": d["risk_level"],
                "health": max(0, min(100, round(100 - float(d["final_risk_score"]), 1))),
                "shap_drivers": pred_res["shap_drivers"],
                "warnings": pred_res["warnings"],
                "sanctioned_cost": float(d["sanctioned_cost"] or 0),
                "sanctioned_date": str(d.get("sanctioned_date") or ""),
                "original_end_date": str(d.get("original_end_date") or ""),
                "duration_months": float(d.get("duration_months") or 36),
                "cumulative_expenditure": float(d.get("cumulative_expenditure") or 0),
                "revised_cost": float(d.get("revised_cost") or 0),
                "revised_end_date": str(d.get("revised_end_date") or ""),
            }
        if month:
            m = m[m["month"] == month]
        row = m.sort_values(
            "month", key=lambda s: s.map({x: i for i, x in enumerate(T.MONTHS)})
        ).iloc[-1]

        row_df = self._features_df(row.to_frame().T)
        cop_prob, top_prob = self._prob(row_df)
        model_score = 100 * 0.5 * (cop_prob + top_prob)

        rule_df = pd.read_sql(
            "SELECT risk_score FROM risk_scores WHERE snapshot_id=?", self.conn,
            params=[row["snapshot_id"]])
        rule = float(rule_df["risk_score"].iloc[0]) if not rule_df.empty else 50.0
        final = np.clip(0.5 * model_score + 0.5 * rule, 0, 100)

        drivers = self._shap_drivers(row_df)
        warnings = self._warnings(row["snapshot_id"])

        # Fetch additional project and snapshot metadata
        p_row = pd.read_sql("SELECT sanctioned_cost, sanctioned_date, original_end_date, duration_months FROM projects WHERE project_id=?",
                            self.conn, params=[project_id])
        s_row = pd.read_sql("SELECT cumulative_expenditure, revised_cost, revised_end_date FROM project_snapshots WHERE project_id=? AND month=?",
                            self.conn, params=[project_id, row["month"]])

        p_info = p_row.iloc[0].to_dict() if not p_row.empty else {}
        s_info = s_row.iloc[0].to_dict() if not s_row.empty else {}

        return {
            "project_id": project_id,
            "sector": row["sector"],
            "state": row["state"],
            "month": row["month"],
            "snapshot_id": row["snapshot_id"],
            "physical_progress_pct": round(row["physical_progress_pct"], 2),
            "financial_progress_pct": round(row["financial_progress_pct"], 2),
            "cost_overrun_to_date_pct": round(row["cost_overrun_to_date_pct"], 2),
            "schedule_slip_months": round(row["schedule_slip_months"], 2),
            "sector_risk_baseline": round(row["sector_risk_baseline"], 2),
            "state_risk_baseline": round(row["state_risk_baseline"], 2),
            "cop_prob": round(cop_prob, 4),
            "top_prob": round(top_prob, 4),
            "model_risk_score": round(model_score, 1),
            "rule_risk_score": round(rule, 1),
            "final_risk_score": round(final, 1),
            "risk_level": risk_level(final),
            "health": max(0, min(100, round(100 - final, 1))),
            "shap_drivers": drivers,
            "warnings": warnings,
            "sanctioned_cost": p_info.get("sanctioned_cost", 0.0),
            "sanctioned_date": p_info.get("sanctioned_date", ""),
            "original_end_date": p_info.get("original_end_date", ""),
            "duration_months": p_info.get("duration_months", 0),
            "cumulative_expenditure": s_info.get("cumulative_expenditure", 0.0),
            "revised_cost": s_info.get("revised_cost", 0.0),
            "revised_end_date": s_info.get("revised_end_date", ""),
        }

    def predict_custom(self, data: dict):
        sector = data.get("sector", "Roads & Highways")
        state = data.get("state", "Maharashtra")
        dur = float(data.get("duration_months") or 36)
        elapsed = float(data.get("months_elapsed") or 12)
        phys = float(data.get("physical_progress_pct") if data.get("physical_progress_pct") is not None else 30)
        fin = float(data.get("financial_progress_pct") if data.get("financial_progress_pct") is not None else 35)
        overrun = float(data.get("cost_overrun_to_date_pct") if data.get("cost_overrun_to_date_pct") is not None else 0)
        slip = float(data.get("schedule_slip_months") if data.get("schedule_slip_months") is not None else 0)
        rev_cost = float(data.get("revised_cost") or data.get("sanctioned_cost") or 1200)
        cum_exp = float(data.get("cumulative_expenditure") if data.get("cumulative_expenditure") is not None else (rev_cost * phys / 100.0))

        expected_phys = float(np.clip(100 * elapsed / max(1, dur), 0, 100))
        fin_phys_gap = round(fin - phys, 3)
        phys_sched_gap = round(phys - expected_phys, 3)
        exp_rate = round(cum_exp / max(1, rev_cost) * 100, 3)

        sec_row = pd.read_sql("SELECT avg_cost_overrun_pct FROM sector_baselines WHERE sector=?", self.conn, params=[sector])
        sec_base = float(sec_row.iloc[0, 0]) if not sec_row.empty else 8.0
        sta_row = pd.read_sql("SELECT avg_cost_overrun_pct FROM state_baselines WHERE state=?", self.conn, params=[state])
        sta_base = float(sta_row.iloc[0, 0]) if not sta_row.empty else 5.0

        feat_dict = {
            "physical_progress_pct": phys,
            "financial_progress_pct": fin,
            "cost_overrun_to_date_pct": overrun,
            "schedule_slip_months": slip,
            "financial_physical_gap": fin_phys_gap,
            "expected_physical_pct": expected_phys,
            "physical_schedule_gap": phys_sched_gap,
            "expenditure_rate": exp_rate,
            "sector_risk_baseline": sec_base,
            "state_risk_baseline": sta_base,
        }
        row_df = pd.DataFrame([feat_dict])[T.FEATURES].astype(float)
        cop_prob, top_prob = self._prob(row_df)
        model_score = 100 * 0.5 * (cop_prob + top_prob)

        cost_risk = np.clip(30 + overrun * 0.7, 0, 100)
        schedule_risk = np.clip(20 + slip * 3.0, 0, 100)
        progress_risk = np.clip(20 + (-phys_sched_gap * 0.6) + (-fin_phys_gap * 1.2), 0, 100)
        rule_score = round(0.45 * cost_risk + 0.35 * schedule_risk + 0.20 * progress_risk, 1)
        final_score = float(np.clip(0.5 * model_score + 0.5 * rule_score, 0, 100))

        drivers = self._shap_drivers(row_df)

        warnings = []
        if slip > 6:
            warnings.append({"warning_type": "schedule_slip", "severity": "High", "signal_value": slip})
        elif slip > 0:
            warnings.append({"warning_type": "schedule_slip", "severity": "Medium", "signal_value": slip})
        if abs(fin_phys_gap) > 15:
            warnings.append({"warning_type": "financial_physical_gap", "severity": "High", "signal_value": fin_phys_gap})
        elif abs(fin_phys_gap) > 8:
            warnings.append({"warning_type": "financial_physical_gap", "severity": "Medium", "signal_value": fin_phys_gap})
        if overrun > 20:
            warnings.append({"warning_type": "cost_overrun_breach", "severity": "High", "signal_value": overrun})
        elif overrun > 10:
            warnings.append({"warning_type": "cost_overrun_breach", "severity": "Medium", "signal_value": overrun})
        if phys_sched_gap < -20:
            warnings.append({"warning_type": "behind_schedule", "severity": "High", "signal_value": phys_sched_gap})
        elif phys_sched_gap < -10:
            warnings.append({"warning_type": "behind_schedule", "severity": "Medium", "signal_value": phys_sched_gap})

        return {
            "sector": sector,
            "state": state,
            "physical_progress_pct": phys,
            "financial_progress_pct": fin,
            "cost_overrun_to_date_pct": overrun,
            "schedule_slip_months": slip,
            "sector_risk_baseline": sec_base,
            "state_risk_baseline": sta_base,
            "cop_prob": round(cop_prob, 4),
            "top_prob": round(top_prob, 4),
            "model_risk_score": round(model_score, 1),
            "rule_risk_score": round(rule_score, 1),
            "final_risk_score": round(final_score, 1),
            "risk_level": risk_level(final_score),
            "health": max(0, min(100, round(100 - final_score, 1))),
            "shap_drivers": drivers,
            "warnings": warnings,
        }

    def timeline(self, project_id):
        t = pd.read_sql(
            "SELECT month, physical_progress_pct, financial_progress_pct, "
            "cumulative_expenditure, revised_cost, cost_overrun_to_date_pct, "
            "schedule_slip_months FROM project_snapshots WHERE project_id=? "
            "ORDER BY CASE month WHEN 'Feb' THEN 1 WHEN 'March' THEN 2 "
            "WHEN 'April' THEN 3 WHEN 'May' THEN 4 WHEN 'June' THEN 5 "
            "WHEN 'July' THEN 6 END", self.conn, params=[project_id])
        return t.to_dict("records")


_engine = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = ScoreEngine()
    return _engine


def score_project(project_id, month=None):
    return get_engine().score_project(project_id, month)


def predict_custom(data):
    return get_engine().predict_custom(data)