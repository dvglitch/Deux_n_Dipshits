# Deux n Dipshits (DnD Cooldown Combat & Campaign Dashboard)

A tailored, real-time combat and campaign operations dashboard built specifically for D&D cooldown-based combat. It provides a synchronized TV display for the table, mobile-friendly remotes for players (with spell lookup and spell slot resource tracking), a fast DM mobile controller, and a full laptop control & campaign maintenance workspace backed by Supabase PostgreSQL.

---

## Architecture & Device Surfaces

| Surface | Device & Route | Purpose |
| --- | --- | --- |
| **Home** | [http://localhost:5000/](http://localhost:5000/) | Navigation landing page with deep-links to all workflows. |
| **Session Control** | [http://localhost:5000/control?mode=session](http://localhost:5000/control?mode=session) | DM laptop panel for live combat, initiative sync, master locks, and fresh session start. |
| **Campaign Maintenance** | [http://localhost:5000/control?mode=maintenance](http://localhost:5000/control?mode=maintenance) | DM laptop workspace for managing party profiles, spellbook, world maps with pins, objectives, and session recaps. |
| **TV Display** | [http://localhost:5000/display](http://localhost:5000/display) | Shared screen view for the room. Features combat timers with visual HP bars & conditions, bottom enemy status ribbon, and live tabs for World Map, Objectives, and Recaps. The map tab supports zoom/pan and an Edit Map mode for auto-saved, screen-sized markers, rotatable rectangles and ellipses, and lines. The map switcher remains available while editing. |
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

Run the complete test suite (unit, state boundary, realtime, roster, and campaign API tests):

```powershell
python -m unittest discover -s tests -v
```

Tests run automatically in GitHub Actions on every push and pull request via [`.github/workflows/tests.yml`](.github/workflows/tests.yml).

---

## Database & Persistence (Supabase PostgreSQL)

- **Durable Campaign Data**: Stored in PostgreSQL (`campaign_records` table) for party profiles, spellbook, world maps, objectives, and session recaps.
- **Active Session Data**: HP, spell slots, cooldowns, enemies, conditions, display tab/map, and control settings are automatically saved to the `active_session_state` table when meaningful changes occur. Timer ticks are represented by their last saved remaining time and timestamp rather than writing to the database every tick.
- **Reconnect Behavior**: Pages resume the shared active session. Since Vercel may route Socket.IO connections to separate runtimes, each page requests canonical state every two seconds; ordinary same-runtime command updates remain immediate. Timer ticks are calculated from saved timestamps, so a runtime does not broadcast its process-local timer state over newer shared state.
- **Session Controls**: The Session Control page has a **Save Session** checkpoint button. **Start New Session** deliberately resets HP/slots to profile maximums, clears temporary enemies, resets cooldowns, and returns the display to Timers. Sessions do not expire automatically.
- **Database Requirement**: Cross-runtime active-session persistence requires the configured PostgreSQL database. The local in-memory SQLite fallback does not provide durable session storage and the app reports that session storage is unavailable.
- **Health Check Endpoint**: Verify database connection status at:
  ```text
  GET /api/persistence/health
  ```
  Returns `{"backend": "PostgresCampaignRepository", "database": "ok"}` when connected.

The application creates `active_session_state` automatically when the repository connects; the table is also included in `src/dnd_clock/database/schema.sql`.

### Environment Variables
Configure these in your local `.env` and in Vercel Project Settings:

```env
DATABASE_URL=postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
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