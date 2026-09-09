import csv
import re
import pandas as pd

MONTH_ORDER = ["Feb", "March", "April", "May", "June", "July"]


def clean_number(s):
    s = s.replace(",", "").replace('"', "").replace("\xa0", " ").strip()
    s = re.sub(r"[^\d\.\-]", "", s)
    if s in ("", "-"):
        return None
    return float(s)


def main():
    rows = []
    with open("Cost-Overview-Report.csv", "r", encoding="latin-1") as f:
        reader = csv.reader(f)
        current_month = None
        for cells in reader:
            cells = [c.strip() for c in cells]
            # block header: "Cost Wise Details - July"
            if cells and cells[0].startswith("Cost Wise Details -"):
                parts = cells[0].split("-")
                current_month = parts[-1].strip()
                continue
            if current_month is None:
                continue
            # data row: value cells are in positions 1..3 and the first starts
            # with the currency-mark char '?'
            data_cells = cells[1:4] if len(cells) >= 4 else []
            if len(data_cells) == 3 and all(c for c in data_cells):
                if not data_cells[0].lstrip().startswith("?"):
                    continue
                nums = [clean_number(c) for c in data_cells]
                if any(n is None for n in nums):
                    continue
                orig, rev, exp = nums
                overrun = (rev - orig) / orig * 100 if orig else None
                rows.append(
                    {
                        "month": current_month,
                        "original_cost_cr": orig,
                        "revised_cost_cr": rev,
                        "cumulative_expenditure_cr": exp,
                        "national_cost_overrun_pct": overrun,
                    }
                )
                current_month = None  # only one data row per block

    df = pd.DataFrame(rows)
    df["month"] = pd.Categorical(df["month"], categories=MONTH_ORDER, ordered=True)
    df = df.sort_values("month").reset_index(drop=True)

    print("--- National cost overview per month ---")
    print(df.to_string(index=False))

    print("\n--- Month-over-month national overrun change (pp) ---")
    df["mom_pp"] = df["national_cost_overrun_pct"].diff().round(3)
    print(df[["month", "national_cost_overrun_pct", "mom_pp"]].to_string(index=False))

    df.to_csv("cost_overview_tidy.csv", index=False)
    print("\nSaved tidy frame to cost_overview_tidy.csv")


if __name__ == "__main__":
    main()
