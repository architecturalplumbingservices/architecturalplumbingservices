# Shady Shaun — Quotation & Pricing System
A quotation system for **Shady Shaun**, who takes on handyman, building and electrical work, and runs **construction site works** as a general building contractor.

### Trades covered
* Architectural performance coatings (painting and waterproofing)
* General handyman work and small repairs
* Electrical work (plug points, lights, fault finding, COC testing)
* Building work (brickwork, walls, slabs, doorways, ceilings)
* Plastering & skimming
* Plumbing, drainage, geysers and excavation
### Construction site works
* Site establishment, hoarding, access and demobilisation
* Demolition, soft strip-out and structural breaking
* Structural concrete: footings, columns, suspended slabs, retaining structures
* Formwork and reinforcement (props, shutterply, rebar, mesh)
* Roofing and waterproofing (trusses, sheeting, tiling, torch-on)
* Plant and equipment hire (excavators, TLB, cranes, pumps, compactors)
* Site services and preliminaries (supervision, setting out, waste, standing time)
* Wet trades and tiling, and hard landscaping (kerbs, paving, retaining walls)
### Features
* Predefined services and job scenarios across all trades
* Automatic line items for common jobs
* Editable quantities and prices
* Labour, materials, equipment and site work costs
* Remove or add items as required
* Automatic quotation calculations
* Professional quotation generation
### Purpose
Make quotations **faster, easier and more consistent**.

### Run On This PC

Open `index.html` in a browser for offline use, or serve this folder through any static web server.

### Publish To The Web

This repository includes a GitHub Pages deployment workflow. After the changes are committed and pushed to `main`:

1. Open the repository's **Settings** > **Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Open the **Actions** tab and wait for **Deploy GitHub Pages** to finish.
4. Open the published GitHub Pages URL for this repository from any device with an internet connection.

The app remains offline-capable after its first successful load. Saved quotes, company settings, custom scenarios, and photos are stored locally in each browser. They are not automatically shared between devices.

### Contact and banking details
* **Contact:** Shaun — 071 683 1908
* **Account name:** SW Futcher
* **Bank:** Standard Bank, Centurion
* **Account no:** 301269017
* **Branch code:** 012645
These appear on the printed quotation under *Banking details*.

### Storage keys
Local data is stored under `ss-*` keys (previously `apc-*`, and `pipewise-*` before that). On first load the app migrates any existing data from the old keys automatically, so saved quotes, settings and price lists are not lost in the rename.
