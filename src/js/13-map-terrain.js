/* ---------- kontury gór (grzbiety, szczyty, rzeki, jeziora) – tylko przy mocnym przybliżeniu ---------- */
const TERR_ON = false; /* kontury gór wyłączone (obciążały mapę); włącz ustawiając true */
const TERR_REG = TERR_ON ? [{id: "tatry", b: [49.0, 19.6, 49.4, 20.5]}] : [];
const TERR = {};
let gTer = null;
function dpSimp(pts, tol){
  if (pts.length < 3) return pts;
  const d2 = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); const x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1]; return x * x + y * y; };
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let m = -1, mi = 0; for (let i = a + 1; i < b; i++) { const d = d2(pts[i], pts[a], pts[b]); if (d > m) { m = d; mi = i; } } if (m > tol * tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]);
}
function terrParse(j){
  const out = {r: [], l: [], g: [], p: [], t: Date.now()}, rd = v => Math.round(v * 1e4) / 1e4;
  const geo = e => dpSimp((e.geometry || []).map(q => [rd(q.lon), rd(q.lat)]), 0.00018);
  (j.elements || []).forEach(e => { const tg = e.tags || {};
    if (e.type === "node" && tg.natural === "peak" && tg.name) out.p.push([rd(e.lon), rd(e.lat), parseInt(tg.ele) || 0, tg.name]);
    else if (e.type === "way" && e.geometry) { const g = geo(e); if (g.length < 2) return;
      if (tg.natural === "water") out.l.push(g); else if (tg.natural === "ridge" || tg.natural === "arete") out.g.push(g); else if (tg.waterway) out.r.push([tg.waterway === "river" ? 1 : 0, g]); } });
  out.p.sort((a, b) => b[2] - a[2]); return out;
}
async function terrLoad(reg){
  const T = TERR[reg.id] || (TERR[reg.id] = {state: 0}); if (T.state) return; T.state = 1;
  const key = "sht-terr-" + reg.id + "-1";
  try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c && Date.now() - c.t < 90 * 864e5) { T.d = c; T.state = 2; terrBuild(reg); terrUpd(); return; } } catch (e) {}
  const [s, w, n, e] = reg.b, bb = `${s},${w},${n},${e}`;
  const q = `[out:json][timeout:60];(way["waterway"~"^(river|stream)$"]["name"](${bb});way["natural"="water"](${bb});way["natural"~"^(ridge|arete)$"](${bb});node["natural"="peak"]["name"](${bb}););out geom qt;`;
  for (const u of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try { const r = await fetch(u, {method: "POST", body: "data=" + encodeURIComponent(q), headers: {"Content-Type": "application/x-www-form-urlencoded"}}); if (!r.ok) continue; T.d = terrParse(await r.json()); T.state = 2; try { localStorage.setItem(key, JSON.stringify(T.d)); } catch (e2) {} terrBuild(reg); terrUpd(); return; } catch (e3) {}
  }
  T.state = 0; T.fail = Date.now();
}
function terrBuild(reg){
  const T = TERR[reg.id]; if (!T || !T.d || T.g) return; const d = T.d, g = mk("g", {"pointer-events": "none"}); T.g = g; gTer.append(g);
  const path = (pts, close) => "M" + pts.map(q => px(q[0]).toFixed(3) + " " + py(q[1]).toFixed(3)).join("L") + (close ? "Z" : "");
  const mkp = (dd, st, w, extra) => mk("path", Object.assign({d: dd, style: st, "stroke-width": w, "vector-effect": "non-scaling-stroke", fill: "none", "stroke-linejoin": "round", "stroke-linecap": "round"}, extra || {}));
  d.g.forEach(l => g.append(mkp(path(l), "stroke:var(--ridge)", 1.6, {"stroke-dasharray": "5 3"})));
  d.r.forEach(([k, l]) => g.append(mkp(path(l), "stroke:var(--water)", k ? 1.4 : .9)));
  d.l.forEach(l => { const e = mkp(path(l, 1), "stroke:var(--water);fill:var(--waterf)", 1); g.append(e); });
  T.pk = d.p.map((q, i) => { const tri = mk("path", {d: "M0 -1.1 L1 .8 L-1 .8Z", style: "fill:var(--ridge);stroke:var(--bg2)", "stroke-width": .25}), tx = mk("text", {"text-anchor": "middle", style: "fill:var(--lblf);stroke:var(--lbls)", "paint-order": "stroke", "stroke-linejoin": "round", "font-family": "Barlow, 'Segoe UI', Roboto, Arial, sans-serif", "font-weight": "600", "letter-spacing": "0.01em"}); tx.textContent = q[3] + (q[2] ? " " + q[2] : ""); g.append(tri, tx); return {tri, tx, x: px(q[0]), y: py(q[1]), i}; });
}
function terrUpd(){
  if (!TERR_ON || !gTer) return; const lonSpan = vb.w / COS, cx = (vb.x + vb.w / 2) / COS, cy = -(vb.y + vb.h / 2); let any = false;
  TERR_REG.forEach(reg => { const [s, w, n, e] = reg.b, near = cx > w - .3 && cx < e + .3 && cy > s - .3 && cy < n + .3, on = lonSpan < 1.1 && near, T = TERR[reg.id] || (TERR[reg.id] = {state: 0});
    if (on && !T.state && Date.now() - (T.fail || 0) > 6e4) terrLoad(reg);
    if (T.g) { T.g.style.display = on ? "" : "none"; if (on) { any = true; const sc = scale(), K = lonSpan < .12 ? 999 : lonSpan < .3 ? 45 : 14; T.pk.forEach(p => { const sh = p.i < K; p.tri.setAttribute("transform", `translate(${p.x} ${p.y}) scale(${5 / sc})`); p.tri.style.display = sh ? "" : "none"; p.tx.style.display = sh ? "" : "none"; if (sh) { p.tx.setAttribute("x", p.x); p.tx.setAttribute("y", p.y - 9 / sc); p.tx.setAttribute("font-size", 10 / sc); p.tx.setAttribute("stroke-width", 3 / sc); } }); } } });
  svg.classList.toggle("terr", any);
}
let showAll = false;
function mapInit(){
  gGrat = mk("g", {}); gLand = mk("g", {}); gTile = mk("g", {"pointer-events":"none"}); gTer = mk("g", {"pointer-events":"none"}); gDots = mk("g", {}); gClu = mk("g", {"pointer-events":"none"}); gLbl = mk("g", {"pointer-events":"none"});
  gGrat.id = "gGrat"; gLand.id = "gLand";
  const gGh = mk("g", {"pointer-events":"none"}); [-1, 0, 1].forEach(k => [-1, 0, 1].forEach(m => { if (!k && !m) return; ["gGrat", "gLand"].forEach(id => { const u = mk("use", {href: "#" + id}); u.setAttribute("transform", `translate(${k * WW} ${m * WH})`); gGh.append(u); }); }));
  svg.append(gGrat, gLand, gGh, gTile, gTer, gClu, gDots, gLbl);
  for (let lon = -180; lon <= 180; lon += 10) gGrat.append(mk("line", {x1:px(lon), y1:py(-90), x2:px(lon), y2:py(90), style:"stroke:var(--grat)", "stroke-width":1, "vector-effect":"non-scaling-stroke"}));
  for (let lat = -90; lat <= 90; lat += 10) gGrat.append(mk("line", {x1:px(-180), y1:py(lat), x2:px(180), y2:py(lat), style:"stroke:var(--grat)", "stroke-width":1, "vector-effect":"non-scaling-stroke"}));
  for (let lon = -25; lon <= 30; lon += 5) gGrat.append(mk("line", {x1:px(lon), y1:py(30), x2:px(lon), y2:py(68), style:"stroke:var(--grat)", "stroke-width":1, "vector-effect":"non-scaling-stroke"}));
  for (let lat = 32; lat <= 68; lat += 4) gGrat.append(mk("line", {x1:px(-26), y1:py(lat), x2:px(30), y2:py(lat), style:"stroke:var(--grat)", "stroke-width":1, "vector-effect":"non-scaling-stroke"}));
  buildDots(); fit(); loadLand();
  new ResizeObserver(() => { const rc = svg.getBoundingClientRect(); if (rc.width) { vb.h = vb.w * rc.height / rc.width; applyVB(); } }).observe(svg);

  const toggleAll = () => {
    const allOn = showAll && !lgOff.size && !filtN();
    if (allOn) { showAll = false; legSync(); mapRefresh(); return; }
    fCountry = ""; fGroup = ""; fMinKm = 0; fMinEl = 0; fMinR = 0; fPrice = 0; fCat = ""; fFilm = ""; fWx = ""; fWd = 0; fWs = 0; fWc = 0; fStat = "all";
    [["fcountry", ""], ["fgroup", ""], ["fminkm", "0"], ["fminel", "0"], ["fminr", "0"], ["fcat", ""], ["fwx", ""], ["fwd", "0"], ["fws", "0"], ["fwc", "0"], ["fstat", "all"]].forEach(([i, v]) => { const e = $(i); if (e) { e.value = v; e.dispatchEvent(new Event("change")); } });
    lgOff.clear(); try { localStorage.setItem("sht-lgoff", ""); } catch (e) {} showAll = true;
    legSync(); renderList(); mapRefresh();
  };
  $("mall").onclick = toggleAll; $("mall2").onclick = toggleAll;
  const goAdd = () => { show("lista"); setTimeout(() => $("q").focus(), 60); };
  $("zin").onclick = () => zoomAt(0.6, null); $("zout").onclick = () => zoomAt(1 / 0.6, null);
  { const nb = $("znames"); const sync = () => { nb.classList.remove("on"); nb.style.textDecoration = showNames ? "" : "line-through"; nb.style.opacity = showNames ? "" : ".6"; }; sync(); nb.onclick = () => { showNames = !showNames; try { localStorage.setItem("skibeen.names", showNames ? "1" : "0"); } catch(e){} sync(); applyVB(); }; }
  $("mfilt").onclick = openMapFilters; $("mlist").onclick = () => show("lista"); $("madd2").onclick = () => openQuickVisit(); $("qvadd").onclick = () => { if (!RO && SBC) openSuggest($("q").value || ""); else openQuickVisit(); };
  bindMapGestures();
}
let showNames = true; try { showNames = localStorage.getItem("skibeen.names") !== "0"; } catch(e){}
["gesturestart","gesturechange","gestureend"].forEach(ev => document.addEventListener(ev, e => { if (!e.target.closest || !e.target.closest("#mapwrap")) e.preventDefault(); }, {passive:false}));
document.addEventListener("wheel", e => { if (e.ctrlKey && !(e.target.closest && e.target.closest("#mapwrap"))) e.preventDefault(); }, {passive:false});
document.addEventListener("touchmove", e => { if (e.touches && e.touches.length > 1 && !(e.target.closest && e.target.closest("#mapwrap"))) e.preventDefault(); }, {passive:false});
function buildDots(){
  gDots.replaceChildren(); gLbl.replaceChildren(); dots = [];
  R.forEach(r => {
    const h = mk("circle", {cx:px(r.x), cy:py(r.y), "pointer-events":"none"});
    const c = mk("circle", {cx:px(r.x), cy:py(r.y), "vector-effect":"non-scaling-stroke"});
    const t = mk("text", {x:px(r.x), y:py(r.y), style:"fill:var(--lblf);stroke:var(--lbls)", "text-anchor":"middle", "paint-order":"stroke", "stroke-linejoin":"round", "font-family":"Barlow, 'Segoe UI', Roboto, Arial, sans-serif", "font-weight":"600", "letter-spacing":"0.01em"});
    { const dn = dname(r), L = filmMode ? 30 : 22; t.textContent = dn.length > L ? dn.slice(0, L - 1) + "…" : dn; }
    gDots.append(h, c); gLbl.append(t); dots.push({r, h, c, t, rad: MODE === "w" ? 2 + Math.sqrt(r.k) / 5 : 5});
  });
  const xs = R.map(r => px(r.x)), ys = R.map(r => py(r.y)), pad = 1.0;
  base = {x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad};
}
const marked = id => isVis(id) || isPlan(id);
function shownBounds(){
  if (!filtN() && !filmMode) return {x0: px(5.5), x1: px(24.5), y0: py(54.8), y1: py(45.2)};
  let pts = dots.filter(d => passF(d.r));
  if (!pts.length) pts = dots;
  const xs = pts.map(d => px(d.r.x)), ys = pts.map(d => py(d.r.y)), pad = 1.2;
  return {x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad};
}
let vbRestore = (() => { try { const a = JSON.parse(localStorage.getItem("skibeen.vb") || "null"); if (Array.isArray(a) && a.length === 4 && a.every(Number.isFinite) && a[2] > 0.05 && a[2] < 1e4 && a[3] > 0.05) return a; } catch(e){} return null; })(), _vbSave = 0;
function fit(){ mapFitted = true; if (ML) { vbRestore = null; const b = shownBounds(); ML.fitBounds([[b.x0 / COS, -b.y1], [b.x1 / COS, -b.y0]], {padding: 24, duration: 500}); return; }
  if (vbRestore) { const a = vbRestore; vbRestore = null; const rc0 = svg.getBoundingClientRect(); if (rc0.width > 50 && rc0.height > 50) { const cx = a[0] + a[2] / 2, cy = a[1] + a[3] / 2; vb.w = a[2]; vb.h = a[2] * rc0.height / rc0.width; vb.x = cx - vb.w / 2; vb.y = cy - vb.h / 2; applyVB(); return; } }
  const rc = svg.getBoundingClientRect(); const W = rc.width || 360, H = rc.height || 500, b = shownBounds();
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0, s = Math.min(W / bw, H / bh);
  vb.w = W / s; vb.h = H / s; vb.x = b.x0 - (vb.w - bw) / 2; vb.y = b.y0 - (vb.h - bh) / 2; applyVB();
}
function scale(){ const rc = svg.getBoundingClientRect(); return (rc.width || 360) / vb.w; }
let _vbq = 0, _vbFull = false;
function applyVB(light){
  { const cc = vb.x + vb.w / 2; if (cc < px(-180)) vb.x += WW; else if (cc > px(180)) vb.x -= WW; const cy0 = vb.y + vb.h / 2; if (cy0 < py(90)) vb.y += WH; else if (cy0 > py(-90)) vb.y -= WH; }
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  if (mapFitted) { clearTimeout(_vbSave); _vbSave = setTimeout(() => { try { localStorage.setItem("skibeen.vb", JSON.stringify([vb.x, vb.y, vb.w, vb.h].map(n => +n.toFixed(3)))); } catch(e){} }, 500); }
  if (light !== true) _vbFull = true;
  if (_vbq) return;
  _vbq = requestAnimationFrame(() => { _vbq = 0; const f = _vbFull; _vbFull = false; vbHeavy(f); });
}
function vbHeavy(full){
  try { terrUpd(); } catch (e) {}
  if (!base) return;
  const rc = svg.getBoundingClientRect(), s = (rc.width || 360) / vb.w, z = s / ((rc.width || 360) / (base.x1 - base.x0));
  const fn = full ? filtN() : 0, mx = vb.w * .04, my = vb.h * .04, X0 = vb.x - mx, X1 = vb.x + vb.w + mx, Y0 = vb.y - my, Y1 = vb.y + vb.h + my;
  const cand = [];
  const vcx = vb.x + vb.w / 2, vcy = vb.y + vb.h / 2;
  dots.forEach(d => {
    const id = d.r.id;
    { const kk = Math.round((vcx - px(d.r.x)) / WW), ky = Math.round((vcy - py(d.r.y)) / WH); if (kk !== (d._k || 0) || ky !== (d._ky || 0)) { d._k = kk; d._ky = ky; const xx = px(d.r.x) + kk * WW, yy = py(d.r.y) + ky * WH; d.h.setAttribute("cx", xx); d.c.setAttribute("cx", xx); d.t.setAttribute("x", xx); d.h.setAttribute("cy", yy); d.c.setAttribute("cy", yy); d.t.setAttribute("y", yy); } }
    if (full) {
      const v = isVis(id), pl = isPlan(id), sel = id === curId, fc = frMode ? frCat(id) : null, on = frMode ? !!fc : (v || pl);
      let show = frMode ? ((!!fc && !frOff.has(fc) && (!fn || passF(d.r))) || sel) : filmMode ? (passF(d.r) || sel) : fn ? (passF(d.r) || sel) : (showAll || on || sel);
      if (d.r.fo && !filmMode && !on && !sel) show = false;
      if (show && !sel && lgOff.size && !frMode) { const cat = v ? "v" : pl ? "p" : "u"; if (lgOff.has(cat)) show = false; }
      d._show = show; d._on = on; d._sel = sel; d._pulse = fc === "D"; d._col = frMode ? (fc ? FRC[fc] : "#7aa8ff") : v ? "#38e0a0" : pl ? "#ffc65c" : "#7aa8ff"; d._s = 0;
      d.c.style.display = show ? "" : "none"; d.h.style.display = show ? "" : "none"; d._cl = false;
      if (show) {
        d.c.setAttribute("fill", on ? d._col : "rgba(122,168,255,.6)");
        d.c.setAttribute("stroke", (sel || on) ? "#ffffff" : "rgba(255,255,255,.3)");
        d.c.setAttribute("stroke-width", sel ? 2.5 : on ? 1.5 : 1);
        d.h.setAttribute("fill", sel ? "#5ad1ff" : d._col); d.h.setAttribute("opacity", sel ? .35 : on ? .26 : 0); d.h.classList.toggle("selp", !!sel); d.h.classList.toggle("pulse", !!d._pulse && !sel);
      }
    }
    if (!d._show) { if (d._lab !== false) { d.t.style.display = "none"; d._lab = false; } return; }
    const X = px(d.r.x) + (d._k || 0) * WW, Y = py(d.r.y) + (d._ky || 0) * WH;
    if (X < X0 || X > X1 || Y < Y0 || Y > Y1) { if (d._lab !== false) { d.t.style.display = "none"; d._lab = false; } return; }
    if (d._s !== s) {
      d._s = s;
      d.c.setAttribute("r", (d._on ? d.rad + 1.5 : d.rad) / s);
      d.h.setAttribute("r", (d.rad + 7) / s);
      d.t.setAttribute("font-size", 11 / s); d.t.setAttribute("stroke-width", 3 / s); d.t.setAttribute("dy", -(d.rad + 6) / s);
    }
    const lab = showNames && ((d._on || d._sel) ? z >= 4 : (z >= 12 || (MODE === "w" && z >= 8 && d.r.k > 100) || (MODE === "s" && z >= 6)));
    if (lab) cand.push(d); else if (d._lab !== false) { d.t.style.display = "none"; d._lab = false; }
  });
  /* etykiety: bez nakładania się, ważniejsze pierwsze */
  const boxes = [];
  cand.sort((a, b) => (b.r.id === curId) - (a.r.id === curId) || (marked(b.r.id) - marked(a.r.id)) || ((b.r.k || 0) - (a.r.k || 0)));
  cand.forEach(d => { const cx = (px(d.r.x) + (d._k || 0) * WW - vb.x) * s, cy = (py(d.r.y) + (d._ky || 0) * WH - vb.y) * s - d.rad - 10, w = Math.min(dname(d.r).length, filmMode ? 30 : 22) * 6.2 + 6, bx = [cx - w / 2, cy - 7, cx + w / 2, cy + 7];
    if (boxes.some(q => bx[0] < q[2] && bx[2] > q[0] && bx[1] < q[3] && bx[3] > q[1])) { if (d._lab !== false) { d.t.style.display = "none"; d._lab = false; } return; }
    boxes.push(bx); if (!d._lab) { d.t.style.display = ""; d._lab = true; } });
}
let LISTIDS = [];
let emptyShown = false, hintDone = false;
function hintSeen(){ try { return localStorage.getItem("skibeen.emptyseen") === "1"; } catch(e){ return hintDone; } }
function hintDismiss(){ if (hintDone) return; hintDone = true; try { localStorage.setItem("skibeen.emptyseen", "1"); } catch(e){} setTimeout(() => { const m = $("mapempty"); if (m) m.style.display = "none"; }, 700); }
addEventListener("pointerdown", () => { if ($("mapempty") && $("mapempty").style.display === "flex") hintDismiss(); }, true);
function fChips(){
  const bx = $("mapfc"); if (!bx) return;
  const L = [["fstat", fStat, "all"], ["fcountry", fCountry, ""], ["fgroup", fGroup, ""], ["fcat", fCat, ""], ["fminr", fMinR, 0], ["fminkm", fMinKm, 0], ["fminel", fMinEl, 0], ["fprice", fPrice, 0], ["fwx", fWx, ""], ["fws", fWs, 0], ["fwc", fWc, 0]];
  const out = [];
  if (!filmMode && !frMode) L.forEach(([id, v, d]) => { if (v === d || v === "" || v == null) return; const el = $(id); if (!el) return; const o = [...el.options].find(x => x.value === String(v)); if (!o) return; out.push(`<button type="button" class="fc2" data-id="${id}" data-d="${d}">${esc(o.textContent.trim())}<i>×</i></button>`); });
  [bx, $("listfc")].forEach(x => { if (!x) return; x.innerHTML = out.join(""); x.style.display = out.length ? "flex" : "none";
    x.querySelectorAll(".fc2").forEach(b => b.onclick = () => { const el = $(b.dataset.id); el.value = b.dataset.d; el.dispatchEvent(new Event("change")); }); });
}
function updateMapUI(){
  try { fChips(); } catch(e){}
  const n = R.filter(r => marked(r.id)).length;
  const show = !n && !showAll && !hintDone && !hintSeen();
  $("mapempty").style.display = show ? "flex" : "none";
  if (show) { const W = MODE === "w"; $("welh").textContent = W ? "Gdzie już zjechałeś?" : "Gdzie już byłeś w górach?"; $("wels").textContent = W ? "Zaznacz ośrodki, w których jeździłeś." : "Zaznacz miejsca i szlaki, które już zrobiłeś."; }
  $("mall").textContent = (showAll && !lgOff.size && !filtN()) ? "Ukryj nieoznaczone" : "Pokaż wszystkie"; $("mall").style.display = ""; $("mfilt").innerHTML = IC.filt + " " + tr("Filtry") + (filtN() ? " · " + filtN() : ""); $("mfilt").classList.toggle("pri", !!filtN());
}
function openMapFilters(){
  const W = MODE === "w", cnt = () => R.filter(passF).length;
  const draw = () => {
    const F = (id, lab, inner) => `<div class="fld"><label>${lab}</label><select id="${id}" class="sel">${inner}</select></div>`, hasF = Object.keys(FRD).length > 0;
    ovBox().innerHTML = `<div class="card mfm" style="width:min(460px,94vw)"><h3>Filtry mapy</h3>
      <div class="mfg2">
      ${F("mfc", "KRAJ", $("fcountry").innerHTML)}
      ${false ? F("mfs", "ZNAJOMI", [["all", "Wszyscy"], ["fp", "Znajomi planują"], ["tog", "Planujemy razem"], ["pfv", "Chcę, byli znajomi"], ["fv", "Znajomi byli"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")) : ""}
      ${W ? F("mfg", "GRUPA", $("fgroup").innerHTML) : ""}
      ${F("mfr", "OCENA", $("fminr").innerHTML)}
      ${W ? F("mfk", "WIELKOŚĆ", $("fminkm").innerHTML) + F("mfe", "WYSOKOŚĆ", $("fminel").innerHTML) : ""}${F("mfv", "TRYB", `<option value="n">Tryb zwykły</option><option value="f">Tryb znajomi</option><option value="m">Tryb filmowy</option>`)}
      ${F("mfwd", "POGODA · KIEDY", $("fwd").innerHTML)}${F("mfwx", "OPADY", $("fwx").innerHTML)}${F("mfwc", "CHMURY", $("fwc").innerHTML)}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="mfclr" style="flex:1">Wyczyść</button><button class="btn pri" id="mfok" style="flex:2">Pokaż (${cnt()})</button></div></div>`;
    $("mfv").value = viewVal(); if ($("mfs")) $("mfs").value = fStat; $("mfr").value = String(fMinR); if ($("mfct")) $("mfct").value = fCat; $("mfwd").value = String(fWd); $("mfwx").value = fWx; $("mfwc").value = String(fWc); $("mfc").value = fCountry; if (W) { $("mfg").value = fGroup; $("mfk").value = String(fMinKm); $("mfe").value = String(fMinEl); }
    const upd = () => { renderList(); mapRefresh(); $("mfok").textContent = "Pokaż (" + cnt() + ")"; };
    if ($("mfs")) $("mfs").onchange = e => { setFStat(e.target.value); upd(); };
    $("mfr").onchange = e => { fMinR = +e.target.value; $("fminr").value = e.target.value; upd(); };
    if ($("mfct")) $("mfct").onchange = e => { fCat = e.target.value; $("fcat").value = fCat; upd(); };
    $("mfv").onchange = e => { const v = e.target.value; setView(v); if (v === "m") closeAccount(); else { $("mfv").value = viewVal(); upd(); } };
    $("mfwd").onchange = e => { fWd = +e.target.value; $("fwd").value = e.target.value; upd(); };
    $("mfwx").onchange = e => { fWx = e.target.value; $("fwx").value = fWx; upd(); };
    $("mfwc").onchange = e => { fWc = +e.target.value; $("fwc").value = e.target.value; upd(); };
    $("mfc").onchange = e => { fCountry = e.target.value; $("fcountry").value = fCountry; upd(); };
    if (W) { $("mfg").onchange = e => { fGroup = e.target.value; $("fgroup").value = fGroup; upd(); }; $("mfk").onchange = e => { fMinKm = +e.target.value; $("fminkm").value = String(fMinKm); upd(); }; $("mfe").onchange = e => { fMinEl = +e.target.value; $("fminel").value = String(fMinEl); upd(); }; }
    $("mfclr").onclick = () => { setView("n"); fCountry = ""; fGroup = ""; fMinKm = 0; fMinEl = 0; $("fcountry").value = ""; $("fgroup").value = ""; $("fminkm").value = "0"; $("fminel").value = "0"; fMinR = 0; $("fminr").value = "0"; fCat = ""; $("fcat").value = ""; fWx = ""; $("fwx").value = ""; fWd = 0; $("fwd").value = "0"; fWc = 0; $("fwc").value = "0"; setFStat("all"); upd(); draw(); };
    $("mfok").onclick = closeAccount;
  };
  draw();
}
