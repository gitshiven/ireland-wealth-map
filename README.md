# 🗺 Ireland Wealth Map

> *Where money lives in Ireland — and where it's moving.*

A full-stack data project mapping property wealth concentration across all 26 Irish counties and 160+ Eircode districts. Built on the Residential Property Price Register (600k+ transactions since 2010), enriched with live Daft.ie listings and CRO/RBO corporate ownership intelligence.

**Live demo:** [ireland-wealth-map.vercel.app](https://ireland-wealth-map.vercel.app)

---

## Two Views

### View I — Emerging vs Established Wealth
Which areas are becoming wealthy fastest, and where is new money displacing old? Eircode-district level granularity with a Surprise Score (CAGR × inverse baseline price) that surfaces genuinely non-obvious findings.

### View II — Who Really Owns Ireland
Nationality of beneficial owners behind corporate property purchases ≥€500k. CRO company lookup + RBO Playwright scraper. The data no one has visualised cleanly.

---

## Stack

| Layer | Tech |
|-------|------|
| Data pipeline | Python — pandas, geopandas, scikit-learn, Playwright |
| Live enrichment | Apify — haketa/daft-scraper |
| Geocoding | postcodes.io (Eircode) + Nominatim (OSM) |
| Deprivation index | Pobal HP Index 2022 |
| Corporate ownership | CRO API + RBO Playwright scraper |
| Dashboard | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Deploy | Vercel |

---

## Data Sources

| Source | What | Cost |
|--------|------|------|
| [Property Price Register](https://propertypriceregister.ie) | All Irish residential sales 2010–present | Free |
| [Daft.ie](https://daft.ie) via Apify | Live asking prices, BER, geo | ~$1/1000 listings |
| [postcodes.io](https://postcodes.io) | Eircode → lat/lng | Free |
| [Nominatim OSM](https://nominatim.openstreetmap.org) | Address geocoding | Free |
| [Pobal HP Index](https://pobal.ie) | Deprivation scores by electoral division | Free |
| [CRO](https://cro.ie) | Company registration lookup | Free |
| [RBO](https://rbo.gov.ie) | Beneficial owner nationality (public) | Free |

---

## Affluence Index Formula

Weighted composite — all components normalised to 0–100:

| Component | Weight |
|-----------|--------|
| Median sale price | 30% |
| 5-year price CAGR | 25% |
| Luxury sale share (≥€1m) | 20% |
| Daft median asking price | 15% |
| BER quality (% A/B rated) | 10% |

---

## Setup

```bash
# 1. Clone
git clone https://github.com/gitshiven/ireland-wealth-map
cd ireland-wealth-map

# 2. Python deps
pip install pandas pyarrow geopandas numpy requests geopy scikit-learn openpyxl tqdm shapely playwright
playwright install chromium

# 3. Get data
wget -O data/raw/PPR-ALL.csv "https://www.propertypriceregister.ie/..."
wget -O data/raw/pobal_deprivation_2022.csv "https://www.pobal.ie/..."

# 4. Set Apify token
export APIFY_TOKEN=apify_api_xxxx

# 5. Run pipeline (fast mode — skips overnight geocoding)
python run_pipeline.py --fast

# 6. Start dashboard
cd dashboard
npm install
npm run dev
# → http://localhost:3000
```

---

## Project Structure

```
ireland-wealth-map/
├── pipeline/
│   ├── 01_clean_ppr.py          # Clean 600k PPR rows
│   ├── 02_geocode.py            # Eircode + Nominatim geocoding (overnight)
│   ├── 03_fetch_daft.py         # Apify → Daft.ie live listings
│   ├── 04_affluence_index.py    # Composite Affluence Index + Gini
│   ├── 05_export.py             # JSON + Excel exports
│   ├── 06_eircode_districts.py  # District granularity + Surprise Score
│   ├── 07_cro_rbo_scraper.py    # CRO corporate buyer lookup
│   └── 07b_rbo_playwright.py    # RBO nationality scraper
├── dashboard/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main page + view switcher
│   │   │   ├── layout.tsx       # Root layout + metadata
│   │   │   └── globals.css      # Design tokens + Playfair Display
│   │   ├── components/
│   │   │   ├── EmergingView.tsx # View I — Emerging vs Established
│   │   │   └── CorporateView.tsx# View II — Who Owns Ireland
│   │   ├── hooks/
│   │   │   └── useData.ts       # Data fetching hooks
│   │   └── types/
│   │       └── index.ts         # TypeScript interfaces
│   └── public/data/             # Pipeline JSON outputs (auto-copied)
├── output/                      # Pipeline outputs
│   ├── county_summary.json
│   ├── district_data.json
│   ├── emerging_areas.json
│   ├── heatmap_points.json
│   ├── price_trends.json
│   └── top_streets.json
└── run_pipeline.py              # Master pipeline runner
```

---

Built by Shiven — Dublin, Ireland
