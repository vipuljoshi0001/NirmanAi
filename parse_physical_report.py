import re
import pandas as pd

MONTH_ORDER = ["Feb", "March", "April", "May", "June", "July"]


def parse_costs(cost_str):
    m = re.match(r"^\s*([\d,\.]+)\s*\(\s*([\d,\.]+)\s*\)\s*$", cost_str)
    if m:
        return float(m.group(1).replace(",", "")), float(m.group(2).replace(",", ""))
    single = re.match(r"^\s*([\d,\.]+)\s*$", cost_str)
    if single:
        v = float(single.group(1).replace(",", ""))
        return v, v
    return None, None


def main():
    with open("Physical-Progress-Report.csv", "r", encoding="latin-1") as f:
        text = f.read()

    blocks = re.split(r"(?m)^Physical Progress-([A-Za-z]+)\s*,", text)

    rows = []
    seen_20_30 = {}
    for i in range(1, len(blocks), 2):
        month = blocks[i]
        lines = blocks[i + 1].splitlines()
        for line in lines:
            cells = [c.strip() for c in line.split(",")]
            if len(cells) != 5:
                continue
            sr, bucket, count, cost_str, exp_str = cells
            # skip the July header rows
            if not bucket or bucket == "Physical Progress slab" or sr == "Sr.No.":
                continue
            if sr == "" or "(" in bucket:
                continue
            orig, rev = parse_costs(cost_str)
            if orig is None:
                continue
            try:
                exp = float(exp_str.replace(",", ""))
                cnt = float(count.replace(",", ""))
            except ValueError:
                continue
            overrun = (rev - orig) / orig * 100 if orig else 0.0
            # Fix source quirk: two rows labeled "20-30" per month with no "10-20".
            # The second occurrence is the intended 10-20% bucket.
            if bucket == "20-30":
                seen_20_30[month] = seen_20_30.get(month, 0) + 1
                if seen_20_30[month] > 1:
                    bucket = "10-20"
            rows.append(
                {
                    "month": month,
                    "progress_bucket": bucket,
                    "project_count": cnt,
                    "original_cost_cr": orig,
                    "revised_cost_cr": rev,
                    "expenditure_cr": exp,
                    "cost_overrun_pct": overrun,
                }
            )

    df = pd.DataFrame(rows)
    df["month"] = pd.Categorical(df["month"], categories=MONTH_ORDER, ordered=True)
    df = df.sort_values(["month", "progress_bucket"], kind="stable").reset_index(drop=True)

    print("--- Parsed rows ---")
    print(df.to_string(index=False))

    print("\n--- Rows per month (should be 11) ---")
    print(df.groupby("month", observed=True).size())

    print("\n--- Raw bucket labels seen ---")
    print(sorted(df["progress_bucket"].unique()))

    # Stalled (0-10) share of ALL projects, per month
    print("\n--- Stalled share (0-10 bucket) as % of ALL projects, per month ---")
    total_by_month = df.groupby("month", observed=True)["project_count"].sum()
    stalled = df[df["progress_bucket"] == "0-10"].set_index("month")["project_count"]
    share = pd.DataFrame(
        {
            "stalled_count": stalled,
            "total_count": total_by_month,
            "stalled_pct": (stalled / total_by_month * 100).round(2),
        }
    )
    print(share.to_string())

    df.to_csv("physical_progress_tidy.csv", index=False)
    print("\nSaved tidy frame to physical_progress_tidy.csv")


if __name__ == "__main__":
    main()
