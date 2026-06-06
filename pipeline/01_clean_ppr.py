"""
Step 1 — Clean & Normalise the Property Price Register
======================================================
Input : data/raw/PPR-ALL.csv   (download from propertypriceregister.ie → All Data)
Output: data/processed/ppr_clean.parquet

How to get the raw file on your machine:
    wget -O data/raw/PPR-ALL.csv \
      "https://www.propertypriceregister.ie/website/npsra/ppr/npsra-ppr.nsf/Downloads/PPR-ALL.zip/$FILE/PPR-ALL.zip"
    # then unzip — the archive contains PPR-ALL.csv
"""

import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

RAW     = Path("data/raw/PPR-ALL.csv")
OUT     = Path("data/processed/ppr_clean.parquet")
OUT.parent.mkdir(parents=True, exist_ok=True)

# ── 1. Load ──────────────────────────────────────────────────────────────────
print("Loading PPR CSV …")
try:
    df = pd.read_csv(RAW, encoding="latin-1", low_memory=False)
except FileNotFoundError:
    # Fall back to synthetic sample so the rest of the pipeline is testable
    print("  ⚠  PPR-ALL.csv not found — generating synthetic sample (100 rows)")
    rng = np.random.default_rng(42)
    counties = [
        "Dublin","Cork","Galway","Limerick","Waterford",
        "Kildare","Meath","Wicklow","Wexford","Kerry",
        "Clare","Tipperary","Kilkenny","Louth","Donegal",
        "Mayo","Sligo","Roscommon","Cavan","Monaghan",
        "Longford","Westmeath","Offaly","Laois","Carlow",
        "Leitrim",
    ]
    n = 200
    df = pd.DataFrame({
        "Date of Sale (dd/mm/yyyy)": pd.date_range("2018-01-01", periods=n, freq="15D").strftime("%d/%m/%Y"),
        "Address": [f"{rng.integers(1,200)} Sample St, Area {i}" for i in range(n)],
        "County": rng.choice(counties, n),
        "Eircode": [f"D{rng.integers(1,24):02d} {rng.integers(1000,9999)}" for _ in range(n)],
        "Price (€)": [f"€{p:,.0f}" for p in rng.lognormal(12.8, 0.5, n)],
        "Not Full Market Price": rng.choice(["No","Yes"], n, p=[0.9, 0.1]),
        "VAT Exclusive": rng.choice(["No","Yes"], n, p=[0.85, 0.15]),
        "Description of Property": rng.choice([
            "Second-Hand Dwelling house /Apartment",
            "New Dwelling house /Apartment",
        ], n),
        "Property Size Description": rng.choice([
            "greater than or equal to 38 sq metres and less than 125 sq metres",
            "greater than or equal to 125 sq metres",
            "less than 38 sq metres",
        ], n),
    })
    print(f"  ✓ Synthetic sample: {len(df)} rows")

# ── 2. Rename columns to snake_case ──────────────────────────────────────────
RENAME = {
    "Date of Sale (dd/mm/yyyy)":     "sale_date",
    "Address":                        "address",
    "County":                         "county",
    "Eircode":                        "eircode",
    "Price (\x80)":                   "price_raw",
    "Not Full Market Price":          "not_full_market",
    "VAT Exclusive":                  "vat_exclusive",
    "Description of Property":        "property_desc",
    "Property Size Description":      "size_desc",
}
df.rename(columns={k: v for k, v in RENAME.items() if k in df.columns}, inplace=True)

# ── 3. Parse price ────────────────────────────────────────────────────────────
def parse_price(raw):
    if pd.isna(raw):
        return np.nan
    cleaned = re.sub(r"[€,\s\x80]", "", str(raw))
    try:
        return float(cleaned)
    except ValueError:
        return np.nan

df["price"] = df["price_raw"].apply(parse_price)

# ── 4. Parse date ─────────────────────────────────────────────────────────────
df["sale_date"] = pd.to_datetime(df["sale_date"], dayfirst=True, errors="coerce")
df["sale_year"]  = df["sale_date"].dt.year
df["sale_month"] = df["sale_date"].dt.month

# ── 5. Normalise county ───────────────────────────────────────────────────────
COUNTY_MAP = {
    "co. dublin": "Dublin", "co dublin": "Dublin", "dublin city": "Dublin",
    "co. cork": "Cork", "co cork": "Cork", "cork city": "Cork",
    "co. galway": "Galway", "co galway": "Galway", "galway city": "Galway",
    "co. limerick": "Limerick", "co limerick": "Limerick", "limerick city": "Limerick",
    "co. waterford": "Waterford", "co waterford": "Waterford",
    "co. kildare": "Kildare", "co kildare": "Kildare",
    "co. meath": "Meath", "co meath": "Meath",
    "co. wicklow": "Wicklow", "co wicklow": "Wicklow",
    "co. wexford": "Wexford", "co. tipperary": "Tipperary",
    "co. kerry": "Kerry", "co. clare": "Clare",
    "co. kilkenny": "Kilkenny", "co. louth": "Louth",
    "co. donegal": "Donegal", "co. mayo": "Mayo",
    "co. sligo": "Sligo", "co. roscommon": "Roscommon",
    "co. cavan": "Cavan", "co. monaghan": "Monaghan",
    "co. longford": "Longford", "co. westmeath": "Westmeath",
    "co. offaly": "Offaly", "co. laois": "Laois",
    "co. carlow": "Carlow", "co. leitrim": "Leitrim",
    "north tipperary": "Tipperary", "south tipperary": "Tipperary",
}

df["county"] = (
    df["county"]
    .astype(str)
    .str.strip()
    .str.lower()
    .map(lambda x: COUNTY_MAP.get(x, x.title()))
)

# ── 6. Drop bad rows ──────────────────────────────────────────────────────────
before = len(df)
df = df[df["price"].between(10_000, 20_000_000)]   # sensible price window
df = df[df["sale_date"].notna()]
df = df[df["county"].notna() & (df["county"] != "Nan")]
after = len(df)
print(f"  Rows after cleaning: {after:,}  (dropped {before - after:,})")

# ── 7. Flag full-market, new vs second-hand ───────────────────────────────────
df["is_full_market"] = df.get("not_full_market", pd.Series("No", index=df.index)).str.strip().eq("No")
df["is_new"]         = df.get("property_desc", pd.Series("", index=df.index)).str.contains("New", na=False)

# ── 8. Price tiers ────────────────────────────────────────────────────────────
bins   = [0, 200_000, 350_000, 500_000, 750_000, 1_000_000, 2_000_000, 20_000_000]
labels = ["<200k", "200-350k", "350-500k", "500-750k", "750k-1m", "1m-2m", "2m+"]
df["price_tier"] = pd.cut(df["price"], bins=bins, labels=labels, right=False)
df["is_luxury"]  = df["price"] >= 1_000_000   # top tier marker

# ── 9. Eircode routing district ───────────────────────────────────────────────
df["eircode"] = df["eircode"].astype(str).str.strip().str.upper()
df["eircode_district"] = df["eircode"].str[:3]   # e.g. "D04", "T12"

# ── 10. Save ──────────────────────────────────────────────────────────────────
df.to_parquet(OUT, index=False)
print(f"\n✅  Saved → {OUT}")
print(df[["sale_date","county","price","price_tier","is_luxury"]].head(8).to_string())
print(f"\nShape: {df.shape}  |  Luxury (≥€1m): {df['is_luxury'].sum():,}")
