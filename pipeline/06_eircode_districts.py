"""
Step 6 — Eircode District Aggregation
=======================================
Input : data/processed/affluence_index.parquet
Output: data/processed/eircode_districts.parquet
        data/processed/emerging_areas.parquet

Drops resolution from 26 counties → ~160 Eircode routing districts
(first 3 chars of Eircode, e.g. D04, T12, H91).

This is where the "I didn't know this" insight lives — county level
smooths everything out. District level reveals the outliers.

Emerging = high CAGR in previously affordable districts
Established = consistently high median, low volatility
Surprise = districts where deprivation score is high but property
           prices are rising fast (displacement signal)
"""

from pathlib import Path
import numpy as np
import pandas as pd

IN       = Path("data/processed/affluence_index.parquet")
POBAL    = Path("data/raw/pobal_deprivation_2022.csv")   # optional enrichment
OUT_DIST = Path("data/processed/eircode_districts.parquet")
OUT_EMRG = Path("data/processed/emerging_areas.parquet")


def cagr(series_by_year: pd.Series, n_years: int = 5) -> float:
    years = sorted(series_by_year.index)
    if len(years) < 2:
        return np.nan
    latest = years[-1]
    base   = max(years[0], latest - n_years)
    p0 = series_by_year.get(base)
    p1 = series_by_year.get(latest)
    if not p0 or not p1 or p0 <= 0:
        return np.nan
    return ((p1 / p0) ** (1 / (latest - base)) - 1) * 100


def run():
    df = pd.read_parquet(IN)
    print(f"Loaded {len(df):,} rows")

    # ── 1. Filter to records with Eircode district ────────────────────────────
    df = df[df["eircode_district"].notna() & (df["eircode_district"] != "NAN")]
    df = df[df["is_full_market"]]
    print(f"  Full market with Eircode district: {len(df):,} rows")
    print(f"  Unique districts: {df['eircode_district'].nunique()}")

    # ── 2. Core metrics per district ─────────────────────────────────────────
    base = df.groupby(["eircode_district", "county"]).agg(
        median_price     = ("price", "median"),
        mean_price       = ("price", "mean"),
        max_price        = ("price", "max"),
        tx_count         = ("price", "count"),
        luxury_count     = ("is_luxury", "sum"),
        luxury_share_pct = ("is_luxury", lambda x: x.mean() * 100),
        price_std        = ("price", "std"),
        first_year       = ("sale_year", "min"),
        last_year        = ("sale_year", "max"),
    ).reset_index()

    # ── 3. Price CAGR per district ─────────────────────────────────────────
    yearly = (
        df.groupby(["eircode_district", "sale_year"])["price"]
        .median()
        .unstack("sale_year")
    )
    cagr_vals = yearly.apply(lambda row: cagr(row.dropna()), axis=1).rename("price_cagr_5yr")
    base = base.merge(cagr_vals.reset_index(), on="eircode_district", how="left")

    # ── 4. Coefficient of Variation (price stability signal) ─────────────────
    base["price_cv"] = base["price_std"] / base["median_price"]

    # ── 5. Baseline year median (for "previously affordable" classification) ──
    baseline_year = df["sale_year"].min() + 2   # 2 years in = stable baseline
    baseline = (
        df[df["sale_year"] <= baseline_year]
        .groupby("eircode_district")["price"]
        .median()
        .rename("baseline_price")
        .reset_index()
    )
    base = base.merge(baseline, on="eircode_district", how="left")

    # ── 6. Classification ─────────────────────────────────────────────────────
    # Median CAGR threshold for "emerging"
    cagr_75th = base["price_cagr_5yr"].quantile(0.75)
    price_50th = base["median_price"].quantile(0.50)
    luxury_75th = base["luxury_share_pct"].quantile(0.75)

    def classify(row):
        high_cagr    = row["price_cagr_5yr"] >= cagr_75th if pd.notna(row["price_cagr_5yr"]) else False
        high_price   = row["median_price"] >= price_50th
        high_luxury  = row["luxury_share_pct"] >= luxury_75th
        low_baseline = row["baseline_price"] <= price_50th if pd.notna(row["baseline_price"]) else True

        if high_luxury and high_price and not high_cagr:
            return "Established"      # wealthy, stable, not accelerating
        if high_cagr and low_baseline:
            return "Emerging"         # was affordable, now accelerating fast
        if high_cagr and high_price:
            return "Accelerating"     # already expensive AND accelerating
        if high_price and not high_cagr:
            return "Mature"           # expensive but growth slowing
        return "Stable"

    base["area_type"] = base.apply(classify, axis=1)

    # ── 7. Surprise score = CAGR × (1 - baseline_price_rank) ─────────────────
    # High surprise = fast growth from a low starting point
    base["baseline_rank"] = base["baseline_price"].rank(pct=True)
    base["surprise_score"] = (
        base["price_cagr_5yr"].fillna(0) * (1 - base["baseline_rank"])
    ).round(2)
    base["surprise_rank"] = base[base["surprise_score"] > 0]["surprise_score"].rank(ascending=False).reindex(base.index).fillna(999).astype(int)

    # ── 8. Optional Pobal deprivation join ────────────────────────────────────
    if POBAL.exists():
        print("  Joining Pobal deprivation scores …")
        pobal = pd.read_csv(POBAL, encoding="latin-1")
        # Pobal is at Electoral Division level — aggregate to county
        # then join on county as proxy (Eircode → county already in base)
        if "HP Index Score" in pobal.columns and "County" in pobal.columns:
            pobal_county = (
                pobal.groupby("County")["HP Index Score"]
                .mean()
                .reset_index()
                .rename(columns={"County": "county", "HP Index Score": "deprivation_score"})
            )
            pobal_county["county"] = pobal_county["county"].str.strip().str.title()
            base = base.merge(pobal_county, on="county", how="left")
            # Wealth-Deprivation tension: high property wealth + high deprivation
            base["wealth_deprivation_tension"] = (
                base["median_price"].rank(pct=True) -
                base["deprivation_score"].rank(pct=True)
            ).round(3)
    else:
        print("  ⚠  Pobal CSV not found — skipping deprivation join")
        print("     Download: https://www.pobal.ie/wp-content/uploads/2024/01/hp-deprivation-index-scores-2022.csv")
        base["deprivation_score"] = np.nan
        base["wealth_deprivation_tension"] = np.nan

    # ── 9. Save full district data ────────────────────────────────────────────
    base.to_parquet(OUT_DIST, index=False)
    print(f"\n✅  District data saved → {OUT_DIST}  ({len(base):,} districts)")

    # ── 10. Emerging areas report ─────────────────────────────────────────────
    emerging = (
        base[base["area_type"].isin(["Emerging", "Accelerating"])]
        .sort_values("surprise_rank")
        .head(30)
    )
    emerging.to_parquet(OUT_EMRG, index=False)

    # Print the "I didn't know this" table
    print("\n── Top 20 Most Surprising Emerging Areas ──")
    display_cols = [
        "surprise_rank", "eircode_district", "county", "area_type",
        "baseline_price", "median_price", "price_cagr_5yr", "luxury_share_pct"
    ]
    disp = emerging[[c for c in display_cols if c in emerging.columns]].head(20).copy()
    for col in ["baseline_price", "median_price"]:
        if col in disp:
            disp[col] = disp[col].map(lambda x: f"€{x:,.0f}" if pd.notna(x) else "n/a")
    for col in ["price_cagr_5yr", "luxury_share_pct"]:
        if col in disp:
            disp[col] = disp[col].map(lambda x: f"{x:.1f}%" if pd.notna(x) else "n/a")
    print(disp.to_string(index=False))

    print(f"\n── Area Type Distribution ──")
    print(base["area_type"].value_counts().to_string())


if __name__ == "__main__":
    run()
