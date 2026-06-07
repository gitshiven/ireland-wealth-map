"""
Test geocoding with real PPR luxury addresses before committing to full run.
Tests 20 addresses and reports match rate.
"""
import time
import requests
import pandas as pd
from pathlib import Path

IN = Path("data/processed/ppr_clean.parquet")
HEADERS = {"User-Agent": "IrelandWealthMap/1.0 (research project, Dublin)"}

def nominatim(address: str, county: str) -> tuple | None:
    # Strategy 1: last 2 parts of address + county
    parts = [p.strip() for p in address.split(",")]
    query1 = ", ".join(parts[-2:]) + f", {county}, Ireland" if len(parts) >= 2 else f"{address}, {county}, Ireland"

    # Strategy 2: just the street name + county (simpler, often works better)
    query2 = f"{parts[0].strip()}, {county}, Ireland"

    for query in [query1, query2]:
        try:
            r = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": 1, "countrycodes": "ie"},
                headers=HEADERS,
                timeout=10,
            )
            results = r.json()
            if results:
                return (float(results[0]["lat"]), float(results[0]["lon"]), query)
        except Exception as e:
            print(f"  Error: {e}")
        time.sleep(1.1)

    return None

def run():
    df = pd.read_parquet(IN)
    luxury = df[df["is_luxury"] == True].head(20)
    print(f"Testing {len(luxury)} luxury addresses...\n")

    matched = 0
    for i, (idx, row) in enumerate(luxury.iterrows()):
        result = nominatim(row["address"], row["county"])
        if result:
            matched += 1
            print(f"✅ [{i+1}] {row['address'][:50]}")
            print(f"      → lat:{result[0]:.4f} lng:{result[1]:.4f}")
            print(f"      query: {result[2]}")
        else:
            print(f"❌ [{i+1}] {row['address'][:50]} ({row['county']})")
        print()

    print(f"Match rate: {matched}/{len(luxury)} = {matched/len(luxury)*100:.0f}%")
    if matched/len(luxury) >= 0.6:
        print("✅ Good enough — safe to run full geocoding")
    else:
        print("⚠️  Low match rate — need different strategy")

if __name__ == "__main__":
    run()
