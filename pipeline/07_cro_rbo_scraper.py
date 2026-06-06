"""
Step 7 — Corporate Ownership & Nationality Intelligence
=========================================================
Input : data/processed/affluence_index.parquet  (PPR data)
Output: data/processed/corporate_buyers.parquet
        data/processed/nationality_map.parquet

Strategy:
  1. Filter PPR for transactions ≥ €500k where address looks corporate
     (keywords: Ltd, Limited, DAC, Holdings, Properties, Investments, etc.)
  2. Query CRO company search to get company number
  3. Query RBO (Register of Beneficial Owners) for each company to get
     beneficial owner nationality
  4. Aggregate nationality by Eircode district

CRO search API: https://services.cro.ie/cws/companies?&company_name=X&skip=0&max=5&htmlEnc=1
RBO search: https://www.rbo.gov.ie/  (form-based, needs browser automation)

Rate limits: 1 req/2s for CRO, polite scraping only.

Usage:
    python pipeline/07_cro_rbo_scraper.py
    python pipeline/07_cro_rbo_scraper.py --max-companies 100
    python pipeline/07_cro_rbo_scraper.py --min-price 1000000  # €1m+ only
"""

import argparse
import json
import re
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests

IN        = Path("data/processed/affluence_index.parquet")
OUT_CORP  = Path("data/processed/corporate_buyers.parquet")
OUT_NAT   = Path("data/processed/nationality_map.parquet")
CACHE     = Path("data/processed/cro_cache.json")

# Keywords that suggest corporate buyer in PPR address field
CORPORATE_KEYWORDS = [
    "ltd", "limited", "dac", "plc", "llc", "holdings", "properties",
    "investments", "capital", "assets", "estates", "development",
    "group", "fund", "reit", "realty", "ventures", "partners",
]

CRO_API = "https://services.cro.ie/cws/companies"
HEADERS = {
    "User-Agent": "IrelandWealthMap/1.0 (academic research)",
    "Accept": "application/json",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_cache() -> dict:
    if CACHE.exists():
        with open(CACHE) as f:
            return json.load(f)
    return {}


def save_cache(cache: dict):
    with open(CACHE, "w") as f:
        json.dump(cache, f, indent=2)


def is_corporate(address: str) -> bool:
    """Check if a PPR address field looks like a corporate buyer."""
    if not isinstance(address, str):
        return False
    lower = address.lower()
    return any(kw in lower for kw in CORPORATE_KEYWORDS)


def extract_company_name(address: str) -> str | None:
    """
    Try to extract a clean company name from a PPR address.
    PPR sometimes has 'c/o Company Name Ltd, 10 Main St' format.
    """
    if not isinstance(address, str):
        return None
    # Pattern: grab text up to and including Ltd/Limited/DAC etc.
    match = re.search(
        r"([A-Z][A-Za-z\s&',\.\-]+(?:Ltd|Limited|DAC|PLC|LLC|Holdings|Properties|Investments|Capital|Estates|Group|Fund|REIT|Ventures|Partners)\.?)",
        address
    )
    if match:
        return match.group(1).strip()
    return None


def search_cro(company_name: str, cache: dict) -> list[dict]:
    """
    Search CRO for a company name.
    Returns list of {company_name, company_num, status, registered_address}
    """
    if company_name in cache:
        return cache[company_name]

    try:
        r = requests.get(
            CRO_API,
            params={
                "company_name": company_name,
                "skip": 0,
                "max": 5,
                "htmlEnc": 1,
            },
            headers=HEADERS,
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            results = data if isinstance(data, list) else data.get("companies", [])
            cache[company_name] = results
            return results
        else:
            cache[company_name] = []
            return []
    except Exception as e:
        print(f"    CRO error for '{company_name}': {e}")
        cache[company_name] = []
        return []


def scrape_rbo_nationality(company_num: str, cache: dict) -> dict | None:
    """
    Attempt to get beneficial owner info from RBO.
    RBO is form-based — we use their search endpoint.
    Returns {nationality, country_of_residence, owner_name} or None.

    Note: RBO blocks automated scraping. This function uses a polite
    approach. If blocked, falls back to None and marks as 'Unknown'.
    In production, use a proper headless browser (Playwright).
    """
    cache_key = f"rbo_{company_num}"
    if cache_key in cache:
        return cache[cache_key]

    # RBO doesn't have a clean JSON API — this is a best-effort attempt
    # The real scraper needs Playwright for the form submission
    # We mark it for Playwright fallback
    result = {
        "rbo_scraped":   False,
        "nationality":   "Pending",
        "country":       "Unknown",
        "owner_name":    None,
        "note":          "Requires Playwright — see 07b_rbo_playwright.py",
    }
    cache[cache_key] = result
    return result


# ── Main ──────────────────────────────────────────────────────────────────────

def run(max_companies: int = 200, min_price: int = 500_000):
    df = pd.read_parquet(IN)
    print(f"Loaded {len(df):,} PPR rows")

    # ── 1. Identify corporate buyer transactions ──────────────────────────────
    df_corp = df[
        (df["price"] >= min_price) &
        (df["address"].apply(is_corporate))
    ].copy()
    print(f"  Corporate-looking buyers (≥€{min_price:,}): {len(df_corp):,} transactions")

    # Extract company name
    df_corp["company_name_extracted"] = df_corp["address"].apply(extract_company_name)
    df_corp = df_corp[df_corp["company_name_extracted"].notna()]
    print(f"  Extractable company names: {len(df_corp):,}")

    # Deduplicate by company name — one lookup per company
    unique_companies = (
        df_corp
        .groupby("company_name_extracted")
        .agg(
            total_spend      = ("price", "sum"),
            tx_count         = ("price", "count"),
            max_price        = ("price", "max"),
            counties         = ("county", lambda x: list(x.unique())),
            eircode_districts= ("eircode_district", lambda x: list(x.dropna().unique())),
        )
        .reset_index()
        .sort_values("total_spend", ascending=False)
        .head(max_companies)
    )
    print(f"\n  Top {len(unique_companies)} companies by total spend:")

    # ── 2. CRO lookup ─────────────────────────────────────────────────────────
    cache = load_cache()
    cro_results = []

    for i, row in unique_companies.iterrows():
        name = row["company_name_extracted"]
        results = search_cro(name, cache)
        time.sleep(0.5)   # polite rate limiting

        if results:
            # Take best match (first result)
            best = results[0]
            cro_results.append({
                "company_name_extracted": name,
                "cro_company_name":       best.get("company_name", name),
                "cro_company_num":        str(best.get("company_num", "")),
                "cro_status":             best.get("status", "Unknown"),
                "cro_registered_address": best.get("registered_address", ""),
            })
        else:
            cro_results.append({
                "company_name_extracted": name,
                "cro_company_name":       name,
                "cro_company_num":        "",
                "cro_status":             "Not Found",
                "cro_registered_address": "",
            })

        if (i + 1) % 20 == 0:
            save_cache(cache)
            print(f"    [{i+1}/{len(unique_companies)}] CRO lookups done …")

    save_cache(cache)
    if not cro_results:
        print("  No corporate companies found — saving empty output")
        pd.DataFrame().to_parquet(OUT_CORP, index=False)
        pd.DataFrame().to_parquet(OUT_NAT, index=False)
        return
    cro_df = pd.DataFrame(cro_results)
    companies = unique_companies.merge(cro_df, on="company_name_extracted", how="left")

    # ── 3. RBO nationality lookup ─────────────────────────────────────────────
    print("\n  RBO nationality lookup …")
    rbo_results = []
    for _, row in companies.iterrows():
        comp_num = row.get("cro_company_num", "")
        if comp_num and comp_num != "Not Found":
            rbo = scrape_rbo_nationality(comp_num, cache)
        else:
            rbo = {"nationality": "Unknown", "country": "Unknown", "rbo_scraped": False}
        rbo_results.append(rbo)

    save_cache(cache)
    rbo_df = pd.DataFrame(rbo_results)
    companies = pd.concat([companies.reset_index(drop=True), rbo_df], axis=1)

    # ── 4. Save corporate buyers ──────────────────────────────────────────────
    companies.to_parquet(OUT_CORP, index=False)
    print(f"\n✅  Corporate buyers saved → {OUT_CORP}  ({len(companies):,} companies)")

    # ── 5. Nationality aggregation by district ────────────────────────────────
    # Join back to individual transactions
    df_corp2 = df_corp.merge(
        companies[["company_name_extracted", "nationality", "country", "cro_status"]],
        on="company_name_extracted",
        how="left"
    )
    df_corp2["nationality"] = df_corp2["nationality"].fillna("Unknown")

    nat_by_district = (
        df_corp2[df_corp2["eircode_district"].notna()]
        .groupby(["eircode_district", "county", "nationality"])
        .agg(
            tx_count     = ("price", "count"),
            total_spend  = ("price", "sum"),
            median_price = ("price", "median"),
        )
        .reset_index()
    )
    nat_by_district.to_parquet(OUT_NAT, index=False)
    print(f"✅  Nationality map saved → {OUT_NAT}")

    # ── 6. Summary ────────────────────────────────────────────────────────────
    print("\n── Corporate Buyer Summary ──")
    print(f"  Total corporate transactions ≥€{min_price:,}: {len(df_corp2):,}")
    print(f"  Total corporate spend: €{df_corp2['price'].sum()/1e9:.2f}B")
    print(f"\n── Top Companies by Spend ──")
    top = companies.head(15)[["cro_company_name", "total_spend", "tx_count", "cro_status"]]
    top["total_spend"] = top["total_spend"].map(lambda x: f"€{x/1e6:.1f}M")
    print(top.to_string(index=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-companies", type=int, default=200)
    parser.add_argument("--min-price",     type=int, default=500_000)
    args = parser.parse_args()
    run(max_companies=args.max_companies, min_price=args.min_price)
