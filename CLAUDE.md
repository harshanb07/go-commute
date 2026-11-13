# GO Commute

iPhone home-screen widget that shows the next 3 GO train/bus departures for a preset route. My idea, built for my own Bramalea ↔ Union commute first.

## How I want help (read this first)

- **I'm hand-writing this project to learn.** Do NOT write full implementations unless I explicitly say "just write it."
- Default mode: review my code, explain errors, give hints (concept → API name → tiny example), in that order. Let me pick how far down the ladder to go.
- Keep answers short and direct. No architecture lectures.
- **Never read, print, or edit `.env`.** It holds my API key.

## Keeping this file current

- When a v1 requirement is met **and verified** (code runs, tested, or I confirm it), check off its box in "Shitty v1 requirements". Don't check boxes on unverified work.
- When I make a request, decision, or idea during a session that isn't already in this file, append it to "Session log" at the bottom as a one-line dated entry (e.g. `- 2026-11-13: decided countdown is computed on the phone`). Tell me in one line that you added it.
- When we discover an API gotcha or bug cause, add it to "Metrolinx API facts" instead of the log.
- Never delete or rewrite my existing lines without asking.

## Architecture (v1)

```
Scriptable widget (JS, iPhone)  →  FastAPI (Python, Google Cloud Run)  →  Metrolinx Open Data API
```

- The widget never sees the API key. Only the backend holds it.
- Backend returns departure **timestamps** (ISO 8601, `America/Toronto` offset). The **phone** computes "in X min" using its own clock, so countdowns stay correct between refreshes and with caching.
- Cloud Run scales to zero and starts on request. The key is set as an env var/secret in Cloud Run, never in code.

## Repo layout

- `backend/realtime.py`: Metrolinx calls, filtering, parsing. No HTTP route logic.
- `backend/api.py`: FastAPI app and routes. No Metrolinx details.
- `.env` (gitignored): `GO_API_KEY=...`
- `.env.example` (committed): `GO_API_KEY=`
- Run locally: `source .venv/bin/activate && uvicorn backend.api:app --reload`, then test at `localhost:8000/docs`

## Metrolinx API facts (verified)

- Base: `https://api.openmetrolinx.com/OpenDataAPI/api/V1`
- Auth: query param `?key=...`
- **Do NOT append `.json` to paths.** It causes "Bad request" / 404. Send the header `Accept: application/json` instead.
- Responses always include `Metadata.ErrorCode`. HTTP 200 can still mean an error, so check `ErrorCode == "200"`.
- Stop codes: `BE` = Bramalea GO, `UN` = Union Station GO. Find others via `Stop/All`.
- `NextService` returns only the next few trips (seen: 5 lines covering ~1 hr, both directions mixed), not the full day.
- `Lines` are **not sorted by time**. Sort by `ComputedDepartureTime` yourself.
- At `BE`, both directions are named after their terminus: "GT - Union Station" (eastbound) and "GT - Mount Pleasant GO" (westbound).
- `Stop/NextService/{StopCode}`: live departures at a stop. Per line: `LineCode` (`GT` = Kitchener), `ServiceType` (`T` train / `B` bus), `DirectionName` (e.g. "GT - Union Station"), `ScheduledDepartureTime`, `ComputedDepartureTime` (includes delay), `ScheduledPlatform`, `ActualPlatform` (often `""` until assigned; prefer it when set), `TripNumber`.
- `DirectionCode` can have trailing spaces (e.g. `"GT   "`). Strip it before comparing, or filter on `DirectionName` instead.
- Times are naive strings `"YYYY-MM-DD HH:MM:SS"` in Toronto local time. Attach `ZoneInfo("America/Toronto")`.
- `NextService` can be `null` or `Lines` empty (late night). Must handle.
- `Schedule/Journey/{YYYYMMDD}/{From}/{To}/{HHMM}/{Max}`: trips with transfers (not v1).
- Attribution required: "Data used in this product or service is provided with the permission of Metrolinx." Don't use GO/GO Transit trademarks in the app name.

## Shitty v1 requirements

- [ ] Widget updates dynamically (iOS decides, ~5–15 min; tap to refresh)
- [ ] Shows next 3 departures on a preset route + platform (single trips only, no transfers)
- [ ] "Last updated" line on the widget
- [ ] Countdown: minutes when < 60, hour format when ≥ 60 (computed on phone)
- [ ] No crash when there are no trips (late night)
- [ ] Clear error state if backend/Metrolinx/network fails ("Couldn't fetch data – tap to retry")
- [ ] Anti-spam:
  - [x] Cache Metrolinx responses ~60s per stop
  - [x] Allowlist of preset routes (reject everything else with 400)
  - [ ] Google Cloud budget alert at $1
  - [ ] Cloud Run max instances = 1
  - [x] Timeout on outbound Metrolinx calls
- [ ] Metrolinx attribution (needed once friends use it)
- [ ] 5+ people using it and giving feedback

## Future (not v1)

- Return trips: likely a second widget using the same script, with the route set via Scriptable's widget Parameter (`args.widgetParameter`)
- Native SwiftUI + WidgetKit app with in-app route setup
- Journeys with transfers (`Schedule/Journey`) merged with live delays


## Session log
- 2026-11-13: teaching mode for realtime.py: one line/block at a time, explain in 1–2 sentences, wait for "next"; I type all code, Claude only edits CLAUDE.md
- 2026-11-13: changed pace: give a couple lines (small block) per step, not one
- 2026-11-13: backend returns delay in minutes (Computed − Scheduled) so widget can show "+3" in orange
- 2026-11-13: phone (not backend) skips departures already in the past, since its clock is current
