-- Design-doc schema: real government baselines + synthetic project data
-- REAL tables: sector_baselines, state_baselines, state_monthly_trends,
--              national_monthly_trends, progress_buckets
-- SYNTHETIC: projects, project_snapshots
-- DERIVED:   project_features, risk_scores, early_warnings, model_risk_scores

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sector_baselines (
    sector TEXT PRIMARY KEY,
    rank INT,
    project_count INT,
    latest_expenditure NUMERIC,
    original_cost NUMERIC,
    anticipated_cost NUMERIC,
    avg_cost_overrun_pct NUMERIC,
    avg_expenditure NUMERIC
);

CREATE TABLE IF NOT EXISTS state_baselines (
    state TEXT PRIMARY KEY,
    project_count INT,
    avg_cost_overrun_pct NUMERIC
);

CREATE TABLE IF NOT EXISTS state_monthly_trends (
    state TEXT,
    month TEXT,
    project_count INT,
    original_cost_cr NUMERIC,
    revised_cost_cr NUMERIC,
    expenditure_cr NUMERIC,
    cost_overrun_pct NUMERIC,
    PRIMARY KEY (state, month)
);

CREATE TABLE IF NOT EXISTS national_monthly_trends (
    month TEXT PRIMARY KEY,
    original_cost_cr NUMERIC,
    revised_cost_cr NUMERIC,
    cumulative_expenditure_cr NUMERIC,
    national_cost_overrun_pct NUMERIC
);

CREATE TABLE IF NOT EXISTS progress_buckets (
    month TEXT,
    progress_bucket TEXT,
    project_count INT,
    original_cost_cr NUMERIC,
    revised_cost_cr NUMERIC,
    expenditure_cr NUMERIC,
    cost_overrun_pct NUMERIC,
    PRIMARY KEY (month, progress_bucket)
);

CREATE TABLE IF NOT EXISTS projects (
    project_id TEXT PRIMARY KEY,
    sector TEXT REFERENCES sector_baselines(sector),
    state TEXT REFERENCES state_baselines(state),
    sanctioned_cost NUMERIC,
    sanctioned_date TEXT,
    original_end_date TEXT,
    duration_months INT,
    target_cost_overrun_pct NUMERIC,
    real_state_overrun_july NUMERIC,
    real_sector_overrun_pct NUMERIC,
    real_state_drift_pp_month NUMERIC
);

CREATE TABLE IF NOT EXISTS project_snapshots (
    project_id TEXT REFERENCES projects(project_id),
    month TEXT,
    snapshot_date TEXT,
    physical_progress_pct NUMERIC,
    financial_progress_pct NUMERIC,
    cumulative_expenditure NUMERIC,
    revised_cost NUMERIC,
    cost_overrun_to_date_pct NUMERIC,
    revised_end_date TEXT,
    schedule_slip_months NUMERIC,
    PRIMARY KEY (project_id, month)
);

CREATE TABLE IF NOT EXISTS project_features (
    project_id TEXT REFERENCES projects(project_id),
    sector TEXT REFERENCES sector_baselines(sector),
    state TEXT REFERENCES state_baselines(state),
    month TEXT,
    snapshot_id TEXT,
    physical_progress_pct NUMERIC,
    financial_progress_pct NUMERIC,
    cost_overrun_to_date_pct NUMERIC,
    schedule_slip_months NUMERIC,
    financial_physical_gap NUMERIC,
    expected_physical_pct NUMERIC,
    physical_schedule_gap NUMERIC,
    expenditure_rate NUMERIC,
    sector_risk_baseline NUMERIC,
    state_risk_baseline NUMERIC,
    prior_risk NUMERIC,
    cost_vs_prior NUMERIC,
    expected_slip NUMERIC,
    slip_vs_expected NUMERIC,
    rem_work NUMERIC,
    burn_ratio NUMERIC
);

CREATE TABLE IF NOT EXISTS risk_scores (
    project_id TEXT,
    snapshot_id TEXT,
    month TEXT,
    cost_risk NUMERIC,
    schedule_risk NUMERIC,
    progress_risk NUMERIC,
    risk_score NUMERIC,
    risk_level TEXT
);

CREATE TABLE IF NOT EXISTS early_warnings (
    project_id TEXT,
    snapshot_id TEXT,
    month TEXT,
    warning_type TEXT,
    severity TEXT,
    signal_value NUMERIC
);

CREATE TABLE IF NOT EXISTS model_risk_scores (
    project_id TEXT,
    snapshot_id TEXT,
    month TEXT,
    cop_prob NUMERIC,
    top_prob NUMERIC,
    model_risk_score NUMERIC,
    rule_risk_score NUMERIC,
    final_risk_score NUMERIC,
    risk_level TEXT
);

-- OPTIONAL: audit trail for the photo-verification (on-site evidence) demo.
-- The table is created here AND guarded idempotently in api.py so the
-- pipeline never requires a re-run of this schema file.
CREATE TABLE IF NOT EXISTS verification_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    upload_path TEXT NOT NULL,
    project_id TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json TEXT NOT NULL
);

-- CONTRACTORS & SITE GEOFENCING SYSTEM
CREATE TABLE IF NOT EXISTS contractors (
    contractor_id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    rating NUMERIC DEFAULT 4.5,
    active_contracts INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contractor_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT REFERENCES projects(project_id),
    contractor_id TEXT REFERENCES contractors(contractor_id),
    package_name TEXT,
    assigned_date TEXT,
    contract_value_cr NUMERIC,
    UNIQUE(project_id, contractor_id)
);

CREATE TABLE IF NOT EXISTS project_geofences (
    project_id TEXT PRIMARY KEY REFERENCES projects(project_id),
    center_lat NUMERIC NOT NULL,
    center_lng NUMERIC NOT NULL,
    radius_km NUMERIC DEFAULT 3.0,
    boundary_geojson TEXT NOT NULL,
    created_at TEXT
);