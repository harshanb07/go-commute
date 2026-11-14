// GO Commute widget (v1 test) for Scriptable
// Set the route per widget: long-press widget → Edit Widget → Parameter (e.g. BE-UN)

const API = "https://go-commute-api-602387977262.northamerica-northeast2.run.app";
const DEFAULT_ROUTE = "BE-UN"; // must match a key in ROUTES on the backend
const ROUTE = (args.widgetParameter || DEFAULT_ROUTE).trim();

const C = {
  bg1: new Color("#0b3d2e"),
  bg2: new Color("#145c43"),
  text: Color.white(),
  dim: new Color("#b8e0d2"),
  warn: new Color("#ff9f43"),
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

// ---------- ui ----------
function baseWidget() {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [C.bg1, C.bg2];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  w.setPadding(12, 14, 10, 14);

  const title = w.addText(ROUTE.replace("-", " → "));
  title.font = Font.boldSystemFont(13);
  title.textColor = C.text;
  w.addSpacer(6);
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
  f.textOpacity = 0.8;
}

function row(w, dep) {
  const departs = new Date(dep.departs);
  const r = w.addStack();
  r.centerAlignContent();

  const time = r.addText(clock(departs));
  time.font = Font.boldMonospacedSystemFont(17);
  time.textColor = C.text;

  r.addSpacer(8);

  const cd = r.addText(countdown(dep.departs));
  cd.font = Font.mediumSystemFont(13);
  cd.textColor = C.dim;

  r.addSpacer();

  if (dep.delay_min > 0) {
    const late = r.addText(`+${dep.delay_min}  `);
    late.font = Font.boldSystemFont(12);
    late.textColor = C.warn;
  }

  const plat = r.addText(dep.platform ? `P${dep.platform}` : "P–");
  plat.font = Font.mediumSystemFont(13);
  plat.textColor = C.dim;

  w.addSpacer(4);
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