"""
Step 5 — Export All Outputs for Dashboard
==========================================
Includes snap-to-coast fix for heatmap points that land in the sea.
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd

COUNTY     = Path("data/processed/affluence_county.parquet")
INDEXED    = Path("data/processed/affluence_index.parquet")
GEOCODED   = Path("data/processed/ppr_geocoded.parquet")
DISTRICTS  = Path("data/processed/eircode_districts.parquet")
EMERGING   = Path("data/processed/emerging_areas.parquet")
CORP       = Path("data/processed/corporate_buyers.parquet")
NAT_MAP    = Path("data/processed/nationality_map.parquet")
OUT        = Path("output")
OUT.mkdir(exist_ok=True)

# ── Ireland coastline snap grid ───────────────────────────────────────────────
# (lat_min, lat_max, lng_snap) — if a point falls east of lng_snap in this
# lat band, pull it back to lng_snap (the actual coastline longitude)
COAST_SNAPS = [
    # East coast — Dublin bay and south
    (53.10, 53.20, -6.04),   # Wicklow / Greystones
    (53.20, 53.28, -6.07),   # Killiney / Dalkey / Dun Laoghaire
    (53.28, 53.35, -6.09),   # Dun Laoghaire / Sandymount
    (53.35, 53.42, -6.11),   # Dublin city / Clontarf
    (53.42, 53.50, -6.10),   # Malahide / Portmarnock
    (53.50, 53.58, -6.12),   # Rush / Skerries
    (53.58, 53.68, -6.15),   # Balbriggan
    (53.68, 53.80, -6.22),   # Drogheda area
    (53.80, 54.00, -6.30),   # Dundalk / Carlingford
    # Southeast coast
    (52.10, 52.40, -6.35),   # Wexford coast
    (52.40, 52.60, -6.95),   # Waterford coast
    # South coast
    (51.80, 52.10, -7.80),   # Cork coast
]

def snap_to_coast(lat: float, lng: float) -> tuple[float, float]:
    """If a point is in the sea (east of Ireland's coast), snap it to land."""
    for lat_min, lat_max, lng_snap in COAST_SNAPS:
        if lat_min <= lat <= lat_max and lng > lng_snap:
            # Add small jitter so snapped points don't all stack exactly
            return lat, lng_snap + np.random.uniform(-0.008, 0.008)
    # Also clip any point clearly outside Ireland's bounding box
    # Ireland: lat 51.4-55.4, lng -10.7 to -5.9
    if lng > -5.9 or lng < -10.7 or lat > 55.4 or lat < 51.4:
        return None, None
    return lat, lng

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

    # 2. Heatmap points — with snap-to-coast fix
    print("  Building heatmap_points.json from geocoded data ...")
    if GEOCODED.exists():
        geo = pd.read_parquet(GEOCODED)
        aff_cols = ["county", "affluence_index", "affluence_rank", "affluence_tier"]
        if all(c in indexed.columns for c in aff_cols):
            county_aff = indexed[aff_cols].drop_duplicates("county")
            geo = geo.merge(county_aff, on="county", how="left")

        map_df = geo[
            geo["lat"].notna() & geo["lng"].notna() & geo["is_full_market"]
        ][["lat", "lng", "price", "county", "sale_year", "price_tier",
           "geo_source", "is_luxury"]].copy()

        # Apply snap-to-coast
        snapped = 0
        dropped = 0
        new_lats, new_lngs = [], []
        for _, row in map_df.iterrows():
            lat, lng = snap_to_coast(row["lat"], row["lng"])
            if lat is None:
                dropped += 1
            elif (lat != row["lat"] or lng != row["lng"]):
                snapped += 1
            new_lats.append(lat)
            new_lngs.append(lng)

        map_df["lat"] = new_lats
        map_df["lng"] = new_lngs
        map_df = map_df[map_df["lat"].notna()]

        print(f"    Snap-to-coast: {snapped:,} points corrected, {dropped:,} out-of-bounds dropped")

        # Sample — prioritise nominatim
        nominatim = map_df[map_df["geo_source"] == "nominatim"]
        centroid  = map_df[map_df["geo_source"] == "county_centroid"]
        n_centroid = max(0, 50000 - len(nominatim))
        if len(centroid) > n_centroid:
            centroid = centroid.sample(n_centroid, random_state=42)
        map_df = pd.concat([nominatim, centroid], ignore_index=True)

        map_records = map_df.replace({float("nan"): None}).to_dict(orient="records")
        with open(OUT / "heatmap_points.json", "w") as f:
            json.dump(nan_safe(map_records), f, default=str)
        size = (OUT / "heatmap_points.json").stat().st_size / 1024
        print(f"  ✓ {'heatmap_points.json':<35} {size:>7.1f} KB  ({len(nominatim):,} precise + {len(centroid):,} centroid)")
    else:
        print("  ⚠  ppr_geocoded.parquet not found — skipping heatmap")

    # 3. Price trends
    trend = (indexed[indexed["is_full_market"]]
             .groupby(["county","sale_year"])["price"]
             .agg(median="median", mean="mean", count="count")
             .reset_index().sort_values(["county","sale_year"]))
    trend_dict = {c: g.drop(columns="county").replace({float("nan"):None}).to_dict(orient="records")
                  for c, g in trend.groupby("county")}
    export_json(trend_dict, OUT/"price_trends.json", "price_trends.json")

    # 4. Top streets
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

    # 5. Districts + Emerging
    if DISTRICTS.exists():
        dist = pd.read_parquet(DISTRICTS)
        export_json(dist.replace({float("nan"):None}).to_dict(orient="records"),
                    OUT/"district_data.json", "district_data.json")
    if EMERGING.exists():
        emrg = pd.read_parquet(EMERGING)
        export_json(emrg.replace({float("nan"):None}).to_dict(orient="records"),
                    OUT/"emerging_areas.json", "emerging_areas.json")

    # 6. Corporate / nationality
    if CORP.exists():
        corp = pd.read_parquet(CORP)
        if len(corp) > 0:
            export_json(corp.replace({float("nan"):None}).to_dict(orient="records"),
                        OUT/"corporate_buyers.json", "corporate_buyers.json")
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
            dist.sort_values("surprise_rank").head(50).to_excel(
                writer, sheet_name="Top Emerging Districts", index=False)
    print(f"  ✓ {'affluence_report.xlsx':<35} {excel_path.stat().st_size/1024:>7.1f} KB")
    print(f"\n✅  All exports complete → {OUT}/")

if __name__ == "__main__":
    run()