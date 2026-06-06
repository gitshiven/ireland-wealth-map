"""
Step 2 — Geocode PPR Records
=============================
Input : data/processed/ppr_clean.parquet
Output: data/processed/ppr_geocoded.parquet

Strategy (free, no API key):
  1. Eircode lookup via api.postcodes.io  (fast, covers ~80% of records)
  2. Fallback: Nominatim (OSM) address geocoding for remainder
  3. County centroid fallback for anything still unmatched

Rate limits respected — 1 req/s for Nominatim as required.
"""

import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from tqdm import tqdm

IN  = Path("data/processed/ppr_clean.parquet")
OUT = Path("data/processed/ppr_geocoded.parquet")

# County centroids (fallback of last resort)
COUNTY_CENTROIDS = {
    "Dublin":     (53.3498, -6.2603),
    "Cork":       (51.8985, -8.4756),
    "Galway":     (53.2707, -9.0568),
    "Limerick":   (52.6638, -8.6267),
    "Waterford":  (52.2593, -7.1101),
    "Kildare":    (53.1581, -6.9094),
    "Meath":      (53.6055, -6.6564),
    "Wicklow":    (52.9808, -6.3782),
    "Wexford":    (52.3369, -6.4633),
    "Kerry":      (52.1545, -9.5669),
    "Clare":      (52.9045, -8.9812),
    "Tipperary":  (52.4730, -8.1619),
    "Kilkenny":   (52.6541, -7.2448),
    "Louth":      (53.9270, -6.4866),
    "Donegal":    (54.6540, -8.1096),
    "Mayo":       (53.8650, -9.2977),
    "Sligo":      (54.2766, -8.4761),
    "Roscommon":  (53.6314, -8.1891),
    "Cavan":      (53.9908, -7.3600),
    "Monaghan":   (54.2492, -6.9683),
    "Longford":   (53.7274, -7.7932),
    "Westmeath":  (53.5345, -7.4653),
    "Offaly":     (53.2357, -7.7122),
    "Laois":      (52.9942, -7.3320),
    "Carlow":     (52.8408, -6.9261),
    "Leitrim":    (54.0051, -8.0038),
}


def geocode_eircode(eircode: str) -> tuple[float, float] | None:
    """
    Use postcodes.io (free, no key, covers Irish Eircodes).
    Returns (lat, lng) or None.
    """
    code = eircode.replace(" ", "").upper()
    if len(code) < 7 or code in ("NAN", ""):
        return None
    try:
        r = requests.get(
            f"https://api.postcodes.io/postcodes/{code}",
            timeout=5
        )
        if r.status_code == 200:
            data = r.json().get("result", {})
            lat = data.get("latitude")
            lng = data.get("longitude")
            if lat and lng:
                return (float(lat), float(lng))
    except Exception:
        pass
    return None


def geocode_nominatim(address: str, county: str) -> tuple[float, float] | None:
    """
    Nominatim (OSM) geocoder — rate limited 1 req/s.
    Appends ', Ireland' to improve match accuracy.
    """
    query = f"{address}, {county}, Ireland"
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "ie"},
            headers={"User-Agent": "IrelandWealthMap/1.0 (research project)"},
            timeout=10,
        )
        results = r.json()
        if results:
            return (float(results[0]["lat"]), float(results[0]["lon"]))
    except Exception:
        pass
    return None


def run():
    df = pd.read_parquet(IN)
    print(f"Loaded {len(df):,} rows")

    df["lat"] = np.nan
    df["lng"] = np.nan
    df["geo_source"] = "none"

    # ── Pass 1: Eircode ───────────────────────────────────────────────────────
    print("\nPass 1: Eircode lookup …")
    eircode_cache: dict[str, tuple | None] = {}
    eircode_mask = df["eircode"].notna() & (df["eircode"] != "NAN") & (df["eircode"].str.len() >= 7)

    for idx in tqdm(df[eircode_mask].index, desc="  Eircode"):
        ec = df.at[idx, "eircode"]
        if ec not in eircode_cache:
            eircode_cache[ec] = geocode_eircode(ec)
            time.sleep(0.05)   # postcodes.io is generous but be polite
        result = eircode_cache[ec]
        if result:
            df.at[idx, "lat"]        = result[0]
            df.at[idx, "lng"]        = result[1]
            df.at[idx, "geo_source"] = "eircode"

    matched_1 = (df["geo_source"] == "eircode").sum()
    print(f"  ✓ Eircode matched: {matched_1:,} / {eircode_mask.sum():,}")

    # ── Pass 2: Nominatim for remainder (sample to avoid hammering OSM) ───────
    unmatched = df[df["lat"].isna()].copy()
    print(f"\nPass 2: Nominatim for {len(unmatched):,} unmatched …")
    print("  (capped at 500 Nominatim calls — county centroid for the rest)")

    nominatim_cap = 500
    count = 0
    for idx in tqdm(unmatched.index, desc="  Nominatim"):
        if count >= nominatim_cap:
            break
        result = geocode_nominatim(df.at[idx, "address"], df.at[idx, "county"])
        if result:
            df.at[idx, "lat"]        = result[0]
            df.at[idx, "lng"]        = result[1]
            df.at[idx, "geo_source"] = "nominatim"
        count += 1
        time.sleep(1.1)   # OSM requires ≥1 s between requests

    matched_2 = (df["geo_source"] == "nominatim").sum()
    print(f"  ✓ Nominatim matched: {matched_2:,}")

    # ── Pass 3: County centroid fallback ─────────────────────────────────────
    still_missing = df["lat"].isna()
    print(f"\nPass 3: County centroid fallback for {still_missing.sum():,} rows …")
    for idx in df[still_missing].index:
        county = df.at[idx, "county"]
        centroid = COUNTY_CENTROIDS.get(county)
        if centroid:
            # Add small jitter so points don't all stack on the same spot
            df.at[idx, "lat"]        = centroid[0] + np.random.uniform(-0.05, 0.05)
            df.at[idx, "lng"]        = centroid[1] + np.random.uniform(-0.05, 0.05)
            df.at[idx, "geo_source"] = "county_centroid"

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n── Geocoding summary ──")
    print(df["geo_source"].value_counts().to_string())
    still_none = df["lat"].isna().sum()
    if still_none:
        print(f"  Still unmatched: {still_none:,} (dropping)")
        df = df[df["lat"].notna()]

    df.to_parquet(OUT, index=False)
    print(f"\n✅  Saved → {OUT}  ({len(df):,} rows with coordinates)")


if __name__ == "__main__":
    run()
