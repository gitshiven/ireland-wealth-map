"""
Step 5 — Export All Outputs for Dashboard
==========================================
Exports: county_summary.json, heatmap_points.json, top_streets.json,
         price_trends.json, emerging_areas.json, nationality_map.json,
         affluence_report.xlsx
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd

COUNTY     = Path("data/processed/affluence_county.parquet")
INDEXED    = Path("data/processed/affluence_index.parquet")
DISTRICTS  = Path("data/processed/eircode_districts.parquet")
EMERGING   = Path("data/processed/emerging_areas.parquet")
CORP       = Path("data/processed/corporate_buyers.parquet")
NAT_MAP    = Path("data/processed/nationality_map.parquet")
OUT        = Path("output")
OUT.mkdir(exist_ok=True)

def nan_safe(obj):
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)): return None
    if isinstance(obj, dict):  return {k: nan_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):  return [nan_safe(v) for v in obj]
    return obj

def export_json(data, path, label):
    with open(path, "w") as f:
        json.dump(nan_safe(data), f, indent=2, default=str)
    size = Path(path).stat().st_size / 1024
    print(f"  ✓ {label:<35} {size:>7.1f} KB")

def run():
    county  = pd.read_parquet(COUNTY)
    indexed = pd.read_parquet(INDEXED)

    # 1. County summary
    export_json(county.replace({float("nan"): None}).to_dict(orient="records"),
                OUT/"county_summary.json", "county_summary.json")

    # 2. Heatmap points
    map_df = indexed[indexed["lat"].notna() & indexed["lng"].notna() & indexed["is_full_market"]]
    if len(map_df) > 50_000: map_df = map_df.sample(50_000, random_state=42)
    export_json(map_df[["lat","lng","price","county","affluence_index","sale_year","price_tier"]]
                .replace({float("nan"):None}).to_dict(orient="records"),
                OUT/"heatmap_points.json", "heatmap_points.json")

    # 3. Price trends
    trend = (indexed[indexed["is_full_market"]]
             .groupby(["county","sale_year"])["price"]
             .agg(median="median", mean="mean", count="count")
             .reset_index().sort_values(["county","sale_year"]))
    trend_dict = {c: g.drop(columns="county").replace({float("nan"):None}).to_dict(orient="records")
                  for c, g in trend.groupby("county")}
    export_json(trend_dict, OUT/"price_trends.json", "price_trends.json")

    # 4. Top streets / Eircode districts
    if "eircode_district" in indexed.columns:
        streets = (indexed[indexed["is_full_market"] & indexed["eircode_district"].notna()]
                   .groupby(["county","eircode_district"])
                   .agg(median_price=("price","median"), sale_count=("price","count"),
                        luxury_count=("is_luxury","sum"), max_price=("price","max"))
                   .reset_index())
        streets = streets[streets["sale_count"] >= 3]
        top = (streets.sort_values("median_price", ascending=False)
               .groupby("county").head(10)
               .sort_values(["county","median_price"], ascending=[True,False]))
        export_json(top.replace({float("nan"):None}).to_dict(orient="records"),
                    OUT/"top_streets.json", "top_streets.json")

    # 5. Emerging areas (View 1 — the surprise insight)
    if DISTRICTS.exists():
        dist = pd.read_parquet(DISTRICTS)
        export_json(dist.replace({float("nan"):None}).to_dict(orient="records"),
                    OUT/"district_data.json", "district_data.json")
    if EMERGING.exists():
        emrg = pd.read_parquet(EMERGING)
        export_json(emrg.replace({float("nan"):None}).to_dict(orient="records"),
                    OUT/"emerging_areas.json", "emerging_areas.json")

    # 6. Nationality / corporate ownership (View 2)
    if CORP.exists():
        corp = pd.read_parquet(CORP)
        if len(corp) > 0:
            export_json(corp.replace({float("nan"):None}).to_dict(orient="records"),
                        OUT/"corporate_buyers.json", "corporate_buyers.json")
            # Nationality summary
            nat_summary = (corp.groupby("nationality")
                           .agg(company_count=("nationality","count"),
                                total_spend=("total_spend","sum"))
                           .reset_index().sort_values("total_spend", ascending=False))
            export_json(nat_summary.replace({float("nan"):None}).to_dict(orient="records"),
                        OUT/"nationality_summary.json", "nationality_summary.json")
    if NAT_MAP.exists():
        nat = pd.read_parquet(NAT_MAP)
        if len(nat) > 0:
            export_json(nat.replace({float("nan"):None}).to_dict(orient="records"),
                        OUT/"nationality_map.json", "nationality_map.json")

    # 7. Excel report
    excel_path = OUT/"affluence_report.xlsx"
    with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
        county.sort_values("affluence_rank").to_excel(writer, sheet_name="County Leaderboard", index=False)
        (indexed[indexed["is_full_market"]].groupby(["county","price_tier"]).size()
         .unstack(fill_value=0).reset_index()
         .to_excel(writer, sheet_name="Price Distribution", index=False))
        (indexed[indexed["is_full_market"]].groupby(["county","sale_year"])["price"]
         .median().unstack("sale_year")
         .to_excel(writer, sheet_name="Yearly Median Prices"))
        if DISTRICTS.exists():
            dist = pd.read_parquet(DISTRICTS)
            dist.sort_values("surprise_rank").head(50).to_excel(writer, sheet_name="Top Emerging Districts", index=False)
    print(f"  ✓ {'affluence_report.xlsx':<35} {excel_path.stat().st_size/1024:>7.1f} KB")
    print(f"\n✅  All exports complete → {OUT}/")

if __name__ == "__main__":
    run()
