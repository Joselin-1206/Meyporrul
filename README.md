# மெய்ப்பொருள் — Full-stack prototype

Tamil literary quote verifier with a browser frontend, Python JSON API, and SQLite corpus database.

## Requirements

- Windows laptop
- Python 3.10 or newer (standard library only; no pip install required)
- Current Chrome, Edge, or Firefox

## Run the application

1. From this folder, double-click `run.bat`.
2. Keep the opened terminal running.
3. Use the URL printed in the terminal. The app tries ports 5173–5182 and picks the first available one.
4. Add `/api/health` to that URL to confirm the backend and 1,330-record database are ready.

`run.bat` imports the included Project Madurai HTML snapshot, then starts the app. The server reads `data/tirukkural.json`, validates the 1–1330 numbering, and creates/refreshes `data/meypporul.sqlite3`; the database is generated locally and is intentionally not committed. The server selects the first free local port from 5173 through 5182. A hosted environment can supply `PORT`; public deployment should use a production-grade server rather than Python's built-in HTTP server.

To refresh the source corpus when internet is available, run `node scripts/fetch_corpus.js`. Review the downloaded data before presenting it as an authoritative edition. The current dataset source is <https://github.com/tk120404/thirukkural> and does not claim to be a critical or institutionally certified edition.

## Kural Witness Board — edition comparison

The quote result has a **பதிப்புகளுடன் ஒப்பிடு** action. It displays each ingested source reading and printed number separately, marks exact matches, text variants, and text-to-number conflicts, and never silently rewrites a source. `run.bat` imports the included source snapshot automatically. To import it manually, run:

```powershell
python scripts/import_project_madurai.py
```

The importer reads the saved source snapshot when available (otherwise downloads it), keeps the complete HTML including its attribution header at `data/source_snapshots/project_madurai_pmuni0001.html`, records its SHA-256, and stores the literal printed label separately from the text-matched Kural reference. Duplicate labels or labels that differ from the text are surfaced as conflicts; the source label is never silently rewritten. Reload the page after import.

Source: <https://www.projectmadurai.org/pm_etexts/utf8/pmuni0001.html>. Project Madurai permits free distribution provided its header is kept intact; the importer retains the complete source page. For public redistribution, review every source's terms and attribution requirements.

## Project structure

```text
index.html                 Tamil frontend structure
style.css                  Responsive presentation and comparison styling
app.js                     UI actions, API calls, rendering and word diff
backend/server.py          HTTP server, verification logic and API routes
scripts/import_project_madurai.py  Edition snapshot importer and parser
data/tirukkural.json       Source corpus input (1,330 records)
data/meypporul.sqlite3     Generated local SQLite database
scripts/fetch_corpus.js    Dataset download and numbering validation
tests/test_backend.py      Backend verification tests
run.bat                    Windows startup command
```

## Backend API

- `GET /api/health` — service and corpus status
- `GET /api/kurals` — corpus records for the frontend
- `GET /api/kurals/{number}` — one Kural by number
- `GET /api/witness/{number}` — imported readings for one Kural, with provenance and discrepancy labels
- `POST /api/verify` — JSON body: `{"text":"Tamil quote"}`
- `POST /api/gate` — JSON body: `{"draft":"...","quote":"optional selected quote"}`

The verification API returns `exact`, `format`, `partial`, `altered`, `not-found`, or `insufficient` plus a source record when one is found. Approximate similarity only locates a possible source; it never certifies an altered quote as authentic. The gate checks only the pasted draft and is not connected to external AI providers.

## Run backend tests

```powershell
python -m unittest discover -s tests -v
```

## Hosting notes

Pushing this repository to GitHub publishes the source code; it does not make the Python API run as a public website. For a public deployment, connect the repository to a Python hosting service and use a production WSGI/ASGI server. Add reviewed/versioned literary editions, database migrations, rate limits, logging/monitoring, backups, and human review for source conflicts before production use. The Witness Board is only as complete as its imported snapshots; a missing row means “not in this local snapshot,” not “the source has no verse.” An external AI integration would require routing generated drafts through the verification API before displaying them.

“No match” means no match in the currently loaded corpus. It does not prove that the line is absent from all Tamil literature.
