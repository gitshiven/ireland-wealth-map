"""
Step 4 — Compute the Affluence Index
======================================
Input : data/processed/merged.parquet  (or ppr_geocoded.parquet if no Daft yet)
Output: data/processed/affluence_index.parquet
        data/processed/affluence_county.parquet  (county-level summary)

Affluence Index formula
-----------------------
Normalised (0–100) weighted composite of:

  Component                    Weight   Source
  ─────────────────────────────────────────────
  Median sale price              30%    PPR
  Price growth (CAGR 5yr)        25%    PPR
  Luxury sale share (≥€1m)       20%    PPR
  Daft median asking price       15%    Daft
  BER quality (% A/B rated)      10%    Daft

Each component is min-max normalised before weighting so no single
metric dominates due to scale differences.
"""

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

MERGED    = Path("data/processed/merged.parquet")
PPR_GEO   = Path("data/processed/ppr_geocoded.parquet")
OUT_IDX   = Path("data/processed/affluence_index.parquet")
OUT_COUNTY = Path("data/processed/affluence_county.parquet")


def minmax(series: pd.Series) -> pd.Series:
    """Normalise a series to [0, 100] range, NaN-safe."""
    mn, mx = series.min(), series.max()
    if mx == mn:
        return pd.Series(50.0, index=series.index)
    return (series - mn) / (mx - mn) * 100


def cagr(prices_by_year: pd.Series) -> float:
    """
    5-year CAGR from a Series indexed by year.
    Returns NaN if fewer than 2 years of data.
    """
    years = prices_by_year.index.tolist()
    if len(years) < 2:
        return np.nan
    latest_yr = max(years)
    base_yr   = max(min(years), latest_yr - 5)
    if base_yr == latest_yr:
        return np.nan
    p0 = prices_by_year.get(base_yr)
    p1 = prices_by_year.get(latest_yr)
    if not p0 or not p1 or p0 <= 0:
        return np.nan
    n = latest_yr - base_yr
    return ((p1 / p0) ** (1 / n) - 1) * 100  # as percent


def run():
    # ── 1. Load data ──────────────────────────────────────────────────────────
    if MERGED.exists():
        source = MERGED
    elif PPR_GEO.exists():
        source = PPR_GEO
    else:
        source = Path("data/processed/ppr_clean.parquet")
    print(f"Loading from: {source}")
    df = pd.read_parquet(source)

    # Ensure required columns exist (graceful fallback for clean-only runs)
    if "is_full_market" not in df.columns:
        df["is_full_market"] = True
    if "is_luxury" not in df.columns:
        df["is_luxury"] = df["price"] >= 1_000_000
    if "lat" not in df.columns:
        df["lat"] = np.nan
    if "lng" not in df.columns:
        df["lng"] = np.nan

    print(f"  {len(df):,} rows, {df['county'].nunique()} counties")

    # ── 2. County-level aggregation from PPR ──────────────────────────────────
    print("\nComputing county-level PPR metrics …")

    # Median price per county
    median_price = (
        df[df["is_full_market"]]
        .groupby("county")["price"]
        .median()
        .rename("median_price")
    )

    # 5-year CAGR per county
    yearly_median = (
        df[df["is_full_market"]]
        .groupby(["county", "sale_year"])["price"]
        .median()
        .unstack("sale_year")
    )
    cagr_series = yearly_median.apply(
        lambda row: cagr(row.dropna()), axis=1
    ).rename("price_cagr_5yr")

    # Luxury share (% of sales ≥ €1m)
    luxury_share = (
        df[df["is_full_market"]]
        .groupby("county")["is_luxury"]
        .mean()
        .mul(100)
        .rename("luxury_share_pct")
    )

    # Transaction count (volume signal)
    tx_count = (
        df[df["is_full_market"]]
        .groupby("county")["price"]
        .count()
        .rename("transaction_count")
    )

    # ── 3. Assemble base county frame ─────────────────────────────────────────
    county = pd.concat([median_price, cagr_series, luxury_share, tx_count], axis=1).reset_index()

    # Daft enrichment columns (if available)
    daft_cols = ["county", "daft_median_asking", "daft_pct_high_ber"]
    if all(c in df.columns for c in daft_cols):
        daft_agg = (
            df[daft_cols]
            .drop_duplicates("county")
            .set_index("county")
        )
        county = county.set_index("county").join(daft_agg).reset_index()
    else:
        county["daft_median_asking"] = np.nan
        county["daft_pct_high_ber"]  = np.nan

    # ── 4. Compute Affluence Index ────────────────────────────────────────────
    print("Computing Affluence Index …")

    # Normalise each component
    county["n_median_price"]    = minmax(county["median_price"])
    county["n_cagr"]            = minmax(county["price_cagr_5yr"].fillna(county["price_cagr_5yr"].median()))
    county["n_luxury_share"]    = minmax(county["luxury_share_pct"])

    # Daft components — use PPR median as proxy if Daft not available
    if county["daft_median_asking"].notna().any():
        county["n_daft_asking"]  = minmax(county["daft_median_asking"].fillna(county["median_price"]))
        county["n_ber_quality"]  = minmax(county["daft_pct_high_ber"].fillna(county["daft_pct_high_ber"].median()) * 100)
    else:
        county["n_daft_asking"]  = county["n_median_price"]   # PPR proxy
        county["n_ber_quality"]  = 50.0                        # neutral

    # Weighted sum
    weights = {
        "n_median_price":  0.30,
        "n_cagr":          0.25,
        "n_luxury_share":  0.20,
        "n_daft_asking":   0.15,
        "n_ber_quality":   0.10,
    }
    county["affluence_index"] = sum(
        county[col] * w for col, w in weights.items()
    ).round(1)

    # Rank (1 = most affluent)
    county["affluence_rank"] = county["affluence_index"].rank(ascending=False).astype(int)

    # Tier label
    def tier(score):
        if score >= 70:   return "Tier 1 — Elite"
        if score >= 50:   return "Tier 2 — Affluent"
        if score >= 30:   return "Tier 3 — Middle"
        return               "Tier 4 — Emerging"

    county["affluence_tier"] = county["affluence_index"].apply(tier)

    # ── 5. Inequality metrics per county ─────────────────────────────────────
    print("Computing Gini coefficients …")

    def gini(arr):
        """Gini coefficient for a 1-D array of positive values."""
        a = np.sort(arr[arr > 0])
        if len(a) < 2:
            return np.nan
        n = len(a)
        idx = np.arange(1, n + 1)
        return (2 * (idx * a).sum() / (n * a.sum())) - (n + 1) / n

    gini_series = (
        df[df["is_full_market"]]
        .groupby("county")["price"]
        .apply(lambda x: gini(x.values))
        .rename("gini_coefficient")
    )
    county = county.merge(gini_series.reset_index(), on="county", how="left")

    # ── 6. Row-level index (each PPR transaction gets its county score) ───────
    df_indexed = df.merge(
        county[["county", "affluence_index", "affluence_rank", "affluence_tier"]],
        on="county",
        how="left",
    )
    df_indexed.to_parquet(OUT_IDX, index=False)

    # ── 7. Save county summary ────────────────────────────────────────────────
    county_out_cols = [
        "county", "affluence_index", "affluence_rank", "affluence_tier",
        "median_price", "price_cagr_5yr", "luxury_share_pct",
        "transaction_count", "gini_coefficient",
        "daft_median_asking", "daft_pct_high_ber",
    ]
    county[[c for c in county_out_cols if c in county.columns]]\
        .sort_values("affluence_rank")\
        .to_parquet(OUT_COUNTY, index=False)

    # ── 8. Print leaderboard ──────────────────────────────────────────────────
    print("\n── Affluence Index Leaderboard ──")
    display = county.sort_values("affluence_rank")[[
        "affluence_rank","county","affluence_index","affluence_tier",
        "median_price","luxury_share_pct","price_cagr_5yr"
    ]].head(26)
    display["median_price"] = display["median_price"].map("€{:,.0f}".format)
    display["luxury_share_pct"] = display["luxury_share_pct"].map("{:.1f}%".format)
    display["price_cagr_5yr"] = display["price_cagr_5yr"].map(
        lambda x: f"{x:.1f}%" if pd.notna(x) else "n/a"
    )
    print(display.to_string(index=False))
    print(f"\n✅  Saved → {OUT_IDX}  &  {OUT_COUNTY}")


if __name__ == "__main__":
    run()
