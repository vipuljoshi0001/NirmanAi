/**
 * mainlogic.js - Infrastructure Oversight "main logic" (Node.js)
 *
 * Dependency-free Node implementation of the deterministic rule-based
 * cost/time-overrun risk engine used by the Python stack (scoring.py /
 * build_database.py). Lets the frontend or external services assess a
 * project's risk without needing the Python/XGBoost runtime.
 *
 * Usage:
 *   1) CLI:
 *        node backend/mainlogic.js '{"physical_progress_pct":40,"financial_progress_pct":55}'
 *   2) HTTP server (POST /assess, GET /health):
 *        node backend/mainlogic.js --serve
 *   3) Library:
 *        const { assessProject } = require('./backend/mainlogic.js');
 */
'use strict';

const http = require('http');

/** Mirror of scoring.risk_level(): >=80 Critical, >=60 High, >=40 Medium, else Low. */
function riskLevel(score) {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function clip(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function round(v, dp) { const f = Math.pow(10, dp); return Math.round(v * f) / f; }
function num(v, fb) { const n = Number(v); return Number.isFinite(n) ? n : fb; }

/**
 * Assess a project using the same rule-based risk model as the Python stack.
 *
 * @param {object} input  Fields mirror scoring.predict_custom:
 *   sector, state, duration_months, months_elapsed, physical_progress_pct,
 *   financial_progress_pct, cost_overrun_to_date_pct, schedule_slip_months,
 *   cumulative_expenditure, revised_cost.
 *   Optional model_score: when provided, final = 0.5*model + 0.5*rule
 *   (as in scoring.py); otherwise final = rule score alone.
 * @returns {object} risk assessment
 */
function assessProject(input = {}) {
  const dur     = Math.max(1, num(input.duration_months, 36));
  const elapsed = num(input.months_elapsed, 12);
  const phys    = num(input.physical_progress_pct, 30);
  const fin     = num(input.financial_progress_pct, 35);
  const overrun = num(input.cost_overrun_to_date_pct, 0);
  const slip    = num(input.schedule_slip_months, 0);
  const revCost = Math.max(1, num(input.revised_cost, num(input.sanctioned_cost, 1200)));
  const cumExp  = num(input.cumulative_expenditure, (revCost * phys) / 100);

  // Derived gaps (mirror build_database.build_features)
  const expectedPhys = clip((100 * elapsed) / dur, 0, 100);
  const finPhysGap   = round(fin - phys, 3);
  const physSchedGap = round(phys - expectedPhys, 3);
  const expRate      = round((cumExp / revCost) * 100, 3);

  // Rule-based risk components (mirror build_database.build_risk_and_warnings)
  const costRisk     = clip(30 + overrun * 0.7, 0, 100);
  const scheduleRisk = clip(20 + slip * 3.0, 0, 100);
  const progressRisk = clip(20 - physSchedGap * 0.6 - finPhysGap * 1.2, 0, 100);
  const ruleScore    = round(0.45 * costRisk + 0.35 * scheduleRisk + 0.20 * progressRisk, 1);

  const hasModel   = input.model_score !== undefined && input.model_score !== null;
  const modelScore = hasModel ? clip(num(input.model_score, 50), 0, 100) : null;
  const finalR     = round(hasModel
    ? clip(0.5 * modelScore + 0.5 * ruleScore, 0, 100)
    : clip(ruleScore, 0, 100), 1);

  // Early-warning triggers (mirror scoring.predict_custom)
  const warnings = [];
  if (slip > 6) warnings.push({ warning_type: 'schedule_slip', severity: 'High', signal_value: slip });
  else if (slip > 0) warnings.push({ warning_type: 'schedule_slip', severity: 'Medium', signal_value: slip });

  const gap = Math.abs(finPhysGap);
  if (gap > 15) warnings.push({ warning_type: 'financial_physical_gap', severity: 'High', signal_value: finPhysGap });
  else if (gap > 8) warnings.push({ warning_type: 'financial_physical_gap', severity: 'Medium', signal_value: finPhysGap });

  if (overrun > 20) warnings.push({ warning_type: 'cost_overrun_breach', severity: 'High', signal_value: overrun });
  else if (overrun > 10) warnings.push({ warning_type: 'cost_overrun_breach', severity: 'Medium', signal_value: overrun });

  if (physSchedGap < -20) warnings.push({ warning_type: 'behind_schedule', severity: 'High', signal_value: physSchedGap });
  else if (physSchedGap < -10) warnings.push({ warning_type: 'behind_schedule', severity: 'Medium', signal_value: physSchedGap });

  return {
    sector: input.sector || 'Roads & Highways',
    state: input.state || 'Maharashtra',
    physical_progress_pct: round(phys, 2),
    financial_progress_pct: round(fin, 2),
    cost_overrun_to_date_pct: round(overrun, 2),
    schedule_slip_months: round(slip, 2),
    expected_physical_pct: round(expectedPhys, 2),
    financial_physical_gap: finPhysGap,
    physical_schedule_gap: physSchedGap,
    expenditure_rate: expRate,
    cost_risk: round(costRisk, 1),
    schedule_risk: round(scheduleRisk, 1),
    progress_risk: round(progressRisk, 1),
    rule_risk_score: ruleScore,
    model_risk_score: hasModel ? round(modelScore, 1) : null,
    final_risk_score: finalR,
    risk_level: riskLevel(finalR),
    health: round(clip(100 - finalR, 0, 100), 1),
    warnings,
  };
}
/* ------------------------------------------------------------------------ */
/* HTTP server (zero external dependencies)                                  */
/* ------------------------------------------------------------------------ */
const DEFAULT_PORT = 8090;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function send(res, code, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(text);
}

function startServer(port = DEFAULT_PORT) {
  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    if (req.method === 'GET' && url === '/health') {
      return send(res, 200, { status: 'connected', engine: 'rule-based mainlogic.js' });
    }
    if (req.method === 'POST' && url === '/assess') {
      try {
        const raw = await readBody(req);
        const input = JSON.parse(raw || '{}');
        return send(res, 200, assessProject(input));
      } catch (err) {
        return send(res, 400, { error: 'Invalid JSON payload', detail: String(err.message || err) });
      }
    }
    return send(res, 404, { error: 'Not found' });
  });
  server.listen(port, () => {
    console.log(`mainlogic.js listening on http://127.0.0.1:${port}`);
    console.log('  POST /assess  (project JSON -> risk assessment)');
    console.log('  GET  /health');
  });
  return server;
}

/* ------------------------------------------------------------------------ */
/* CLI                                                                       */
/* ------------------------------------------------------------------------ */
function runCli() {
  const args = process.argv.slice(2);
  if (args[0] === '--serve') {
    const port = Number(args[1]) || DEFAULT_PORT;
    return startServer(port);
  }
  const raw = args[0];
  try {
    const input = raw === undefined ? null : (
      raw.startsWith('@')
        ? require('fs').readFileSync(raw.slice(1), 'utf8') // @project.json
        : raw
    );
    if (input === null) throw new Error('no input (pass JSON, @file.json, or pipe stdin)');
    const project = JSON.parse(input.trim());
    console.log(JSON.stringify(assessProject(project), null, 2));
  } catch (err) {
    console.error(String(err.message || err));
    console.log('');
    console.log('Usage:');
    console.log('  node backend/mainlogic.js "<project JSON>"   # one-off assessment');
    console.log('  node backend/mainlogic.js @project.json      # read JSON from a file');
    console.log('  node backend/mainlogic.js --serve [port]     # start HTTP server');
    process.exitCode = 1;
  }
}

module.exports = { assessProject, riskLevel, startServer };

if (require.main === module) {
  runCli();
}