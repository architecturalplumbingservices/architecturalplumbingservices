# APS Architectural Performance Coatings — Quotation & Pricing System
A quotation system for **Architectural Performance Coatings**, who also take on handyman, building and electrical work.

### Trades covered
* Architectural performance coatings
* General handyman work and small repairs
* Electrical work (plug points, lights, fault finding, COC testing)
* Building work (brickwork, walls, slabs, doorways, ceilings)
* Plastering & skimming
* Plumbing, drainage, geysers and excavation
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
4. Open `https://belshie1.github.io/aps/` from any device with an internet connection.

The app remains offline-capable after its first successful load. Saved quotes, company settings, custom scenarios, and photos are stored locally in each browser. They are not automatically shared between devices.

### Storage keys
Local data is stored under `apc-*` keys (previously `pipewise-*`). On first load the app migrates any existing data from the old keys automatically, so saved quotes, settings and price lists are not lost in the rename.
