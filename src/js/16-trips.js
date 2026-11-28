/* ---------- planer wyjazdów (lato) ---------- */
let SHT = [], shTimer = 0, shBusy = false;
const meName = () => TOURME || String((store.prof && store.prof.username) || "").toLowerCase();
const newTripId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const allTrips = () => [...SHT, ...TRIPS, ...(TOURDEMO ? [TOURDEMO] : [])];
const shData = t => ({name: t.name || "", from: t.from || "", to: t.to || "", note: t.note || "", items: t.items || [], dn: t.dn || {}, dnb: t.dnb || {}, costs: t.costs || [], pack: t.pack || [], settle: t.settle || [], shop: t.shop || [], dest: t.dest || "", cur: t.cur || "PLN", cc: t.cc || [], rt: t.rt || {}, rs: t.rs || {}, rd: t.rd || 0, rsvp: t.rsvp || {}, cover: t.cover || null, ar: t.ar ? 1 : 0, mode: t.mode === "w" ? "w" : "s", base: t.base || ""});
const shNorm = r => { const d = r.data || {}, t = {id: r.id, shared: true, owner: r.owner, owner_name: r.owner_name || "", members: r.members || [], invite: r.invite || "", ed: d.ed || "", _upd: r.updated_at || "", name: d.name || "Wyjazd", from: d.from || "", to: d.to || "", note: d.note || "", items: d.items || [], dn: d.dn || {}, dnb: d.dnb || {}, costs: d.costs || [], pack: d.pack || [], settle: d.settle || [], shop: d.shop || [], dest: d.dest || "", cur: d.cur || "PLN", cc: d.cc || [], rt: d.rt || {}, rs: d.rs || {}, rd: d.rd || 0, rsvp: d.rsvp || {}, cover: d.cover || null, ar: d.ar ? 1 : 0, mode: d.mode === "w" ? "w" : "s", base: d.base || ""}; t._snap = JSON.stringify(shData(t)); return t; };
async function loadShared(force){
  if (!SBC || !store.sb || !store.authed || RO || shBusy) return;
  if (!force && SHT.some(t => JSON.stringify(shData(t)) !== t._snap)) return;
  shBusy = true;
  try { const r = await store.sb.from("shared_trips").select("*").order("updated_at", {ascending: false}); if (r.error) throw r.error;
    const sig = a => JSON.stringify(a.map(t => [t.id, t._snap, t.members]));
    const prev = sig(SHT), old = SHT; SHT = (r.data || []).map(shNorm).map(n => { const o = old.find(x => x.id === n.id); if (!o) return n;
      if (JSON.stringify(shData(o)) !== o._snap) { o.members = n.members; o.invite = n.invite; o.owner_name = n.owner_name; return o; }
      const ui = {}; Object.keys(n).forEach(k => { o[k] = n[k]; }); return o; });
    if (sig(SHT) !== prev) renderTrips();
  } catch(e){}
  shBusy = false;
}
function saveSharedSoon(){ clearTimeout(shTimer); shTimer = setTimeout(async () => {
  for (const t of SHT) { const js = JSON.stringify(shData(t)); if (js === t._snap) continue;
    try { const r = await store.sb.from("shared_trips").update({data: Object.assign(shData(t), {ed: meName()})}).eq("id", t.id); if (r && r.error) throw r.error; t._snap = js; t.ed = meName(); setSaveState("wyjazd zapisany ✓"); }
    catch(e){ setSaveState("nie udało się zapisać wyjazdu"); if (!t._warned) { t._warned = 1; alert("Nie udało się zapisać zmian we wspólnym wyjeździe: " + String((e && e.message) || e).slice(0, 90) + "\nSprawdź, czy SQL dla wyjazdów został uruchomiony."); } setTimeout(saveSharedSoon, 8000); } } }, 700); }
const tripSave = () => { scheduleSave(); if (SHT.length) saveSharedSoon(); };
setInterval(() => { const v = $("v-wyjazdy"); if (v && v.classList.contains("on") && !document.hidden) loadShared(false); }, 20000);
/* zaproszenia linkiem */
(function(){ const m = /^#trip\/([0-9a-f-]{36})\.([0-9a-z]+)$/i.exec(location.hash); if (m) { try { sessionStorage.setItem("skibeen.join", m[1] + "." + m[2]); history.replaceState(null, "", location.pathname + location.search); } catch(e){} } })();
async function tryJoin(){
  let j = null; try { j = sessionStorage.getItem("skibeen.join"); } catch(e){}
  if (!j || !SBC || !store.sb || RO) return;
  if (!store.authed) return;
  const [tid, tok] = j.split(".");
  try { const r = await store.sb.rpc("join_trip", {tid, tok}); if (r.error) throw r.error; sessionStorage.removeItem("skibeen.join");
    await loadShared(true); tripOpen = tid; { const tj = SHT.find(x => x.id === tid), mm = (tj && tj.mode) || "s"; if (MODE !== mm) setMode(mm); } show("wyjazdy"); renderTrips(); alert("Dołączyłeś do wyjazdu ✓"); }
  catch(e){ try { sessionStorage.removeItem("skibeen.join"); } catch(_){} alert("Nie udało się dołączyć do wyjazdu: " + String((e && e.message) || e).slice(0, 90) + "\nUstaw nazwę użytkownika w koncie i otwórz link jeszcze raz."); }
}
if (SBC) setTimeout(() => { let j = null; try { j = sessionStorage.getItem("skibeen.join"); } catch(e){} if (j && !store.authed && typeof openAccount === "function") openAccount(); }, 3500);
/* pomocnicze */
const hrs = t => { return 0;
  /* czasy tras wyłączone, dopóki nie zostaną zweryfikowane */  const s = String(t || ""), nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map(x => parseFloat(x.replace(",", "."))); if (!nums.length) return 0; const a = nums.reduce((p, q) => p + q, 0) / nums.length; return /min/i.test(s) && !/h/i.test(s) ? a / 60 : a; };
const fmtH = h => h ? "≈ " + (Math.round(h * 2) / 2).toString().replace(".", ",") + " h" : "";
const dayISO = (from, k) => { if (!from) return ""; const d = new Date(from + "T12:00:00"); if (isNaN(d)) return ""; d.setDate(d.getDate() + k - 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const dayDate = (from, k) => { const iso = dayISO(from, k); if (!iso) return ""; return new Date(iso + "T12:00:00").toLocaleDateString(LOC(), {weekday: "short", day: "numeric", month: "numeric"}); };
const tripDays = t => { let n = 3; if (t.from && t.to) { const a = new Date(t.from), b = new Date(t.to); if (!isNaN(a) && !isNaN(b)) n = Math.max(1, Math.min(21, Math.round((b - a) / 864e5) + 1)); } (t.items || []).forEach(i => { if (i.day > n) n = i.day; }); return n; };
const tripHike = it => { if (it.custom) return {r: undefined, h: undefined}; if (it.m === "w") return {r: byIdW[it.p], h: undefined}; const r = byIdS[it.p]; const h = r && (r.hikes || []).find(z => z.n === it.n && !z.del); return {r, h}; };
const unitT = (t, n) => t && t.mode === "w" ? plur(n, "ośrodek", "ośrodki", "ośrodków") : plur(n, "szlak", "szlaki", "szlaków");
const packDef = m => m === "w" ? PACK_DEF_W : PACK_DEF;
const CSYM = {PLN: "zł", EUR: "€", USD: "$", CHF: "CHF", GBP: "£", NOK: "NOK", NZD: "NZ$", ISK: "ISK", KGS: "KGS"}, CBUILT = ["PLN", "EUR", "USD", "CHF", "GBP", "NOK", "NZD", "ISK"], CMAN = ["KGS"];
const cNorm = c => { c = String(c || "").trim(); const u = c.toUpperCase(); return !c || c === "zł" || u === "PLN" ? "PLN" : c === "€" ? "EUR" : c === "$" ? "USD" : u.slice(0, 6); };
const baseC = t => cNorm(t.cur);
const allC = t => [...new Set([...CBUILT, ...CMAN, ...(t.cc || []), baseC(t)])];
const cRate = (t, k) => k === baseC(t) ? 1 : (t.rt && t.rt[k] > 0 ? t.rt[k] : null);
const convC = (t, c) => { const k = cNorm(c.cu || t.cur); if (k === baseC(t)) return c.a; if (c.fr > 0) return c.a * c.fr; const r = cRate(t, k); return r == null ? null : c.a * r; };
const money = (n, cur) => { const k = cNorm(cur); return (Math.round(n * 100) / 100).toLocaleString(LOC(), {minimumFractionDigits: 0, maximumFractionDigits: 2}) + " " + (CSYM[k] || k); };
const dtNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const dtShow = dt => { const d = new Date(dt); return isNaN(d) ? "" : d.toLocaleString(LOC(), {day: "numeric", month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit"}); };
const dtField = (id, val) => `<div class="fld" style="margin-top:6px"><label>DATA I GODZINA ZAKUPU</label><input id="${id}" type="datetime-local" class="lin" value="${esc(val || dtNow())}" max="${dtNow()}"><div class="small" style="margin-top:3px">Zmiana dnia przelicza kurs waluty obcej na kurs z tego dnia.</div></div>`;
async function fxAt(t, cu, dt) {
  const b = baseC(t), day = String(dt || "").slice(0, 10), cur = cRate(t, cu);
  if (cu === b || !day || day >= dtNow().slice(0, 10) || (t.rs && t.rs[cu] === "m") || !CBUILT.includes(b) || !CBUILT.includes(cu)) return {fr: cu === b ? undefined : cur};
  try { const r = await fetch("https://api.frankfurter.dev/v1/" + day + "?base=" + b + "&symbols=" + cu); if (!r.ok) throw 0; const j = await r.json(), v = j.rates && j.rates[cu]; if (v > 0) return {fr: Math.round(1e6 / v) / 1e6, fd: day}; } catch (e) {}
  return {fr: cur, fail: true};
}
let FXBUSY = false, FXFAIL = 0;
async function fxRefresh(t, force) { if (FXBUSY || (!force && Date.now() - FXFAIL < 3e5)) return false; const b = baseC(t); if (!CBUILT.includes(b)) return false; const ks = allC(t).filter(k => k !== b && CBUILT.includes(k) && t.rs[k] !== "m"); if (!ks.length) return false; if (!force && t.rd && Date.now() - t.rd < 432e5 && ks.every(k => t.rt[k] > 0)) return false; FXBUSY = true; try { const r = await fetch("https://api.frankfurter.dev/v1/latest?base=" + b + "&symbols=" + ks.join(",")); if (!r.ok) throw 0; const j = await r.json(); let ch = false; ks.forEach(k => { const v = j.rates && j.rates[k]; if (v > 0) { t.rt[k] = Math.round(1e6 / v) / 1e6; t.rs[k] = "a"; ch = true; } }); if (ch) { t.rd = Date.now(); return true; } FXFAIL = Date.now(); } catch (e) { FXFAIL = Date.now(); } finally { FXBUSY = false; } return false; }
function tripRange(t){ if (!t.from) return ""; const f = x => new Date(x + "T12:00:00").toLocaleDateString(LOC(), {day: "numeric", month: "short"}); return t.to && t.to !== t.from ? f(t.from) + " – " + f(t.to) : f(t.from); }
const tripPeople = t => t.shared ? [t.owner_name, ...(t.members || [])] : [meName() || "ja"];
const seenGet = () => { try { return JSON.parse(localStorage.getItem("skibeen.tseen") || "{}"); } catch(e){ return {}; } };
const seenSet = (id, ms) => { try { const m = seenGet(); m[id] = ms; localStorage.setItem("skibeen.tseen", JSON.stringify(m)); } catch(e){} };
const tripIsNew = t => t.shared && t.ed && t.ed !== meName() && t._upd && new Date(t._upd).getTime() > (seenGet()[t.id] || 0);
const km2 = (a, b) => { const R0 = 6371, rad = Math.PI / 180, dl = (b.y - a.y) * rad, dn = (b.x - a.x) * rad, h = Math.sin(dl / 2) ** 2 + Math.cos(a.y * rad) * Math.cos(b.y * rad) * Math.sin(dn / 2) ** 2; return 2 * R0 * Math.asin(Math.sqrt(h)); };
const votes = it => { const v = it.v || {}; let up = 0, dn = 0; Object.values(v).forEach(x => { if (x > 0) up++; else if (x < 0) dn++; }); return {up, dn, sc: up - dn}; };
const WX = {}; const WXI = c => c === 0 ? "☀️" : c <= 2 ? "🌤" : c === 3 ? "☁️" : c <= 48 ? "🌫" : c <= 57 ? "🌦" : c <= 67 ? "🌧" : c <= 77 ? "🌨" : c <= 82 ? "🌦" : c <= 86 ? "🌨" : "⛈";
async function wxFor(lat, lon, iso, elv){
  const k = lat.toFixed(2) + "|" + lon.toFixed(2) + "|" + iso + (elv ? "|" + elv : ""); if (k in WX) return WX[k];
  const EL = elv ? "&elevation=" + elv : "";
  const diff = (new Date(iso + "T12:00:00") - new Date()) / 864e5;
  const q = "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max&timezone=auto";
  try {
    if (diff >= -1 && diff <= 15) { const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}${q}${EL}&start_date=${iso}&end_date=${iso}`); const j = await r.json(); const d = j && j.daily;
      if (d && d.time && d.time.length) return (WX[k] = {el: j.elevation, c: d.weathercode[0], hi: d.temperature_2m_max[0], lo: d.temperature_2m_min[0], p: d.precipitation_probability_max[0], w: d.windspeed_10m_max[0]}); return (WX[k] = null); }
    if (diff > 15) { const y = String(+iso.slice(0, 4) - 1 - Math.max(0, Math.floor((diff - 15) / 365))) + iso.slice(4); const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto${EL}&start_date=${y}&end_date=${y}`); const j = await r.json(); const d = j && j.daily;
      if (d && d.time && d.time.length && d.temperature_2m_max[0] != null) return (WX[k] = {el: j.elevation, c: d.weathercode[0], hi: d.temperature_2m_max[0], lo: d.temperature_2m_min[0], p: null, mm: d.precipitation_sum[0], w: d.windspeed_10m_max[0], est: 1}); }
    return (WX[k] = null);
  } catch(e){ return null; }
}
const WXN = {};
async function wxNow(r){
  if (!r || r.y == null || r.x == null) return null;
  const c = WXN[r.id]; if (c && Date.now() - c.at < 108e5) return c.v;
  try {
    const el = r.e > 0 ? "&elevation=" + Math.round(r.e) : "";
    const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${r.y}&longitude=${r.x}${el}&current=temperature_2m,weather_code&hourly=snow_depth&daily=snowfall_sum&forecast_days=3&timezone=auto`)).json();
    if (!j || !j.current) throw 0;
    let d = null; const h = j.hourly; if (h && h.snow_depth && h.time) { let ix = h.time.indexOf(String(j.current.time).slice(0, 13) + ":00"); if (ix < 0) ix = 0; if (h.snow_depth[ix] != null) d = Math.round(h.snow_depth[ix] * 100); }
    const sf = j.daily && j.daily.snowfall_sum ? Math.round(j.daily.snowfall_sum.reduce((q, x) => q + (+x || 0), 0)) : 0;
    const v = {t: j.current.temperature_2m, c: j.current.weather_code, d, s3: sf}; WXN[r.id] = {at: Date.now(), v}; return v;
  } catch(e){ return null; }
}
function wxNowHtml(r, w){ return `${WXI(w.c)} ${Math.round(w.t)}°C${w.d != null && w.d >= 1 ? " · śnieg " + w.d + " cm" : ""}${w.s3 >= 1 ? " · +" + w.s3 + " cm w 3 dni" : ""}${r.e > 0 && MODE === "w" ? ` <span style="opacity:.6">(na ${r.e} m)</span>` : ""}`; }
const PACK_DEF_W = ["Buty narciarskie", "Kask", "Gogle", "Rękawice", "Kurtka narciarska", "Spodnie narciarskie", "Bielizna termoaktywna", "Skarpety narciarskie", "Komin / kominiarka", "Karnet / ski pass", "Krem z filtrem", "Okulary przeciwsłoneczne", "Ciepłe buty na po nartach", "Powerbank", "Ładowarka", "Apteczka", "Dowód / EKUZ", "Gotówka / karta", "Strój na basen / saunę"];
const PACK_DEF = ["Buty trekkingowe", "Kurtka przeciwdeszczowa", "Polar / warstwa ocieplająca", "Czapka i rękawiczki", "Czapka z daszkiem + okulary", "Krem z filtrem", "Bidon / woda", "Powerbank", "Apteczka + plastry", "Czołówka", "Kijki trekkingowe", "Przekąski / batony", "Mapa offline", "Dowód / EKUZ", "Gotówka / karta", "Zapasowe skarpety", "Pokrowiec na plecak", "Ładowarka"];
function applyTheme(){ let v = "auto"; try { v = localStorage.getItem("skibeen.theme") || "auto"; } catch(e){} const light = v === "light" || (v === "auto" && matchMedia("(prefers-color-scheme: light)").matches); document.body.classList.toggle("light", light); try { const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = light ? "#f2f6fc" : "#08111f"; } catch(e){} }
const dayCol = new Set();
let shopEd = null, costEditId = null, cmOpen = new Set(), pkOpen = new Set(), tripPrev = 0;
const PCOL = ["#ff7b8a", "#5ad1ff", "#ffd35a", "#38e0a0", "#c792ff", "#ff9f5a", "#7ab8ff", "#b6e35a"]; let PCM = {};
const pcHash = n => { let h = 0; for (const ch of String(n || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % PCOL.length; };
const pc = n => PCM[n] || PCOL[pcHash(n)];
const pn = n => `<b style="color:${pc(n)}">@${esc(n)}</b>`;
const pcAssign = ppl => { PCM = {}; const used = new Set(); ppl.forEach(p => { let i = pcHash(p), k = 0; while (used.has(i) && k++ < PCOL.length) i = (i + 1) % PCOL.length; used.add(i); PCM[p] = PCOL[i]; }); };
function renderTrips(){
  const box = $("trips"); if (!box) return; updateFab();
  if (RO) { box.innerHTML = ""; return; }
  const t = allTrips().find(x => x.id === tripOpen);
  const me = meName();
  const segH = `<div class="seg" id="tseg" style="margin-bottom:12px"><button data-s="trips" class="${tripsTab === "trips" ? "on" : ""}">Wyjazdy</button><button data-s="packs" class="${tripsTab === "packs" ? "on" : ""}">Pakowanie</button></div>`;
  const bindSeg = () => { const sg = $("tseg"); if (sg) sg.onclick = e => { const b = e.target.closest("button"); if (!b) return; tripsTab = b.dataset.s; packOpen = null; renderTrips(); }; };
  if (!t && tripsTab === "packs") { renderPacks(box, segH); bindSeg(); return; }
  if (!t) {
    box.innerHTML = segH + `<div class="hint">${MODE === "w" ? "Planer wyjazdów narciarskich: rozłóż ośrodki na dni, dodaj notatki, koszty i pakowanie, a znajomi planują razem z Tobą." : "Planer górskich wyjazdów: zbierz szlaki, rozłóż je na dni, a znajomi mogą planować razem z Tobą."}</div>` +
      (allTrips().filter(x => (x.mode || "s") === MODE).length ? allTrips().filter(x => (x.mode || "s") === MODE).sort((p, q) => (p.ar ? 1 : 0) - (q.ar ? 1 : 0)).map(x => { const its = x.items || [], hh = its.reduce((s, i) => s + hrs(tripHike(i).h && tripHike(i).h.t), 0), dn = its.filter(i => i.ok).length;
        const places = [...new Set([x.mode === "w" && x.base && byIdW[x.base] ? byIdW[x.base].n : null, ...its.map(i => tripHike(i).r && tripHike(i).r.n)].filter(Boolean))].slice(0, 3).join(", ");
        return `<div class="card tripc" data-id="${esc(x.id)}" style="cursor:pointer;display:flex;gap:12px;align-items:center${x.ar ? ";opacity:.55" : ""}"><div class="tcv" style="background:${tripCover(x).bg}">${tripCover(x).e}</div><div style="min-width:0;flex:1"><h3 style="margin:0 0 2px">${esc(x.name || "Wyjazd")}${x.ar ? ` <span class="small" style="font-weight:600">${IC.arch} Archiwum</span>` : ""}${x.shared ? ` <span class="small" style="font-weight:600">👥 ${1 + (x.members || []).length}</span>` : ""}${tripIsNew(x) ? ` <span class="small" style="color:var(--accent)">● nowe</span>` : ""}</h3><div class="sub" style="margin:0">${esc(tripRange(x))}${tripRange(x) && places ? " · " : ""}${esc(places)}</div><div class="small" style="margin-top:4px">${x.shared && x.owner !== store.uid ? "od " + pn(x.owner_name) + " · " : ""}${its.length} ${unitT(x, its.length)}${hh ? " · " + fmtH(hh) : ""}${dn ? " · zrobione " + dn + "/" + its.length : ""}</div></div></div>`; }).join("") : `<div class="empty">Nie masz jeszcze żadnego wyjazdu.</div>`) +
      `<button class="btn pri" id="tnew" style="width:100%;margin-top:6px">＋ Nowy wyjazd</button>`;
    $("tnew").onclick = () => { const x = {id: newTripId(), name: "Nowy wyjazd", from: "", to: "", note: "", items: [], dn: {}, costs: [], pack: [], cur: "zł", mode: MODE}; TRIPS.unshift(x); tripOpen = x.id; tripSave(); renderTrips(); if (MODE === "w") pickTripBase(x); };
    box.querySelectorAll(".tripc").forEach(c => c.onclick = () => openTrip(c.dataset.id));
    bindSeg(); return;
  }
  t.items = t.items || []; t.costs = t.costs || []; t.pack = t.pack || []; t.settle = t.settle || []; t.shop = t.shop || []; t.dn = t.dn || {}; t.dnb = t.dnb || {}; t.cc = t.cc || []; t.rt = t.rt || {}; t.rs = t.rs || {}; t.rsvp = t.rsvp || {};
  const base = t.mode === "w" && t.base ? byIdW[t.base] : null;
  const D = tripDays(t), total = t.items.reduce((s, i) => s + hrs(tripHike(i).h && tripHike(i).h.t), 0), ppl = tripPeople(t), shared = t.shared && ppl.length > 1; pcAssign(ppl);
  const rsv = t.rsvp || {}, RS = {y: ["Jadę", "✓", "#2fb96a"], m: ["Może", "?", "#e0a526"], n: ["Nie jadę", "✕", "#e5484d"]};
  const rsvMy = t.shared && me ? rsv[me] : "";
  const rsvTop = t.shared && me ? `<span class="small" style="font-weight:700;margin-right:2px">Chęci:</span><span id="rsvseg" style="display:inline-flex;gap:5px">${["y", "m", "n"].map(k => `<button class="rsvb ${rsvMy === k ? "on" : ""}" data-v="${k}" aria-label="${RS[k][0]}" title="${RS[k][0]}" style="${rsvMy === k ? "background:" + RS[k][2] + ";border-color:" + RS[k][2] + ";color:#fff" : ""}">${RS[k][1]}</button>`).join("")}</span>` : "";
  const rsvHtml = t.shared && me ? (() => { const cnt = k => ppl.filter(q => rsv[q] === k).length, nn = ppl.filter(q => !rsv[q]).length, pd = (SOC.outInv || []).filter(i => i.trip_id === t.id).length;
    return `<div style="margin-top:10px"><div style="display:flex;flex-wrap:wrap;gap:6px">${ppl.map(q => { const v = rsv[q], c = v ? RS[v][2] : "var(--faint)"; return `<span class="rsvc" style="border-color:${c}"><b style="color:${c}">${v ? RS[v][1] : "·"}</b> ${pn(q)}</span>`; }).join("")}</div>
      <div class="small" style="margin-top:6px">${cnt("y")} jedzie · ${cnt("m")} może · ${cnt("n")} nie jedzie${nn ? " · " + nn + " bez odpowiedzi" : ""}${pd ? " · " + pd + " zaproszonych czeka" : ""}</div></div>`; })() : "";
  const row = (it, idx) => { const {r, h} = tripHike(it), v = votes(it), cm = it.cm || [], isNew = t.shared && it.by && it.by !== me && it.at && it.at > tripPrev;
    return `<div class="hike tit ${it.ok ? "done" : ""}" data-ti="${idx}" style="margin-bottom:8px${isNew ? ";border-color:var(--accent)" : ""}"><div class="tk2"><button class="tick ${it.ok ? "on" : ""}" data-ti="${idx}" aria-label="Zrobione">✓</button></div><div class="hb" style="padding-right:26px"><a class="hlnk" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(it.custom ? it.n : it.m === "w" ? it.n + " ośrodek narciarski" : it.n + " " + (r ? r.n : "") + " szlak")}" style="color:inherit;text-decoration:underline dotted;text-underline-offset:3px"><b>${esc(it.n)}</b> <span class="small">↗</span></a> <span class="small">${it.custom ? (it.other ? "inne" : "własne miejsce") : it.m === "w" ? (r ? esc((r.c || "").split(",")[0]) : "(miejsce usunięte)") : r ? esc(r.n) : "(miejsce usunięte)"}${!it.custom && it.m !== "w" && h ? ` · <span class="d${DIFF.indexOf(h.d)}">${esc(h.d)}</span>` : ""}${it.by ? " · dodał " + pn(it.by) : ""}</span>${isNew ? ` <span class="small" style="color:var(--accent)">● nowe</span>` : ""}${it.custom ? "" : it.m === "w" ? (r ? `<div class="bd"><span>⛷ ${r.k} km tras</span>${r.e ? `<span>▲ ${r.e} m</span>` : ""}</div>` : "") : h ? "" : `<div class="small">szlak nie jest już dostępny</div>`}${it.day && t.from && r && r.y != null ? `<div class="hwx small" data-ti="${idx}" style="margin-top:4px;opacity:.9"></div>` : ""}
      <div class="tctl"><select class="sel tdaysel" data-ti="${idx}"><option value="0">Bez dnia</option>${Array.from({length: D}, (_, k) => `<option value="${k + 1}" ${it.day === k + 1 ? "selected" : ""}>Dzień ${k + 1}${dayDate(t.from, k + 1) ? " · " + dayDate(t.from, k + 1) : ""}</option>`).join("")}</select>
      ${shared ? `<span class="tvg"><button class="tvote ${(it.v || {})[me] > 0 ? "on" : ""}" data-ti="${idx}" data-v="1" aria-label="Za">${IC.up}${v.up ? `<i>${v.up}</i>` : ""}</button><button class="tvote ${(it.v || {})[me] < 0 ? "on" : ""}" data-ti="${idx}" data-v="-1" aria-label="Przeciw">${IC.down}${v.dn ? `<i>${v.dn}</i>` : ""}</button></span>` : ""}${shared || cm.length ? `<button class="tcmb ${cm.length ? "has" : ""}" data-ti="${idx}" aria-label="Komentarze">${IC.chat}${cm.length ? `<i>${cm.length}</i>` : ""}</button>` : ""}<button class="tdel tdx" data-ti="${idx}" title="Usuń z wyjazdu" aria-label="Usuń z wyjazdu">✕</button></div>
      ${cmOpen.has(idx) ? `<div style="margin-top:8px">${cm.map((c, ci) => `<div class="small" style="margin:3px 0"><b>${pn(c.u)}</b> ${esc(c.t)}${c.u === (me || "ja") ? ` <button class="tcdel" data-ti="${idx}" data-c="${ci}" style="background:none;border:0;color:#ff8a8a;cursor:pointer">✕</button>` : ""}</div>`).join("")}<div style="display:flex;gap:6px"><input class="lin tcin" data-ti="${idx}" placeholder="Napisz komentarz…" style="flex:1"><button class="btn sm pri tcsend" data-ti="${idx}">Wyślij</button></div></div>` : ""}</div><button class="thandle" title="Przeciągnij na inny dzień" aria-label="Przeciągnij">⠿</button></div>`; };
  const groups = [[0, "Do rozplanowania"], ...Array.from({length: D}, (_, k) => [k + 1, "Dzień " + (k + 1) + (dayDate(t.from, k + 1) ? " · " + dayDate(t.from, k + 1) : "")])];
  const body = groups.map(([d, lab]) => { let its = t.items.map((it, idx) => ({it, idx})).filter(z => (z.it.day || 0) === d); if (d === 0 && shared) its = its.slice().sort((a, b) => votes(b.it).sc - votes(a.it).sc);
    const hh = its.reduce((s, z) => s + hrs(tripHike(z.it).h && tripHike(z.it).h.t), 0);
    if (!its.length && d === 0) return "";
    const pl = []; its.forEach(z => { const r = tripHike(z.it).r; if (r && !pl.includes(r)) pl.push(r); }); let far = 0; for (let i = 1; i < pl.length; i++) far = Math.max(far, km2(pl[i - 1], pl[i]));
    const warn = (hh > 8 ? `<div class="small" style="color:var(--warn);margin:0 0 6px">⚠ Długi dzień (${fmtH(hh)} marszu)</div>` : "") + (far > 40 ? `<div class="small" style="color:var(--warn);margin:0 0 6px">⚠ Miejsca oddalone o ok. ${Math.round(far)} km</div>` : "");
    const c0 = pl[0] && pl[0].y != null ? pl[0] : null;
    const dd = d ? dayDate(t.from, d) : ""; return `<div class="sect tday t${d ? 1 : 0}${dayCol.has(t.id + "|" + d) ? " col" : ""}" data-d="${d}"><div class="sh">${d ? `<span class="dttl"><span class="dnum"><small>DZIEŃ</small><b>${d}</b></span><span class="dd">${esc(dd || "Dzień " + d)}</span></span>` : `<b>${esc(lab)}</b>`}<span class="small" style="display:flex;gap:8px;align-items:center">${d && dayDests(t, d).length ? `<button class="btn sm tdnav" data-d="${d}" title="Nawiguj do miejsca na ten dzień" aria-label="Nawiguj" style="padding:2px 8px;display:inline-flex;align-items:center">${IC.map}</button>` : ""}${d ? `<button class="btn sm tdaddb" data-d="${d}" style="padding:2px 9px">＋</button>` : ""}${its.length ? its.length + " " + unitT(t, its.length) + (hh ? " · " + fmtH(hh) : "") : ""}<i class="dchev"></i></span></div>${warn}${d && base ? `<div class="small" style="margin:0 0 4px">⛷ ${esc(base.n)}</div><div class="twx small" data-d="${d}" style="margin:0 0 6px"></div>` : ""}${d ? `<textarea class="lin tdn" data-d="${d}" rows="1" placeholder="Notatka">${esc(t.dn[d] || "")}</textarea>${t.shared && t.dn[d] && t.dnb[d] ? `<div class="small" style="margin:-6px 0 8px">✎ ${pn(t.dnb[d])}</div>` : ""}` : ""}${its.length ? (d ? `<div class="dsep">${t.mode === "w" ? "OŚRODKI" : "SZLAKI"}</div>` : "") + its.map(z => row(z.it, z.idx)).join("") : (d ? `<div class="small tempty" style="margin:0 0 8px;opacity:.6">Przeciągnij tu ${t.mode === "w" ? "ośrodek" : "szlak"}</div>` : "")}</div>`; }).join("");
  /* koszty */
  const cur = baseC(t), paid = {}, owe = {}, cvm = []; t.costs.forEach(c => { if (!c.cu) c.cu = cur; if (!(c.fr > 0) && cNorm(c.cu) !== cur) { const r = cRate(t, cNorm(c.cu)); if (r) c.fr = r; } }); const cv = c => { const v = convC(t, c); if (v == null) { if (!cvm.includes(cNorm(c.cu))) cvm.push(cNorm(c.cu)); return 0; } return v; }; ppl.forEach(p => { paid[p] = 0; owe[p] = 0; });
  t.costs.forEach(c => { const a = cv(c); paid[c.by] = (paid[c.by] || 0) + a; if (c.sh) { const ks = Object.keys(c.sh).filter(p => p in owe), sm = ks.reduce((q, p) => q + c.sh[p], 0) || 1; ks.forEach(p => { owe[p] = (owe[p] || 0) + a * c.sh[p] / sm; }); } else { const sp = (c.sp && c.sp.length ? c.sp : ppl).filter(p => p in owe); sp.forEach(p => { owe[p] = (owe[p] || 0) + a / sp.length; }); } });
  t.settle.forEach(z => { paid[z.from] = (paid[z.from] || 0) + z.a; paid[z.to] = (paid[z.to] || 0) - z.a; if (!(z.from in owe)) owe[z.from] = 0; if (!(z.to in owe)) owe[z.to] = 0; });
  const bal = ppl.map(p => [p, (paid[p] || 0) - (owe[p] || 0)]), cr = bal.filter(b => b[1] > 0.005).map(b => [...b]).sort((a, b) => b[1] - a[1]), db = bal.filter(b => b[1] < -0.005).map(b => [b[0], -b[1]]).sort((a, b) => b[1] - a[1]), tr = [];
  { let i = 0, j = 0; while (i < db.length && j < cr.length) { const x = Math.min(db[i][1], cr[j][1]); tr.push([db[i][0], cr[j][0], x]); db[i][1] -= x; cr[j][1] -= x; if (db[i][1] < 0.005) i++; if (cr[j][1] < 0.005) j++; } }
  const totalC = t.costs.reduce((s, c) => s + cv(c), 0);
  const lsg = k => { try { return localStorage.getItem(k + t.id) || ""; } catch (e) { return ""; } };
  const dk = (() => { const v = lsg("sht_dc_"); return v && allC(t).includes(v) && cRate(t, v) ? v : cur; })(), dr = cRate(t, dk) || 1, dm = n => money(n / dr, dk);
  const lcu = (() => { const v = lsg("sht_lc_"); return v && allC(t).includes(v) ? v : cur; })();
  const curOpts = (sel, nw) => allC(t).map(k => `<option value="${esc(k)}" ${k === sel ? "selected" : ""}>${esc(CSYM[k] && CSYM[k] !== k ? k + " · " + CSYM[k] : k)}</option>`).join("") + (nw ? `<option value="__new">Inna waluta…</option>` : "");
  const newRow = c => `<div class="${c}" style="display:none;gap:6px;align-items:center;margin-top:6px"><input class="lin ncc" maxlength="5" placeholder="Kod (np. GBP)" style="flex:1;min-width:0;padding:6px 10px;min-height:0;font-size:13px"><span class="small" style="white-space:nowrap">1 =</span><input class="lin ncr" inputmode="decimal" placeholder="przelicznik" style="flex:1;min-width:0;padding:6px 10px;min-height:0;font-size:13px"><span class="small">${esc(CSYM[cur] || cur)}</span></div>`;
  const cAmt = c => money(c.a, c.cu || cur);
  if (t.costs.some(c => cNorm(c.cu || cur) !== cur)) fxRefresh(t).then(ch => { if (ch) { tripSave(); rr(); } });
  const fxDate = t.rd ? new Date(t.rd).toLocaleDateString(LOC(), {day: "numeric", month: "short"}) : "";
  const fxHtml = `<details class="tfx" style="margin:6px 0 8px"><summary class="small" style="cursor:pointer;font-weight:700">Waluty i kursy <span style="opacity:.7;font-weight:400">· rozliczamy w ${esc(CSYM[cur] || cur)}</span> <span style="opacity:.7;font-weight:400">(kurs z dnia zakupu)</span></summary>
    <div class="card" style="margin:6px 0;padding:9px 11px"><div class="fld"><label>WALUTA ROZLICZENIA</label><select id="fxbase" class="sel">${curOpts(cur)}</select></div>
    ${allC(t).filter(k => k !== cur).map(k => { const r = t.rt[k], man = t.rs[k] === "m", cust = !CBUILT.includes(k); return `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 0;border-top:1px solid rgba(128,128,128,.25)"><span style="min-width:66px;font-size:13px">1 ${esc(CSYM[k] || k)} =</span><input class="lin fxin" data-k="${esc(k)}" inputmode="decimal" value="${r ? esc(String(r).replace(".", ",")) : ""}" placeholder="kurs" style="width:84px;padding:5px 8px;min-height:0;font-size:13px"><span style="font-size:13px">${esc(CSYM[cur] || cur)}</span><span class="small" style="flex:1;${r ? "" : "color:var(--warn)"}">${!r ? "brak kursu" : man ? "ręcznie" : "auto" + (fxDate ? " · " + fxDate : "")}</span>${man && !cust ? `<button class="btn sm fxauto" data-k="${esc(k)}">↻ auto</button>` : ""}${cust ? `<button class="tdel fxdel" data-k="${esc(k)}" title="Usuń walutę">${IC.trash}</button>` : ""}</div>`; }).join("")}
    <div style="display:flex;gap:6px;align-items:center;margin-top:8px"><button class="btn sm" id="fxref">↻ Pobierz aktualne kursy</button></div>
    <div class="tflab" style="margin-top:10px">Własna waluta</div><div style="display:flex;gap:6px"><input id="fxck" class="lin" placeholder="Kod (np. GBP)" maxlength="5" style="flex:1;padding:6px 10px;min-height:0;font-size:13px"><input id="fxcr" class="lin" inputmode="decimal" placeholder="Kurs → ${esc(CSYM[cur] || cur)}" style="flex:1;padding:6px 10px;min-height:0;font-size:13px"><button class="btn sm pri" id="fxca">Dodaj</button></div>
    <div class="small" style="opacity:.75;margin-top:6px">EUR, USD i CHF aktualizują się same (kursy dzienne EBC), ale możesz je wpisać ręcznie. Własne waluty mają kurs ręczny.</div></div></details>`;
  const sgn = x => (x > 0.005 ? "+" : x < -0.005 ? "−" : "") + dm(Math.abs(x));
  const costsHtml = `<details class="tcd tfold" ${t.costs.length ? "open" : ""}><summary>Koszty${totalC ? `<span class="sbadge">${dm(totalC)}</span>` : ""}<button type="button" class="tcplus" id="tcplus" aria-label="Dodaj wydatek" title="Dodaj wydatek">＋</button></summary>
    ${fxHtml}${cvm.length ? `<div class="small" style="color:var(--warn);margin:0 0 6px">⚠ Brak kursu: ${esc(cvm.join(", "))}. Te wydatki nie są wliczone do sum.</div>` : ""}
    ${shared && totalC ? `<div class="card" style="margin:6px 0 8px;padding:9px 11px;border:1px solid var(--acc,#4aa3ff)"><div style="font-weight:700;font-size:13px;margin-bottom:4px">Rozliczenie</div>
      ${tr.length ? tr.map(x => `<div style="font-size:14px;padding:5px 0;border-top:1px solid rgba(128,128,128,.25)"><b>${pn(x[0])}</b> oddaje <b>${pn(x[1])}</b><span style="float:right;font-weight:700;font-size:15px">${dm(x[2])}</span><div style="margin-top:4px"><button class="btn sm tset" data-f="${esc(x[0])}" data-t="${esc(x[1])}" data-a="${Math.round(x[2] * 100) / 100}">✓ Rozliczone</button></div></div>`).join("") : `<div style="font-size:14px;padding:4px 0">Wszyscy rozliczeni ✓</div>`}
      <div style="margin-top:6px;display:grid;gap:2px">${bal.map(b => `<div class="small" style="display:flex;justify-content:space-between;font-size:12px"><span>${pn(b[0])} · zapłacił ${dm(paid[b[0]] || 0)}, jego część ${dm(owe[b[0]] || 0)}</span><b style="color:${b[1] > 0.005 ? "#2fb96a" : b[1] < -0.005 ? "#e5484d" : "inherit"}">${sgn(b[1])}</b></div>`).join("")}</div>${t.settle.length ? `<details style="margin-top:8px"><summary class="small" style="cursor:pointer;font-weight:700">Rozliczone (${t.settle.length})</summary>${t.settle.slice().reverse().map(z => `<div class="frow" style="font-size:13px"><span>${pn(z.from)} oddał(a) ${pn(z.to)} <b>${dm(z.a)}</b> <span class="small">· ${esc(new Date(z.at).toLocaleDateString(LOC(), {day: "numeric", month: "short"}))}</span></span><button class="btn sm tsundo" data-id="${esc(z.id)}">Cofnij</button></div>`).join("")}</details>` : ""}</div>` : ""}
    ${t.costs.map(c => { const adder = c.ad || c.by, mine = adder === (me || "ja"); if (costEditId === c.id && mine) { const spx = (c.sp && c.sp.length ? c.sp : ppl); return `<div class="card" style="margin:5px 0;padding:9px 10px;border:1px solid var(--acc,#4aa3ff)"><div class="small" style="font-weight:700;margin-bottom:6px">✎ Edytuj wydatek</div><div style="display:flex;gap:6px"><input class="lin" id="cew" value="${esc(c.w)}" style="flex:2" placeholder="Co"><input class="lin" id="cea" inputmode="decimal" value="${esc(String(c.a).replace(".", ","))}" style="flex:1" placeholder="Kwota"><select id="cecu" class="sel" style="width:auto;flex:none">${curOpts(cNorm(c.cu || cur))}</select></div><div style="display:flex;gap:6px;margin-top:8px;align-items:flex-end"><div style="flex:1.5;min-width:0"><label class="small" style="display:block;margin-bottom:2px">Data i godzina</label><input id="cedt" type="datetime-local" class="lin" style="padding:6px 8px;font-size:13px" value="${esc(c.dt || (c.at ? new Date(c.at - new Date(c.at).getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "") || dtNow())}" max="${dtNow()}"></div><div style="flex:1;min-width:0"><label class="small" style="display:block;margin-bottom:2px" title="1 waluta = ? ${esc(CSYM[cur] || cur)}">Kurs (1 = ? ${esc(CSYM[cur] || cur)})</label><input id="cefr" class="lin" style="padding:6px 8px;font-size:13px" inputmode="decimal" data-o="${c.fr > 0 ? c.fr : ""}" value="${c.fr > 0 ? esc(String(c.fr).replace(".", ",")) : ""}" placeholder="np. 4,25"></div></div>${shared ? `<div class="fld" style="margin-top:8px"><label>KTO ZAPŁACIŁ</label><select id="ceby" class="sel">${ppl.map(p => `<option value="${esc(p)}" ${p === c.by ? "selected" : ""}>@${esc(p)}</option>`).join("")}</select></div>${splitBlock("ce", ppl, p => spx.includes(p), "Dzielimy na:", c.sh)}` : ""}<div style="display:flex;gap:6px;margin-top:8px"><button class="btn sm pri" id="cesave" data-c="${esc(c.id)}">Zapisz</button><button class="btn sm" id="cecancel">Anuluj</button></div></div>`; } return `${mine ? `<div class="swr"><div class="swa"><button class="swb tced" data-c="${esc(c.id)}">Edytuj</button><button class="swb bad tcdl" data-c="${esc(c.id)}">Usuń</button></div>` : ""}<div class="card${mine ? " swc" : ""}" style="margin:5px 0;padding:7px 10px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div style="min-width:0"><div style="font-weight:600;font-size:14px">${esc(c.w)}</div><div style="font-size:12.5px;margin-top:1px">Zapłacił: <b>${pn(c.by)}</b>${c.dt ? ` <span class="small">· ${esc(dtShow(c.dt))}</span>` : ""}</div>${shared ? `<div class="small" style="margin-top:2px">Dla: ${c.sh ? Object.keys(c.sh).map(x => pn(x) + " " + money(c.sh[x], c.cu || cur)).join(", ") : (c.sp && c.sp.length && c.sp.length < ppl.length) ? c.sp.map(x => pn(x)).join(", ") : "wszystkich"}</div>` : ""}</div><div style="text-align:right;flex:none"><div style="font-weight:700;font-size:15px">${cAmt(c)}</div>${cNorm(c.cu || cur) !== cur && convC(t, c) != null ? `<div class="small">≈ ${dm(convC(t, c))}${c.fr > 0 ? " · kurs " + String(Math.round(c.fr * 1e4) / 1e4).replace(".", ",") + (c.fd ? " z " + new Date(c.fd + "T12:00:00").toLocaleDateString(LOC(), {day: "numeric", month: "numeric"}) : "") : ""}</div>` : ""}${mine ? `<div class="swic" style="display:flex;gap:6px;justify-content:flex-end;margin-top:4px"><button class="tdel tced" data-c="${esc(c.id)}" title="Edytuj wydatek" style="background:none">${IC.edit}</button><button class="tdel tcdl" data-c="${esc(c.id)}" title="Usuń wydatek">${IC.trash}</button></div>` : ""}</div></div></div>${mine ? "</div>" : ""}`; }).join("") || `<div class="small">Brak wydatków.</div>`}
    ${t.costs.length ? `<div class="card" style="margin:10px 0 2px;padding:9px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px"><div><div class="small">Razem</div><div style="font-weight:800;font-size:18px">${dm(totalC)}</div></div><div style="display:flex;align-items:center;gap:6px"><span class="small">w walucie</span><select id="fxtot" class="sel" style="width:auto">${curOpts(dk)}</select><button type="button" class="tcplus" id="tcplus2" aria-label="Dodaj wydatek" title="Dodaj wydatek" style="margin-left:4px">＋</button></div></div>` : ""}</details>`;
  /* pakowanie */
  const pkWho = x => (x.for && x.for.length === 1 && ppl.includes(x.for[0])) ? x.for[0] : (x.who && ppl.includes(x.who) ? x.who : "");
  const pkDone = x => !!x.ok;
  const whoSel = (cls, id, cur, ph) => `<select class="sel ${cls}" ${id ? `data-id="${esc(id)}"` : 'id="tpwho"'} style="width:auto;padding:4px 6px;font-size:12px"><option value="">${ph}</option>${ppl.map(p => `<option value="${esc(p)}" ${cur === p ? "selected" : ""}>@${esc(p)}${p === me ? " (ja)" : ""}</option>`).join("")}</select>`;
  const byWho = ppl.map(p => [p, t.pack.filter(x => pkWho(x) === p)]).filter(z => z[1].length);
  const shopHtml = `<details class="tsd tfold" ${t.shop.length ? "open" : ""}><summary>Lista zakupów${t.shop.length ? `<span class="sbadge">${t.shop.filter(x => x.ok).length}/${t.shop.length}</span>` : ""}</summary>
    ${t.shop.map(x => { const c = x.cid && t.costs.find(z => z.id === x.cid); return `<div class="frow" style="flex-wrap:wrap"><label style="display:flex;gap:8px;align-items:center;min-width:0;flex:1"><input type="checkbox" class="tsk" data-id="${esc(x.id)}" ${x.ok ? "checked" : ""}> <span style="${x.ok ? "text-decoration:line-through;opacity:.6" : ""}">${esc(x.n)}</span>${x.ok && (c ? c.by : x.okby) && shared ? ` <span class="small">· kupił(a) ${pn(c ? c.by : x.okby)}</span>` : ""}${c ? ` <span class="small">· ${cAmt(c)} w kosztach${shared && c.sp && c.sp.length && c.sp.length < ppl.length ? " · dla: " + c.sp.map(x => pn(x)).join(", ") : ""}</span>` : ""}</label>${x.ok && !c && shopEd !== x.id ? `<button class="btn sm tshc" data-id="${esc(x.id)}">+ do kosztów</button>` : ""}<button class="tdel tskdl" data-id="${esc(x.id)}" title="Usuń">${IC.trash}</button>
      ${shopEd === x.id ? `<div style="width:100%;margin:2px 0 6px;display:grid;gap:6px"><div style="display:flex;gap:6px"><input class="lin tshin" inputmode="decimal" placeholder="Ile zapłaciłeś?" style="flex:1;padding:6px 10px;min-height:0;font-size:13px"><select class="sel tshcu" style="width:auto;flex:none">${curOpts(lcu, 1)}</select></div>${newRow("tshnew")}${shared ? `<div class="fld"><label>KTO ZAPŁACIŁ</label><select class="sel tshby">${ppl.map(p => `<option value="${esc(p)}" ${p === me ? "selected" : ""}>@${esc(p)}${p === me ? " (ja)" : ""}</option>`).join("")}</select></div>${splitBlock("sh", ppl, p => (t.rsvp || {})[p] !== "n", "Kupione dla:")}` : ""}<div style="display:flex;gap:6px"><button class="btn sm pri tskc" data-id="${esc(x.id)}">Dodaj do kosztów</button><button class="btn sm tsks">Pomiń</button></div></div>` : ""}</div>`; }).join("") || `<div class="small">Nic tu jeszcze nie ma. Dodaj, co trzeba kupić.</div>`}
    <div style="display:flex;gap:6px;margin:8px 0;align-items:center"><input id="tsn" class="lin" placeholder="+ do kupienia (np. makaron)" style="flex:1;padding:6px 10px;font-size:13px;min-height:0"><button class="btn sm" id="tsadd" style="padding:4px 10px;font-size:12px">Dodaj</button></div>
    <div class="small" style="opacity:.75">Po odhaczeniu możesz dopisać, ile to kosztowało. Wydatek trafi do kosztów i do rozliczenia.</div></details>`;
  const packHtml = `<details class="tpd tfold" ${t.pack.length ? "open" : ""}><summary>Do ogarnięcia przed wyjazdem${t.pack.length ? `<span class="sbadge">${t.pack.filter(pkDone).length}/${t.pack.length}</span>` : ""}</summary>
    ${shared ? `<div class="small" style="margin:0 0 6px;opacity:.8">Tu tylko wspólne sprawy do ogarnięcia, za które odpowiada konkretna osoba. Własne rzeczy do zabrania odhaczysz w zakładce „Pakowanie".</div>` : ""}
    ${t.pack.map(x => { if (!shared) return `<div class="frow"><label style="display:flex;gap:8px;align-items:center;min-width:0"><input type="checkbox" class="tpk2" data-id="${esc(x.id)}" ${x.ok ? "checked" : ""}> <span style="${x.ok ? "text-decoration:line-through;opacity:.6" : ""}">${esc(x.n)}</span></label><button class="tdel tpdl" data-id="${esc(x.id)}" title="Usuń">${IC.trash}</button></div>`;
      return `<div class="card" style="margin:4px 0;padding:7px 10px"><div style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="tpk2" data-id="${esc(x.id)}" ${x.ok ? "checked" : ""}><span style="flex:1;min-width:0;font-size:14px;${x.ok ? "text-decoration:line-through;opacity:.6" : ""}">${esc(x.n)}</span>${whoSel("tpw", x.id, pkWho(x), "kto bierze?")}<button class="tdel tpdl" data-id="${esc(x.id)}" title="Usuń">${IC.trash}</button></div></div>`; }).join("") || `<div class="small">${shared ? "Nic tu jeszcze nie ma." : "Nic tu jeszcze nie ma. Dodaj sprawę do ogarnięcia."}</div>`}
    ${shared && byWho.length ? `<div class="small" style="margin:6px 0;display:flex;gap:10px;flex-wrap:wrap">${byWho.map(([p, a]) => `<span>${pn(p)}: <b>${a.filter(x => x.ok).length}/${a.length}</b></span>`).join("")}</div>` : ""}
    <div style="display:flex;gap:6px;margin:8px 0;align-items:center"><input id="tpn" class="lin" placeholder="${shared ? "+ wspólna sprawa" : "+ sprawa do ogarnięcia"}" style="flex:1;padding:6px 10px;font-size:13px;min-height:0">${shared ? whoSel("", "", me, "kto bierze?") : ""}<button class="btn sm" id="tpadd" style="padding:4px 10px;font-size:12px">Dodaj</button></div>
  </details>`;
  box.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><button class="btn sm" id="tback">← Wszystkie wyjazdy</button><span style="flex:1"></span>${rsvTop}</div>
    <div class="card"><div class="tcover" id="tcover" style="background:${tripCover(t).bg}"><span class="tce">${tripCover(t).e}</span><span class="tcb">Zmień okładkę</span></div><div class="fld"><label>NAZWA WYJAZDU</label><input id="tname" class="lin" value="${esc(t.name || "")}"></div>
    <div style="display:flex;gap:8px"><div class="fld" style="flex:1"><label>OD</label><input id="tfrom" type="date" class="lin" value="${esc(t.from || "")}"></div><div class="fld" style="flex:1"><label>DO</label><input id="tto" type="date" class="lin" value="${esc(t.to || "")}"></div></div>
    ${t.mode === "w" ? `<div class="fld"><label>OŚRODEK (DOMYŚLNY DLA WYJAZDU)</label><button class="btn" id="tbase" style="width:100%;text-align:left">${base ? "⛷ " + esc(base.n) + " ›" : "＋ Wybierz ośrodek"}</button></div>` : ""}
    <div class="fld"><label>NOTATKI</label><textarea id="tnote" class="lin" rows="2" placeholder="Nocleg, dojazd, kto co bierze…">${esc(t.note || "")}</textarea></div>
    ${t.from ? "" : `<div class="small" style="margin:-4px 0 8px;opacity:.7">Ustaw datę „OD", żeby zobaczyć pogodę przy ${t.mode === "w" ? "ośrodkach" : "szlakach"}.</div>`}
    <div class="tsum"><span>${t.items.length} ${unitT(t, t.items.length)}${total ? " · " + fmtH(total) : ""}</span>${t.shared ? `<span class="tppl">${ppl.map(p => pn(p)).join(" ")}</span>` : ""}</div>
    ${rsvHtml}
    <div class="tact"><button class="btn sm" id="tics">${IC.cal} Kalendarz</button><button class="btn sm" id="tmap">${IC.map} Mapa</button>${(SBC && store.authed) ? `<button class="btn sm" id="tshare">${IC.users} ${t.shared ? "Uczestnicy i zaproszenie (" + ppl.length + ")" : "Współdziel ze znajomymi"}</button>` : ""}</div></div>
    <button class="btn pri" id="tadd" style="width:100%;margin:0 0 12px">＋ Dodaj cel</button>
    ${D >= 3 && body ? `<div style="display:flex;justify-content:flex-end;margin:8px 0 -18px"><button type="button" class="btn sm" id="dcall" style="padding:3px 10px;font-size:12px"></button></div>` : ""}${body || `<div class="empty">Dodaj pierwsze szlaki do wyjazdu.</div>`}
    ${costsHtml}${shopHtml}${packHtml}
    ${(() => { const auto = tripAuto(), man = actGet() === t.id; return (auto && auto.id === t.id && !man) ? `<div class="small" style="margin:10px 0 0">${IC.pin} To jest Twój obecny wyjazd: trwa jego termin.</div>` : `<button class="btn" id="tact" style="width:100%;margin:10px 0 0">${IC.pin} ${man ? "Wyłącz „obecny wyjazd”" : "Ustaw jako obecny wyjazd"}</button><div class="small" style="margin:4px 0 0">Obecny wyjazd ma skrót w prawym dolnym rogu ekranu: wydatki, zakupy, rzeczy do wzięcia. W terminie wyjazdu włącza się sam.</div>`; })()}
    ${t.items.some(i => i.p && byId[i.p]) && !RO ? `<button class="btn pri" id="tfin" style="width:100%;margin:10px 0 6px">${IC.flag} ${t.fin ? "Wyjazd zakończony · dodaj ponownie" : "Zakończ wyjazd"}</button><div class="small" style="margin:0 0 8px">${t.mode === "w" ? "Ośrodki z wyjazdu zapiszą się jako odwiedzone" : "Szlaki z wyjazdu zapiszą się jako zaliczone"}${t.shared ? " tylko u Ciebie" : ""}.</div>` : ""}
    <button class="tdelall" id="tarch" style="margin-bottom:0;text-decoration:none;color:var(--mute)"></button><button class="tdelall" id="tdelall" style="margin-top:4px"></button>`;
  const rr = () => { window.__rrT = Date.now(); const st = $("v-wyjazdy").scrollTop, open = [...box.querySelectorAll("details")].map(x => x.open); renderTrips(); box.querySelectorAll("details").forEach((x, i) => { if (open[i] !== undefined) x.open = open[i]; }); $("v-wyjazdy").scrollTop = st; };
  { const fb = $("tfin"); if (fb) fb.onclick = () => finishTrip(t); const ta = $("tact"); if (ta) ta.onclick = () => { actSet(actGet() === t.id ? "" : t.id); renderTrips(); updateFab(); toast(actGet() === t.id ? "Obecny wyjazd: " + (t.name || "wyjazd") : "Wyłączono"); }; }
  $("tback").onclick = () => { tripOpen = null; renderTrips(); };
  $("tname").onchange = e => { t.name = e.target.value.trim().slice(0, 80); tripSave(); };
  $("tcover").onclick = () => openTripCover(t);
  $("tnote").onchange = e => { t.note = e.target.value.slice(0, 1000); tripSave(); };
  $("tfrom").onchange = e => { t.from = e.target.value; if (t.to && t.to < t.from) t.to = t.from; tripSave(); rr(); };
  $("tto").onchange = e => { t.to = e.target.value; if (t.from && t.to < t.from) t.from = t.to; tripSave(); rr(); };
  box.querySelectorAll(".tick[data-ti]").forEach(b => b.onclick = () => { const it = t.items[+b.dataset.ti]; it.ok = !it.ok; tripSave(); rr(); });
  { const dk2 = el => t.id + "|" + el.dataset.d, days = [...box.querySelectorAll(".tday[data-d]")].filter(el => +el.dataset.d > 0), ab = $("dcall");
    const lab2 = () => { if (ab) ab.textContent = days.every(el => el.classList.contains("col")) ? "Rozwiń dni" : "Zwiń dni"; }; lab2();
    box.querySelectorAll(".tday > .sh").forEach(h => h.onclick = e => { if (e.target.closest("button,textarea,select,a,input")) return; const el = h.parentElement; el.classList.toggle("col"); if (el.classList.contains("col")) dayCol.add(dk2(el)); else dayCol.delete(dk2(el)); lab2(); });
    if (ab) ab.onclick = () => { const all = days.every(el => el.classList.contains("col")); days.forEach(el => { el.classList.toggle("col", !all); if (all) dayCol.delete(dk2(el)); else dayCol.add(dk2(el)); }); lab2(); }; }
  box.querySelectorAll(".tdaysel").forEach(s2 => s2.onchange = () => { t.items[+s2.dataset.ti].day = +s2.value; tripSave(); rr(); });
  box.querySelectorAll("button.tdel[data-ti]").forEach(b => b.onclick = () => { t.items.splice(+b.dataset.ti, 1); cmOpen.clear(); tripSave(); rr(); });
  box.querySelectorAll(".tvote").forEach(b => b.onclick = () => { if (!me) { alert("Ustaw nazwę użytkownika w koncie, żeby głosować."); return; } const it = t.items[+b.dataset.ti], val = +b.dataset.v; it.v = it.v || {}; if (it.v[me] === val) delete it.v[me]; else it.v[me] = val; tripSave(); rr(); });
  box.querySelectorAll(".tcmb").forEach(b => b.onclick = () => { const i = +b.dataset.ti; if (cmOpen.has(i)) cmOpen.delete(i); else cmOpen.add(i); rr(); });
  box.querySelectorAll(".tcsend").forEach(b => b.onclick = () => { const i = +b.dataset.ti, inp = box.querySelector('.tcin[data-ti="' + i + '"]'), tx = inp.value.trim().slice(0, 300); if (!tx) return; const it = t.items[i]; it.cm = it.cm || []; it.cm.push({u: me || "ja", t: tx, at: Date.now()}); tripSave(); rr(); });
  box.querySelectorAll(".tcdel").forEach(b => b.onclick = () => { const it = t.items[+b.dataset.ti]; it.cm.splice(+b.dataset.c, 1); tripSave(); rr(); });
  box.querySelectorAll(".tdn").forEach(a => { a.onchange = () => { const v = a.value.slice(0, 600); if (v.trim()) { t.dn[a.dataset.d] = v; if (t.shared) t.dnb[a.dataset.d] = me; } else { delete t.dn[a.dataset.d]; delete t.dnb[a.dataset.d]; } tripSave(); if (t.shared) rr(); }; });
  /* koszty */
  const cuPick = (sel, row) => { if (sel.value !== "__new") return cNorm(sel.value); const k = cNorm(row.querySelector(".ncc").value).replace(/[^A-Z0-9]/g, ""), v = parseFloat(String(row.querySelector(".ncr").value).replace(",", ".")); if (!k || !(v > 0)) { alert("Podaj kod waluty i przelicznik na " + (CSYM[cur] || cur) + "."); return null; } if (!allC(t).includes(k)) { t.cc.push(k); t.rt[k] = v; t.rs[k] = "m"; } return k; };
  splitWire(box, b => { const k = b.dataset.k, el = k === "tc" ? $("tca") : k === "ce" ? $("cea") : box.querySelector(".tshin"); return parseFloat(String(el ? el.value : "").replace(",", ".")); });
  [["#tccu", ".tcnew"], [".tshcu", ".tshnew"]].forEach(z => { const sl = box.querySelector(z[0]), rw = box.querySelector(z[1]); if (sl && rw) sl.onchange = () => { rw.style.display = sl.value === "__new" ? "flex" : "none"; }; });
  ["tcplus", "tcplus2"].forEach(i => { const pb = $(i); if (pb) pb.onclick = e => { e.preventDefault(); e.stopPropagation(); openQuickCost({id: 1, tid: t.id}); }; });
  { const addShop = () => { const n = ($("tsn").value || "").trim().slice(0, 60); if (!n || t.shop.some(x => x.n.toLowerCase() === n.toLowerCase())) return; t.shop.push({id: newTripId(), n, by: me || "ja", ok: false}); tripSave(); rr(); box.querySelector(".tsd").open = true; };
    $("tsadd").onclick = addShop; $("tsn").onkeydown = e => { if (e.key === "Enter") addShop(); }; }
  box.querySelectorAll(".tsk").forEach(b => b.onchange = () => { const x = t.shop.find(z => z.id === b.dataset.id); if (!x) return; x.ok = b.checked; x.okby = b.checked ? (me || "ja") : undefined; shopEd = b.checked && !x.cid ? x.id : null; tripSave(); rr(); box.querySelector(".tsd").open = true; });
  box.querySelectorAll(".tshc").forEach(b => b.onclick = () => { shopEd = b.dataset.id; rr(); box.querySelector(".tsd").open = true; });
  box.querySelectorAll(".tsks").forEach(b => b.onclick = () => { shopEd = null; rr(); box.querySelector(".tsd").open = true; });
  box.querySelectorAll(".tskdl").forEach(b => b.onclick = () => { t.shop = t.shop.filter(z => z.id !== b.dataset.id); if (shopEd === b.dataset.id) shopEd = null; tripSave(); rr(); box.querySelector(".tsd").open = true; });
  box.querySelectorAll(".tskc").forEach(b => b.onclick = () => { const x = t.shop.find(z => z.id === b.dataset.id), inp = box.querySelector(".tshin"), a = parseFloat(String(inp.value).replace(",", ".")); if (!x || !(a > 0)) { inp.focus(); return; } const cid = newTripId(); t.costs.push({id: cid, w: x.n, a, by: me || "ja", ad: me || "ja", sp: null, at: Date.now(), shop: x.id}); x.cid = cid; shopEd = null; tripSave(); rr(); box.querySelector(".tcd").open = true; });
  box.querySelectorAll(".tskc").forEach(b => b.onclick = async () => { const x = t.shop.find(z => z.id === b.dataset.id), inp = box.querySelector(".tshin"), a = parseFloat(String(inp.value).replace(",", ".")); if (!x || !(a > 0)) { inp.focus(); return; } const cu = cuPick(box.querySelector(".tshcu"), box.querySelector(".tshnew")); if (cu) { try { localStorage.setItem("sht_lc_" + t.id, cu); } catch (x) {} } const sb = box.querySelector('.spblk[data-k="sh"]'), sr = shared && sb ? splitRead(sb, a) : {sp: [], sh: null}; if (!cu) return; if (sr.err) { alert(sr.err); return; } const sp = sr.sp; if (shared && !sp.length) { alert("Zaznacz, dla kogo to było."); return; }
    if (cRate(t, cu) == null) { await fxRefresh(t, true); if (cRate(t, cu) == null) { alert("Brak kursu dla " + cu + ". Ustaw go w „Waluty i kursy”."); return; } }
    const by = (box.querySelector(".tshby") && box.querySelector(".tshby").value) || me || "ja", cid = newTripId(); t.costs.push({id: cid, w: x.n, a, cu, fr: cu !== cur ? cRate(t, cu) : undefined, by, ad: me || "ja", sp: shared && (sr.sh || sp.length < ppl.length) ? sp : null, sh: sr.sh || undefined, at: Date.now(), shop: x.id}); x.cid = cid; shopEd = null; tripSave(); rr(); box.querySelector(".tcd").open = true; });
  { const fxd = () => { tripSave(); rr(); };
    const setBase = v => { const nb = cNorm(v), ob = cur; if (nb === ob) return; const rn = cRate(t, nb); if (!(rn > 0)) { alert("Najpierw ustaw kurs tej waluty."); rr(); return; } const nrt = {}; allC(t).forEach(k => { const r = cRate(t, k); if (r > 0 && k !== nb) nrt[k] = Math.round(r / rn * 1e6) / 1e6; }); t.costs.forEach(c => { if (!c.cu) c.cu = ob; if (cNorm(c.cu) === nb) delete c.fr; else if (c.fr > 0) c.fr = Math.round(c.fr / rn * 1e6) / 1e6; else if (cNorm(c.cu) === ob) c.fr = nrt[ob]; }); const ro = nrt[ob]; t.settle.forEach(z => { z.a = Math.round(z.a * ro * 100) / 100; }); t.rt = nrt; t.cur = nb; t.rd = 0; fxd(); };
    { const e = $("fxbase"); if (e) e.onchange = () => setBase(e.value); const d = $("fxtot"); if (d) d.onchange = () => { try { localStorage.setItem("sht_dc_" + t.id, d.value); } catch (x) {} rr(); }; }
    box.querySelectorAll(".fxin").forEach(i => i.onchange = () => { const v = parseFloat(String(i.value).replace(",", ".")); if (!(v > 0)) { rr(); return; } t.rt[i.dataset.k] = v; t.rs[i.dataset.k] = "m"; fxd(); });
    box.querySelectorAll(".fxauto").forEach(b => b.onclick = async () => { delete t.rs[b.dataset.k]; const ok = await fxRefresh(t, true); if (!ok) { t.rs[b.dataset.k] = "m"; alert("Nie udało się pobrać kursów. Zostaje kurs ręczny."); } fxd(); });
    box.querySelectorAll(".fxdel").forEach(b => b.onclick = () => { const k = b.dataset.k; if (t.costs.some(c => cNorm(c.cu || cur) === k)) { alert("Ta waluta jest użyta w wydatkach."); return; } t.cc = t.cc.filter(z => z !== k); delete t.rt[k]; delete t.rs[k]; fxd(); });
    const fr = $("fxref"); if (fr) fr.onclick = async () => { fr.disabled = true; const ok = await fxRefresh(t, true); if (!ok) alert("Nie udało się pobrać kursów. Możesz wpisać je ręcznie."); fxd(); };
    const fa = $("fxca"); if (fa) fa.onclick = () => { const k = cNorm($("fxck").value).replace(/[^A-Z0-9]/g, ""), v = parseFloat(String($("fxcr").value).replace(",", ".")); if (!k || !(v > 0)) { alert("Podaj kod waluty i kurs."); return; } if (allC(t).includes(k)) { alert("Taka waluta już jest."); return; } t.cc.push(k); t.rt[k] = v; t.rs[k] = "m"; fxd(); }; }
  box.querySelectorAll(".tset").forEach(b => b.onclick = () => { const a = parseFloat(b.dataset.a); if (!(a > 0)) return; t.settle.push({id: newTripId(), from: b.dataset.f, to: b.dataset.t, a, by: me || "ja", at: Date.now()}); tripSave(); rr(); box.querySelector(".tcd").open = true; });
  box.querySelectorAll(".tsundo").forEach(b => b.onclick = () => { t.settle = t.settle.filter(z => z.id !== b.dataset.id); tripSave(); rr(); box.querySelector(".tcd").open = true; });
  box.querySelectorAll(".swc").forEach(el => { const W = 150, ac = el.previousElementSibling; let x0 = 0, y0 = 0, dx = 0, on = false, drag = false, open = false, ld = 0;
    el.onpointerdown = e => { x0 = e.clientX; y0 = e.clientY; dx = 0; drag = false; on = true; };
    el.onpointermove = e => { if (!on) return; const ax = e.clientX - x0, ay = e.clientY - y0; if (!drag) { if (Math.abs(ax) > 10 && Math.abs(ax) > Math.abs(ay) * 1.5) { drag = true; try { el.setPointerCapture(e.pointerId); } catch (x) {} el.style.transition = "none"; } else { if (Math.abs(ay) > 10) on = false; return; } } dx = Math.max(-W, Math.min(0, (open ? -W : 0) + ax)); el.style.transform = "translateX(" + dx + "px)"; if (ac) ac.style.opacity = Math.min(1, -dx / 50); };
    const end = () => { if (!on) return; on = false; if (!drag) return; drag = false; ld = Date.now(); el.style.transition = ""; open = dx < -W / 2; el.style.transform = open ? "translateX(" + (-W) + "px)" : ""; if (ac) ac.style.opacity = open ? 1 : 0; };
    el.onpointerup = end; el.onpointercancel = end;
    el.addEventListener("click", e => { if (Date.now() - ld < 400) { e.stopPropagation(); e.preventDefault(); return; } if (open) { open = false; el.style.transform = ""; if (ac) ac.style.opacity = 0; e.stopPropagation(); e.preventDefault(); } }, true); });
  box.querySelectorAll(".tced").forEach(b => b.onclick = () => { costEditId = b.dataset.c; rr(); });
  { const cc = $("cecancel"); if (cc) cc.onclick = () => { costEditId = null; rr(); };
    const cs = $("cesave"); if (cs) cs.onclick = async () => { const c = t.costs.find(x => x.id === cs.dataset.c); if (!c || (c.ad || c.by) !== (me || "ja")) return;
      const w = $("cew").value.trim().slice(0, 80), a = parseFloat(String($("cea").value).replace(",", ".")); if (!w || !(a > 0)) { alert("Wpisz, co to było, i kwotę."); return; }
      c.w = w; c.a = a; if ($("cecu")) { const nc = cNorm($("cecu").value), fv = parseFloat(String($("cefr").value).replace(",", ".")), same = String($("cefr").dataset.o) === String(fv); if (nc === cur) delete c.fr; else { const ndt = ($("cedt") && $("cedt").value) || c.dt || "", chg = nc !== cNorm(c.cu || cur) || ndt.slice(0, 10) !== String(c.dt || "").slice(0, 10); if (fv > 0 && !(chg && same)) { c.fr = fv; if (!same) delete c.fd; } else { const fx = await fxAt(t, nc, ndt); if (fx.fr) { c.fr = fx.fr; if (fx.fd) c.fd = fx.fd; else delete c.fd; } else delete c.fr; if (fx.fail) toast("Nie udało się pobrać kursu z tego dnia, użyto bieżącego"); } } c.cu = nc; } if ($("cedt") && $("cedt").value) c.dt = $("cedt").value; if (shared) { c.by = ($("ceby") && $("ceby").value) || c.by; const sr = splitRead(box.querySelector('.spblk[data-k="ce"]'), a); if (sr.err) { alert(sr.err); return; } const sp = sr.sp; if (!sp.length) { alert("Zaznacz, na kogo dzielimy."); return; } c.sp = (sr.sh || sp.length < ppl.length) ? sp : null; if (sr.sh) c.sh = sr.sh; else delete c.sh; }
      costEditId = null; tripSave(); rr(); box.querySelector(".tcd").open = true; }; }
  box.querySelectorAll(".tcdl").forEach(b => b.onclick = () => { const c = t.costs.find(x => x.id === b.dataset.c); if (!c || (c.ad || c.by) !== (me || "ja")) return; t.costs = t.costs.filter(x => x !== c); tripSave(); rr(); });
  /* pakowanie */
  const addPack = n => { n = String(n || "").trim().slice(0, 60); if (!n || t.pack.some(x => x.n === n)) return; t.pack.push({id: newTripId(), n, by: shared ? me : undefined, who: shared ? (($("tpwho") && $("tpwho").value) || "") : "", ok: false}); tripSave(); rr(); box.querySelector(".tpd").open = true; };
  $("tpadd").onclick = () => addPack($("tpn").value); $("tpn").onkeydown = e => { if (e.key === "Enter") addPack(e.target.value); };
  box.querySelectorAll(".tpq").forEach(b => b.onclick = () => addPack(b.dataset.n));
  box.querySelectorAll(".tpk2").forEach(b => b.onchange = () => { const x = t.pack.find(z => z.id === b.dataset.id); if (x) { x.ok = b.checked; tripSave(); rr(); } });
  box.querySelectorAll("select.tpw").forEach(b => b.onchange = () => { const x = t.pack.find(z => z.id === b.dataset.id); if (x) { x.who = b.value; x.for = null; tripSave(); rr(); } });
  box.querySelectorAll(".tpdl").forEach(b => b.onclick = () => { t.pack = t.pack.filter(z => z.id !== b.dataset.id); tripSave(); rr(); box.querySelector(".tpd").open = true; });
  /* akcje */
  $("tadd").onclick = () => openTripAdd(t);
  box.querySelectorAll(".tdaddb").forEach(b => b.onclick = () => openTripAdd(t, +b.dataset.d));
  { const sg = $("rsvseg"); if (sg) sg.querySelectorAll("button").forEach(b => b.onclick = () => { const who = me || "ja"; t.rsvp = t.rsvp || {}; if (t.rsvp[who] === b.dataset.v) delete t.rsvp[who]; else t.rsvp[who] = b.dataset.v; tripSave(); rr(); }); }
  box.querySelectorAll(".tdnav").forEach(b => b.onclick = () => openDayNav(t, +b.dataset.d));
  $("tics").onclick = () => tripICS(t);
  $("tmap").onclick = () => tripMap(t);
  { const sb = $("tshare"); if (sb) sb.onclick = () => openTripShare(t); }
  $("tarch").innerHTML = IC.arch + " " + (t.ar ? "Przywróć z archiwum" : "Archiwizuj wyjazd");
  $("tarch").onclick = async () => { if (!t.ar && !(await appConfirm("Zarchiwizować wyjazd „" + (t.name || "") + "”? Nie będzie już pojawiał się przy dodawaniu wydatków. Możesz go przywrócić w każdej chwili." + (t.shared ? " Dotyczy wszystkich uczestników." : "")))) return; t.ar = t.ar ? 0 : 1; tripSave(); renderTrips(); };
  $("tdelall").textContent = t.shared && t.owner !== store.uid ? "Opuść wyjazd" : "Usuń cały wyjazd";
  $("tdelall").onclick = async () => { if (!(await appCode((t.shared && t.owner !== store.uid ? "Opuścić wyjazd „" : "Usunąć cały wyjazd „") + (t.name || "") + "”?" + (t.shared && t.owner === store.uid ? " Zniknie też u uczestników." : ""), "12345"))) return;
    if (t.shared) { try { const r = t.owner === store.uid ? await store.sb.from("shared_trips").delete().eq("id", t.id) : await store.sb.from("shared_trips").update({members: (t.members || []).filter(m => m !== meName())}).eq("id", t.id); if (r && r.error) throw r.error; SHT = SHT.filter(x => x !== t); } catch(e){ alert("Nie udało się: " + String((e && e.message) || e).slice(0, 90)); return; } }
    else TRIPS = TRIPS.filter(x => x !== t);
    tripOpen = null; tripSave(); renderTrips(); };
  bindTripDrag(box, t, rr);
  /* pogoda */
  box.querySelectorAll(".twx").forEach(async el => { const d = +el.dataset.d, iso = dayISO(t.from, d); if (!base || base.y == null || !iso) return;
    const w = await wxFor(+base.y, +base.x, iso); if (!w || !el.isConnected) return; const bad = !w.est && (w.c >= 95 || w.p >= 60 || w.w >= 50);
    el.innerHTML = `${WXI(w.c)} ${Math.round(w.lo)}–${Math.round(w.hi)}°C${w.est ? (w.mm != null ? " · opady " + w.mm + " mm" : "") : " · opady " + (w.p == null ? "?" : w.p) + "%"} · wiatr ${Math.round(w.w)} km/h${w.est ? ` <span style="opacity:.65">(rok temu)</span>` : ""}${bad ? ` <span style="color:var(--warn)">⚠ ${w.c >= 95 ? "ryzyko burzy" : w.p >= 60 ? "duże ryzyko opadów" : "silny wiatr"}</span>` : ""}`; });
  if ($("tbase")) $("tbase").onclick = () => pickTripBase(t);
  box.querySelectorAll(".hwx").forEach(async el => { const it = t.items[+el.dataset.ti], hk = it && tripHike(it), r = hk && hk.r, iso = it && dayISO(t.from, it.day); if (!r || r.y == null || !iso) return;
    const fmt = w => { const bad = !w.est && (w.c >= 95 || w.p >= 60 || w.w >= 50), pr = w.est ? (w.mm != null ? "opady " + w.mm + " mm" : "") : "opady " + (w.p == null ? "?" : w.p) + "%"; return `${WXI(w.c)} ${Math.round(w.lo)}–${Math.round(w.hi)}°C${pr ? " · " + pr : ""} · wiatr ${Math.round(w.w)} km/h${bad ? ` <span style="color:var(--warn)">⚠ ${w.c >= 95 ? "ryzyko burzy" : w.p >= 60 ? "duże ryzyko deszczu" : "silny wiatr"}</span>` : ""}`; };
    const w = await wxFor(+r.y, +r.x, iso); if (!el.isConnected) return; if (!w) { const df = (new Date(iso + "T12:00:00") - new Date()) / 864e5; el.innerHTML = df < -1 ? "" : `<span style="opacity:.6">Pogoda: brak danych</span>`; return; }
    const tm = hk.h && ((hk.h.n || "") + " " + (hk.h.o || "")).match(/(\d[\d ]{2,4})\s*m\b/), tel = tm ? parseInt(tm[1].replace(/\s/g, ""), 10) : 0;
    const note = w.est ? ` <span style="opacity:.65">(rok temu, prognoza dopiero ~2 tyg. przed)</span>` : "";
    if (tel >= 1000 && w.el != null && tel - w.el > 400 && tel < 6000) { const wt = await wxFor(+r.y, +r.x, iso, tel); if (!el.isConnected) return; if (wt) { el.innerHTML = `<div><b>Dół</b> (${Math.round(w.el)} m): ${fmt(w)}</div><div><b>Góra</b> (${tel} m): ${fmt(wt)}</div>${note}`; return; } }
    el.innerHTML = fmt(w) + note; });
}
function renderPacks(box, segH){
  const save = () => scheduleSave(), p = PACKS.find(x => x.id === packOpen), rr = () => { const st = $("v-wyjazdy").scrollTop; renderTrips(); $("v-wyjazdy").scrollTop = st; };
  if (!p) {
    box.innerHTML = segH + `<div class="hint">Listy rzeczy do zabrania ${MODE === "w" ? "na narty" : "w góry"}. Działają osobno od wyjazdów, więc możesz odhaczać to, co już spakowałeś, bez planowania trasy.</div>` +
      (PACKS.filter(x => (x.mode || "s") === MODE).length ? PACKS.filter(x => (x.mode || "s") === MODE).map(x => { const n = (x.items || []).length, k = (x.items || []).filter(i => i.ok).length; return `<div class="card pkc" data-id="${esc(x.id)}" style="cursor:pointer"><h3 style="margin:0 0 4px">${esc(x.name || "Lista")}</h3><div class="small">${k} / ${n} spakowane${n && k === n ? " ✓" : ""}</div><div class="bar" style="margin-top:6px"><i class="${n && k === n ? "full" : ""}" style="width:${n ? 100 * k / n : 0}%"></i></div></div>`; }).join("") : `<div class="empty">Nie masz jeszcze żadnej listy.</div>`) +
      `<button class="btn pri" id="pknew0" style="width:100%;margin-top:6px">＋ Nowa lista</button>`;
    const mk = seed => { const x = {id: newTripId(), mode: MODE, name: MODE === "w" ? "Pakowanie na narty" : "Pakowanie w góry", items: seed ? packDef(MODE).map(n => ({id: newTripId(), n, ok: false})) : []}; PACKS.unshift(x); packOpen = x.id; save(); renderTrips(); };
    $("pknew0").onclick = () => mk(false);
    box.querySelectorAll(".pkc").forEach(c => c.onclick = () => { packOpen = c.dataset.id; renderTrips(); $("v-wyjazdy").scrollTop = 0; });
    return;
  }
  p.items = p.items || [];
  const n = p.items.length, k = p.items.filter(i => i.ok).length;
  box.innerHTML = `<button class="btn sm" id="pkback" style="margin-bottom:10px">← Wszystkie listy</button>
    <div class="card"><div class="fld"><label>NAZWA LISTY</label><input id="pkname" class="lin" value="${esc(p.name || "")}"></div><div class="small">${k} / ${n} spakowane${n && k === n ? " ✓ komplet" : ""}</div><div class="bar" style="margin-top:6px"><i class="${n && k === n ? "full" : ""}" style="width:${n ? 100 * k / n : 0}%"></i></div></div>
    ${p.items.map(x => `<div class="frow"><label style="display:flex;gap:10px;align-items:center;min-width:0;flex:1;padding:4px 0"><input type="checkbox" class="pki" data-id="${esc(x.id)}" ${x.ok ? "checked" : ""} style="width:20px;height:20px"> <span style="${x.ok ? "text-decoration:line-through;opacity:.55" : ""}">${esc(x.n)}</span></label><button class="tdel pkdl" data-id="${esc(x.id)}" title="Usuń">${IC.trash}</button></div>`).join("") || `<div class="small" style="margin:8px 0">Lista jest pusta. Dodaj rzeczy poniżej.</div>`}
    <div style="display:flex;gap:6px;margin:12px 0"><input id="pkn" class="lin" placeholder="Dodaj własną rzecz…" style="flex:1"><button class="btn pri" id="pkadd">Dodaj</button></div>
    ${packDef(p.mode).some(d => !p.items.some(x => x.n === d)) ? `<div class="small" style="margin:4px 0">Podpowiedzi:</div><div style="display:flex;gap:6px;flex-wrap:wrap">${packDef(p.mode).filter(d => !p.items.some(x => x.n === d)).map(d => `<button class="btn sm pkq" data-n="${esc(d)}">+ ${esc(d)}</button>`).join("")}</div>` : ""}
    <div style="display:flex;gap:8px;margin-top:16px"><button class="btn sm" id="pkreset" style="flex:1">↺ Odznacz wszystko</button><button class="btn sm" id="pkdup" style="flex:1">⧉ Duplikuj</button></div>
    <button class="btn sm" id="pkdel" style="width:100%;margin-top:10px;color:#ff8a8a">Usuń listę</button>`;
  $("pkback").onclick = () => { packOpen = null; renderTrips(); };
  $("pkname").onchange = e => { p.name = e.target.value.trim().slice(0, 60); save(); };
  const add = nm => { nm = String(nm || "").trim().slice(0, 60); if (!nm || p.items.some(x => x.n === nm)) return; p.items.push({id: newTripId(), n: nm, ok: false}); save(); rr(); };
  $("pkadd").onclick = () => add($("pkn").value); $("pkn").onkeydown = e => { if (e.key === "Enter") add(e.target.value); };
  box.querySelectorAll(".pkq").forEach(b => b.onclick = () => add(b.dataset.n));
  box.querySelectorAll(".pki").forEach(b => b.onchange = () => { const x = p.items.find(z => z.id === b.dataset.id); if (x) { x.ok = b.checked; save(); rr(); } });
  box.querySelectorAll(".pkdl").forEach(b => b.onclick = () => { p.items = p.items.filter(z => z.id !== b.dataset.id); save(); rr(); });
  $("pkreset").onclick = () => { p.items.forEach(x => x.ok = false); save(); rr(); };
  $("pkdup").onclick = () => { const x = {id: newTripId(), name: (p.name || "Lista") + " (kopia)", items: p.items.map(i => ({id: newTripId(), n: i.n, ok: false}))}; PACKS.unshift(x); packOpen = x.id; save(); renderTrips(); };
  $("pkdel").onclick = async () => { if (!(await appConfirm("Usunąć listę „" + (p.name || "") + "”?"))) return; PACKS = PACKS.filter(x => x !== p); packOpen = null; save(); renderTrips(); };
}
function openTrip(id){ const t = allTrips().find(x => x.id === id); tripOpen = id; cmOpen.clear(); tripPrev = seenGet()[id] || 0; if (t) seenSet(id, Date.now()); renderTrips(); $("v-wyjazdy").scrollTop = 0; }
/* przeciąganie szlaków między dniami */
function bindTripDrag(box, t, rr){
  const sc = $("v-wyjazdy"); let d = null, raf = 0;
  const dayAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest(".tday") : null; };
  const loop = () => { raf = 0; if (!d) return; const H = window.innerHeight; let dy = 0; if (d.cy < 150) dy = -Math.ceil((150 - d.cy) / 6); else if (d.cy > H - 170) dy = Math.ceil((d.cy - (H - 170)) / 6); if (dy) sc.scrollTop += Math.max(-24, Math.min(24, dy)); raf = requestAnimationFrame(loop); };
  box.querySelectorAll(".thandle").forEach(h => h.addEventListener("pointerdown", e => {
    e.preventDefault(); const row = h.closest(".tit"); d = {idx: +row.dataset.ti, row, cx: e.clientX, cy: e.clientY, over: null};
    const g = row.cloneNode(true); g.classList.add("ghost"); g.style.width = Math.min(row.offsetWidth, 420) + "px"; g.style.left = e.clientX + "px"; g.style.top = e.clientY + "px"; g.style.opacity = ".92"; document.body.append(g); d.g = g; row.style.visibility = "hidden";
    try { h.setPointerCapture(e.pointerId); } catch(_){} if (!raf) raf = requestAnimationFrame(loop);
    h.onpointermove = ev => { if (!d) return; d.cx = ev.clientX; d.cy = ev.clientY; g.style.left = d.cx + "px"; g.style.top = d.cy + "px"; const dd = dayAt(d.cx, d.cy); if (d.over && d.over !== dd) d.over.classList.remove("over"); if (dd) dd.classList.add("over"); d.over = dd; };
    const end = ev => { if (!d) return; const cur = d; d = null; h.onpointermove = null; h.onpointerup = null; h.onpointercancel = null; cur.g.remove(); cur.row.style.visibility = ""; if (cur.over) cur.over.classList.remove("over");
      if (ev.type === "pointercancel") return;
      const day = dayAt(ev.clientX, ev.clientY); if (!day) return; const nd = +day.dataset.d, it = t.items[cur.idx];
      const tg = document.elementFromPoint(ev.clientX, ev.clientY), trow = tg && tg.closest ? tg.closest(".tit") : null; let before = null;
      if (trow && +trow.dataset.ti !== cur.idx) { const rc = trow.getBoundingClientRect(), j = +trow.dataset.ti; before = ev.clientY < rc.top + rc.height / 2 ? t.items[j] : t.items[j + 1] || null; if (!(ev.clientY < rc.top + rc.height / 2)) { const nx = t.items.slice(j + 1).find(z => (z.day || 0) === nd); before = nx || null; } }
      if (before === it) { it.day = nd; tripSave(); rr(); return; } t.items.splice(cur.idx, 1); it.day = nd; if (before && t.items.includes(before)) t.items.splice(t.items.indexOf(before), 0, it); else t.items.push(it);
      tripSave(); rr(); };
    h.onpointerup = end; h.onpointercancel = end;
  }));
}
/* eksport do kalendarza (.ics) */
function tripICS(t){
  if (!t.from) { alert("Ustaw daty wyjazdu (Od), żeby wyeksportować do kalendarza."); return; }
  const esc2 = s => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""), L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mountained there//PL", "CALSCALE:GREGORIAN"], D = tripDays(t);
  for (let d = 1; d <= D; d++) { const its = (t.items || []).filter(i => (i.day || 0) === d); if (!its.length && !(t.dn || {})[d]) continue; const iso = dayISO(t.from, d), nx = dayISO(t.from, d + 1); if (!iso) continue;
    const places = [...new Set(its.map(i => tripHike(i).r && tripHike(i).r.n).filter(Boolean))];
    const desc = its.map(i => { const x = tripHike(i); return "• " + i.n + (x.r && i.m !== "w" ? " (" + x.r.n + (x.h ? ", " + x.h.d : "") + ")" : ""); }).join("\n") + ((t.dn || {})[d] ? "\n\n" + t.dn[d] : "") + (t.note ? "\n\n" + t.note : "");
    L.push("BEGIN:VEVENT", "UID:" + t.id + "-" + d + "@hiked-there", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + iso.replace(/-/g, ""), "DTEND;VALUE=DATE:" + nx.replace(/-/g, ""), "SUMMARY:" + esc2((t.name || "Wyjazd") + " · dzień " + d + (places.length ? " · " + places.join(", ") : (t.mode === "w" && t.base && byIdW[t.base] ? " · " + byIdW[t.base].n : ""))), "DESCRIPTION:" + esc2(desc), "END:VEVENT"); }
  L.push("END:VCALENDAR");
  if (L.length < 6) { alert("Nie ma jeszcze żadnych dni z szlakami do wyeksportowania."); return; }
  const blob = new Blob([L.join("\r\n")], {type: "text/calendar;charset=utf-8"}), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (String(t.name || "wyjazd").replace(/[^\w\-]+/g, "_") || "wyjazd") + ".ics"; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
/* mapa wyjazdu */
function tripMap(t){
  const seq = []; [...(t.items || [])].filter(i => i.day).sort((a, b) => a.day - b.day).forEach(i => { const r = tripHike(i).r; if (r && r.y != null && (!seq.length || seq[seq.length - 1].r !== r)) seq.push({r, day: i.day}); });
  const pts = seq.length ? seq : [...new Set((t.items || []).map(i => tripHike(i).r).filter(r => r && r.y != null))].map(r => ({r, day: 0}));
  if (!pts.length && t.mode === "w" && t.base && byIdW[t.base] && byIdW[t.base].y != null) pts.push({r: byIdW[t.base], day: 0});
  if (!pts.length) { alert("Dodaj szlaki do wyjazdu, żeby zobaczyć mapę."); return; }
  const la0 = pts.reduce((s, p) => s + +p.r.y, 0) / pts.length, k = Math.cos(la0 * Math.PI / 180), X = p => +p.r.x * k, Y = p => -+p.r.y;
  const xs = pts.map(X), ys = pts.map(Y), mx = Math.min(...xs), Mx = Math.max(...xs), my = Math.min(...ys), My = Math.max(...ys), w = Mx - mx, h = My - my, sc = Math.min(300 / Math.max(w, .05), 220 / Math.max(h, .05)), ox = 30 + (300 - w * sc) / 2, oy = 25 + (220 - h * sc) / 2;
  const P = p => [ox + (X(p) - mx) * sc, oy + (Y(p) - my) * sc];
  const line = pts.map(p => P(p).join(",")).join(" ");
  ovBox().innerHTML = `<div class="card" style="width:min(460px,94vw)"><h3>Mapa: ${esc(t.name || "wyjazd")}</h3><svg id="tmsvg" viewBox="0 0 360 270" style="width:100%;background:rgba(255,255,255,.04);border-radius:14px"><g id="tmland"></g>${pts.length > 1 ? `<polyline points="${line}" fill="none" stroke="#5ad1ff" stroke-width="2" stroke-dasharray="5 4"/>` : ""}${pts.map((p, i) => { const [x, y] = P(p); return `<circle cx="${x}" cy="${y}" r="11" fill="#38e0a0"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="#07101e">${i + 1}</text><text x="${x}" y="${y - 16}" text-anchor="middle" font-size="11" fill="#dbe8ff" paint-order="stroke" stroke="#07101e" stroke-width="3">${esc(p.r.n)}</text>`; }).join("")}</svg><div class="small" style="margin-top:6px">Kolejność wg dni wyjazdu. Schematyczny widok bez mapy tła.</div><button class="btn" id="lclose" style="width:100%;margin-top:8px">Zamknij</button></div>`;
  $("lclose").onclick = closeAccount;
  const paintLand = () => { const G = GEO || LANDR, g = $("tmland"); if (!G || !g) return;
    const lo0 = (mx + (0 - ox) / sc) / k, lo1 = (mx + (360 - ox) / sc) / k, la1 = -(my + (0 - oy) / sc), la0 = -(my + (270 - oy) / sc); let d = "";
    G.forEach(rg => { let a = 1e9, b = -1e9, e = 1e9, f = -1e9; for (const p of rg) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; if (p[1] < e) e = p[1]; if (p[1] > f) f = p[1]; }
      if (b < lo0 || a > lo1 || f < la0 || e > la1) return; d += "M" + rg.map(p => P({r: {x: p[0], y: p[1]}}).map(v => v.toFixed(1)).join(" ")).join("L") + "Z"; });
    if (d) g.innerHTML = `<path d="${d}" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.3)" stroke-width="1" stroke-linejoin="round"/>`; };
  if (GEO || LANDR) paintLand(); else loadGeo().then(paintLand);
}
/* zrobione szlaki do mojego profilu */
async function tripToProfile(t){
  const done = (t.items || []).filter(i => i.ok); if (!done.length) { alert("Najpierw odhacz ✓ szlaki, które zrobiłeś."); return; }
  if (!(await appConfirm("Oznaczyć " + done.length + " " + plur(done.length, "szlak", "szlaki", "szlaków") + " jako zrobione w Twoim profilu (lato)?"))) return;
  const dt = t.from ? new Date(t.from + "T12:00:00") : new Date(); let n = 0;
  done.forEach(i => { const r = byIdS[i.p]; if (!r) return; const idx = (r.hikes || []).findIndex(h => h.n === i.n); if (idx < 0) return;
    let v = sVisits[i.p]; if (!v) { v = sVisits[i.p] = newEntry("v"); v.stays = [{y: String(dt.getFullYear()), m: String(dt.getMonth() + 1)}]; } v.s = "v"; v.done = v.done || {}; v.hp = v.hp || {}; if (!v.done[idx]) { v.done[idx] = 1; n++; } delete v.hp[idx]; });
  syncVisits(); scheduleSave(); renderAll(); alert("Gotowe: " + n + " " + plur(n, "nowy szlak", "nowe szlaki", "nowych szlaków") + " dodano do profilu ✓");
}
function pickTripBase(t){
  let q = "";
  const draw = () => { const L = WINTER.R.filter(r => !q || norm(r.n + " " + (r.c || "")).includes(norm(q))).sort((a, b) => b.k - a.k).slice(0, 40);
    ovBox().innerHTML = `<div class="card" style="max-height:85vh;overflow:auto;width:min(560px,94vw)"><h3>Domyślny ośrodek</h3><div class="small" style="margin:-4px 0 8px">Zwykle jeździ się w jednym miejscu. Pozostałe dni i dodatkowe punkty dodasz osobno.</div><div class="fld"><input id="bq" class="lin" type="search" placeholder="Szukaj ośrodka…" value="${esc(q)}"></div>${L.map(r => `<div class="frow bpk" data-id="${esc(r.id)}" style="cursor:pointer"><span>${flag((r.c || "").split(",")[0])} <b>${esc(r.n)}</b> <span class="small">${r.k} km</span></span><span>${t.base === r.id ? "✓" : "›"}</span></div>`).join("")}<div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="bclr" style="flex:1">${t.base ? "Usuń wybór" : "Pomiń"}</button><button class="btn" id="bcl" style="flex:1">Zamknij</button></div></div>`;
    const qi = $("bq"); qi.oninput = () => { q = qi.value; const p = qi.selectionStart; draw(); const n = $("bq"); n.focus(); n.setSelectionRange(p, p); };
    document.querySelectorAll(".bpk").forEach(el => el.onclick = () => { t.base = el.dataset.id; const r = byIdW[t.base]; if (r && (!t.name || t.name === "Nowy wyjazd")) t.name = r.n; tripSave(); closeAccount(); renderTrips(); });
    $("bclr").onclick = () => { t.base = ""; tripSave(); closeAccount(); renderTrips(); }; $("bcl").onclick = closeAccount; };
  draw();
}
function parseDest(txt){
  const s = String(txt || "").trim(); if (!s) return null; let m;
  const ok = (a, b) => { a = +a; b = +b; return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? {lat: a, lon: b} : null; };
  if ((m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(s))) { const r = ok(m[1], m[2]); if (r) return r; }
  if (/^https?:\/\//i.test(s)) {
    let dec = s; try { dec = decodeURIComponent(s); } catch(e){}
    if ((m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(dec)) || (m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(dec)) || (m = /[?&](?:q|ll|query|destination|daddr|sll)=(-?\d+\.\d+)[, ]\s*(-?\d+\.\d+)/.exec(dec))) { const r = ok(m[1], m[2]); if (r) return r; }
    return {url: s};
  }
  return {q: s};
}
function navUrl(d, apple){
  if (d.url) return d.url;
  const dest = d.lat != null ? d.lat + "," + d.lon : d.q;
  return apple ? "https://maps.apple.com/?dirflg=d&daddr=" + encodeURIComponent(dest) : "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(dest);
}
function dayDests(t, d) {
  const seen = new Set(), out = [];
  (t.items || []).forEach(it => { if (it.day !== d || it.custom) return; const r = tripHike(it).r; if (!r || r.x == null || r.y == null || seen.has(r.id)) return; seen.add(r.id); out.push({n: t.mode === "w" ? (r.l || r.n) : r.n, sub: t.mode === "w" ? r.n : "", lat: r.y, lon: r.x}); });
  if (!out.length) { const b = t.mode === "w" && t.base ? byIdW[t.base] : null; if (b && b.x != null) out.push({n: b.l || b.n, sub: b.n, lat: b.y, lon: b.x}); }
  if (!out.length && t.dest) { const q = parseDest(t.dest); if (q) out.push({n: "Cel wyjazdu", q}); }
  return out;
}
const dnavUrl = x => navUrl(x.q || {lat: x.lat, lon: x.lon}, false);
function openDayNav(t, d) {
  const L = dayDests(t, d); if (!L.length) return;
  if (L.length === 1) { window.open(dnavUrl(L[0]), "_blank", "noopener"); return; }
  ovBox().innerHTML = `<div class="card" style="width:min(420px,94vw)"><h3>Dokąd jedziemy?</h3><div class="sub">Dzień ${d}: wybierz miejscowość, do której ma prowadzić nawigacja.</div>${L.map((x, i) => `<a class="btn pri" href="${esc(dnavUrl(x))}" target="_blank" rel="noopener" style="display:block;text-align:left;margin-bottom:8px;text-decoration:none">${IC.map} ${esc(x.n)}${x.sub ? ` <span class="small" style="opacity:.8">· ${esc(x.sub)}</span>` : ""}</a>`).join("")}<button class="btn" id="lclose" style="width:100%;margin-top:4px">Zamknij</button></div>`;
  $("lclose").onclick = closeAccount; document.querySelectorAll("#acctov a.btn").forEach(a => a.addEventListener("click", () => setTimeout(closeAccount, 50)));
}
const CGR = [["#2f9bf0", "#6c5ce7"], ["#f4a259", "#e5484d"], ["#38e0a0", "#2f9bf0"], ["#ffd27f", "#f4a259"], ["#ff7a90", "#6c5ce7"], ["#5ad1ff", "#2f6fe0"], ["#7bd88f", "#2b8a6e"], ["#9aa8c7", "#3a4a6b"]];
const CEM = ["🏔️", "⛷️", "🏂", "🥾", "🎿", "🌲", "⛰️", "🗻", "🚠", "❄️", "☀️", "🏕️", "🌄", "🧗", "🍲", "🛷"];
const tripCover = t => { const c = t.cover || {}, h = [...String(t.id || "")].reduce((a, ch) => a + ch.charCodeAt(0), 0), g = CGR[(c.c != null ? c.c : h) % CGR.length]; return {bg: "linear-gradient(135deg," + g[0] + "," + g[1] + ")", e: c.e || (t.mode === "w" ? "⛷️" : "🥾")}; };
function openTripCover(t) {
  const c = t.cover = t.cover || {}, cv = tripCover(t);
  ovBox().innerHTML = `<div class="card" style="width:min(440px,94vw)"><h3>Okładka wyjazdu</h3><div class="tcover" style="background:${cv.bg};cursor:default"><span class="tce">${cv.e}</span></div>
    <div class="tflab">Kolor</div><div class="cvg">${CGR.map((g, i) => `<button data-c="${i}" class="${(c.c != null ? c.c : -1) === i ? "on" : ""}" style="background:linear-gradient(135deg,${g[0]},${g[1]})" aria-label="Kolor ${i + 1}"></button>`).join("")}</div>
    <div class="tflab">Ikona</div><div class="cve">${CEM.map(e => `<button data-e="${e}" class="${c.e === e ? "on" : ""}">${e}</button>`).join("")}</div>
    <button class="btn pri" id="cvok" style="width:100%">Gotowe</button></div>`;
  const redo = () => { tripSave(); openTripCover(t); };
  document.querySelectorAll("#acctov .cvg button").forEach(b => b.onclick = () => { c.c = +b.dataset.c; redo(); });
  document.querySelectorAll("#acctov .cve button").forEach(b => b.onclick = () => { c.e = b.dataset.e; redo(); });
  $("cvok").onclick = () => { closeAccount(); renderTrips(); };
}
function fmtN(n) { return (Math.round(n * 100) / 100).toString().replace(".", ","); }
function splitBlock(k, ppl, chk, label, sh) {
  const am = sh && Object.keys(sh).length > 0;
  return `<div class="spblk" data-k="${k}"><div class="tflab">${label}</div><div class="seg spm" style="margin-bottom:6px"><button type="button" data-m="eq" class="${am ? "" : "on"}">Po równo</button><button type="button" data-m="am" class="${am ? "on" : ""}">Po kwotach</button></div>
  <div class="tspl speq" style="${am ? "display:none" : ""}">${ppl.map(p => `<label><input type="checkbox" class="spc" value="${esc(p)}" ${chk(p) ? "checked" : ""}> ${pn(p)}</label>`).join("")}</div>
  <div class="spam" style="${am ? "" : "display:none"}">${ppl.map(p => `<div class="frow" style="gap:8px"><span style="flex:1;min-width:0">${pn(p)}</span><input class="lin spa" data-p="${esc(p)}" inputmode="decimal" placeholder="0" value="${am && sh[p] > 0 ? esc(fmtN(sh[p])) : ""}" style="width:96px;flex:none;padding:6px 10px;min-height:0;font-size:13px;text-align:right"></div>`).join("")}<div class="small spsum" style="margin-top:4px;font-weight:600"></div></div></div>`;
}
function splitWire(root, totalOf) {
  root.querySelectorAll(".spblk").forEach(b => { if (b.dataset.w) return; b.dataset.w = "1";
    const num = i => { const v = parseFloat(String(i.value).replace(",", ".")); return v > 0 ? v : 0; };
    const sum = b._sum = () => { const tot = totalOf(b) || 0, el = b.querySelector(".spsum"); let sm = 0; b.querySelectorAll(".spa").forEach(i => { sm += num(i); }); sm = Math.round(sm * 100) / 100;
      const d = Math.round((tot - sm) * 100) / 100; el.style.color = (tot > 0 && d !== 0) ? "#e5484d" : "";
      el.textContent = tot > 0 ? "Suma: " + fmtN(sm) + " z " + fmtN(tot) + (d === 0 ? " ✓" : d > 0 ? " · brakuje " + fmtN(d) : " · za dużo " + fmtN(-d)) : "Suma: " + fmtN(sm); };
    b.querySelectorAll(".spm button").forEach(x => x.onclick = () => {
      b.querySelectorAll(".spm button").forEach(y => y.classList.toggle("on", y === x)); const am = x.dataset.m === "am";
      b.querySelector(".speq").style.display = am ? "none" : ""; b.querySelector(".spam").style.display = am ? "" : "none";
      sum(); });
    b._auto = () => { const am = b.querySelector(".spm .on").dataset.m === "am"; if (am) { const tot = totalOf(b) || 0, all = [...b.querySelectorAll(".spa")], typed = all.filter(i => i.dataset.auto !== "1" && num(i) > 0), emp = all.filter(i => i.dataset.auto === "1" || !(num(i) > 0));
        if (tot > 0 && emp.length === 1 && typed.length) { const rest = Math.round((tot - typed.reduce((q, i) => q + num(i), 0)) * 100) / 100; emp[0].value = rest > 0 ? fmtN(rest) : ""; emp[0].dataset.auto = rest > 0 ? "1" : ""; }
        else emp.forEach(i => { if (i.dataset.auto === "1") { i.value = ""; i.dataset.auto = ""; } }); } sum(); };
    b.querySelectorAll(".spa").forEach(i => i.addEventListener("input", () => { i.dataset.auto = ""; b._auto(); })); b.querySelectorAll(".spm button").forEach(x => x.addEventListener("click", () => b._auto())); sum(); });
  if (!root._spl) { root._spl = 1; root.addEventListener("input", e => { if (!e.target.classList.contains("spa")) root.querySelectorAll(".spblk").forEach(b => b._auto ? b._auto() : b._sum && b._sum()); }); }
}
function splitRead(b, a) {
  const am = b.querySelector(".spm .on").dataset.m === "am";
  if (!am) return {sp: [...b.querySelectorAll(".spc")].filter(x => x.checked).map(x => x.value), sh: null};
  const sh = {}; let sm = 0; b.querySelectorAll(".spa").forEach(i => { const v = Math.round(parseFloat(String(i.value).replace(",", ".")) * 100) / 100; if (v > 0) { sh[i.dataset.p] = v; sm += v; } });
  const ks = Object.keys(sh); if (!ks.length) return {sp: [], sh: null};
  if (Math.abs(a - sm) > 1.005) return {err: "Kwoty osób muszą się sumować do kwoty wydatku (różnica maks. 1)."};
  return {sp: ks, sh};
}
function qaTrip(){
  const L = allTrips().filter(x => !x.ar); if (!L.length) return null; let last = ""; try { last = localStorage.getItem("sht_qt") || ""; } catch (e) {}
  const vw = $("v-wyjazdy"); if (vw && vw.classList.contains("on") && tripOpen) { const o = L.find(x => x.id === tripOpen); if (o) return o; }
  return curTrip() || L.find(x => x.id === tripOpen) || L.find(x => x.id === last) || L[0];
}
const actGet = () => { try { return localStorage.getItem("sht_act") || ""; } catch (e) { return ""; } };
const actSet = id => { try { if (id) localStorage.setItem("sht_act", id); else localStorage.removeItem("sht_act"); } catch (e) {} };
const tripToday = () => new Date().toISOString().slice(0, 10);
function tripAuto(){ const td = tripToday(); return allTrips().filter(x => !x.ar).find(x => x.from && x.from <= td && (x.to || x.from) >= td) || null; }
function curTrip(){
  const td = tripToday(), L = allTrips().filter(x => !x.ar), a = L.find(x => x.id === actGet());
  if (a && !(a.to && a.to < td)) return a;
  return tripAuto();
}
function goTrip(t){ fabClose(); if (MODE !== (t.mode || "s")) setMode(t.mode || "s"); show("wyjazdy"); openTrip(t.id); }
function jumpSec(t, sel){ if (tripOpen !== t.id || !$("v-wyjazdy").classList.contains("on")) return; setTimeout(() => { const d = document.querySelector("#v-wyjazdy " + sel); if (d) { d.open = true; d.scrollIntoView({behavior: "smooth", block: "center"}); } }, 80); }
function openQuickShop(t){
  t.shop = t.shop || [];
  ovBox().innerHTML = `<div class="card" style="width:min(420px,94vw)"><h3>Dodaj rzecz do sklepu</h3><div class="sub">${esc(t.name || "Wyjazd")}</div>
    <div class="fld"><label>CO KUPIĆ</label><input id="qsn" class="lin" maxlength="60" placeholder="np. makaron, woda, kremy"></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn" id="qsx" style="flex:1">Anuluj</button><button class="btn pri" id="qsa" style="flex:2">Dodaj</button></div></div>`;
  const go = () => { const n = $("qsn").value.trim().slice(0, 60); if (!n) { $("qsn").focus(); return; } if (t.shop.some(x => x.n.toLowerCase() === n.toLowerCase())) { toast("Już jest na liście"); return; }
    t.shop.push({id: newTripId(), n, by: meName() || "ja", ok: false}); tripSave(); closeAccount(); toast("Dodano do listy zakupów: " + n); renderTrips(); jumpSec(t, ".tsd"); };
  $("qsx").onclick = closeAccount; $("qsa").onclick = go; $("qsn").onkeydown = e => { if (e.key === "Enter") go(); }; setTimeout(() => $("qsn").focus(), 60);
}
const fabRound = () => { const v = $("v-wyjazdy"); return !!(v && v.classList.contains("on") && tripOpen && allTrips().some(x => x.id === tripOpen && !x.ar)); };
function fabLabel(){ return fabRound() ? "＋" : "Obecny wyjazd"; }
function fabClose(){ const w = $("fabw"); if (w) w.classList.remove("open"); const f = $("fabx"); if (f) { f.textContent = fabLabel(); f.classList.toggle("fabround", fabRound()); f.setAttribute("aria-expanded", "false"); } }
async function finishTrip(t){
  const W = t.mode === "w", store_ = W ? wVisits : sVisits, y = (t.from || "").slice(0, 4) || String(new Date().getFullYear()), m = (t.from || "").slice(5, 7) || "";
  const its = (t.items || []).filter(i => i.p && byId[i.p]), places = [...new Set(its.map(i => i.p))];
  if (!its.length) return;
  if (!(await appConfirm("Zakończyć wyjazd „" + (t.name || "") + "”? " + (W ? places.length + " " + plur(places.length, "ośrodek", "ośrodki", "ośrodków") + " zapisze się jako odwiedzone" : its.length + " " + plur(its.length, "szlak", "szlaki", "szlaków") + " zapisze się jako zaliczone") + " (" + y + (m ? "-" + m : "") + ")."))) return;
  let add = 0;
  places.forEach(pid => {
    const r = byId[pid], e = store_[pid] || (store_[pid] = newEntry("v")); e.s = "v"; e.done = e.done || {}; e.hp = e.hp || {}; e.stays = e.stays || [];
    if (W) { const days = new Set(its.filter(i => i.p === pid && i.day).map(i => i.day)).size; if (!e.stays.some(k => String(k.y) === y && (!k.m || k.m === m))) { e.stays.push({y, m, d: days}); e.stays = sortStays(e.stays); add++; } }
    else { its.filter(i => i.p === pid).forEach(i => { const k = (r.hikes || []).findIndex(h => h.n === i.n); if (k >= 0 && !e.done[k]) { e.done[k] = 1; delete e.hp[k]; add++; } }); if (!e.stays.some(k => String(k.y) === y)) e.stays.push({y, m: ""}); }
  });
  t.fin = Date.now(); tripSave(); scheduleSave(); renderAll(); renderTrips(); toast(add ? "Dodano do odwiedzonych: " + add : "Wszystko już było zapisane");
}
function openQuickPack(t){
  t.pack = t.pack || []; const me = meName(), ppl = tripPeople(t), shared = t.shared && ppl.length > 1;
  ovBox().innerHTML = `<div class="card" style="width:min(420px,94vw)"><h3>Dodaj rzecz do wzięcia</h3><div class="sub">${esc(t.name || "Wyjazd")}</div>
    <div class="fld"><label>CO</label><input id="qpn" class="lin" maxlength="60" placeholder="np. kask, ładowarka, karnet"></div>
    ${shared ? `<div class="fld"><label>KTO ZAPEWNIA</label><select id="qpw" class="sel"><option value="">Wspólne / ktokolwiek</option>${ppl.map(p => `<option value="${esc(p)}">@${esc(p)}${p === me ? " (ja)" : ""}</option>`).join("")}</select></div>` : ""}
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn" id="qpx" style="flex:1">Anuluj</button><button class="btn pri" id="qpa" style="flex:2">Dodaj</button></div></div>`;
  const go = () => { const n = $("qpn").value.trim().slice(0, 60); if (!n) { $("qpn").focus(); return; } if (t.pack.some(x => x.n === n)) { toast("Już jest na liście"); return; }
    t.pack.push({id: newTripId(), n, by: shared ? me : undefined, who: shared ? ($("qpw").value || "") : "", ok: false}); try { localStorage.setItem("sht_qt", t.id); } catch (e) {} tripSave(); closeAccount(); toast("Dodano: " + n); renderTrips(); jumpSec(t, ".tpd"); };
  $("qpx").onclick = closeAccount; $("qpa").onclick = go; $("qpn").onkeydown = e => { if (e.key === "Enter") go(); }; setTimeout(() => $("qpn").focus(), 60);
}
function updateFab() {
  let w = $("fabw");
  if (!w) {
    w = document.createElement("div"); w.id = "fabw";
    w.innerHTML = `<div id="fabbg"></div><div id="fabm"></div><button id="fabx" aria-label="Szybkie akcje wyjazdu" aria-expanded="false">${fabLabel()}</button>`; document.body.append(w);
    $("fabbg").onclick = fabClose;
    $("fabx").onclick = () => {
      if (w.classList.contains("open")) { fabClose(); return; }
      const t = qaTrip(); if (!t) return; const W = t.mode === "w", can = !!(SBC && store.authed);
      const acts = [...(tripOpen === t.id && $("v-wyjazdy").classList.contains("on") ? [] : [["fg", IC.compass, "Wejdź na wyjazd"]]), ["fc", IC.wallet, "Dodaj wydatek"], ["fs", IC.cart, "Dodaj rzecz do sklepu"], ["fp", IC.pack, "Dodaj rzecz do wzięcia"], ["fu", IC.users, "Dodaj znajomego do wyjazdu"], ["fh", W ? IC.mtn : IC.foot, W ? "Dodaj ośrodek do wyjazdu" : "Dodaj szlak do wyjazdu"]];
      $("fabm").innerHTML = `<div class="fabt">${curTrip() && curTrip().id === t.id ? "Obecny wyjazd · " : ""}${esc(t.name || "Wyjazd")}</div>` + acts.map(a => `<button class="fabi" data-a="${a[0]}"><i>${a[1]}</i><span>${a[2]}</span></button>`).join("");
      $("fabm").querySelectorAll(".fabi").forEach(b => b.onclick = () => { const k = b.dataset.a; fabClose(); if (tripOpen !== t.id) { try { localStorage.setItem("sht_qt", t.id); } catch (e) {} }
        if (k === "fu") { if (!can) { toast("Zaloguj się, żeby zapraszać znajomych"); return; } openTripShare(t); }
        else if (k === "fg") goTrip(t);
        else if (k === "fs") openQuickShop(t);
        else if (k === "fc") openQuickCost({id: 1, tid: t.id});
        else if (k === "fp") openQuickPack(t);
        else { if (MODE !== (t.mode || "s")) setMode(t.mode || "s"); openTripPicker(t, "", 0); } });
      w.classList.add("open"); $("fabx").textContent = fabRound() ? "✕" : "Zamknij"; $("fabx").setAttribute("aria-expanded", "true");
    };
  }
  const v = $("v-wyjazdy"), has = !!curTrip() || fabRound(), on = !RO && has && !(v && v.classList.contains("on") && tripsTab === "packs");
  w.style.display = on ? "block" : "none"; if (!w.classList.contains("open")) { const f = $("fabx"); if (f) { f.textContent = fabLabel(); f.classList.toggle("fabround", fabRound()); } } if (!on) fabClose();
}
function openQuickVisit(pre){
  if (RO) return;
  const W = MODE === "w", cy = new Date().getFullYear(), cm = String(new Date().getMonth() + 1).padStart(2, "0");
  let sel = pre ? R.find(x => x.id === pre) : null, st = "v";
  const box = ovBox();
  box.innerHTML = `<div class="card" style="width:min(440px,94vw);max-height:90vh;overflow:auto"><h3>Dodaj miejsce</h3>
    <div class="fld"><label>MIEJSCE</label><div id="qvch"></div><input id="qvq" class="lin" placeholder="Szukaj ośrodka lub miejscowości…" autocomplete="off"><div id="qvr" style="margin-top:6px;display:grid;gap:4px"></div></div>
    <div class="seg" id="qvs" style="margin:4px 0 10px;flex:none"><button type="button" data-s="v" class="on">✓ Byłem</button><button type="button" data-s="p">📅 Planuję</button></div>
    <div class="fld"><label>KIEDY (OPCJONALNIE)</label><div style="display:flex;gap:6px;align-items:center"><div class="dt" id="qvyv" style="flex:1;min-width:0"><select id="qvy" class="sel">${yearOpts(cy, cy, 1980, true)}</select></div><div class="dt" id="qvyp" style="flex:1;min-width:0;display:none"><select id="qvyq" class="sel">${yearOpts("", cy, cy + 3, true)}</select></div><div class="dt" style="flex:1;min-width:0"><select id="qvm" class="sel">${monthOpts(cm)}</select></div>${W ? `<input id="qvd" class="lin sdy" inputmode="numeric" maxlength="2" placeholder="dni" aria-label="Dni na nartach" style="width:58px;flex:none;text-align:center">` : ""}</div></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn" id="qvx" style="flex:1">Anuluj</button><button class="btn pri" id="qvok" style="flex:2">Dodaj</button></div></div>`;
  const chip = () => { $("qvch").innerHTML = sel ? `<div class="frow" style="margin-bottom:6px"><span>${flag(sel.c.split(",")[0])} <b>${esc(sel.n)}</b></span><button class="btn sm" id="qvchg">Zmień</button></div>` : ""; $("qvq").style.display = sel ? "none" : ""; $("qvr").innerHTML = ""; if (sel) $("qvchg").onclick = () => { sel = null; chip(); $("qvq").focus(); }; };
  const find = () => { const q = norm($("qvq").value.trim()); if (q.length < 2) { $("qvr").innerHTML = ""; return; }
    const m = R.filter(r => matchR(r, q)).sort((a, b) => (norm(a.n).startsWith(q) ? 0 : 1) - (norm(b.n).startsWith(q) ? 0 : 1) || b.k - a.k).slice(0, 6);
    $("qvr").innerHTML = m.map(r => `<button type="button" class="btn sm qvit" data-id="${esc(r.id)}" style="text-align:left;justify-content:flex-start">${flag(r.c.split(",")[0])} ${esc(r.n)} <span class="small" style="margin-left:6px">${esc(r.c.split(",").map(cname).join(", "))}</span></button>`).join("") || `<div class="small">Nic nie znaleziono.</div>`;
    $("qvr").querySelectorAll(".qvit").forEach(b => b.onclick = () => { sel = R.find(x => x.id === b.dataset.id); chip(); }); };
  $("qvq").oninput = find; chip(); if (!sel) setTimeout(() => $("qvq").focus(), 60);
  $("qvs").onclick = e => { const b = e.target.closest("button"); if (!b) return; st = b.dataset.s; $("qvs").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); $("qvyv").style.display = st === "v" ? "" : "none"; $("qvyp").style.display = st === "p" ? "" : "none"; if ($("qvd")) $("qvd").style.display = st === "v" ? "" : "none"; };
  $("qvx").onclick = closeAccount;
  $("qvok").onclick = () => {
    if (!sel) { alert("Wybierz miejsce."); return; }
    const id = sel.id, y = $(st === "v" ? "qvy" : "qvyq").value, m = $("qvm").value, d = $("qvd") ? Math.min(99, Math.max(0, parseInt($("qvd").value, 10) || 0)) : 0;
    if (st === "p" && isVis(id)) { alert("Już byłeś w tym miejscu."); return; }
    if (!visits[id]) visits[id] = newEntry(st); else if (st === "v") visits[id].s = "v";
    const e = visits[id];
    if (st === "v") { if (y) { e.stays.push({y, m: y ? m : "", d}); e.stays = sortStays(e.stays); } }
    else e.pd = y ? (m ? y + "-" + m : y) : "";
    scheduleSave(); renderAll(); closeAccount(); toast("Dodano: " + sel.n);
  };
}
function openQuickCost(st) {
  const L = allTrips().filter(x => !x.ar); if (!L.length) return; const me = meName(); st = (st && st.id) ? st : {};
  let last = ""; try { last = localStorage.getItem("sht_qt") || ""; } catch (e) {}
  const today = new Date().toISOString().slice(0, 10);
  const t = L.find(x => x.id === st.tid) || L.find(x => x.id === tripOpen) || L.find(x => x.id === last) || L.find(x => x.from && x.from <= today && (x.to || x.from) >= today) || L[0];
  t.cc = t.cc || []; t.rt = t.rt || {}; t.rs = t.rs || {}; t.costs = t.costs || []; t.rsvp = t.rsvp || {};
  const ppl = tripPeople(t), shared = t.shared && ppl.length > 1, cur = baseC(t); let lc = ""; try { lc = localStorage.getItem("sht_lc_" + t.id) || ""; } catch (e) {}
  const cu0 = st.cu && allC(t).includes(st.cu) ? st.cu : (lc && allC(t).includes(lc) ? lc : cur);
  const opts = (arr, f) => arr.map(f).join("");
  ovBox().innerHTML = `<div class="card" style="width:min(440px,94vw);max-height:90vh;overflow:auto"><h3>Dodaj wydatek</h3>
    <div class="fld"><label>1. CO I ZA ILE</label><input id="qcw" class="lin" placeholder="Co (np. obiad)" value="${esc(st.w || "")}"><div style="display:flex;gap:6px;margin-top:6px"><input id="qca" class="lin" inputmode="decimal" placeholder="Kwota" value="${esc(st.a || "")}" style="flex:1"><select id="qccu" class="sel" style="width:auto;flex:none">${opts(allC(t), k => `<option value="${esc(k)}" ${k === cu0 ? "selected" : ""}>${esc(CSYM[k] && CSYM[k] !== k ? k + " · " + CSYM[k] : k)}</option>`)}</select></div></div>
    <div class="fld"><label>2. WYJAZD</label><select id="qct" class="sel">${opts(L, x => `<option value="${esc(x.id)}" ${x.id === t.id ? "selected" : ""}>${esc((x.name || "Wyjazd") + (tripRange(x) ? " · " + tripRange(x) : ""))}</option>`)}</select></div>
    ${shared ? `<div class="fld"><label>3. KTO ZAPŁACIŁ</label><select id="qcby" class="sel">${opts(ppl, p => `<option value="${esc(p)}" ${p === (st.by || me) ? "selected" : ""}>@${esc(p)}${p === me ? " (ja)" : ""}</option>`)}</select></div>
    ${splitBlock("qc", ppl, p => st.sp ? st.sp.includes(p) : t.rsvp[p] !== "n", "Dzielimy na:")}` : ""}
    <div style="display:flex;gap:8px;margin-top:14px"><button class="btn" id="qcx" style="flex:1">Anuluj</button><button class="btn pri" id="qcadd" style="flex:2">Dodaj wydatek</button></div></div>`;
  const cur_ = () => ({w: $("qcw").value, a: $("qca").value, cu: $("qccu").value, by: $("qcby") && $("qcby").value, sr: shared ? splitRead(document.querySelector('.spblk[data-k="qc"]'), parseFloat(String($("qca").value).replace(",", "."))) : null});
  splitWire(ovBox(), () => parseFloat(String($("qca").value).replace(",", ".")));
  $("qcx").onclick = closeAccount;
  $("qct").onchange = () => { const v = cur_(); openQuickCost({id: 1, tid: $("qct").value, w: v.w, a: v.a}); };
  $("qcadd").onclick = async () => { const v = cur_(), w = v.w.trim().slice(0, 80), a = parseFloat(String(v.a).replace(",", ".")); if (!w || !(a > 0)) { alert("Wpisz, co to było, i kwotę."); return; }
    const cu = cNorm(v.cu); if (cu !== cur && cRate(t, cu) == null) { await fxRefresh(t, true); if (cRate(t, cu) == null) { alert("Brak kursu dla " + cu + ". Ustaw go w wyjeździe, w „Waluty i kursy”."); return; } }
    if (shared && v.sr.err) { alert(v.sr.err); return; } if (shared && !v.sr.sp.length) { alert("Zaznacz, na kogo dzielimy."); return; } v.sp = shared ? v.sr.sp : null; v.sh = shared ? v.sr.sh : null;
    const dt = dtNow(), fx = await fxAt(t, cu, dt); if (fx.fail) toast("Nie udało się pobrać kursu z tego dnia, użyto bieżącego"); const nid = newTripId(); t.costs.push({id: nid, w, a, cu, fr: cu !== cur ? fx.fr : undefined, fd: fx.fd, dt, by: (shared && v.by) || me || "ja", ad: me || "ja", sp: shared && (v.sh || v.sp.length < ppl.length) ? v.sp : null, sh: v.sh || undefined, at: Date.now()});
    try { localStorage.setItem("sht_qt", t.id); localStorage.setItem("sht_lc_" + t.id, cu); } catch (e) {}
    tripSave(); closeAccount(); toast("Dodano: " + w + " · " + money(a, cu)); goTrip(t); setTimeout(() => { const d = document.querySelector(".tcd"); if (!d) return; d.open = true; const b = d.querySelector('.tced[data-c="' + nid + '"]'), cd = b && b.closest(".card"); (cd || d).scrollIntoView({behavior: "smooth", block: "center"}); if (cd) cd.style.animation = "ringpulse .9s ease-out 1"; }, 120); };
  setTimeout(() => { const i = $("qcw"); if (i && !i.value) i.focus(); }, 60);
}
function openTripAdd(t, day0){
  const W = t.mode === "w";
  ovBox().innerHTML = `<div class="card" style="width:min(420px,94vw)"><h3>Dodaj cel</h3><div class="sub">${esc(t.name || "Wyjazd")}</div>
    <button class="btn pri" id="tapk" style="width:100%;margin-bottom:8px">${W ? IC.mtn : IC.foot} ${W ? "Dodaj ośrodki" : "Dodaj szlaki"}</button>
    <button class="btn" id="taot" style="width:100%">＋ Dodaj inne</button><div class="small" style="margin-top:6px">„Inne” to wszystko, co nie jest ${W ? "ośrodkiem" : "szlakiem"}: zwiedzanie miasta, termy, restauracja, dojazd.</div>
    <button class="btn" id="lclose" style="width:100%;margin-top:12px">Zamknij</button></div>`;
  $("lclose").onclick = closeAccount; $("tapk").onclick = () => openTripPicker(t, "", day0); $("taot").onclick = () => openTripOther(t, day0);
}
function openTripOther(t, day0){
  let day = day0 || 0;
  ovBox().innerHTML = `<div class="card" style="width:min(460px,94vw)"><h3>Dodaj inne</h3><div class="sub">${esc(t.name || "Wyjazd")}</div>
    <div class="fld"><label>NAZWA</label><input id="toi" class="lin" placeholder="np. Zwiedzanie starego miasta" maxlength="80"></div>
    <div class="fld"><label>DODAJ DO</label><select id="tod" class="sel"><option value="0">Do rozplanowania (bez dnia)</option>${Array.from({length: tripDays(t)}, (_, k) => `<option value="${k + 1}" ${day === k + 1 ? "selected" : ""}>Dzień ${k + 1}${dayDate(t.from, k + 1) ? " · " + dayDate(t.from, k + 1) : ""}</option>`).join("")}</select></div>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="tob" style="flex:1">← Wróć</button><button class="btn pri" id="toa" style="flex:1">Dodaj</button></div></div>`;
  const inp = $("toi"); inp.focus();
  $("tod").onchange = e => { day = +e.target.value; }; $("tob").onclick = () => openTripAdd(t, day);
  const go = () => { const n = inp.value.trim().slice(0, 80); if (!n) { inp.focus(); return; } t.items = t.items || []; t.items.push(Object.assign({p: "", n, day, custom: 1, other: 1, at: Date.now()}, t.shared ? {by: meName()} : {})); tripSave(); closeAccount(); renderTrips(); toast("Dodano: " + n); };
  $("toa").onclick = go; inp.onkeydown = e => { if (e.key === "Enter") go(); };
}
function openTripPicker(t, pid0, day0){
  let pid = pid0 || "", q = "", day = day0 || 0, sm = "p", cf = "", mv = false, ms = "", po = false, bm = false;
  const inC = r => (!cf || (r.c || "").split(",").includes(cf)) && (!po || isPlan(r.id));
  const cSel = list => { const cs = {}; list.forEach(r => (r.c || "").split(",").forEach(c => { if (c) cs[c] = (cs[c] || 0) + 1; })); return `<div class="fld" style="display:flex;gap:8px"><select id="tpc" class="sel" aria-label="Kraj" style="flex:1"><option value="">Wszystkie kraje</option>` + Object.keys(cs).sort((a, b) => cname(a).localeCompare(cname(b), "pl")).map(c => `<option value="${c}" ${cf === c ? "selected" : ""}>${flag(c)} ${esc(cname(c))} (${cs[c]})</option>`).join("") + `</select><button class="btn sm" id="tpmap" type="button" style="white-space:nowrap">${mv ? IC.list + " Lista" : IC.map + " Mapa"}</button></div><label class="small" style="display:flex;align-items:center;gap:8px;margin:-2px 0 8px;cursor:pointer"><input type="checkbox" id="tppl" ${po ? "checked" : ""}> Tylko planowane (chcę tam pojechać) · ${list.filter(r => isPlan(r.id)).length}</label>`; };
  const mapPts = W => { const nq = norm(q); return (W ? WINTER.R : SUMMER.R).filter(r => inC(r) && (!nq || norm(r.n + " " + (r.c || "")).includes(nq) || (!W && sm === "h" && (r.hikes || []).some(h => !h.del && norm(h.n).includes(nq))))); };
  let mvb = null, mkey = "", MC = null;
  const RW = 520, RH = 300;
  const mapTiles = vb => tileG(vb, 340);
  const mapInner = () => {
    const {P, W, sel, full} = MC, vb = mvb, u = vb.w / RW, z = full.w / vb.w, inV = r => px(r.x) > vb.x - 8 * u && px(r.x) < vb.x + vb.w + 8 * u && py(r.y) > vb.y - 8 * u && py(r.y) < vb.y + vb.h + 8 * u;
    const V = P.filter(inV);
    let h = bm ? mapTiles(vb) : `<g>${gLand ? gLand.innerHTML : ""}</g>`;
    V.forEach(r => { const on = W && sel.has(r.id + "|" + r.n), s2 = r.id === ms; h += `<circle class="tpdot" data-id="${esc(r.id)}" cx="${px(r.x)}" cy="${py(r.y)}" r="${(s2 ? 9 : 5.5) * u}" fill="${on ? "#38e0a0" : "#7aa8ff"}" stroke="#fff" stroke-width="${(s2 ? 2.5 : 1) * u}" opacity="${s2 ? 1 : .9}"/><circle class="tpdot" data-id="${esc(r.id)}" cx="${px(r.x)}" cy="${py(r.y)}" r="${14 * u}" fill="transparent"/>`; });
    const placed = [], lab = [], imp = r => W ? (r.k || 0) : (r.hikes || []).length;
    const order = V.slice().sort((x, y) => (y.id === ms) - (x.id === ms) || imp(y) - imp(x));
    for (const r of order) {
      if (lab.length >= 70) break;
      const nm = r.n.length > 24 ? r.n.slice(0, 23) + "…" : r.n, w = nm.length * 6.4 * u, cx = px(r.x), cy = py(r.y) - 11 * u, bx = [cx - w / 2, cx + w / 2, cy - 10 * u, cy + 2 * u];
      if (r.id !== ms && placed.some(q => bx[0] < q[1] && bx[1] > q[0] && bx[2] < q[3] && bx[3] > q[2])) continue;
      placed.push(bx); lab.push(`<text x="${cx}" y="${cy}" text-anchor="middle" font-size="${10.5 * u}" font-weight="${r.id === ms ? 800 : 600}" style="fill:var(--text);stroke:var(--bg2);stroke-width:${3 * u}px;paint-order:stroke;pointer-events:none">${esc(nm)}</text>`);
    }
    return h + lab.join("");
  };
  const mapPaint = () => { const sv = $("tpsvg"); if (!sv) return; sv.setAttribute("viewBox", `${mvb.x} ${mvb.y} ${mvb.w} ${mvb.h}`); sv.innerHTML = mapInner(); };
  const mapZoom = (f, cx, cy) => { const full = MC.full, nw = Math.max(full.w / 80, Math.min(full.w * 1.6, mvb.w / f)), k = nw / mvb.w, fx = cx == null ? .5 : cx, fy = cy == null ? .5 : cy; mvb = {x: mvb.x + (mvb.w - nw) * fx, y: mvb.y + (mvb.h - nw * RH / RW) * fy, w: nw, h: nw * RH / RW}; mapPaint(); };
  const mapHtml = (W, sel) => {
    const P = mapPts(W).filter(r => isFinite(r.x) && isFinite(r.y));
    if (!P.length) { MC = null; return `<div class="small tpsel frow" style="padding:10px 0">Brak miejsc do pokazania.</div>`; }
    const xs = P.map(r => px(r.x)), ys = P.map(r => py(r.y)), pad = 1.2, x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad * .55, y1 = Math.max(...ys) + pad * .55;
    const bw = x1 - x0, bh = y1 - y0, k = Math.min(RW / bw, RH / bh), vw = RW / k, vh = RH / k, full = {x: x0 - (vw - bw) / 2, y: y0 - (vh - bh) / 2, w: vw, h: vh};
    MC = {P, W, sel, full}; const key = cf + "|" + q + "|" + sm + "|" + W; if (!mvb || key !== mkey) { mvb = Object.assign({}, full); mkey = key; }
    const r0 = P.find(r => r.id === ms); let info = `<div class="small tpsel frow" style="padding:8px 0">Dotknij punktu, żeby zobaczyć szczegóły i dodać. Punkty: ${P.length}. Przybliżaj palcami, kółkiem lub przyciskami.</div>`;
    if (r0) { const on = W && sel.has(r0.id + "|" + r0.n); info = W ? `<div class="frow tpsel"><span style="min-width:0">${flag((r0.c || "").split(",")[0])} <b>${esc(r0.n)}</b> <span class="small">${r0.k} km</span></span><button class="btn sm tpa ${on ? "" : "pri"}" data-p="${esc(r0.id)}" data-n="${esc(r0.n)}">${on ? "✓ dodany" : "＋ Dodaj"}</button></div>` : `<div class="frow tpp tpsel" data-id="${esc(r0.id)}" style="cursor:pointer"><span>${flag((r0.c || "").split(",")[0])} <b>${esc(r0.n)}</b> <span class="small">${(r0.hikes || []).filter(h => !h.del).length} szlaków</span></span><span>Szlaki ›</span></div>`; }
    const bs = "position:absolute;right:8px;width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--bg2);color:var(--text);font-size:20px;line-height:1;cursor:pointer;padding:0";
    return `<div style="position:relative;margin:4px 0 6px"><svg id="tpsvg" viewBox="${mvb.x} ${mvb.y} ${mvb.w} ${mvb.h}" style="width:100%;height:auto;max-height:46vh;background:rgba(var(--pn),.55);border-radius:12px;border:1px solid var(--line);display:block;touch-action:none;user-select:none">${mapInner()}</svg><button type="button" id="tpzi" aria-label="Przybliż" style="${bs};top:8px">+</button><button type="button" id="tpzo" aria-label="Oddal" style="${bs};top:48px">−</button><button type="button" id="tpzr" aria-label="Pokaż wszystko" style="${bs};top:88px;font-size:15px">⤢</button><button type="button" id="tpbm" aria-label="Mapa terenu" style="${bs};top:128px;font-size:15px;${bm ? "" : "opacity:.55"}">🏔️</button>${bm ? `<div style="position:absolute;left:8px;bottom:6px;font-size:9px;color:#222;background:rgba(255,255,255,.75);padding:1px 5px;border-radius:6px;pointer-events:none">© OpenStreetMap · OpenTopoMap</div>` : ""}</div>` + info;
  };
  const mapBind = () => {
    const sv = $("tpsvg"); if (!sv || !MC) return;
    $("tpzi").onclick = () => mapZoom(1.6); $("tpzo").onclick = () => mapZoom(1 / 1.6); $("tpzr").onclick = () => { mvb = Object.assign({}, MC.full); mapPaint(); }; $("tpbm").onclick = () => { bm = !bm; draw(); };
    const ptr = new Map(); let moved = 0, tapId = "", pd = 0;
    const rel = e => { const rc = sv.getBoundingClientRect(); return [(e.clientX - rc.left) / rc.width, (e.clientY - rc.top) / rc.height]; };
    sv.addEventListener("wheel", e => { e.preventDefault(); const [fx, fy] = rel(e); mapZoom(e.deltaY < 0 ? 1.3 : 1 / 1.3, fx, fy); }, {passive: false});
    sv.addEventListener("pointerdown", e => { sv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); if (ptr.size === 1) { moved = 0; const d = e.target.closest && e.target.closest(".tpdot"); tapId = d ? d.dataset.id : ""; } else { moved = 99; tapId = ""; const v = [...ptr.values()]; pd = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]); } });
    sv.addEventListener("pointermove", e => { if (!ptr.has(e.pointerId)) return; const o = ptr.get(e.pointerId), rc = sv.getBoundingClientRect();
      if (ptr.size === 1) { const dx = e.clientX - o[0], dy = e.clientY - o[1]; moved += Math.abs(dx) + Math.abs(dy); if (moved > 6) { const k = mvb.w / rc.width; mvb = {x: mvb.x - dx * k, y: mvb.y - dy * k, w: mvb.w, h: mvb.h}; ptr.set(e.pointerId, [e.clientX, e.clientY]); mapPaint(); } }
      else { ptr.set(e.pointerId, [e.clientX, e.clientY]); const v = [...ptr.values()], nd = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]); if (pd > 0 && nd > 0) { const mx = (v[0][0] + v[1][0]) / 2, my = (v[0][1] + v[1][1]) / 2; mapZoom(nd / pd, (mx - rc.left) / rc.width, (my - rc.top) / rc.height); } pd = nd; } });
    const up = e => { if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); if (!ptr.size && moved <= 6 && tapId) { ms = tapId; draw(); } };
    sv.addEventListener("pointerup", up); sv.addEventListener("pointercancel", e => { ptr.delete(e.pointerId); });
  };
  const draw = () => {
    const sel = new Set((t.items || []).map(i => i.p + "|" + i.n));
    let inner;
    const W = t.mode === "w", segP = `<div class="seg" id="tpmode" style="margin-bottom:8px"><button data-v="p" class="${sm === "p" ? "on" : ""}">Miejsca</button><button data-v="h" class="${sm === "h" ? "on" : ""}">Szlaki</button></div>`;
    if (W) { const L = WINTER.R.filter(r => inC(r) && (!q || norm(r.n + " " + (r.c || "")).includes(norm(q)))).sort((a, b) => b.k - a.k).slice(0, 40);
      inner = cSel(WINTER.R) + `<div class="fld"><input id="tpq" class="lin" type="search" placeholder="Szukaj ośrodka (np. Les 3 Vallées)…" value="${esc(q)}"></div>` + L.map(r => { const on = sel.has(r.id + "|" + r.n); return `<div class="frow"><span style="min-width:0">${flag((r.c || "").split(",")[0])} <b>${esc(r.n)}</b> <span class="small">${r.k} km</span></span><button class="btn sm tpa ${on ? "" : "pri"}" data-p="${esc(r.id)}" data-n="${esc(r.n)}">${on ? "✓ dodany" : "＋ Dodaj"}</button></div>`; }).join(""); }
    else if (!pid && sm === "h") { const qq = norm(q), HL = qq.length < 2 && !cf && !po ? [] : SUMMER.R.flatMap(r => (r.hikes || []).filter(h => !h.del).map(h => ({r, h}))).filter(z => inC(z.r) && norm(z.h.n + " " + z.r.n).includes(qq)).slice(0, 60);
      inner = segP + cSel(SUMMER.R) + `<div class="fld"><input id="tpq" class="lin" type="search" placeholder="Szukaj szlaku (np. Morskie Oko)…" value="${esc(q)}"></div>` + (HL.length ? HL.map(({r, h}) => { const on = sel.has(r.id + "|" + h.n); return `<div class="frow"><span style="min-width:0"><b>${esc(h.n)}</b><div class="small">${flag((r.c || "").split(",")[0])} ${esc(r.n)} · <span class="d${DIFF.indexOf(h.d)}">${esc(h.d)}</span></div></span><button class="btn sm tpa ${on ? "" : "pri"}" data-p="${esc(r.id)}" data-n="${esc(h.n)}">${on ? "✓ dodany" : "＋ Dodaj"}</button></div>`; }).join("") : `<div class="small" style="padding:6px 0">${qq.length < 2 ? "Wpisz nazwę szlaku." : "Brak takiego szlaku w bazie."}</div>`); }
    else if (!pid) { const L = SUMMER.R.filter(r => inC(r) && (!q || norm(r.n + " " + (r.c || "")).includes(norm(q)))).slice(0, 60);
      inner = segP + cSel(SUMMER.R) + `<div class="fld"><input id="tpq" class="lin" type="search" placeholder="Szukaj miejsca (np. Interlaken)…" value="${esc(q)}"></div>` + L.map(r => `<div class="frow tpp" data-id="${esc(r.id)}" style="cursor:pointer"><span>${flag((r.c || "").split(",")[0])} ${esc(r.n)} <span class="small">${(r.hikes || []).filter(h => !h.del).length} szlaków</span></span><span>›</span></div>`).join(""); }
    else { const r = byIdS[pid]; inner = `<button class="btn sm" id="tpback" style="margin-bottom:8px">← Inne miejsce</button><div class="small" style="font-weight:700;margin:0 0 6px">${esc(r.n)}</div>` + (r.hikes || []).filter(h => !h.del).map(h => { const on = sel.has(pid + "|" + h.n); return `<div class="frow"><span style="min-width:0"><b>${esc(h.n)}</b><div class="small"><span class="d${DIFF.indexOf(h.d)}">${esc(h.d)}</span></div></span><button class="btn sm tpa ${on ? "" : "pri"}" data-n="${esc(h.n)}">${on ? "✓ dodany" : "＋ Dodaj"}</button></div>`; }).join(""); }
    const qn = q.trim().slice(0, 80), none = W ? !WINTER.R.some(r => norm(r.n + " " + (r.c || "")).includes(norm(q))) : !pid && (sm === "h" ? !SUMMER.R.some(r => (r.hikes || []).some(h => !h.del && norm(h.n + " " + r.n).includes(norm(q)))) : !SUMMER.R.some(r => norm(r.n + " " + (r.c || "")).includes(norm(q))));
    const miss = qn.length >= 2 && (none || (!W && !pid)) ? `<div class="card" style="margin:10px 0;padding:10px 12px"><div style="font-size:14px;margin-bottom:6px">${none ? "Nie ma „" + esc(qn) + "” w bazie." : "Nie znalazłeś tego, czego szukasz?"}</div><button class="btn pri" id="tcxadd" style="width:100%">＋ Dodaj „${esc(qn)}” jako własne</button><div class="small" style="margin-top:4px;opacity:.7">Trafi do planu jako tekst, bez mapy i pogody. Wyślę je też adminowi jako propozycję nowego miejsca.</div></div>` : "";
    ovBox().innerHTML = `<div class="card" style="max-height:85vh;overflow:auto;width:min(560px,94vw)"><h3>Dodaj ${W ? "ośrodki" : "szlaki"} do: ${esc(t.name || "wyjazdu")}</h3><div class="fld"><label>DODAWAJ DO</label><select id="tpday" class="sel"><option value="0">Do rozplanowania (bez dnia)</option>${Array.from({length: tripDays(t)}, (_, k) => `<option value="${k + 1}" ${day === k + 1 ? "selected" : ""}>Dzień ${k + 1}${dayDate(t.from, k + 1) ? " · " + dayDate(t.from, k + 1) : ""}</option>`).join("")}</select></div>${inner}${miss}<button class="btn" id="lclose" style="width:100%;margin-top:10px">Gotowe</button></div>`;
    $("lclose").onclick = () => { closeAccount(); renderTrips(); };
    if (mv && !pid) { const card = $("tpday").closest(".card"); card.querySelectorAll(".frow").forEach(e => e.style.display = "none"); const qf = $("tpq"); (qf ? qf.closest(".fld") : $("tpc").closest(".fld")).insertAdjacentHTML("afterend", mapHtml(W, sel)); mapBind(); }
    { const pc = $("tppl"); if (pc) pc.onchange = e => { po = e.target.checked; draw(); }; }
    { const mb = $("tpmap"); if (mb) mb.onclick = () => { mv = !mv; ms = ""; mvb = null; draw(); }; }
    $("tpday").onchange = e => { day = +e.target.value; };
    const addCustom = () => { const n = q.trim().slice(0, 80); if (!n) return; q = ""; t.items = t.items || []; t.items.push(Object.assign({p: "", n, day, custom: 1, at: Date.now()}, t.shared ? {by: meName()} : {})); if (store.mode === "sb" && store.sb && store.uid && !store.admin) { store.sb.from("suggestions").insert({user_id: store.uid, username: (store.prof && store.prof.username) || store.name || "", mode: t.mode === "w" ? "w" : "s", name: n.slice(0, 120), country: "", note: ("z planu wyjazdu: " + (t.name || "")).slice(0, 200)}).then(() => {}, () => {}); } tripSave(); { const sc = $("v-wyjazdy"), st = sc.scrollTop; renderTrips(); sc.scrollTop = st; } draw(); };
    { const cx = $("tcxadd"); if (cx) cx.onclick = addCustom; }
    { const cc = $("tpc"); if (cc) cc.onchange = e => { cf = e.target.value; draw(); }; }
    const qi = $("tpq"); if (qi) { qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; draw(); const n = $("tpq"); n.focus(); n.setSelectionRange(pos, pos); }; }
    document.querySelectorAll(".tpp").forEach(el => el.onclick = () => { pid = el.dataset.id; draw(); });
    { const sg = $("tpmode"); if (sg) sg.onclick = e => { const b = e.target.closest("button"); if (!b) return; sm = b.dataset.v; draw(); }; }
    const bk = $("tpback"); if (bk) bk.onclick = () => { pid = ""; draw(); };
    document.querySelectorAll(".tpa").forEach(b => b.onclick = () => { const pp = b.dataset.p || pid, k = pp + "|" + b.dataset.n; t.items = t.items || []; if (t.items.some(i => i.p + "|" + i.n === k)) { t.items = t.items.filter(i => i.p + "|" + i.n !== k); } else t.items.push(Object.assign({p: pp, n: b.dataset.n, day, at: Date.now()}, W ? {m: "w"} : {}, t.shared ? {by: meName()} : {})); tripSave(); { const sc = $("v-wyjazdy"), st = sc.scrollTop; renderTrips(); sc.scrollTop = st; } draw(); });
  };
  draw();
}
function openTripShare(t){
  const owner = !t.shared || t.owner === store.uid;
  const draw = (msg) => {
    const members = t.shared ? (t.members || []) : [], pend = t.shared ? SOC.outInv.filter(i => i.trip_id === t.id) : [], low = x => String(x).toLowerCase(), fr = SOC.friends.filter(f => !members.some(m => low(m) === f) && !pend.some(i => low(i.to_name) === f));
    ovBox().innerHTML = `<div class="card" style="width:min(480px,94vw);max-height:88vh;overflow:auto"><h3>Uczestnicy: ${esc(t.name || "wyjazd")}</h3><div class="sub">Uczestnicy widzą wyjazd i mogą go edytować: dodawać szlaki, zmieniać dni, głosować, komentować i pisać notatki. Wydatki edytuje tylko ich autor. Zaproszona osoba musi zaakceptować zaproszenie.</div>
      ${t.shared && t.invite ? `<button class="btn pri" id="tmlink" style="width:100%;margin:2px 0 4px">${IC.link} ${navigator.share ? "Wyślij link zaproszenia" : "Skopiuj link zaproszenia"}</button><div class="small" style="margin-bottom:10px">Kto otworzy link i się zaloguje, dołączy do wyjazdu.</div>` : ""}
      <div class="frow"><span>@${esc(t.shared ? t.owner_name : meName() || "ty")} <span class="small">właściciel</span></span></div>
      ${members.map(m => `<div class="frow"><span>@${esc(m)}</span>${owner ? `<button class="btn sm tmrm" data-u="${esc(m)}" style="color:#ff8a8a">Usuń</button>` : ""}</div>`).join("")}
      ${pend.map(i => `<div class="frow"><span>@${esc(i.to_name)} <span class="small">zaproszono, czeka na akceptację</span></span>${owner ? `<button class="btn sm tmcx" data-id="${esc(i.id)}">Anuluj</button>` : ""}</div>`).join("")}
      ${owner ? `<div class="fld" style="margin-top:10px"><label>ZAPROŚ PO NAZWIE UŻYTKOWNIKA</label><div style="display:flex;gap:8px"><input id="tmu" class="lin" style="flex:1" placeholder="np. kropek" autocapitalize="off"><button class="btn pri" id="tmadd">Zaproś</button></div></div>${fr.length ? `<div class="small" style="margin:4px 0">Obserwowani:</div><div style="display:flex;gap:6px;flex-wrap:wrap">${fr.map(f => `<button class="btn sm tmq" data-u="${esc(f)}">+ @${esc(f)}</button>`).join("")}</div>` : ""}` : ""}
      <div class="small" id="tmm" style="min-height:16px;margin-top:8px">${esc(msg || "")}</div><button class="btn" id="lclose" style="width:100%;margin-top:6px">Zamknij</button></div>`;
    $("lclose").onclick = () => { closeAccount(); renderTrips(); };
    const lk = $("tmlink"); if (lk) lk.onclick = () => shareLink("Wyjazd „" + (t.name || "") + "”", "Dołącz do wyjazdu „" + (t.name || "") + "”:", location.origin + location.pathname + "#trip/" + t.id + "." + t.invite);
    const add = async u => { u = String(u || "").trim().toLowerCase().replace(/^@/, ""); const m = $("tmm");
      if (!meName()) { m.textContent = "Najpierw ustaw nazwę użytkownika w koncie."; return; }
      if (u.length < 2) { m.textContent = "Wpisz nazwę użytkownika."; return; } if (u === meName().toLowerCase()) { m.textContent = "To Ty."; return; } if ((t.members || []).some(x => String(x).toLowerCase() === u)) { m.textContent = "Już jest na liście."; return; }
      if (pend.some(i => String(i.to_name).toLowerCase() === u)) { m.textContent = "Już zaproszono tę osobę."; return; }
      m.textContent = "Wysyłam zaproszenie…";
      try {
        if (!t.shared) { const dd = shData(t), defs = new Set([...PACK_DEF_W, ...PACK_DEF]); dd.pack = (dd.pack || []).filter(x => !defs.has(x.n)); const ins = await store.sb.from("shared_trips").insert({owner: store.uid, owner_name: meName(), members: [], data: dd}).select("*").single(); if (ins.error) throw ins.error; const nt = shNorm(ins.data); TRIPS = TRIPS.filter(x => x !== t); SHT.unshift(nt); tripOpen = nt.id; scheduleSave(); t = nt; }
        const r = await store.sb.rpc("invite_to_trip", {tid: t.id, uname: u}); if (r.error) throw r.error;
        await socLoad(); draw("Wysłano zaproszenie do @" + u + " ✓");
      } catch(e){ const em = String((e && e.message) || e); m.textContent = SOCERR[em] || ("Nie udało się (czy uruchomiłeś social.sql?): " + em.slice(0, 80)); } };
    const ab = $("tmadd"); if (ab) ab.onclick = () => add($("tmu").value);
    document.querySelectorAll(".tmq").forEach(b => b.onclick = () => add(b.dataset.u));
    document.querySelectorAll(".tmcx").forEach(b => b.onclick = async () => { b.disabled = true; await socAct("cancel_trip_invite", {iid: b.dataset.id}); await socLoad(); draw(); });
    document.querySelectorAll(".tmrm").forEach(b => b.onclick = async () => { const mem = (t.members || []).filter(x => x !== b.dataset.u); try { const up = await store.sb.from("shared_trips").update({members: mem}).eq("id", t.id); if (up && up.error) throw up.error; t.members = mem; draw(); } catch(e){ $("tmm").textContent = "Nie udało się."; } });
  };
  SOC.ov = "share"; SOC.shareRedraw = () => { if (document.activeElement && document.activeElement.id === "tmu") return; draw(); };
  draw();
}
function pickTripFor(pid, hn){
  const add = t => { t.items = t.items || []; if (!t.items.some(i => i.p === pid && i.n === hn)) t.items.push(Object.assign({p: pid, n: hn, day: 0, at: Date.now()}, t.shared ? {by: meName()} : {})); tripSave(); renderTrips(); };
  ovBox().innerHTML = `<div class="card" style="width:min(460px,94vw)"><h3>Dodaj do wyjazdu</h3><div class="sub">${esc(hn)}</div>${allTrips().map(x => `<div class="frow tpk" data-id="${esc(x.id)}" style="cursor:pointer"><span>${esc(x.name || "Wyjazd")} <span class="small">${esc(tripRange(x))}</span></span><span>＋</span></div>`).join("")}<button class="btn pri" id="tpnew" style="width:100%;margin-top:10px">＋ Nowy wyjazd z tym szlakiem</button><button class="btn" id="lclose" style="width:100%;margin-top:8px">Anuluj</button></div>`;
  $("lclose").onclick = closeAccount;
  document.querySelectorAll(".tpk").forEach(el => el.onclick = () => { add(allTrips().find(x => x.id === el.dataset.id)); closeAccount(); alert("Dodano do wyjazdu ✓"); });
  $("tpnew").onclick = () => { const x = {id: newTripId(), name: "Nowy wyjazd", from: "", to: "", note: "", items: [], dn: {}, costs: [], pack: [], cur: "zł", mode: MODE}; TRIPS.unshift(x); add(x); closeAccount(); tripOpen = x.id; show("wyjazdy"); };
}

const mineDone = {};
function mineDefault(){ try { if (RO || !store || !store.authed || mineDone[MODE] || !R.length) return; if (!R.some(r => marked(r.id))) return; mineDone[MODE] = true; if (fStat === "all") setFStat("mine"); } catch (e) {} }
function renderAll(){ mineDefault(); renderHeader(); renderList(); renderTiers(); renderStats(); renderTrips(); mapRefresh(); updateFab(); }
setInterval(() => { try { updateFab(); } catch (e) {} }, 60000);
/* auto-aktualizacja: po powrocie do aplikacji sprawdź, czy jest nowsza wersja, i przeładuj */
{ let chk = 0; const upd = () => { const n = Date.now(); if (n - chk < 20000) return; chk = n;
    fetch("./?v=" + n, {cache: "no-store"}).then(r => r.ok ? r.text() : "").then(h => { const m = /const APPV = "(v\d+)"/.exec(h); if (m && m[1] !== APPV) { const busy = document.querySelector("#appdlg, .ov.on, .overlay.on, textarea:focus, input:focus"); if (!busy) location.reload(); } }).catch(() => {}); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") upd(); }); window.addEventListener("pageshow", upd); setTimeout(upd, 4000); }

document.addEventListener("click", e => { if (e.target && e.target.id === "sgbtn") openSuggest(fQ ? ($("q").value || "") : ""); });
/* instalacja jako aplikacja (PWA) */
let instPrompt = null;
const isStandalone = () => (navigator.standalone === true) || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const isIOSSafari = () => isIOS() && !/crios|fxios|edgios|opios|gsa\//i.test(navigator.userAgent);
function installText(){ return isIOS() ? (isIOSSafari() ? "Na iPhonie działa to tylko w Safari: dotknij ikony Udostępnij (kwadrat ze strzałką na dole), przewiń i wybierz „Dodaj do ekranu początkowego”, a na końcu „Dodaj”." : "Na iPhonie da się to zrobić tylko w Safari. Skopiuj link do tej strony, otwórz go w Safari, dotknij Udostępnij (kwadrat ze strzałką) i wybierz „Dodaj do ekranu początkowego”.") : "Otwórz menu przeglądarki (⋮) i wybierz „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”."; }
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); instPrompt = e; scheduleInstBar(); });
window.addEventListener("appinstalled", () => { instPrompt = null; hideInstBar(); });
function hideInstBar(){ const b = $("instbar"); if (b) b.style.display = "none"; }
async function doInstall(){ if (instPrompt) { instPrompt.prompt(); try { await instPrompt.userChoice; } catch(e){} instPrompt = null; hideInstBar(); return true; } return false; }
function showInstBar(){
  if (isStandalone() || !SBC || location.protocol.indexOf("http") !== 0) return;
  try { if (localStorage.getItem("skibeen.instdismiss")) return; } catch(e){}
  if (!instPrompt && !isIOS()) return;
  let b = $("instbar"); if (!b) { b = document.createElement("div"); b.id = "instbar"; document.body.append(b); }
  b.innerHTML = `<div class="t"><b>${IC.phone} Dodaj do ekranu głównego</b>${instPrompt ? "Dzięki temu strona będzie działała jak aplikacja: na pełnym ekranie, także bez zasięgu." : "Dzięki temu strona będzie działała jak aplikacja. " + esc(installText())}</div>${instPrompt ? `<button class="btn pri sm" id="instgo">Zainstaluj</button>` : (isIOS() && !isIOSSafari() ? `<button class="btn pri sm" id="instcp">Kopiuj link</button>` : "")}<button class="btn sm" id="instx" aria-label="Zamknij">✕</button>`;
  b.style.display = "flex";
  const go = $("instgo"); if (go) go.onclick = doInstall;
  const cp = $("instcp"); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(location.href.split("#")[0]); cp.textContent = "Skopiowano ✓"; } catch(e){ cp.textContent = "Nie udało się"; } };
  $("instx").onclick = () => { hideInstBar(); try { localStorage.setItem("skibeen.instdismiss", "1"); } catch(e){} };
}
let instT = null; function scheduleInstBar(){ if (instT) return; instT = setTimeout(showInstBar, 25000); }
if (isIOS()) scheduleInstBar();
$("gear").onclick = openSettings; $("frbtn").onclick = openFriends; $("bell").onclick = openInbox; $("acct").onclick = openAccount; updateAcct(); initListControls(); mapInit(); if (mlOn) setTimeout(() => { if (mlOn) mlStart(); }, 50); show(location.hash.slice(1) || "mapa"); setTimeout(welcomePick, 1200);
try { if (localStorage.getItem(LSM) !== "w") setMode("s"); } catch(e){}
document.querySelector('#nav button[data-t="wyjazdy"]').style.display = RO ? "none" : "";
initStore(); startI18n();
try { if (!RO && !R.some(r => marked(r.id))) { showAll = true; mapRefresh(); } } catch(e){}

try { applyTheme(); setTimeout(buildFx, 0); matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme); } catch(e){}

/* pierwsze uruchomienie: wybór zima / lato */
function welcomePick(){
  try { if (localStorage.getItem("skibeen.tour") === "1" || localStorage.getItem("skibeen.picked") === "1" || RO || Object.keys(wVisits).length + Object.keys(sVisits).length) { startTour(); return; } } catch (e) { startTour(); return; }
  if ($("wpick")) return; const o = document.createElement("div"); o.id = "wpick";
  o.innerHTML = `<div class="wpc"><h2>Od czego zaczynasz?</h2><p>Zaznaczasz miejsca, w których już byłeś, i planujesz kolejne.</p>
    <div class="wpg"><button data-m="w" class="wpw"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9M9 3l3 3 3-3M9 21l3-3 3 3M3 9l3 3-3 3M21 9l-3 3 3 3"/></svg><b>Zima</b><span>Ośrodki narciarskie</span></button>
    <button data-m="s" class="wps"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 20 6.5-11 4 6.5 2.5-4L21 20z"/><circle cx="17" cy="5" r="2"/></svg><b>Lato</b><span>Góry i szlaki</span></button></div>
    <small>Tryb zmienisz w każdej chwili przełącznikiem u góry.</small></div>`;
  document.body.append(o);
  const done = () => { o.classList.add("out"); setTimeout(() => { o.remove(); startTour(); }, 260); };
  const finish = c => { fCountry = c; try { $("fcountry").value = c; } catch (x) {} mineDone[MODE] = false; renderAll(); mapRefresh(); done(); };
  const SEL = new Set();
  const step3 = () => {
    const W = MODE === "w", sc = r => W ? (r.k || 0) : (r.hikes || []).filter(h => !h.del).length, box = o.querySelector(".wpc"), cs = [...SEL]; let n = 0;
    const sect = c => `<div class="wph">${flag(c)} ${esc(cname(c))}</div>` + R.filter(r => r.c.split(",")[0] === c).sort((x, y) => sc(y) - sc(x)).slice(0, cs.length > 3 ? 6 : 8).map(r => `<button type="button" class="wpi${isVis(r.id) ? " on" : ""}" data-id="${esc(r.id)}"><span><b>${esc(r.n)}</b><small>${W ? Math.round(r.k || 0) + " km" : sc(r) + " " + plur(sc(r), "szlak", "szlaki", "szlaków")}</small></span><i>✓</i></button>`).join("");
    box.innerHTML = `<h2>${tr("Gdzie już byłeś?")}</h2><p>${tr(W ? "Zaznacz tyle ośrodków, ile chcesz." : "Zaznacz tyle miejsc, ile chcesz.")}</p>
      <div class="wpl">${cs.map(sect).join("")}</div>
      <button type="button" class="btn pri wpdone" style="width:100%;margin-top:12px">${tr("Gotowe")}</button><button type="button" class="wpskip" data-back="1">${tr("← Wróć do krajów")}</button>`;
    box.onclick = e => { const it = e.target.closest(".wpi"); if (it) { const id = it.dataset.id; if (isVis(id)) { if (visits[id] && Object.keys(visits[id]).length <= 6) delete visits[id]; else visits[id].s = "n"; } else visits[id] = Object.assign(newEntry("v"), {s: "v"}); it.classList.toggle("on", isVis(id)); n++; scheduleSave(); return; }
      if (e.target.closest("[data-back]")) { step2(); return; } if (e.target.closest(".wpdone")) { if (n) track("start-zaznaczone-" + n); finish(cs.length === 1 ? cs[0] : ""); } };
  };
  const step2 = () => {
    const W = MODE === "w", sc = {}; R.forEach(r => r.c.split(",").forEach(c => { sc[c] = (sc[c] || 0) + (W ? 1 : ((r.hikes || []).filter(h => !h.del).length || 1)); }));
    const pop = ["PL", "AT", "CH", "IT", "FR", "DE", "SI"].filter(c => sc[c]), rest = Object.keys(sc).filter(c => !pop.includes(c)).sort((a, b) => sc[b] - sc[a] || cname(a).localeCompare(cname(b), "pl"));
    const tile = c => `<button type="button" data-c="${esc(c)}" class="wpt${SEL.has(c) ? " on" : ""}"><i>${flag(c)}</i><b>${esc(cname(c))}</b></button>`;
    o.querySelector(".wpc").innerHTML = `<h2>${tr("Gdzie najczęściej?")}</h2><p>${tr("Wybierz jeden kraj albo kilka. Potem zaznaczysz największe miejsca.")}</p>
      <div class="wpg wpg3">${pop.map(tile).join("")}</div>
      ${rest.length ? `<div class="wph2">${tr("Pozostałe kraje")}</div><div class="wpr">${rest.map(c => `<button type="button" class="wpq${SEL.has(c) ? " on" : ""}" data-c="${esc(c)}">${flag(c)} ${esc(cname(c))}</button>`).join("")}</div>` : ""}
      <button type="button" class="btn pri wpnext" style="width:100%;margin-top:12px"${SEL.size ? "" : " disabled"}>${tr("Idź dalej")}${SEL.size ? " (" + SEL.size + ")" : ""}</button><button type="button" class="wpskip" data-skip="1">${tr("Pomiń")}</button>`;
    const box = o.querySelector(".wpc"), nx = box.querySelector(".wpnext");
    box.onclick = e => { if (e.target.closest("[data-skip]")) { finish(""); return; } if (e.target.closest(".wpnext")) { if (SEL.size) step3(); return; }
      const b = e.target.closest("button[data-c]"); if (!b) return; const c = b.dataset.c; if (SEL.has(c)) SEL.delete(c); else SEL.add(c); b.classList.toggle("on", SEL.has(c)); nx.disabled = !SEL.size; nx.textContent = tr("Idź dalej") + (SEL.size ? " (" + SEL.size + ")" : ""); };
  };
  o.onclick = e => { const b = e.target.closest("button[data-m]"); if (!b) return; try { localStorage.setItem("skibeen.picked", "1"); } catch (x) {} track("start-" + (b.dataset.m === "w" ? "zima" : "lato")); setMode(b.dataset.m); o.onclick = null; step2(); };
}
/* wyszukiwarka na mapie */
function mapGoTo(r){
  if (typeof ML !== "undefined" && ML) { ML.flyTo({center: [r.x, r.y], zoom: Math.max(ML.getZoom(), 8.5), duration: 700}); return; }
  const rc = svg.getBoundingClientRect(), tw = Math.min(vb.w, 2.6), th = tw * rc.height / rc.width, tx = px(r.x) - tw / 2, ty = py(r.y) - th / 2;
  const a = {...vb}, t0 = performance.now(), D = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 420; mapFitted = true;
  (function st(t){ const k = D ? Math.min(1, (t - t0) / D) : 1, e = 1 - Math.pow(1 - k, 3); vb.x = a.x + (tx - a.x) * e; vb.y = a.y + (ty - a.y) * e; vb.w = a.w + (tw - a.w) * e; vb.h = a.h + (th - a.h) * e; if (k < 1) { applyVB(true); requestAnimationFrame(st); } else applyVB(); })(t0);
}
function mapSearch(){
  let p = $("msrch"); if (p) { p.querySelector("input").focus(); return; }
  p = document.createElement("div"); p.id = "msrch";
  p.innerHTML = `<div class="msi"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" placeholder="${tr(MODE === "w" ? "Szukaj ośrodka lub szlaku…" : "Szukaj miejsca lub szlaku…")}" autocomplete="off" enterkeyhint="go"><button class="msx" aria-label="Zamknij">×</button></div><div class="msr"></div>`;
  $("v-mapa").append(p); const inp = p.querySelector("input"), res = p.querySelector(".msr");
  const close = () => { p.classList.add("out"); setTimeout(() => p.remove(), 160); };
  const pick = (id, hi) => { track("szukaj"); if (hi != null && MODE !== "s") setMode("s"); const r = byId[id]; if (!r) return; close(); if (!passF(r) && !marked(r.id)) { showAll = true; } mapRefresh(); mapGoTo(r);
    setTimeout(() => { openSheet(id); if (hi != null) { hkOpen.add(r.id + ":" + hi); renderSheet(); } if (hi != null) setTimeout(() => { const el = document.querySelector(`#sheet .hkhead[data-o="${hi}"]`); if (el) { const h = el.closest(".hike") || el; h.scrollIntoView({block: "center", behavior: "smooth"}); h.classList.add("hkflash"); setTimeout(() => h.classList.remove("hkflash"), 1600); } }, 320); }, document.body.classList.contains("wide") ? 0 : 450); };
  const draw = () => { const q = norm(inp.value.trim()); if (q.length < 2) { res.innerHTML = ""; return; }
    const L = R.filter(r => norm(r.n + " " + r.c.split(",").map(cname).join(" ")).includes(q)).sort((a, b) => (norm(b.n).startsWith(q) - norm(a.n).startsWith(q)) || ((b.k || 0) - (a.k || 0))).slice(0, 5);
    const H = []; SUMMER.R.forEach(r => (r.hikes || []).forEach((h, i) => { if (!h.del && norm(h.n).includes(q)) H.push({r, h, i, st: norm(h.n).startsWith(q)}); })); H.sort((a, b) => b.st - a.st);
    const row = r => `<button data-id="${esc(r.id)}"><span class="msf">${flag(r.c.split(",")[0])}</span><span class="msn"><b>${esc(r.n)}</b><small>${esc(r.c.split(",").map(cname).join(", "))}</small></span>${marked(r.id) ? `<i class="msd ${isVis(r.id) ? "v" : "p"}"></i>` : ""}</button>`;
    const hrow = z => `<button data-id="${esc(z.r.id)}" data-h="${z.i}"><span class="msf msh">${IC.foot}</span><span class="msn"><b>${esc(z.h.n)}</b><small>${tr("Szlak")} · ${esc(z.r.n)}</small></span>${z.h.d ? `<span class="msdf">${esc(z.h.d)}</span>` : ""}</button>`;
    const out = L.map(row).join("") + H.slice(0, Math.max(3, 8 - L.length)).map(hrow).join("");
    res.innerHTML = out || `<div class="mse">${tr("Nic nie znaleziono")}</div>`; };
  inp.oninput = draw; inp.onkeydown = e => { if (e.key === "Escape") close(); if (e.key === "Enter") { const b = res.querySelector("button"); if (b) pick(b.dataset.id, b.dataset.h != null ? +b.dataset.h : null); } };
  res.onclick = e => { const b = e.target.closest("button[data-id]"); if (b) pick(b.dataset.id, b.dataset.h != null ? +b.dataset.h : null); };
  p.querySelector(".msx").onclick = close; requestAnimationFrame(() => inp.focus());
}
$("msbtn").onclick = mapSearch;
