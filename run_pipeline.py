#!/usr/bin/env python3
"""
run_pipeline.py — Ireland Wealth Map  |  Full Pipeline Runner
Steps: 1=Clean PPR, 2=Geocode, 3=Daft/Apify, 4=Affluence Index,
       5=Export, 6=Eircode Districts, 7=CRO Corporate, 8=RBO Nationality

Usage:
    python run_pipeline.py                    # full run
    python run_pipeline.py --fast             # steps 1,4,5,6,7 (no geocode/daft/rbo)
    python run_pipeline.py --steps 1,6,7      # specific steps
    python run_pipeline.py --force            # re-run all
"""
import argparse, os, subprocess, sys, time
from pathlib import Path

STEPS = {
    1: ("Clean PPR",                   "pipeline/01_clean_ppr.py"),
    2: ("Geocode addresses",            "pipeline/02_geocode.py"),
    3: ("Fetch Daft enrichment",        "pipeline/03_fetch_daft.py"),
    4: ("Compute Affluence Index",      "pipeline/04_affluence_index.py"),
    5: ("Export county outputs",        "pipeline/05_export.py"),
    6: ("Eircode district granularity", "pipeline/06_eircode_districts.py"),
    7: ("CRO corporate buyers",         "pipeline/07_cro_rbo_scraper.py"),
    8: ("RBO nationality (Playwright)", "pipeline/07b_rbo_playwright.py"),
}
OUTPUTS = {
    1: Path("data/processed/ppr_clean.parquet"),
    2: Path("data/processed/ppr_geocoded.parquet"),
    3: Path("data/processed/daft_enrichment.parquet"),
    4: Path("data/processed/affluence_county.parquet"),
    5: Path("output/county_summary.json"),
    6: Path("data/processed/eircode_districts.parquet"),
    7: Path("data/processed/corporate_buyers.parquet"),
    8: Path("data/processed/rbo_nationality_cache.json"),
}

def run_step(n, force=False, extra=None):
    name, script = STEPS[n]
    if not force and OUTPUTS[n].exists():
        print(f"  ⏭  Step {n} [{name}] — skipping (output exists)")
        return True
    print(f"\n{'='*55}\n  Step {n}: {name}\n{'='*55}")
    t0 = time.time()
    ok = subprocess.run([sys.executable, script] + (extra or [])).returncode == 0
    print(f"\n  {'✅' if ok else '❌'}  Step {n} {'done' if ok else 'FAILED'} in {time.time()-t0:.1f}s")
    return ok

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--force",        action="store_true")
    p.add_argument("--fast",         action="store_true")
    p.add_argument("--skip-geocode", action="store_true")
    p.add_argument("--skip-daft",    action="store_true")
    p.add_argument("--skip-rbo",     action="store_true")
    p.add_argument("--steps",        default="")
    args = p.parse_args()

    if args.steps:
        to_run = [int(s) for s in args.steps.split(",")]
    elif args.fast:
        to_run = [1, 4, 5, 6, 7]
    else:
        to_run = list(STEPS.keys())
        if args.skip_geocode: to_run.remove(2)
        if args.skip_daft:    to_run.remove(3)
        if args.skip_rbo:     to_run.remove(8)

    print(f"\n🗺  Ireland Wealth Map Pipeline — steps: {to_run}")
    t0 = time.time()
    for n in to_run:
        extra = []
        if n == 3:
            token = os.getenv("APIFY_TOKEN","")
            if not token: print("  ⚠  APIFY_TOKEN not set — skipping step 3"); continue
            extra = ["--token", token]
        if not run_step(n, args.force, extra): break

    print(f"\n✅  Pipeline done in {(time.time()-t0)/60:.1f} min\n")

if __name__ == "__main__": main()
