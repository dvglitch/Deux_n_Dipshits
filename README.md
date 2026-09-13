# Deux n Dipshits (DnD Cooldown Combat & Campaign Dashboard)

A tailored, real-time combat and campaign operations dashboard built specifically for D&D cooldown-based combat. It provides a synchronized TV display for the table, mobile-friendly remotes for players (with spell lookup and spell slot resource tracking), a fast DM mobile controller, and a full laptop control & campaign maintenance workspace backed by Supabase PostgreSQL.

---

## Architecture & Device Surfaces

| Surface | Device & Route | Purpose |
| --- | --- | --- |
| **Home** | [http://localhost:5000/](http://localhost:5000/) | Navigation landing page with deep-links to all workflows. |
| **Session Control** | [http://localhost:5000/control?mode=session](http://localhost:5000/control?mode=session) | DM laptop panel for live combat, initiative sync, master locks, and fresh session start. |
| **Campaign Maintenance** | [http://localhost:5000/control?mode=maintenance](http://localhost:5000/control?mode=maintenance) | DM laptop workspace for managing party profiles, spellbook, world maps with pins, objectives, and session recaps. |
| **TV Display** | [http://localhost:5000/display](http://localhost:5000/display) | Shared screen view for the room. Features combat timers with visual HP bars & conditions, bottom enemy status ribbon, and live tabs for World Map, Objectives, and Recaps. |
| **DM Mobile** | [http://localhost:5000/dm](http://localhost:5000/dm) | DM phone controller for real-time timer management, quick +/- HP adjustments, on-the-fly enemy creation, and TV tab switching. |
| **Player Remote** | [http://localhost:5000/remote](http://localhost:5000/remote) | Player phone interface: no-scroll cooldown card with giant reset action, searchable spellbook with detail modal/slot-casting, and interactive spell-slot bubbles & HP adjustments. |
| **QR Code** | [http://localhost:5000/qr](http://localhost:5000/qr) | Connection utility for players at the table to scan and open their remotes. |

---

## Combat System: Cooldown Mechanics

In this system, standard D&D initiative is replaced by action cooldowns:
- **Actions**: Attacks, spells, and major actions require your timer to reach `0:00` (Ready).
- **Reset**: After taking an action, tap **⚡ Action Taken** to restart your cooldown.
- **Bonus Actions & Movement**: Replenish each time you act and are not blocked by active cooldowns.
- **Initiative**: Sets relative cooldown duration (higher initiative = shorter cooldown = more frequent actions).

---

## Local Development Setup

### Prerequisites
- Python 3.11+ (Python 3.14 supported)
- Virtual environment (recommended)

### Installation
```powershell
# 1. Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# 2. Install dependencies & editable package
pip install --upgrade pip
pip install -r requirements.txt
pip install -e .

# 3. Configure environment variables (optional for local SQLite testing)
cp .env.example .env
```

### Running the App Locally
```powershell
python app.py
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## Running Automated Tests

Run the complete test suite (39 unit, state boundary, realtime, roster, and campaign API tests):

```powershell
python -m unittest discover -s tests -v
```

Tests run automatically in GitHub Actions on every push and pull request via [`.github/workflows/tests.yml`](.github/workflows/tests.yml).

---

## Database & Persistence (Supabase PostgreSQL)

- **Durable Campaign Data**: Stored in PostgreSQL (`campaign_records` table) for party profiles, spellbook, world maps, objectives, and session recaps.
- **Disposable Live State**: Combat timers, conditions, remaining slots, and active enemies are held in-memory and synchronized in real-time via WebSockets / Socket.IO polling. Server restarts clear disposable state without affecting campaign data.
- **Health Check Endpoint**: Verify database connection status at:
  ```text
  GET /api/persistence/health
  ```
  Returns `{"backend": "PostgresCampaignRepository", "database": "ok"}` when connected.

### Environment Variables
Configure these in your local `.env` and in Vercel Project Settings:

```env
DATABASE_URL=postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_STORAGE_BUCKET=player-portraits
```
*(Vercel's Supabase Integration automatically injects `POSTGRES_URL` and `POSTGRES_PRISMA_URL`.)*

---

## Vercel Deployment

This project deploys directly to Vercel via GitHub integration on pushes to `main`.
- **Framework Preset**: Flask
- **Root Directory**: `./` (repository root)
- **Install Command**: `pip install -r requirements.txt`
- **Output Directory**: None
- **Fluid Compute**: Enabled