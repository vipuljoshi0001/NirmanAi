"""
Synthetic project generator grounded in REAL monthly trends.

Reads:
  - state_report_tidy.csv      : real state x month cost_overrun_pct (Feb-Jul)
  - physical_progress_tidy.csv : real monthly progress-bucket distributions
  - sector_baselines_clean.csv : static sector baseline (point-in-time)

Produces per-project monthly TRAJECTORIES whose drift is sampled from the
assigned state's REAL month-over-month overrun change, blended with the
static sector baseline, and whose stalled share (0-10% progress bucket in the
final/most-recent snapshot) matches the REAL July stalled share.

Outputs:
  - synthetic_projects_master.csv   : one row / project (static attributes)
  - synthetic_project_timeline.csv  : one row / (project, month snapshot)
"""
import numpy as np
import pandas as pd

RNG_SEED = 42
MONTHS = ["Feb", "March", "April", "May", "June", "July"]
MONTH_NUM = {"Feb": 2, "March": 3, "April": 4, "May": 5, "June": 6, "July": 7}
YEAR = 2026

W_STATE = 0.6     # weight on the state's REAL monthly curve
W_SECTOR = 0.4    # weight on the static sector baseline
CLIP_LO, CLIP_HI = -55.0, 180.0
DRIFT_SIGMA = 2.0     # per-project spread around the state's real net monthly drift


def month_overrun_by_state(state_tidy):
    piv = state_tidy.pivot_table(
        index="state", columns="month", values="cost_overrun_pct",
        aggfunc="first", observed=True,
    )
    out = {}
    for state, row in piv.iterrows():
        # fill missing months (e.g. states that only report later months)
        filled = row.reindex(MONTHS).ffill().bfill()
        out[state] = {m: float(filled[m]) for m in MONTHS}
    return out


def state_net_monthly_drift(state_curves):
    """Robust per-state drift: (July - Feb) / 5, i.e. the real net pp/month trend."""
    out = {}
    for state, curve in state_curves.items():
        july = curve["July"]
        feb = curve["Feb"]
        out[state] = (july - feb) / (len(MONTHS) - 1)
    return out


def stall_share_for_month(phys_tidy, month="July"):
    sub = phys_tidy[phys_tidy["month"] == month]
    total = sub["project_count"].sum()
    stalled = sub[sub["progress_bucket"] == "0-10"]["project_count"].sum()
    return stalled / total


def july_bucket_distribution(phys_tidy, month="July"):
    sub = phys_tidy[phys_tidy["month"] == month]
    d = dict(zip(sub["progress_bucket"], sub["project_count"]))
    total = sum(d.values())
    order = ["0-10", "10-20", "20-30", "30-40", "40-50",
             "50-60", "60-70", "70-80", "80-90", "90-100", "100"]
    return {b: d.get(b, 0) / total for b in order}


def sample_final_physical_progress(rng, bucket_dist):
    buckets = list(bucket_dist.keys())
    probs = np.array([bucket_dist[b] for b in buckets])
    probs = probs / probs.sum()
    b = rng.choice(len(buckets), p=probs)
    label = buckets[b]
    if label == "100":
        return 100.0
    lo, hi = (float(x) for x in label.split("-"))
    return rng.uniform(lo, hi)


def main():
    rng = np.random.default_rng(RNG_SEED)

    state_tidy = pd.read_csv("state_report_tidy.csv")
    phys_tidy = pd.read_csv("physical_progress_tidy.csv")
    sector = pd.read_csv("sector_baselines_clean.csv")
    sector = sector.set_index("sector")  # index by sector

    state_curves = month_overrun_by_state(state_tidy)
    state_net_drift = state_net_monthly_drift(state_curves)

    stall_share = stall_share_for_month(phys_tidy)
    bucket_dist = july_bucket_distribution(phys_tidy)

    sb = sector["project_count"]                       # real sector counts
    tb = state_tidy[state_tidy["month"] == "July"].set_index("state")["project_count"]

    n_projects = int(rng.integers(300, 501))
    print(f"Generating {n_projects} synthetic projects "
          f"(real July stalled share {stall_share*100:.2f}%)")

    # --- assign sectors: every sector present, weighted by real counts ------
    sectors = list(sb.index)
    w_sector_arr = (sb / sb.sum()).to_numpy()
    base_sector_counts = np.floor(n_projects * w_sector_arr).astype(int)
    zero_sectors = [i for i in range(len(sectors)) if base_sector_counts[i] == 0]
    for i in zero_sectors:  # take 1 from the largest bucket to cover tiny sectors
        top = int(np.argmax(base_sector_counts))
        base_sector_counts[top] -= 1
        base_sector_counts[i] = 1
    rem = n_projects - int(base_sector_counts.sum())
    pick = rng.choice(len(sectors), size=rem, replace=False)
    for i in pick:
        base_sector_counts[i] += 1
    sector_assign = []
    for s, c in zip(sectors, base_sector_counts):
        sector_assign.extend([s] * int(c))
    rng.shuffle(sector_assign)

    # --- assign states: every state present, weighted by real counts ---------
    states = list(tb.index)
    w_state_arr = (tb / tb.sum()).to_numpy()
    base_state_counts = np.floor(n_projects * w_state_arr).astype(int)
    zero_states = [i for i in range(len(states)) if base_state_counts[i] == 0]
    for i in zero_states:
        top = int(np.argmax(base_state_counts))
        base_state_counts[top] -= 1
        base_state_counts[i] = 1
    rem = n_projects - int(base_state_counts.sum())
    pick = rng.choice(len(states), size=rem, replace=False)
    for i in pick:
        base_state_counts[i] += 1
    state_assign = []
    for s, c in zip(states, base_state_counts):
        state_assign.extend([s] * int(c))
    rng.shuffle(state_assign)

    projects = []
    for idx in range(n_projects):
        sec = sector_assign[idx]
        sta = state_assign[idx]
        sector_overrun = float(sector.loc[sec, "cost_overrun_pct"])
        state_july = float(state_curves[sta]["July"])
        net_drift = float(state_net_drift[sta])

        # base tendency anchored at the REAL state July level, blended with sector
        base_tendency = (
            W_STATE * state_july
            + W_SECTOR * sector_overrun
            + rng.normal(0, 6.0)
        )
        # per-project drift sampled around the state's REAL net monthly drift
        drift = rng.normal(net_drift, DRIFT_SIGMA)

        sanctioned = float(np.clip(
            rng.lognormal(np.log(max(float(sector.loc[sec, "original_cost"]), 1.0)), 0.55),
            10.0, 2_000_000.0))

        duration_months = int(rng.integers(24, 121))
        sanctioned_date = pd.Timestamp(YEAR, 2, int(rng.integers(1, 29)))
        original_end = sanctioned_date + pd.DateOffset(months=duration_months)

        projects.append({
            "project_id": f"PRJ-{idx+1:04d}",
            "sector": sec,
            "state": sta,
            "sanctioned_cost": round(sanctioned, 2),
            "sanctioned_date": sanctioned_date,
            "original_end_date": original_end,
            "duration_months": duration_months,
            "target_cost_overrun_pct": round(float(base_tendency), 3),
            "real_state_overrun_july": round(state_july, 3),
            "real_sector_overrun_pct": round(sector_overrun, 3),
            "real_state_drift_pp_month": round(float(net_drift), 3),
        })

    proj_df = pd.DataFrame(projects)

    # --- snapshots: 6 monthly, overrun drifts along the real state curve ---
    snapshots = []
    for _, p in proj_df.iterrows():
        pid, sta, sec = p["project_id"], p["state"], p["sector"]
        curve = state_curves[sta]
        sector_overrun = p["real_sector_overrun_pct"]
        net_drift = p["real_state_drift_pp_month"]
        drift = rng.normal(net_drift, DRIFT_SIGMA)
        bias0 = rng.normal(0, 4.0)
        base = p["target_cost_overrun_pct"]          # July-anchored level
        sanctioned = p["sanctioned_cost"]

        final_phys = sample_final_physical_progress(rng, bucket_dist)
        pace = rng.lognormal(mean=np.log(1.25), sigma=0.5)
        phys = {}
        for i, m in enumerate(MONTHS):
            t = (i + 1) / len(MONTHS)
            phys[m] = np.clip(final_phys * t * pace, 0, 100)
        if final_phys < 10:  # stalled projects stay near 0 all through
            for m in MONTHS:
                phys[m] = min(phys[m], rng.uniform(0, 8))

        for i, m in enumerate(MONTHS):
            # anchored at July's real level; earlier months follow the real
            # curve's relative shape (W_STATE share) plus the project's own
            # sampled drift (the residual 1-W_STATE share), so the combined
            # net movement matches the real state trajectory.
            curve_shift = W_STATE * (curve[m] - curve["July"])
            project_drift = (1 - W_STATE) * drift * (i - (len(MONTHS) - 1))
            overrun = base + curve_shift + project_drift + bias0 + rng.normal(0, 1.5)
            overrun = float(np.clip(overrun, CLIP_LO, CLIP_HI))

            pp = phys[m]
            fp = np.clip(pp + rng.normal(0, 4), 0, 100)

            revised_cost = sanctioned * (1 + overrun / 100.0)
            cum_exp = sanctioned * (fp / 100.0)

            slip = max(0.0, overrun * 0.35 + (100 - pp) * 0.12 + rng.normal(0, 2))
            snapshot_date = pd.Timestamp(YEAR, MONTH_NUM[m], 15)
            revised_end = p["original_end_date"] + pd.DateOffset(months=int(round(slip)))

            snapshots.append({
                "project_id": pid,
                "month": m,
                "snapshot_date": snapshot_date,
                "physical_progress_pct": round(pp, 2),
                "financial_progress_pct": round(fp, 2),
                "cumulative_expenditure": round(cum_exp, 2),
                "revised_cost": round(revised_cost, 2),
                "cost_overrun_to_date_pct": round(overrun, 2),
                "revised_end_date": revised_end,
                "schedule_slip_months": round(slip, 2),
            })

    snap_df = pd.DataFrame(snapshots)
    snap_df["month"] = pd.Categorical(snap_df["month"], categories=MONTHS, ordered=True)
    snap_df = snap_df.sort_values(["project_id", "month"]).reset_index(drop=True)

    # --- validation ---------------------------------------------------------
    final = snap_df[snap_df["month"] == "July"]
    stalled_final = (final["physical_progress_pct"] < 10).mean()
    print(f"\nSynthetic stalled share (final, <10%): {stalled_final*100:.2f}% "
          f"(real July: {stall_share*100:.2f}%)")

    # Net Feb->July drift fidelity (population-weighted, real states)
    snap_curve = snap_df.pivot_table(
        index="month", columns="project_id", values="cost_overrun_to_date_pct",
        observed=True,
    ).reindex(MONTHS)
    synth_net = float(snap_curve.loc["July"].mean() - snap_curve.loc["Feb"].mean())
    # real: population-weighted (Feb->July) / 5 per month, times 5 months
    july_counts = state_tidy[state_tidy["month"] == "July"].set_index("state")["project_count"]
    num = 0.0
    den = 0.0
    for sta in state_net_drift:
        cnt = float(july_counts.get(sta, 0.0))
        num += state_net_drift[sta] * 5 * cnt
        den += cnt
    real_net = num / den if den else float("nan")
    print(f"Synthetic net Feb->Jul overrun movement: {synth_net:+.2f} pp "
          f"(real population-weighted: {real_net:+.2f} pp)")

    # mean trajectory by month (shape check against the real national path)
    print("\nMean synthetic overrun by month (real national: 15.6,15.6,15.2,14.6,13.8,10.1):")
    print(snap_curve.mean(axis=1).round(2).to_string())

    proj_df.to_csv("synthetic_projects_master.csv", index=False)
    snap_df.to_csv("synthetic_project_timeline.csv", index=False)
    print("\nSaved synthetic_projects_master.csv and synthetic_project_timeline.csv")


if __name__ == "__main__":
    main()
