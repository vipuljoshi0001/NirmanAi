import re
import pandas as pd

COST_COL = "Original (Revised)"
EX_HEADER = "Expenditure"
SR = "Sr.No."


def parse_block(block_lines, month_letters):
    """Parse rows for one month block.

    block_lines: raw text lines for the block (starting at the 'State-wise-report <Month>' line)
    month_letters: title-case month name, e.g. 'July'
    Returns list of row dicts.
    """
    # July block has a 2-line header ('Sr.No.,State Name,...' + subtitle); skip it.
    # Other blocks go straight into data after the block-title line.
    start = 0
    cells0 = [c.strip() for c in block_lines[0].split(",")] if block_lines else []
    if cells0 and cells0[0] == SR:
        start = 1  # skip the Sr.No. header line
        if block_lines[start].strip().startswith("(in no"):
            start += 1  # also skip the subtitle line
    # skip any remaining blank/header-ish lines at the top of the block
    while start < len(block_lines):
        cells = [c.strip() for c in block_lines[start].split(",")]
        first = cells[0] if cells else ""
        if first in ("", SR) and "State Name" in ",".join(cells):
            start += 1
        else:
            break

    rows = []
    for line in block_lines[start:]:
        cells = [c.strip() for c in line.split(",")]
        # exactly 5 columns: [blank, state, count, cost, exp]
        if len(cells) != 5:
            continue
        blank, state, count, cost_str, exp_str = cells
        if not state or state == SR:
            continue
        # skip subtitle rows that only contain column headers
        if blank in (SR,) or state == EX_HEADER or "Project Count" in state:
            continue
        # state containing a description in blank col already handled above
        rows.append(
            {
                "month": month_letters,
                "state": state,
                "project_count_raw": count,
                "cost_raw": cost_str,
                "exp_raw": exp_str,
            }
        )
    return rows


def parse_costs(cost_str):
    """Parse '535255.42 (601442.86)' into original & revised floats, unit in crore."""
    m = re.match(r"^\s*([\d,\.eE+]+)\s*\(\s*([\d,\.eE+]+)\s*\)\s*$", cost_str)
    if m:
        original = float(m.group(1).replace(",", ""))
        revised = float(m.group(2).replace(",", ""))
        return original, revised
    single = re.match(r"^\s*([\d,\.eE+]+)\s*$", cost_str)
    if single:
        v = float(single.group(1).replace(",", ""))
        return v, v
    return None, None


def main():
    with open("State-Wise-Report.csv", "r", encoding="latin-1") as f:
        text = f.read()

    blocks = re.split(r"(?m)^State-wise-report\s+([A-Za-z]+)\s*,", text)
    # blocks[0] is preamble (empty/NA), then alternating (month, content) ...
    month_order = ["Feb", "March", "April", "May", "June", "July"]

    all_rows = []
    # blocks[1:] pairs
    for i in range(1, len(blocks), 2):
        month = blocks[i]
        content = blocks[i + 1]
        lines = content.splitlines()
        all_rows.extend(parse_block(lines, month))

    df = pd.DataFrame(all_rows)

    df["project_count"] = pd.to_numeric(df["project_count_raw"], errors="coerce")
    parsed = df["cost_raw"].map(lambda s: parse_costs(s))
    df["original_cost_cr"] = parsed.map(lambda t: t[0])
    df["revised_cost_cr"] = parsed.map(lambda t: t[1])
    df["expenditure_cr"] = pd.to_numeric(df["exp_raw"].str.replace(",", ""), errors="coerce")

    # cost overrun pct = (revised - original) / original * 100
    df["cost_overrun_pct"] = (
        (df["revised_cost_cr"] - df["original_cost_cr"])
        / df["original_cost_cr"]
        * 100
    )

    df = df[
        [
            "month",
            "state",
            "project_count",
            "original_cost_cr",
            "revised_cost_cr",
            "expenditure_cr",
            "cost_overrun_pct",
        ]
    ]

    # enforce chronological month order
    df["month"] = pd.Categorical(df["month"], categories=month_order, ordered=True)
    df = df.sort_values(["state", "month"]).reset_index(drop=True)

    print(df.to_string(index=False))
    print("\n--- State count per month ---")
    print(df.groupby("month", observed=True)["state"].count())

    # Pivot trend table: rows states, cols months, values cost_overrun_pct
    trend = df.pivot_table(
        index="state",
        columns="month",
        values="cost_overrun_pct",
        aggfunc="first",
        observed=True,
    )[month_order]

    print("\n--- Cost overrun % trend per state over months ---")
    print(trend.round(2).to_string())

    # Worsening vs improving: compare first available to last available month
    def delta(row):
        first = row.dropna()
        if len(first) < 2:
            return None
        return first.iloc[-1] - first.iloc[0]

    trend["delta_pp"] = trend.apply(delta, axis=1)
    trend_stable = trend[trend["delta_pp"].notna()].copy()
    worst = trend_stable.sort_values("delta_pp", ascending=False).head(10)
    improving = trend_stable.sort_values("delta_pp", ascending=True).head(10)

    print("\n--- States getting WORSE (largest overrun increase, pp) ---")
    print(worst[["delta_pp"] + month_order].round(2).to_string())
    print("\n--- States getting BETTER (largest overrun decrease, pp) ---")
    print(improving[["delta_pp"] + month_order].round(2).to_string())

    df.to_csv("state_report_tidy.csv", index=False)
    print("\nSaved tidy frame to state_report_tidy.csv")


if __name__ == "__main__":
    main()
