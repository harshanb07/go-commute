// GO Commute widget (v1) for Scriptable
// Set the route per widget: long-press widget → Edit Widget → Parameter (e.g. BE-UN, MO-MC)

const API = "https://go-commute-api-602387977262.northamerica-northeast2.run.app";
const DEFAULT_ROUTE = "BE-UN"; // must match a key in ROUTES on the backend (case doesn't matter)
const ROUTE = (args.widgetParameter || DEFAULT_ROUTE).trim().toUpperCase();

// Friendly titles; unknown routes fall back to "XX → YY"
const TITLES = {
  "BE-UN": "Bramalea → Union",
  "MO-MC": "Mount Pleasant → McMaster",
};

const C = {
  bg1: new Color("#1c1c1e"),   // iOS dark gray
  bg2: new Color("#2c2c2e"),
  text: Color.white(),
  dim: new Color("#8e8e93"),
  divider: new Color("#3a3a3c"),
  ok: new Color("#30d158"),    // on time
  warn: new Color("#ffd60a"),  // 1–4 min late
  late: new Color("#ff453a"),  // 5+ min late
};

// ---------- data ----------
async function fetchDepartures() {
  const req = new Request(`${API}/departures/${encodeURIComponent(ROUTE)}`);
  req.timeoutInterval = 10;
  const data = await req.loadJSON();
  const status = req.response?.statusCode;
  if (status !== 200) throw new Error(data?.detail || `HTTP ${status}`);
  return data;
}

// "in X min" computed on the phone with its own clock
function countdown(departs) {
  const mins = Math.floor((new Date(departs) - new Date()) / 60000);
  if (mins <= 0) return "now";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function clock(d) {
  const f = new DateFormatter();
  f.dateFormat = "h:mm a";
  return f.string(d);
}

// Pick a color + label from how late the trip is
function delayStatus(delayMin) {
  if (delayMin >= 5) return { color: C.late, label: `+${delayMin} min` };
  if (delayMin >= 1) return { color: C.warn, label: `+${delayMin} min` };
  return { color: C.ok, label: "On time" };
}

// ---------- ui ----------
function baseWidget() {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [C.bg1, C.bg2];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  w.setPadding(12, 14, 10, 14);

  const title = w.addText(TITLES[ROUTE] || ROUTE.replace("-", " → "));
  title.font = Font.boldSystemFont(14);
  title.textColor = C.text;
  title.lineLimit = 1;
  title.minimumScaleFactor = 0.7;
  w.addSpacer(8);
  return w;
}

function message(w, text) {
  w.addSpacer();
  const t = w.addText(text);
  t.font = Font.mediumSystemFont(14);
  t.textColor = C.dim;
  w.addSpacer();
}

function footer(w) {
  w.addSpacer();
  const f = w.addText(`Updated ${clock(new Date())} · Data: Metrolinx`);
  f.font = Font.systemFont(9);
  f.textColor = C.dim;
}

function row(w, dep) {
  const departs = new Date(dep.departs);
  const status = delayStatus(dep.delay_min);

  const r = w.addStack();
  r.centerAlignContent();

  // colored bar on the left = status at a glance
  const bar = r.addStack();
  bar.size = new Size(3, 20);
  bar.backgroundColor = status.color;
  bar.cornerRadius = 1.5;
  r.addSpacer(8);

  const time = r.addText(clock(departs));
  time.font = Font.boldMonospacedSystemFont(17);
  time.textColor = dep.delay_min >= 1 ? status.color : C.text;

  r.addSpacer(8);

  const cd = r.addText(countdown(dep.departs));
  cd.font = Font.mediumSystemFont(13);
  cd.textColor = C.dim;

  r.addSpacer();

  const st = r.addText(status.label);
  st.font = Font.semiboldSystemFont(12);
  st.textColor = status.color;

  r.addSpacer(10);

  const plat = r.addText(dep.platform ? `P${dep.platform}` : "P–");
  plat.font = Font.mediumMonospacedSystemFont(13);
  plat.textColor = C.dim;

  w.addSpacer(5);
}

// ---------- main ----------
const w = baseWidget();

try {
  const deps = await fetchDepartures();
  const upcoming = deps
    .filter(d => new Date(d.departs) > new Date(Date.now() - 60000)) // drop ones that already left
    .slice(0, 3);

  if (upcoming.length === 0) {
    message(w, "No upcoming trips");
  } else {
    upcoming.forEach(d => row(w, d));
  }
} catch (e) {
  console.error(e);
  message(w, "Couldn't fetch data – tap to retry");
}

footer(w);
w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000); // hint only; iOS decides

if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  await w.presentMedium();
}
Script.complete();
