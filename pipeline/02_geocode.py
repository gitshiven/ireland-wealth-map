"""
Step 2 — Geocode PPR Records (Fixed)
======================================
Input : data/processed/ppr_clean.parquet
Output: data/processed/ppr_geocoded.parquet

Strategy:
  1. Luxury sales (>=€1m) — Nominatim address geocoding  (~4.5hrs, 15k records)
  2. Everything else      — county centroid with jitter   (instant)

Nominatim: free, no key, 1 req/s rate limit (strictly enforced).
Resume-safe: saves progress every 500 records so interruptions don't lose work.

Usage:
    python pipeline/02_geocode.py
    python pipeline/02_geocode.py --all      # geocode all records (slow, days)
    python pipeline/02_geocode.py --limit 500  # test with 500 luxury records
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from tqdm import tqdm

IN       = Path("data/processed/ppr_clean.parquet")
OUT      = Path("data/processed/ppr_geocoded.parquet")
CACHE_F  = Path("data/processed/geocode_cache.json")

HEADERS  = {"User-Agent": "IrelandWealthMap/1.0 (research project, Dublin)"}

COUNTY_CENTROIDS = {
    "Dublin":    (53.3498, -6.2603),
    "Cork":      (51.8985, -8.4756),
    "Galway":    (53.2707, -9.0568),
    "Limerick":  (52.6638, -8.6267),
    "Waterford": (52.2593, -7.1101),
    "Kildare":   (53.1581, -6.9094),
    "Meath":     (53.6055, -6.6564),
    "Wicklow":   (52.9808, -6.3782),
    "Wexford":   (52.3369, -6.4633),
    "Kerry":     (52.1545, -9.5669),
    "Clare":     (52.9045, -8.9812),
    "Tipperary": (52.4730, -8.1619),
    "Kilkenny":  (52.6541, -7.2448),
    "Louth":     (53.9270, -6.4866),
    "Donegal":   (54.6540, -8.1096),
    "Mayo":      (53.8650, -9.2977),
    "Sligo":     (54.2766, -8.4761),
    "Roscommon": (53.6314, -8.1891),
    "Cavan":     (53.9908, -7.3600),
    "Monaghan":  (54.2492, -6.9683),
    "Longford":  (53.7274, -7.7932),
    "Westmeath": (53.5345, -7.4653),
    "Offaly":    (53.2357, -7.7122),
    "Laois":     (52.9942, -7.3320),
    "Carlow":    (52.8408, -6.9261),
    "Leitrim":   (54.0051, -8.0038),
}


def load_cache() -> dict:
    if CACHE_F.exists():
        with open(CACHE_F) as f:
            return json.load(f)
    return {}


def save_cache(cache: dict):
    with open(CACHE_F, "w") as f:
        json.dump(cache, f)


def nominatim(address: str, county: str, cache: dict) -> tuple[float, float] | None:
    """Geocode via Nominatim OSM. Returns (lat, lng) or None."""
    # Clean address — remove apartment numbers, shorten to key parts
    parts = [p.strip() for p in address.split(",")]
    # Use last 2-3 meaningful parts + county + Ireland
    query_parts = parts[-2:] if len(parts) >= 2 else parts
    query = ", ".join(query_parts) + f", {county}, Ireland"

    if query in cache:
        return cache[query]

    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "ie"},
            headers=HEADERS,
            timeout=10,
        )
        results = r.json()
        if results:
            lat = float(results[0]["lat"])
            lng = float(results[0]["lon"])
            result = (lat, lng)
        else:
            result = None
    except Exception:
        result = None

    cache[query] = result
    return result


def county_centroid(county: str) -> tuple[float, float]:
    """Return county centroid with small random jitter so points don't stack."""
    base = COUNTY_CENTROIDS.get(county, (53.4, -8.0))
    return (
        base[0] + np.random.uniform(-0.12, 0.12),
        base[1] + np.random.uniform(-0.15, 0.15),
    )


def run(geocode_all: bool = False, limit: int | None = None):
    rng = np.random.default_rng(42)
    np.random.seed(42)

    df = pd.read_parquet(IN)
    print(f"Loaded {len(df):,} rows")

    # ── Check for existing partial output ─────────────────────────────────────
    if OUT.exists():
        existing = pd.read_parquet(OUT)
        done_ids = set(existing.index)
        print(f"  Resuming — {len(done_ids):,} already geocoded")
        df = df[~df.index.isin(done_ids)]
        print(f"  Remaining: {len(df):,} rows")
    else:
        existing = None

    df["lat"]        = np.nan
    df["lng"]        = np.nan
    df["geo_source"] = "none"

    # ── Decide which rows to geocode via Nominatim ────────────────────────────
    if geocode_all:
        to_geocode = df.index.tolist()
        print(f"\nGeocoding ALL {len(to_geocode):,} rows via Nominatim")
        print("Warning: this will take many days at 1 req/s")
    else:
        # Only luxury sales (>=€1m) — the most valuable data
        luxury_mask = df["is_luxury"] == True
        to_geocode  = df[luxury_mask].index.tolist()
        print(f"\nGeocoding {len(to_geocode):,} luxury sales (>=€1m) via Nominatim")
        print(f"Estimated time: {len(to_geocode)/3600:.1f} hours at 1 req/s")

    if limit:
        to_geocode = to_geocode[:limit]
        print(f"  (limited to {limit} for testing)")

    # ── Nominatim geocoding ────────────────────────────────────────────────────
    cache = load_cache()
    matched = 0

    for i, idx in enumerate(tqdm(to_geocode, desc="Nominatim")):
        result = nominatim(df.at[idx, "address"], df.at[idx, "county"], cache)
        if result:
            df.at[idx, "lat"]        = result[0]
            df.at[idx, "lng"]        = result[1]
            df.at[idx, "geo_source"] = "nominatim"
            matched += 1
        time.sleep(1.1)  # Nominatim requires >= 1s between requests

        # Save cache + partial output every 500 records
        if (i + 1) % 500 == 0:
            save_cache(cache)
            _save_partial(df, existing)
            print(f"  [{i+1}/{len(to_geocode)}] matched so far: {matched:,}")

    save_cache(cache)
    print(f"\nNominatim matched: {matched:,} / {len(to_geocode):,}")

    # ── County centroid fallback for everything else ───────────────────────────
    still_missing = df["lat"].isna()
    print(f"Applying county centroid to {still_missing.sum():,} remaining rows ...")
    for idx in df[still_missing].index:
        lat, lng = county_centroid(df.at[idx, "county"])
        df.at[idx, "lat"]        = lat
        df.at[idx, "lng"]        = lng
        df.at[idx, "geo_source"] = "county_centroid"

    # ── Combine with any previous partial output ──────────────────────────────
    final = _save_partial(df, existing, final=True)

    print(f"\n── Geocoding summary ──")
    print(final["geo_source"].value_counts().to_string())
    print(f"\n✅  Saved → {OUT}  ({len(final):,} total rows)")


def _save_partial(df: pd.DataFrame, existing, final: bool = False) -> pd.DataFrame:
    """Merge current batch with any previously saved output and save."""
    if existing is not None:
        combined = pd.concat([existing, df], ignore_index=False)
    else:
        combined = df
    combined.to_parquet(OUT, index=True)
    return combined


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--all",   action="store_true", help="Geocode all rows (very slow)")
    parser.add_argument("--limit", type=int, default=None, help="Limit Nominatim calls for testing")
    args = parser.parse_args()
    run(geocode_all=args.all, limit=args.limit)
