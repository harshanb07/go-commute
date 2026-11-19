# GO Commute

An iPhone home-screen widget that shows the next 3 GO train / bus departures for a preset route, with live delays and platform info.

Built for my own commute first — Bramalea ↔ Union — so I can glance at my phone and know if I need to run for the train.

## What it does

- Shows the next 3 departures for one preset route
- Shows departure time, countdown (`in 12 min`, `1h 5m`, `now`), platform, and delay status
- Colour-codes delays: green = on time, yellow = 1–4 min late, red = 5+ min late
- Shows a "Last updated" line
- Handles late-night / no-service and fetch failures with a clear message instead of crashing — "Couldn't fetch data – tap to retry"

## Routes

Set the route in the widget Parameter in Scriptable. Route keys are case-insensitive.

| Route key | Route | Stop code |
| --- | --- | --- |
| `BE-UN` | Bramalea → Union | `BE` |
| `MO-MC` | Mount Pleasant GO → McMaster | `00296` |
| `MC-MO` | McMaster → Mount Pleasant GO | `00310` |

`BE-UN` is the default if no Parameter is set.

## How it works

```
Scriptable widget (JavaScript, iPhone)
  → FastAPI (Python, Google Cloud Run)
  → Metrolinx Open Data API
```

- The widget never sees the API key. Only the backend holds it.
- The backend returns departure **timestamps** in ISO 8601 with the `America/Toronto` offset. The **phone** computes "in X min" from its own clock, so countdowns stay correct between refreshes.
- The backend sorts by `ComputedDepartureTime` (Metrolinx does not return lines sorted by time) and returns only the next 3 in your direction.
- Live API: `https://go-commute-api-602387977262.northamerica-northeast2.run.app`

### API

**`GET /departures/{route}`**

Example: `GET /departures/be-un`

Returns:

```json
[
  {
    "departs": "2026-11-19T17:42:00-05:00",
    "platform": "11",
    "trip": "1234",
    "delay_min": 3
  }
]
```

- `400 Unknown route` if the route is not in the allowlist
- `502 Couldn't fetch data` if Metrolinx can't be reached

### Repo layout

```
go-commute/
├── widget/go-commute.js     # Scriptable widget (UI, countdown, colours)
├── backend/api.py           # FastAPI app and routes, no Metrolinx details
├── backend/realtime.py      # Metrolinx calls, filtering, parsing, caching
├── tests/test_departures.py # Currently empty placeholder
├── requirements.txt
├── Procfile                 # Cloud Run: uvicorn backend.api:app
└── .env.example             # Copy to .env and add your key (see below)
```

## Run it yourself

### 1. Get a Metrolinx API key

You need a key from the Metrolinx Open Data API. The backend reads it from the environment as `GO_API_KEY`.

Create a `.env` file in the repo root:

```
GO_API_KEY=your_key_here
```

Never commit `.env` — it is gitignored.

### 2. Run the backend locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.api:app --reload
```

Then open `http://localhost:8000/docs` to try it, or:

```bash
curl http://localhost:8000/departures/be-un
```

### 3. Set up the widget

1. Install [Scriptable](https://scriptable.app/) on iPhone
2. Copy `widget/go-commute.js` into Scriptable
3. Add a Scriptable widget to your home screen
4. Long-press the widget → Edit Widget → Parameter → enter a route, e.g. `BE-UN`
5. Tap the widget to refresh

iOS decides when widgets refresh, usually every 5–15 minutes. Tapping forces a refresh.

## Design choices / guards

These are here because the backend is public and the Metrolinx key costs money if abused:

- **60-second cache per stop** in `backend/realtime.py` — spamming the endpoint does not spam Metrolinx
- **Allowlist of preset routes** — unknown routes return `400`, so the API can't be used as a general Metrolinx proxy
- **10-second timeout** on outbound Metrolinx calls
- **Cloud Run max instances = 1**, with a $1 budget alert set on the GCP project
- **API key in Secret Manager on Cloud Run**, never in code. Locally it lives only in `.env`

Deployed as Cloud Run service `go-commute-api`, project `commute-widget-hb`, region `northamerica-northeast2`.

## Tech stack

| Layer | Technology |
| --- | --- |
| Widget | Scriptable (JavaScript), iOS Widget |
| Backend | Python, FastAPI + Uvicorn |
| Transit data | Metrolinx Open Data API (`Stop/NextService`) |
| Hosting | Google Cloud Run |
| Secrets | Google Secret Manager (`GO_API_KEY`) |

## Metrolinx quirks I ran into

- Do **not** append `.json` to API paths — it causes "Bad request" / 404. Send `Accept: application/json` instead.
- Responses always include `Metadata.ErrorCode`. HTTP 200 can still mean an error, so check `ErrorCode == "200"`.
- `NextService` returns only the next few trips, not the full day, and lines are not sorted by time.
- Times are naive strings (`YYYY-MM-DD HH:MM:SS`) in Toronto local time — attach `ZoneInfo("America/Toronto")` before returning them.
- `NextService` can be `null` or `Lines` empty late at night. That is handled as no departures, not a crash.
- `ActualPlatform` is often empty until assigned — fall back to `ScheduledPlatform` when it is.

## Limitations

- Single trips only, no transfers. Journeys with transfers are not in v1.
- One route per widget. Return trips need a second widget with a different Parameter.
- Refresh timing is controlled by iOS (5–15 min), not by the app.
- Only `.txt`-style live departure data via `NextService` — no full schedule browsing in v1.

## Roadmap

- Return trips via the same script, using Scriptable's widget Parameter
- Journeys with transfers (`Schedule/Journey`) merged with live delays
- Native SwiftUI + WidgetKit app with in-app route setup

## Attribution

Data used in this product or service is provided with the permission of Metrolinx.
