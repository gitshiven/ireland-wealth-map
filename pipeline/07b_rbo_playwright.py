"""
Step 7b — RBO Playwright Scraper (Nationality)
================================================
Uses Playwright to automate the RBO form at rbo.gov.ie.
Handles CAPTCHA-free sessions (RBO does not currently use CAPTCHA).

Input : data/processed/corporate_buyers.parquet
Output: data/processed/corporate_buyers.parquet  (updated with real nationalities)

Usage:
    pip install playwright
    playwright install chromium
    python pipeline/07b_rbo_playwright.py
    python pipeline/07b_rbo_playwright.py --headless false  # watch it work
"""

import argparse
import json
import time
from pathlib import Path

import pandas as pd

CORP_FILE  = Path("data/processed/corporate_buyers.parquet")
CACHE_FILE = Path("data/processed/rbo_nationality_cache.json")
RBO_URL    = "https://www.rbo.gov.ie/search.aspx"


def load_cache() -> dict:
    if CACHE_FILE.exists():
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}


def save_cache(cache: dict):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)


def scrape_rbo_batch(company_numbers: list[str], headless: bool = True) -> dict:
    """
    Use Playwright to query RBO for each company number.
    Returns {company_num: {nationality, country, owner_name, ownership_pct}}
    """
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
    except ImportError:
        print("❌  Playwright not installed. Run: pip install playwright && playwright install chromium")
        return {}

    results = {}
    cache   = load_cache()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        page = context.new_page()

        for i, comp_num in enumerate(company_numbers):
            if comp_num in cache:
                results[comp_num] = cache[comp_num]
                continue

            if not comp_num or comp_num in ("", "Not Found"):
                results[comp_num] = {"nationality": "Unknown", "rbo_found": False}
                continue

            try:
                print(f"  [{i+1}/{len(company_numbers)}] RBO lookup: {comp_num}")
                page.goto(RBO_URL, timeout=15000)
                page.wait_for_load_state("networkidle", timeout=10000)

                # Fill company number field
                page.fill('input[name*="company"], input[id*="company"], input[placeholder*="company" i]', comp_num)
                page.click('button[type="submit"], input[type="submit"]')
                page.wait_for_load_state("networkidle", timeout=10000)

                # Extract results table
                rows = page.query_selector_all("table tr")
                owners = []
                for row in rows[1:]:   # skip header
                    cells = row.query_selector_all("td")
                    if len(cells) >= 4:
                        owners.append({
                            "owner_name":    cells[0].inner_text().strip() if cells[0] else "",
                            "nationality":   cells[2].inner_text().strip() if len(cells) > 2 else "Unknown",
                            "country":       cells[3].inner_text().strip() if len(cells) > 3 else "Unknown",
                        })

                if owners:
                    # Take first/primary owner
                    result = {
                        "rbo_found":   True,
                        "nationality": owners[0]["nationality"],
                        "country":     owners[0]["country"],
                        "owner_name":  owners[0]["owner_name"],
                        "all_owners":  owners,
                    }
                else:
                    result = {"rbo_found": False, "nationality": "Unknown", "country": "Unknown"}

                results[comp_num]  = result
                cache[comp_num]    = result
                time.sleep(1.5)   # polite delay

                if (i + 1) % 10 == 0:
                    save_cache(cache)

            except PlaywrightTimeout:
                print(f"    Timeout for {comp_num}")
                results[comp_num] = {"rbo_found": False, "nationality": "Unknown"}
            except Exception as e:
                print(f"    Error for {comp_num}: {e}")
                results[comp_num] = {"rbo_found": False, "nationality": "Error"}

        browser.close()

    save_cache(cache)
    return results


def run(headless: bool = True, max_companies: int = 200):
    if not CORP_FILE.exists():
        print("❌  Run 07_cro_rbo_scraper.py first")
        return

    df = pd.read_parquet(CORP_FILE)
    print(f"Loaded {len(df):,} companies")

    # Only scrape companies we have CRO numbers for and haven't yet scraped
    to_scrape = df[
        (df["cro_company_num"].notna()) &
        (df["cro_company_num"] != "") &
        (df["cro_company_num"] != "Not Found") &
        (df.get("rbo_scraped", pd.Series(False, index=df.index)) == False)
    ]["cro_company_num"].tolist()[:max_companies]

    print(f"  Companies to scrape from RBO: {len(to_scrape)}")

    if not to_scrape:
        print("  Nothing to scrape — all done or no CRO numbers found")
        return

    nationality_data = scrape_rbo_batch(to_scrape, headless=headless)

    # Update the dataframe
    for idx, row in df.iterrows():
        comp_num = str(row.get("cro_company_num", ""))
        if comp_num in nationality_data:
            nat = nationality_data[comp_num]
            df.at[idx, "nationality"]   = nat.get("nationality", "Unknown")
            df.at[idx, "country"]       = nat.get("country", "Unknown")
            df.at[idx, "rbo_scraped"]   = nat.get("rbo_found", False)

    df.to_parquet(CORP_FILE, index=False)
    print(f"\n✅  Updated corporate buyers with RBO nationality data")

    # Print nationality breakdown
    nat_counts = df["nationality"].value_counts()
    print("\n── Nationality Breakdown of Corporate Property Buyers ──")
    print(nat_counts.head(20).to_string())
    print(f"\n  Irish: {nat_counts.get('Irish', nat_counts.get('Ireland', 0)):,}")
    non_irish = nat_counts[~nat_counts.index.isin(["Irish", "Ireland", "Unknown", "Pending"])].sum()
    print(f"  Non-Irish (known): {non_irish:,}")
    print(f"  Unknown: {nat_counts.get('Unknown', 0) + nat_counts.get('Pending', 0):,}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--headless",       default="true")
    parser.add_argument("--max-companies",  type=int, default=200)
    args = parser.parse_args()
    run(
        headless=(args.headless.lower() != "false"),
        max_companies=args.max_companies
    )
