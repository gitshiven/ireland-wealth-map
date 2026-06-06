"""
Step 3 — Fetch Daft.ie Enrichment via Apify
=============================================
Input : none (live fetch)
Output: data/processed/daft_enrichment.parquet
        data/processed/merged.parquet  (PPR + Daft merged by county/eircode)

Uses haketa/daft-scraper on Apify.
Requires: APIFY_TOKEN environment variable  OR  pass token as CLI arg.

Usage:
    python pipeline/03_fetch_daft.py
    python pipeline/03_fetch_daft.py --token apify_api_xxxx
    python pipeline/03_fetch_daft.py --max-records 500 --price-from 300000
"""

import argparse
import os
import time
from pathlib import Path

import pandas as pd
import requests

PPR_GEO = Path("data/processed/ppr_geocoded.parquet")
OUT_DAFT  = Path("data/processed/daft_enrichment.parquet")
OUT_MERGE = Path("data/processed/merged.parquet")

APIFY_ACTOR = "haketa/daft-scraper"
APIFY_BASE  = "https://api.apify.com/v2"


# ── Apify helpers ─────────────────────────────────────────────────────────────

def run_actor(token: str, input_payload: dict, max_wait_secs: int = 600) -> str:
    """Start actor, poll until done, return dataset ID."""
    url = f"{APIFY_BASE}/acts/{APIFY_ACTOR.replace('/', '~')}/runs"
    r = requests.post(
        url,
        json=input_payload,
        params={"token": token},
        timeout=30,
    )
    r.raise_for_status()
    run_id = r.json()["data"]["id"]
    print(f"  Run started: {run_id}")

    # Poll for completion
    poll_url = f"{APIFY_BASE}/actor-runs/{run_id}"
    elapsed = 0
    while elapsed < max_wait_secs:
        time.sleep(10)
        elapsed += 10
        status_r = requests.get(poll_url, params={"token": token}, timeout=10)
        status = status_r.json()["data"]["status"]
        items  = status_r.json()["data"].get("stats", {}).get("itemCount", 0)
        print(f"  [{elapsed:>4}s] status={status}  items={items}")
        if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            break

    if status != "SUCCEEDED":
        raise RuntimeError(f"Actor run {run_id} ended with status: {status}")

    dataset_id = status_r.json()["data"]["defaultDatasetId"]
    print(f"  ✓ Finished — dataset: {dataset_id}")
    return dataset_id


def fetch_dataset(token: str, dataset_id: str) -> list[dict]:
    """Paginate through dataset and return all items."""
    items = []
    offset = 0
    limit  = 1000
    while True:
        r = requests.get(
            f"{APIFY_BASE}/datasets/{dataset_id}/items",
            params={"token": token, "offset": offset, "limit": limit, "format": "json"},
            timeout=30,
        )
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        items.extend(batch)
        offset += limit
        if len(batch) < limit:
            break
    return items


# ── Main ──────────────────────────────────────────────────────────────────────

def run(token: str, max_records: int = 1000, price_from: int = 200_000):
    # ── 1. Scrape Daft.ie ────────────────────────────────────────────────────
    print(f"\nScraping Daft.ie  (max_records={max_records}, price_from=€{price_from:,}) …")
    actor_input = {
        "section":           "property-for-sale",
        "location":          "",                   # all-Ireland
        "priceFrom":         price_from,
        "maxRecords":        max_records,
        "scrapeDescription": False,
        "requestDelay":      1000,
        "proxyConfiguration": {
            "useApifyProxy":     True,
            "apifyProxyGroups":  ["RESIDENTIAL"],
            "apifyProxyCountry": "IE",
        },
    }
    dataset_id = run_actor(token, actor_input)
    raw_items  = fetch_dataset(token, dataset_id)
    print(f"  Fetched {len(raw_items):,} listings")

    # ── 2. Normalise Daft data ───────────────────────────────────────────────
    daft = pd.DataFrame(raw_items)
    daft.rename(columns={
        "latitude":     "lat_daft",
        "longitude":    "lng_daft",
        "county":       "county_daft",
        "priceMin":     "asking_price",
        "berRating":    "ber_rating",
        "eircode":      "eircode_daft",
        "propertyType": "property_type_daft",
        "numBedrooms":  "bedrooms",
        "numBathrooms": "bathrooms",
        "floorArea":    "floor_area",
        "listingUrl":   "daft_url",
        "publishDate":  "daft_publish_date",
    }, inplace=True)

    # Keep only useful columns
    keep = [
        "address", "county_daft", "eircode_daft", "lat_daft", "lng_daft",
        "asking_price", "ber_rating", "property_type_daft",
        "bedrooms", "bathrooms", "floor_area",
        "daft_url", "daft_publish_date",
    ]
    daft = daft[[c for c in keep if c in daft.columns]].copy()

    # Parse numeric asking price
    daft["asking_price"] = pd.to_numeric(daft["asking_price"], errors="coerce")

    # Normalise BER to ordered category
    BER_ORDER = ["A1","A2","A3","B1","B2","B3","C1","C2","C3",
                 "D1","D2","E1","E2","F","G","EXEMPT"]
    daft["ber_rating"] = daft["ber_rating"].astype(str).str.strip().str.upper()
    daft["ber_rating"] = daft["ber_rating"].where(daft["ber_rating"].isin(BER_ORDER), other=None)
    daft["ber_score"]  = daft["ber_rating"].map(
        {r: i for i, r in enumerate(BER_ORDER)}
    )  # lower score = better

    daft.to_parquet(OUT_DAFT, index=False)
    print(f"\n✅  Daft enrichment saved → {OUT_DAFT}  ({len(daft):,} rows)")

    # ── 3. Merge with PPR ────────────────────────────────────────────────────
    if PPR_GEO.exists():
        print("\nMerging with PPR geocoded data …")
        ppr = pd.read_parquet(PPR_GEO)

        # Aggregate Daft by county for county-level join
        daft_by_county = daft.groupby("county_daft").agg(
            daft_median_asking   = ("asking_price", "median"),
            daft_listing_count   = ("asking_price", "count"),
            daft_avg_ber_score   = ("ber_score",    "mean"),
            daft_pct_high_ber    = ("ber_score",    lambda x: (x <= 5).mean()),  # A1–B3
        ).reset_index().rename(columns={"county_daft": "county"})

        merged = ppr.merge(daft_by_county, on="county", how="left")
        merged.to_parquet(OUT_MERGE, index=False)
        print(f"✅  Merged dataset saved → {OUT_MERGE}  ({len(merged):,} rows)")
    else:
        print("⚠  PPR geocoded file not found — skipping merge (run 01 + 02 first)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch Daft.ie enrichment via Apify")
    parser.add_argument("--token",       default=os.getenv("APIFY_TOKEN", ""), help="Apify API token")
    parser.add_argument("--max-records", type=int, default=1000)
    parser.add_argument("--price-from",  type=int, default=200_000)
    args = parser.parse_args()

    if not args.token:
        raise SystemExit("❌  No Apify token — set APIFY_TOKEN env var or pass --token")

    run(token=args.token, max_records=args.max_records, price_from=args.price_from)
