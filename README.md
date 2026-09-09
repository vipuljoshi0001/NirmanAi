# Nirman-AI (Paimana)

An **Infrastructure Oversight Co-Pilot** that monitors India's large infrastructure
projects for **cost and time overruns**. It ingests real monthly progress reports,
grounds synthetic project trajectories in those real trends, trains **XGBoost**
cost/time-overrun (COP/TOP) models, explains each prediction with **SHAP**, and
surfaces everything through a **FastAPI** backend and a **React** dashboard.

---

## Architecture

```
raw CSVs (MoSPI-style monthly reports, Feb–Jul)
      │  parse_*.py
      ▼
tidy CSVs ──► generate_synthetic_projects.py ──► synthetic project trajectories
      │                                              (drift sampled from real
      │                                               state/sector curves)
      ▼
build_database.py ──► project_monitoring.db  (SQLite, 11 tables)
      │
      ▼
train_models.py ──► cop_model.json / top_model.json   (XGBoost, idealized vs noisy)
      │
      ▼
risk_analysis.py ──► model_risk_scores + early_warnings + SHAP figures
      │
      ▼
api.py (FastAPI)  ◄── scoring.py (ScoreEngine: risk score, SHAP drivers, timeline)
      │
      ▼
React frontend (Vite + Tailwind + Recharts)  — Dashboard, Projects, Intelligence,
                                                State Analysis, Reports
```

### Data model (11 tables in `project_monitoring.db`)
- **REAL baselines:** `sector_baselines`, `state_baselines`, `state_monthly_trends`,
  `national_monthly_trends`, `progress_buckets`
- **SYNTHETIC:** `projects`, `project_snapshots` (Feb–Jul per project)
- **DERIVED:** `project_features`, `risk_scores`, `early_warnings`, `model_risk_scores`

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend / API | Python, FastAPI, Uvicorn, SQLite |
| ML | XGBoost, scikit-learn, SHAP |
| Data | pandas, numpy, matplotlib |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts, lucide-react, Leaflet (react-leaflet 4) |

---

## Setup

### 1. Python environment
```bash
python -m venv .venv
# Windows:  .venv\Scripts\activate     macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Build the data pipeline (order matters)
```bash
python parse_state_report.py        # -> state_report_tidy.csv
python parse_cost_overview.py       # -> cost_overview_tidy.csv
python parse_physical_report.py     # -> physical_progress_tidy.csv
python generate_synthetic_projects.py   # -> synthetic_*.csv
python build_database.py            # -> project_monitoring.db
python train_models.py              # -> cop_model.json, top_model.json
python risk_analysis.py             # -> model_risk_scores, warnings, SHAP PNGs
```

> A pre-built `project_monitoring.db` and trained models are already present, so
> step 2 is only needed to regenerate from scratch.

### 3. Run the backend
```bash
python api.py            # serves http://127.0.0.1:8000
```

### 4. Run the frontend
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173 (proxies /api -> :8000)
# production build:      npm run build && npm run preview
```

---

## API endpoints (FastAPI)

| Method | Path | Description |
|---|---|---|
| GET | `/` | Static dashboard (`static/index.html`) |
| GET | `/api/health` | DB + model status |
| GET | `/api/projects` | Project cards (filter by `sector`, `state`, `risk_level`, `limit`) — original shape unchanged |
| GET | `/api/projects?map=true` | `{ mode, projects[] }` map feed: default project fields + `lat`/`lng` (deterministic state centroids) |
| GET | `/api/projects/{id}` | Full project detail + risk + SHAP drivers |
| GET | `/api/projects/{id}/timeline` | Monthly snapshot timeline |
| POST | `/api/projects` | Register a new project (triggers ML scoring) |
| POST | `/api/predict` | Score a custom project without persisting |
| GET | `/api/baselines/sectors` | Real sector baselines |
| GET | `/api/baselines/states` | Real state baselines |
| GET | `/api/trends/national` | National monthly trends |
| GET | `/api/trends/states` | State monthly trends |
| GET | `/api/states/{name}` | State detail (health, sector mix, trends, top risks) |
| GET | `/api/warnings` | Early-warning feed |
| GET | `/api/llm/status` | OpenRouter LLM availability + configured model |
| POST | `/api/llm/explain` | Natural-language risk brief (`project_id` or raw `data`) |

---

## Interactive project map

The dashboard's "Live infrastructure project map" card and the dedicated
`/map` page render a **react-leaflet** map (Leaflet 1.9 / react-leaflet 4 —
the combination needed for this React 18 app):

- Markers are pinned to deterministic **functional state centroids**
  (`STATE_CENTROIDS` in `mock_data.py`); cluster colour follows the project's
  live status (`On Track` → green, `Watch` → amber, `At Risk` → red), and
  marker size scales with the composite XGBoost risk score.
- The map reads `GET /api/projects?map=true`. The **default** `/api/projects`
  payload is untouched, so existing consumers keep working unchanged.
- If the backend is unreachable, `src/services/api.ts` builds a deterministic
  fallback from the same centroid table (`src/data/stateCentroids.ts`) plus a
  project-id-seeded jitter — the map stays stable across reloads.

**Why functional centroids and not real coordinates?** The DB stores no
georeferencing, so exact sites are neither recorded nor derivable. The map is a
*verification and monitoring surface* — it shows **where risk sits** at the
portfolio level, not an authoritative/encrypted GIS layer. Coordinates are
display-only derivations of state identity, so there is nothing secret to
encrypt; real per-project location data, when it exists, lives in the project
record itself.

## Testing
```bash
python test_end_to_end.py      # DB integrity, scoring engine, API, baseline fidelity
python eval_model.py           # held-out model evaluation (AUC, precision/recall)
```

## Auxiliary entry points

`ml/costoverrun.py` wraps the XGBoost scoring engine as a CLI / library — a
focused entry point for cost/time-overrun modelling independent of the web API:

```bash
python ml/costoverrun.py project PRJ-0001                       # score a DB project
python ml/costoverrun.py custom --json '{"physical_progress_pct":40,...}'
python ml/costoverrun.py top --n 10                             # portfolio at-risk list
python ml/costoverrun.py overview                               # risk-level counts
python ml/costoverrun.py report --csv cost_overrun_report.csv   # CSV dossier
```

`backend/mainlogic.js` is a dependency-free Node port of the rule-based risk
engine (cost / schedule / progress risk, warning triggers, risk level). Ideal
for quick assessments or edge services without a Python/XGBoost runtime:

```bash
node backend/mainlogic.js '{"physical_progress_pct":40,"financial_progress_pct":55}'
node backend/mainlogic.js @project.json    # read JSON from a file (avoid shell quoting)
node backend/mainlogic.js --serve          # POST /assess, GET /health on :8090
```

### LLM narratives (OpenRouter)

The backend can generate a plain-English "AI Intervention Brief" per project by
sending the scored model output (final risk, COp/TOP probabilities, SHAP
drivers, warnings) to an LLM via [OpenRouter](https://openrouter.ai). It
replaces the deterministic `reviewReason` template text, and falls back to it
automatically when no key is present or the call fails.

```bash
# 1. Get a key at https://openrouter.ai/keys, then:
copy .env.example .env            # Windows
# cp .env.example .env            # macOS/Linux

# 2. Edit .env and set:
#    OPENROUTER_API_KEY="sk-or-..."

# 3. Start the backend as usual; the brief uses the model below by default
#    (override with OPENROUTER_MODEL):
#    OPENROUTER_MODEL="qwen/qwen3-reranker-8b"
```

The feature degrades gracefully: with no `OPENROUTER_API_KEY` it is disabled
and the frontend keeps showing the rule-based template text.

```bash
curl -X POST http://127.0.0.1:8000/api/llm/explain \
     -H "Content-Type: application/json" \
     -d '{"project_id":"PRJ-0115"}'
# -> {"project_id":"PRJ-0115","narrative":"...","model":"...","available":true,"source":"openrouter"}

curl http://127.0.0.1:8000/api/llm/status
# -> {"available":true,"model":"qwen/qwen3-reranker-8b"}
```

---

## Project layout
```
backend/        mainlogic.js     Node rule-based risk engine (CLI + HTTP server, no deps)
ml/             costoverrun.py   Cost-overrun CLI / wrapper around scoring.py
llm.py          OpenRouter LLM narrative generator (graceful fallback)
static/         legacy static dashboard (index.html)
frontend/       React + Vite + Tailwind app (src/pages, src/components, src/services)
api.py          FastAPI application
scoring.py      ScoreEngine (risk scores, SHAP, timeline)
train_models.py COP/TOP model training
risk_analysis.py  model risk scores + warnings + SHAP figures
build_database.py DB build from tidy CSVs
generate_synthetic_projects.py synthetic project generator
parse_*.py      raw CSV -> tidy CSV parsers
schema.sql      DB schema
*.csv           raw and tidy data
cop_model.json / top_model.json  trained XGBoost models
shap_*.png      global SHAP explainability figures
```

## Status / known gaps
- LLM narratives are wired up via OpenRouter (`OPENROUTER_API_KEY` in `.env`);
  they fall back to deterministic template text when the key is absent. See the
  "LLM narratives (OpenRouter)" section above.
