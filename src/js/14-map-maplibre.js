/* ---------- nowa mapa (test): MapLibre + OpenFreeMap + cieniowanie gór ---------- */
let ML = null, mlOn = true; try { mlOn = localStorage.getItem("skibeen.ml") !== "0"; } catch (e) {}
const ML_SRC = window.__MLSRC || "https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist/";
function mlLoad(){ if (window.maplibregl) return Promise.resolve(); if (mlLoad._p) return mlLoad._p;
  mlLoad._p = new Promise((res, rej) => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = ML_SRC + "maplibre-gl.css"; document.head.append(l); const sc = document.createElement("script"); sc.src = ML_SRC + "maplibre-gl.js"; sc.onload = res; sc.onerror = () => { mlLoad._p = null; rej(new Error("maplibre")); }; document.head.append(sc); }); return mlLoad._p; }
if (mlOn) { try { mlLoad().catch(() => {}); } catch (e) {} }
async function mlStyle(){
  const light = document.body.classList.contains("light"), sum = document.body.classList.contains("summer");
  let src = {type: "vector", url: "https://tiles.openfreemap.org/planet"}, glyphs = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
  if (!mlStyle._b) { try { const c = JSON.parse(localStorage.getItem("skibeen.mlb") || "null"); if (c && c.t > Date.now() - 864e5 && c.b && c.b.src) { mlStyle._b = c.b; } } catch (e) {} }
  if (!mlStyle._b) { try { const st = await (await fetch(window.__MLSTYLE || "https://tiles.openfreemap.org/styles/positron")).json(); const k = Object.keys(st.sources || {}).find(k => st.sources[k].type === "vector"); mlStyle._b = {src: k ? st.sources[k] : src, glyphs: st.glyphs || glyphs}; try { localStorage.setItem("skibeen.mlb", JSON.stringify({t: Date.now(), b: mlStyle._b})); } catch (e) {} } catch (e) { mlStyle._b = {src, glyphs}; } }
  src = mlStyle._b.src; glyphs = mlStyle._b.glyphs;
  const C = sum
    ? (light ? {bg: "#f1e8d3", wlab: "#2f6f8e", water: "#9cc8de", ice: "#ffffff", wood: "rgba(84,148,86,.34)", grass: "rgba(150,190,98,.26)", bnd: "rgba(120,80,40,.78)", lab: "#7a6446", halo: "#f1e8d3", sh: "rgba(92,58,24,.5)", hi: "rgba(255,244,214,.55)", txt: "#3b2a1c"}
      : {bg: "#17130d", wlab: "#7fb9cf", water: "#17414f", ice: "rgba(255,238,210,.26)", wood: "rgba(76,140,78,.26)", grass: "rgba(130,170,84,.15)", bnd: "rgba(240,190,130,.52)", lab: "#b39b78", halo: "#17130d", sh: "rgba(0,0,0,.62)", hi: "rgba(255,196,120,.17)", txt: "#f6efe4"})
    : light ? {bg: "#e8eef5", wlab: "#2d5f93", water: "#9fc3e4", ice: "#ffffff", icel: "rgba(70,110,160,.55)", wood: "rgba(88,138,112,.3)", grass: "rgba(0,0,0,0)", bnd: "rgba(50,70,105,.78)", lab: "#44556f", halo: "#eef3f9", sh: "rgba(36,58,92,.6)", hi: "rgba(255,255,255,.75)", txt: "#1f2c42"}
    : {bg: "#0d1726", wlab: "#7fb0dc", water: "#103a57", ice: "rgba(220,235,255,.22)", wood: "rgba(60,110,80,.2)", grass: "rgba(0,0,0,0)", bnd: "rgba(190,208,235,.52)", lab: "#8193b0", halo: "#0d1726", sh: "rgba(0,0,0,.6)", hi: "rgba(140,170,210,.16)", txt: "#dbe6f7"};
  mlStyle.C = C;
  const F = ["Noto Sans Regular"];
  return {version: 8, glyphs, sources: {omt: src, dem: {type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], encoding: "terrarium", tileSize: 256, maxzoom: 12, attribution: "Teren: Mapzen / AWS"}}, layers: [
    {id: "bg", type: "background", paint: {"background-color": C.bg}},
    {id: "wood", type: "fill", source: "omt", "source-layer": "landcover", minzoom: 7, filter: ["in", ["get", "class"], ["literal", ["wood", "forest"]]], paint: {"fill-color": C.wood}},
    {id: "grass", type: "fill", source: "omt", "source-layer": "landcover", minzoom: 6, filter: ["in", ["get", "class"], ["literal", ["grass", "farmland"]]], paint: {"fill-color": C.grass}},
    {id: "ice", type: "fill", source: "omt", "source-layer": "landcover", filter: ["in", ["get", "class"], ["literal", ["ice", "glacier"]]], paint: {"fill-color": C.ice, "fill-opacity": .8}},
    {id: "icel", type: "line", source: "omt", "source-layer": "landcover", filter: ["in", ["get", "class"], ["literal", ["ice", "glacier"]]], paint: {"line-color": C.icel || "rgba(0,0,0,0)", "line-width": .8}},
    {id: "water", type: "fill", source: "omt", "source-layer": "water", paint: {"fill-color": C.water}},
    {id: "hs", type: "hillshade", source: "dem", minzoom: 7, paint: {"hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 7, 0, 8.5, light && !sum ? .5 : .3, 12, light && !sum ? .75 : .5], "hillshade-shadow-color": C.sh, "hillshade-highlight-color": C.hi, "hillshade-accent-color": "rgba(0,0,0,0)"}},
    {id: "bnd", type: "line", source: "omt", "source-layer": "boundary", filter: ["all", ["<=", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]], paint: {"line-color": C.bnd, "line-width": ["interpolate", ["linear"], ["zoom"], 3, .6, 8, 1.4]}},
    {id: "wname", type: "symbol", source: "omt", "source-layer": "water_name", minzoom: 4, filter: ["all", ["!=", ["get", "class"], "river"], ["==", ["geometry-type"], "Point"]], layout: {"text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]], "text-font": ["Noto Sans Italic"], "text-size": ["interpolate", ["linear"], ["zoom"], 4, 9, 8, 11, 12, 13], "text-letter-spacing": .04, "text-max-width": 7, "text-padding": 2, "text-max-angle": 70}, paint: {"text-color": C.wlab, "text-halo-color": C.halo, "text-halo-width": 1.3}},
    {id: "wnamel", type: "symbol", source: "omt", "source-layer": "water_name", minzoom: 4, filter: ["all", ["!=", ["get", "class"], "river"], ["==", ["geometry-type"], "LineString"]], layout: {"symbol-placement": "line-center", "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]], "text-font": ["Noto Sans Italic"], "text-size": ["interpolate", ["linear"], ["zoom"], 4, 9, 8, 11, 12, 13], "text-letter-spacing": .04, "text-max-width": 7, "text-padding": 2, "text-max-angle": 70}, paint: {"text-color": C.wlab, "text-halo-color": C.halo, "text-halo-width": 1.3}},
    {id: "peak", type: "symbol", source: "omt", "source-layer": "mountain_peak", minzoom: 11, layout: {"text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]], "text-font": F, "text-size": 10.5, "text-offset": [0, .6]}, paint: {"text-color": C.lab, "text-halo-color": C.halo, "text-halo-width": 1.2}},
    {id: "country", type: "symbol", source: "omt", "source-layer": "place", maxzoom: 6, filter: ["==", ["get", "class"], "country"], layout: {"text-field": ["coalesce", ["get", "name:" + (LANG === "pl" ? "pl" : LANG)], ["get", "name:latin"], ["get", "name"]], "text-font": F, "text-size": 11, "text-transform": "uppercase", "text-letter-spacing": .12}, paint: {"text-color": C.lab, "text-halo-color": C.halo, "text-halo-width": 1.2}}]};
}
const mlEmpty = () => ({type: "FeatureCollection", features: []});
function mlData(){
  if (!ML || !ML.getSource("pm")) return;
  try { vbHeavy(true); } catch (e) {}
  const on = [], off = [], sg = [];
  dots.forEach(d => { if (!d._show) return; sg.push(d.r.id + (d._col || "") + (d._sel ? "s" : "") + (d._on ? "o" : "")); const f = {type: "Feature", geometry: {type: "Point", coordinates: [d.r.x, d.r.y]}, properties: {id: d.r.id, n: dname(d.r), col: d._col || "#7aa8ff", sel: d._sel ? 1 : 0, k: d.r.k || 0}}; (d._on || d._sel ? on : off).push(f); });
  const sig = sg.join("|") + (showNames ? "N" : "n") + (typeof LANG !== "undefined" ? LANG : ""); if (sig === mlData._sig && ML.getLayer("pm-p")) return; mlData._sig = sig;
  ML.getSource("pm").setData({type: "FeatureCollection", features: on}); ML.getSource("pu").setData({type: "FeatureCollection", features: off});
  ["pm-l", "pu-l"].forEach(l => { if (ML.getLayer(l)) ML.setLayoutProperty(l, "visibility", showNames ? "visible" : "none"); });
}
function mlLayers(){
  mlData._sig = "";
  const C = mlStyle.C || {}, halo = C.halo || "#0d1726", txt = C.txt || "#dbe6f7", F = ["Noto Sans Regular"];
  ML.addSource("pu", {type: "geojson", data: mlEmpty()});
  ML.addSource("pm", {type: "geojson", data: mlEmpty()});
  ML.addLayer({id: "pu-p", type: "circle", source: "pu", paint: {"circle-color": "rgba(122,168,255,.6)", "circle-radius": 5, "circle-stroke-color": "rgba(255,255,255,.35)", "circle-stroke-width": 1}});
  ML.addLayer({id: "pu-l", type: "symbol", source: "pu", minzoom: 7, layout: {"text-field": ["get", "n"], "text-font": F, "text-size": 11, "text-offset": [0, -1.2], "text-anchor": "bottom", "text-max-width": 12}, paint: {"text-color": txt, "text-halo-color": halo, "text-halo-width": 1.5, "text-opacity": .8}});
  ML.addLayer({id: "pm-h", type: "circle", source: "pm", filter: ["==", ["get", "sel"], 1], paint: {"circle-color": "#5ad1ff", "circle-opacity": .35, "circle-radius": 16}});
  ML.addLayer({id: "pm-p", type: "circle", source: "pm", paint: {"circle-color": ["get", "col"], "circle-radius": ["case", ["==", ["get", "sel"], 1], 8, 6.5], "circle-stroke-color": "#fff", "circle-stroke-width": ["case", ["==", ["get", "sel"], 1], 2.5, 1.5]}});
  ML.addLayer({id: "pm-l", type: "symbol", source: "pm", minzoom: 4, layout: {"text-field": ["get", "n"], "text-font": F, "text-size": 12, "text-offset": [0, -1.3], "text-anchor": "bottom", "text-max-width": 12, "symbol-sort-key": ["-", 0, ["get", "k"]]}, paint: {"text-color": txt, "text-halo-color": halo, "text-halo-width": 1.6}});
  mlData();
}
async function mlStart(){
  if (ML) return; const box = $("v-mapa"); if (!box) return;
  const stP = mlStyle(); try { await mlLoad(); } catch (e) { toast("Nie udało się wczytać nowej mapy"); return; }
  let el = $("mlmap"); if (!el) { el = document.createElement("div"); el.id = "mlmap"; svg.after(el); }
  const style = await stP; if (!mlOn) return;
  svg.style.display = "none"; document.body.classList.add("mlon");
  ML = new maplibregl.Map({container: el, style, bounds: [[vb.x / COS, -(vb.y + vb.h)], [(vb.x + vb.w) / COS, -vb.y]], attributionControl: {compact: true}, dragRotate: false, pitchWithRotate: false, touchPitch: false, renderWorldCopies: true, maxZoom: 15, pixelRatio: Math.min(window.devicePixelRatio || 1, 2), fadeDuration: 120, refreshExpiredTiles: false});
  ML.touchZoomRotate.disableRotation();
  ML.on("load", mlEnsure); ML.on("styledata", mlEnsure); ML.on("idle", mlEnsure); ML.on("sourcedata", mlEnsure); ML.on("moveend", mlEnsure);
  ML.on("moveend", () => { const b = ML.getBounds(); try { localStorage.setItem("skibeen.vb", JSON.stringify([b.getWest() * COS, -b.getNorth(), (b.getEast() - b.getWest()) * COS, b.getNorth() - b.getSouth()].map(n => +n.toFixed(3)))); } catch (e) {} });
  ML.on("click", e => { const p = e.point, f = ML.queryRenderedFeatures([[p.x - 14, p.y - 14], [p.x + 14, p.y + 14]], {layers: ["pm-p", "pu-p"]}); if (!f.length) return;
    const pm = f.find(x => x.layer.id === "pm-p"), x = pm || f[0];
    openSheet(x.properties.id); });
  ["pm-p", "pu-p"].forEach(l => { ML.on("mouseenter", l, () => ML.getCanvas().style.cursor = "pointer"); ML.on("mouseleave", l, () => ML.getCanvas().style.cursor = ""); });
}
function mlStop(){  document.body.classList.remove("mlon"); if (ML) { ML.remove(); ML = null; } const el = $("mlmap"); if (el) el.remove(); svg.style.display = ""; mapRefresh(); }
function mlSet(v){ mlOn = !!v; try { localStorage.setItem("skibeen.ml", mlOn ? "1" : "0"); } catch (e) {} if (mlOn) mlStart(); else mlStop(); }
{ const o = applyTheme; applyTheme = function(){ o(); try { if (ML) mlTheme(); } catch (e) {} }; }
function mlEnsure(){
  /* isStyleLoaded() bywa false, dopóki płyną kafelki, a styledata potem już nie wraca – kropki znikały. Dlatego próbujemy wprost i łapiemy błąd "Style is not done loading". */
  if (!ML || mlEnsure._b) return;
  try { if (ML.getSource("pm") && ML.getLayer("pm-p") && ML.getLayer("pu-p")) return; } catch (e) { return; }
  mlEnsure._b = 1;
  try {
    ["pm-l", "pm-p", "pm-h", "pu-l", "pu-p"].forEach(l => { if (ML.getLayer(l)) ML.removeLayer(l); });
    ["pm", "pu"].forEach(x => { if (ML.getSource(x)) ML.removeSource(x); });
    mlLayers();
  } catch (e) { try { ["pm-l", "pm-p", "pm-h", "pu-l", "pu-p"].forEach(l => { if (ML.getLayer(l)) ML.removeLayer(l); }); ["pm", "pu"].forEach(x => { if (ML.getSource(x)) ML.removeSource(x); }); } catch (e2) {} }
  finally { mlEnsure._b = 0; }
}
function mlTheme(){ if (!ML) return; const t = mlTheme._t = (mlTheme._t || 0) + 1; mlStyle().then(st => { if (!ML || t !== mlTheme._t) return; ML.setStyle(st); }); }
function mapRefresh(){ if (ML) setTimeout(mlData, 0); legSync(); viewSync(); { if (frMode && !Object.keys(FRD).length) frMode = false; } if (dots.length) { applyVB(); updateMapUI(); } paintCountries(); }
function zoomAt(f, ctr){
  if (ML) { ML.easeTo({zoom: ML.getZoom() - Math.log2(f), duration: 220}); return; }
  const rc = svg.getBoundingClientRect();
  const cx = ctr ? vb.x + (ctr.x - rc.left) / rc.width * vb.w : vb.x + vb.w / 2;
  const cy2 = ctr ? vb.y + (ctr.y - rc.top) / rc.height * vb.h : vb.y + vb.h / 2;
  const maxW = (base.x1 - base.x0) * 1.3, minW = Math.min((base.x1 - base.x0) / 60, px(0.4) - px(0));
  let nw = Math.min(maxW, Math.max(minW, vb.w * f)); f = nw / vb.w;
  vb.x = cx - (cx - vb.x) * f; vb.y = cy2 - (cy2 - vb.y) * f; vb.w = nw; vb.h = vb.h * f; applyVB(true);
}
function bindMapGestures(){
  const ptrs = new Map(); let moved = 0, startPt = null;
  svg.addEventListener("pointerdown", e => { svg.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY}); moved = 0; startPt = {x:e.clientX, y:e.clientY}; });
  svg.addEventListener("pointermove", e => {
    if (!ptrs.has(e.pointerId)) return;
    const p = ptrs.get(e.pointerId), rc = svg.getBoundingClientRect();
    if (ptrs.size === 1) { const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy); vb.x -= dx / rc.width * vb.w; vb.y -= dy / rc.height * vb.h; applyVB(true); }
    else if (ptrs.size === 2) {
      const other = [...ptrs.entries()].find(([id]) => id !== e.pointerId)[1];
      const d0 = Math.hypot(p.x - other.x, p.y - other.y), d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      moved += 10; if (d0 > 0 && d1 > 0) zoomAt(d0 / d1, {x:(e.clientX + other.x) / 2, y:(e.clientY + other.y) / 2});
    }
    ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
  });
  svg.addEventListener("pointerup", e => { const wasOne = ptrs.size === 1; ptrs.delete(e.pointerId); if (wasOne && moved < 8 && startPt) tapAt(e.clientX, e.clientY); });
  svg.addEventListener("pointercancel", e => ptrs.delete(e.pointerId));
  document.addEventListener("keydown", e => {
    const v = $("v-mapa"); if (!v || !v.classList.contains("on") || e.ctrlKey || e.metaKey || e.altKey) return;
    const ae = document.activeElement, tg = ae && ae.tagName; if (tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT" || (ae && ae.isContentEditable)) return;
    if (document.querySelector("#appdlg, .ddm.open") || ($("acctov") && $("acctov").style.display !== "none") || ($("sheet") && $("sheet").style.display !== "none" && $("sheet").style.display !== "")) return;
    const k = e.key, st = 0.18;
    if (k === "ArrowLeft") vb.x -= vb.w * st; else if (k === "ArrowRight") vb.x += vb.w * st; else if (k === "ArrowUp") vb.y -= vb.h * st; else if (k === "ArrowDown") vb.y += vb.h * st;
    else if (k === "+" || k === "=") { zoomAt(0.7, null); e.preventDefault(); return; } else if (k === "-" || k === "_") { zoomAt(1 / 0.7, null); e.preventDefault(); return; }
    else return;
    e.preventDefault(); applyVB(true);
  });
  svg.addEventListener("wheel", e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 0.8 : 1.25, {x:e.clientX, y:e.clientY}); }, {passive:false});
}
function tapAt(cx, cy){
  const rc = svg.getBoundingClientRect(), s = scale(), c = [];
  { let best = null; CLU.forEach(q => { const sx = rc.left + (q.x - vb.x) * s, sy = rc.top + (q.y - vb.y) * s, dd = Math.hypot(sx - cx, sy - cy); if (dd < q.r * s + 6 && (!best || dd < best.dd)) best = {dd, sx, sy}; });
    if (best) { const fr = 0.35, steps = 10; let i = 0; const st = () => { i++; zoomAt(Math.pow(fr, 1 / steps), {x: best.sx, y: best.sy}); if (i < steps) requestAnimationFrame(st); }; st(); return; } }
  dots.forEach(d => { if (d.c.style.display === "none") return; const sx = rc.left + (px(d.r.x) + (d._k || 0) * WW - vb.x) * s, sy = rc.top + (py(d.r.y) + (d._ky || 0) * WH - vb.y) * s; const dist = Math.hypot(sx - cx, sy - cy) - d.rad; if (dist < 22) c.push({d, dist}); });
  if (!c.length) return; c.sort((p, q) => p.dist - q.dist);
  const L = c.filter(x => x.dist < c[0].dist + 12).slice(0, 5);
  if (L.length < 2) { openSheet(c[0].d.r.id); return; }
  const old = $("tappick"); if (old) old.remove();
  const bx = document.createElement("div"); bx.id = "tappick";
  bx.innerHTML = L.map(x => `<button type="button" data-id="${esc(x.d.r.id)}">${esc(dname(x.d.r))}</button>`).join("");
  document.body.append(bx);
  const w = bx.offsetWidth, h = bx.offsetHeight; bx.style.left = Math.max(8, Math.min(innerWidth - w - 8, cx - w / 2)) + "px"; bx.style.top = Math.max(8, Math.min(innerHeight - h - 8, cy + 14)) + "px";
  const close = () => { bx.remove(); document.removeEventListener("pointerdown", out, true); };
  const out = e => { if (!bx.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener("pointerdown", out, true), 0);
  bx.onclick = e => { const t = e.target.closest("button"); if (t) { close(); openSheet(t.dataset.id); } };
}
/* obrysy państw: best-effort z biblioteki ECharts (jeśli się wczyta) */
function loadLand(){
  const urls = ["https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/js/world.js", "https://cdn.jsdelivr.net/npm/echarts@4.2.1/map/js/world.js"]; let i = 0;
  const next = () => {
    if (i >= urls.length) { $("mapnote").textContent = "Mapa bez obrysów państw"; return; }
    const prev = window.echarts; let got = null; window.echarts = {registerMap: (n, g) => { got = g; }};
    const sc = document.createElement("script"); sc.src = urls[i++];
    sc.onload = () => { window.echarts = prev; try { if (got) drawLand(got); else next(); } catch(e){ next(); } };
    sc.onerror = () => { window.echarts = prev; next(); };
    document.head.appendChild(sc);
  };
  next();
}
function decodePoly(str, off, scl){
  const out = []; let X = off[0], Y = off[1];
  for (let i = 0; i < str.length; i += 2) { let x = str.charCodeAt(i) - 64, y = str.charCodeAt(i + 1) - 64; x = (x >> 1) ^ (-(x & 1)); y = (y >> 1) ^ (-(y & 1)); X += x; Y += y; out.push([X / scl, Y / scl]); }
  return out;
}
function drawLand(geo){
  const scl = geo.UTF8Scale || 1024, enc = geo.UTF8Encoding; let d = "";
  const ring = pts => { if (!LANDR) LANDR = []; LANDR.push(pts); return true ? "M" + pts.map(p => px(p[0]).toFixed(3) + " " + py(p[1]).toFixed(3)).join("L") + "Z" : ""; };
  CPATH = {};
  geo.features.forEach(f => {
    const g = f.geometry; if (!g) return; let fd = "";
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates, offs = g.type === "Polygon" ? [g.encodeOffsets] : g.encodeOffsets;
    polys.forEach((poly, pi) => poly.forEach((rg, ri) => { fd += ring((enc && typeof rg === "string") ? decodePoly(rg, offs[pi][ri], scl) : rg); }));
    if (!fd) return; d += fd;
    const p = mk("path", {d: fd, class: "ctry", style:"fill:var(--land);stroke:var(--landline)", "stroke-width":1, "vector-effect":"non-scaling-stroke", "stroke-linejoin":"round", "fill-rule":"evenodd"});
    gLand.append(p); const nm = f.properties && f.properties.name; if (nm) CPATH[nm] = p;
  });
  if (!d) { $("mapnote").textContent = "Mapa bez obrysów państw"; return; }
  paintCountries();
}
let CPATH = {};
const ECN = {AE:"United Arab Emirates",TN:"Tunisia",DM:"Dominica",VC:"Saint Vincent and the Grenadines",AT:"Austria",CH:"Switzerland",DE:"Germany",FR:"France",IT:"Italy",ES:"Spain",PL:"Poland",SK:"Slovakia",CZ:"Czech Rep.",SI:"Slovenia",LI:"Liechtenstein",AD:"Andorra",IS:"Iceland",NO:"Norway",GB:"United Kingdom",PT:"Portugal",HR:"Croatia",ME:"Montenegro",BG:"Bulgaria",RO:"Romania",GE:"Georgia",KZ:"Kazakhstan",KG:"Kyrgyzstan",AM:"Armenia",AZ:"Azerbaijan",TJ:"Tajikistan",UZ:"Uzbekistan",MN:"Mongolia",NP:"Nepal",PK:"Pakistan",IN:"India",PE:"Peru",BO:"Bolivia",AR:"Argentina",CL:"Chile",EC:"Ecuador",NZ:"New Zealand",CA:"Canada",US:"United States",MA:"Morocco",TR:"Turkey",JP:"Japan",TZ:"Tanzania",ID:"Indonesia",VN:"Vietnam",ZA:"South Africa",AL:"Albania",BA:"Bosnia and Herz.",GR:"Greece",MK:"Macedonia",SE:"Sweden",FI:"Finland",IE:"Ireland",CO:"Colombia",BR:"Brazil",AU:"Australia",CN:"China",ZW:"Zimbabwe",VE:"Venezuela",JO:"Jordan",KR:"South Korea",NA:"Namibia",MY:"Malaysia",KE:"Kenya"};
function paintCountries(){
  try {
    const on = new Set(); (typeof R !== "undefined" ? R : []).forEach(r => { if (isVis(r.id)) String(r.c || "").split(",").forEach(c => on.add(ECN[c] || c)); });
    Object.keys(CPATH).forEach(n => { const p = CPATH[n], v = on.has(n); p.classList.toggle("vis", v); if (v && !p._top) { p._top = 1; gLand.append(p); } else if (!v) p._top = 0; });
  } catch(e){}
}

