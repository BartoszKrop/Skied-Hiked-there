/* ---------- eksport i udostępnianie ---------- */
async function saveBlob(name, blob, msg){
  try { const dl = await useCap("downloads"); if (dl) { await dl.save({filename:name, data:blob}); if (msg) msg.textContent = "Zapisano ✓"; return true; } } catch(e){}
  try { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); if (msg) msg.textContent = "Pobrano ✓"; return true; } catch(e){}
  if (msg) msg.textContent = "Nie udało się pobrać pliku."; return false;
}
const xmlEsc = t => String(t).replace(/[<>&"']/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]));
function markedList(){ return R.filter(r => visits[r.id]).map(r => ({r, v:visits[r.id]})); }
function noteFor(r, v){
  const parts = [v.s === "v" ? "Byłem" : "Planuję" + (v.pr ? " (priorytet " + v.pr + ")" : "")];
  if (v.s === "v") { if (v.t) parts.push("tier " + v.t); if (v.r) parts.push(v.r + "/5"); if (v.stays.length) parts.push("wizyty: " + v.stays.map(x => fmtYM(x.y, x.m)).join(", ")); }
  if (v.n) parts.push(v.n);
  return parts.join(" · ");
}
function exportGPX(){
  const w = markedList().map(({r, v}) => `<wpt lat="${r.y}" lon="${r.x}"><name>${xmlEsc(r.n)}</name><desc>${xmlEsc(noteFor(r, v))}</desc><type>${v.s === "v" ? "visited" : "planned"}</type></wpt>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Mountained there" xmlns="http://www.topografix.com/GPX/1/1">\n${w}\n</gpx>`;
}
function exportKML(){
  const pm = markedList().map(({r, v}) => `<Placemark><name>${xmlEsc(r.n)}</name><description>${xmlEsc(noteFor(r, v))}</description><styleUrl>#${v.s}</styleUrl><Point><coordinates>${r.x},${r.y},0</coordinates></Point></Placemark>`).join("\n");
  const st = (id, col) => `<Style id="${id}"><IconStyle><color>${col}</color><scale>1.1</scale></IconStyle></Style>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Mountained there</name>${st("v","ff8ae038")}${st("p","ff5cc6ff")}\n${pm}\n</Document></kml>`;
}
function periodOptions(){
  const ys = new Set(); R.forEach(r => { if (isVis(r.id)) visits[r.id].stays.forEach(x => { if (+x.y) ys.add(+x.y); }); });
  const out = [], all = [...ys].sort((a,b) => b - a);
  if (MODE === "w") {
    const seas = new Set(); R.forEach(r => { if (isVis(r.id)) visits[r.id].stays.forEach(x => { const y = +x.y, m = +x.m; if (!y) return; seas.add(m && m >= 7 ? y : m ? y - 1 : y - 1); }); });
    [...seas].sort((a,b) => b - a).forEach(y => out.push({v:"s" + y, label:"Sezon " + y + "/" + String(y + 1).slice(2), test:x => { const yy = +x.y, m = +x.m; return m ? ((yy === y && m >= 7) || (yy === y + 1 && m < 7)) : (yy === y + 1); }}));
  }
  all.forEach(y => out.push({v:"y" + y, label:"Rok " + y, test:x => +x.y === y}));
  return out;
}
function periodData(per){
  const places = R.filter(r => isVis(r.id) && visits[r.id].stays.some(per.test));
  const cs = new Set(); places.forEach(r => r.c.split(",").forEach(c => cs.add(c)));
  const stays = places.reduce((a, r) => a + visits[r.id].stays.filter(per.test).length, 0);
  const days = places.reduce((a, r) => a + visits[r.id].stays.filter(per.test).reduce((q, x) => q + (+x.d || 0), 0), 0);
  return {places, countries:cs, stays, days, km:places.reduce((a, r) => a + r.k, 0)};
}
let GEO = null, GEOP = null, LANDR = null, mapFitted = false;
function decodeTopo(t){
  const k = t.transform || {scale:[1,1], translate:[0,0]};
  const arcs = t.arcs.map(a => { let x = 0, y = 0; return a.map(p => { x += p[0]; y += p[1]; return [x * k.scale[0] + k.translate[0], y * k.scale[1] + k.translate[1]]; }); });
  const ring = idx => { const out = []; idx.forEach(i => { const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); out.push(...(out.length ? a.slice(1) : a)); }); return out; };
  const rings = [];
  const obj = t.objects.countries || t.objects[Object.keys(t.objects)[0]];
  (obj.geometries || []).forEach((g, gi) => {
    const mk = r => { const q = ring(r); q.f = gi; return q; };
    if (g.type === "Polygon") g.arcs.forEach(r => rings.push(mk(r)));
    else if (g.type === "MultiPolygon") g.arcs.forEach(p => p.forEach(r => rings.push(mk(r))));
  });
  return rings;
}
function loadGeo(){
  if (GEO) return Promise.resolve(GEO);
  if (LANDR) return Promise.resolve(LANDR);
  if (GEOP) return GEOP;
  GEOP = new Promise(res => {
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null, to = setTimeout(() => { try { ac && ac.abort(); } catch(e){} res(null); }, 12000);
    const us = ["https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json", "https://unpkg.com/world-atlas@2/countries-50m.json", "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"]; let i = 0;
    const go = () => { if (i >= us.length) { clearTimeout(to); res(null); return; } fetch(us[i++], ac ? {signal: ac.signal} : {}).then(r => r.json()).then(j => { clearTimeout(to); GEO = decodeTopo(j); res(GEO); }).catch(() => { if (ac && ac.signal.aborted) return; go(); }); };
    go();
  }).then(g => { if (!g) GEOP = null; return g; });
  return GEOP;
}
const inRing = (rg, x, y) => { let ins = false; for (let i = 0, j = rg.length - 1; i < rg.length; j = i++) { const a = rg[i], b = rg[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; };
function drawMapPanel(c, pts, PX, PY, PW, PH, rad, opt){
  opt = opt || {};
  c.fillStyle = "rgba(255,255,255,.05)"; c.beginPath(); c.roundRect(PX, PY, PW, PH, 26); c.fill();
  if (!pts.length) return;
  const xs = pts.map(r => px(r.x)), ys = pts.map(r => py(r.y)); let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(0.9, (x1 - x0) * 0.12, (y1 - y0) * 0.12); x0 -= pad; x1 += pad; y0 -= pad * 0.9; y1 += pad * 0.9;
  const sc = Math.min((PW - 40) / (x1 - x0), (PH - 40) / (y1 - y0)), ox = PX + (PW - (x1 - x0) * sc) / 2, oy = PY + (PH - (y1 - y0) * sc) / 2;
  const TX = x => ox + (x - x0) * sc, TY = y => oy + (y - y0) * sc;
  c.save(); c.beginPath(); c.roundRect(PX, PY, PW, PH, 26); c.clip();
  const lx0 = (PX - ox) / sc / COS + x0 / COS, lx1 = (PX + PW - ox) / sc / COS + x0 / COS, la0 = -((PY + PH - oy) / sc + y0), la1 = -((PY - oy) / sc + y0);
  const GG = GEO || LANDR;
  if (GG) {
    c.lineWidth = 1.6; c.lineJoin = "round";
    const hit = new Set(), bb = new Map(), grn = "56,224,160";
    GG.forEach(rg => { let a = 1e9, b = -1e9, d = 1e9, e = -1e9; for (const p of rg) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; if (p[1] < d) d = p[1]; if (p[1] > e) e = p[1]; } bb.set(rg, [a, b, d, e]); });
    if (GEO) pts.forEach(r => { for (const rg of GG) { const q = bb.get(rg); if (rg.f !== undefined && !hit.has(rg.f) && r.x >= q[0] && r.x <= q[1] && r.y >= q[2] && r.y <= q[3] && inRing(rg, r.x, r.y)) { hit.add(rg.f); break; } } });
    GG.forEach(rg => {
      const q = bb.get(rg), h = rg.f !== undefined && hit.has(rg.f);
      if (q[1] < lx0 || q[0] > lx1 || q[3] < la0 || q[2] > la1) return;
      c.fillStyle = h ? `rgba(${grn},.2)` : "rgba(255,255,255,.085)"; c.strokeStyle = h ? `rgba(${grn},.75)` : "rgba(255,255,255,.32)";
      c.beginPath(); rg.forEach((p, i) => { const X = TX(px(p[0])), Y = TY(py(p[1])); if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.closePath(); c.fill(); c.stroke();
    });
  } else {
    const span = Math.max(lx1 - lx0, la1 - la0), st = span > 60 ? 10 : span > 25 ? 5 : span > 10 ? 2 : 1;
    c.strokeStyle = "rgba(255,255,255,.09)"; c.lineWidth = 1.5; c.font = `500 18px Barlow, system-ui, sans-serif`; c.fillStyle = "rgba(255,255,255,.35)";
    for (let lo = Math.ceil(lx0 / st) * st; lo <= lx1; lo += st) { const X = TX(px(lo)); c.beginPath(); c.moveTo(X, PY); c.lineTo(X, PY + PH); c.stroke(); c.fillText(lo + "°", X + 4, PY + PH - 12); }
    for (let la = Math.ceil(la0 / st) * st; la <= la1; la += st) { const Y = TY(py(la)); c.beginPath(); c.moveTo(PX, Y); c.lineTo(PX + PW, Y); c.stroke(); c.fillText(la + "°", PX + 8, Y - 4); }
  }
  const vset = new Set(pts.map(r => r.id));
  c.fillStyle = "rgba(255,255,255,.2)"; R.forEach(r => { if (vset.has(r.id)) return; const X = TX(px(r.x)), Y = TY(py(r.y)); if (X > PX && X < PX + PW && Y > PY && Y < PY + PH) { c.beginPath(); c.arc(X, Y, 3.5, 0, 7); c.fill(); } });
  pts.forEach(r => { const X = TX(px(r.x)), Y = TY(py(r.y));
    c.fillStyle = "rgba(56,224,160,.3)"; c.beginPath(); c.arc(X, Y, rad * 2, 0, 7); c.fill();
    c.fillStyle = "#38e0a0"; c.strokeStyle = "#fff"; c.lineWidth = 3; c.beginPath(); c.arc(X, Y, rad, 0, 7); c.fill(); c.stroke(); });
  if (opt.labels) {
    const F2 = "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif", fs = pts.length > 40 ? 19 : pts.length > 22 ? 22 : 26, dots = pts.map(r => ({x: TX(px(r.x)), y: TY(py(r.y))})), boxes = [];
    c.font = `700 ${fs}px ${F2}`; c.textAlign = "left"; c.lineJoin = "round";
    const hit = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
    pts.map((r, i) => ({r, i})).sort((a, b) => b.r.k - a.r.k).slice(0, 70).forEach(({r, i}) => {
      let n = String(r.n).split(/\s[-–]\s|\s?\(|\s?\/|,/)[0].trim(); if (n.length > 20) n = n.slice(0, 19) + "…"; if (!n) return;
      const w = c.measureText(n).width, X = dots[i].x, Y = dots[i].y, g = rad + 7;
      const cand = [[X + g, Y - fs * .5], [X - g - w, Y - fs * .5], [X - w / 2, Y - g - fs - 2], [X - w / 2, Y + g], [X + g, Y - fs * 1.4], [X + g, Y + 2]];
      for (const [bx, by] of cand) { const bx0 = [bx - 2, by - 1, w + 4, fs + 4];
        if (bx0[0] < PX + 8 || bx0[0] + bx0[2] > PX + PW - 8 || bx0[1] < PY + 8 || bx0[1] + bx0[3] > PY + PH - 8) continue;
        if (boxes.some(b => hit(b, bx0)) || dots.some((d, k) => k !== i && d.x > bx0[0] - rad && d.x < bx0[0] + bx0[2] + rad && d.y > bx0[1] - rad && d.y < bx0[1] + bx0[3] + rad)) continue;
        boxes.push(bx0); c.strokeStyle = "rgba(6,12,24,.9)"; c.lineWidth = 6; c.strokeText(n, bx, by + fs * .85); c.fillStyle = "#fff"; c.fillText(n, bx, by + fs * .85); break; }
    });
  }
  c.restore();
}
function shareCanvasBase(kind, per){
  const W = MODE === "w", S = stats(), cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350;
  const c = cv.getContext("2d"), F = "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif";
  const g = c.createLinearGradient(0, 0, 0, 1350);
  if (W) { g.addColorStop(0, "#14305a"); g.addColorStop(1, "#070d19"); } else { g.addColorStop(0, "#3b2a1c"); g.addColorStop(1, "#15110c"); }
  c.fillStyle = g; c.fillRect(0, 0, 1080, 1350);
  const acc = W ? "#5ad1ff" : "#f2a65a", FD = "Barlow Condensed, Arial Narrow, sans-serif";
  c.textAlign = "left"; c.fillStyle = "#fff"; { const ttl = (per ? tr(per.label) : tr(W ? "Moje ośrodki narciarskie" : "Moje górskie szlaki")).toUpperCase(); let fs = 72; do { c.font = `800 ${fs}px ${FD}`; fs -= 2; } while (c.measureText(ttl).width > 960 && fs > 30); c.fillText(ttl, 60, 108); }
  c.fillStyle = acc; c.font = `700 32px ${FD}`; c.fillText((W ? "SKIED THERE  ·  ❄️" : "HIKED THERE  ·  ☀️"), 60, 152);
  const PD = per ? periodData(per) : null;
  const st = PD ? (W ? [[PD.places.length, "ośrodków"], [PD.countries.size, "krajów"], [Math.round(PD.km), "km tras"], PD.days > 0 ? [PD.days, "dni na nartach"] : [PD.stays, "wizyt"]] : [[PD.places.length, "miejsc"], [PD.countries.size, "krajów"]]) : W ? [[S.n, "ośrodków"], [S.countries.size, "krajów"], [Math.round(S.km), "km tras"], S.days > 0 ? [S.days, "dni na nartach"] : [S.stays, "wizyt"]] : [[S.n, "miejsc"], [S.countries.size, "krajów"], [S.hikes, "szlaków"]];
  st.forEach((x, i) => { const px0 = 60 + i * 240; c.fillStyle = "rgba(255,255,255,.07)"; c.beginPath(); c.roundRect(px0, 190, 225, 130, 22); c.fill(); c.fillStyle = acc; c.font = `800 66px ${FD}`; c.fillText(String(x[0]), px0 + 22, 262); c.fillStyle = "#9db0d0"; c.font = `500 24px ${F}`; c.fillText(tr(x[1]), px0 + 22, 295); });
  const vis = R.filter(r => isVis(r.id));
  if (kind === "ranking") {
    const rows = TIERS.map(([t, gr]) => ({t, col:(gr.match(/#[0-9a-f]{6}/i)||["#ccc"])[0], a: vis.filter(r => visits[r.id].t === t).sort((x, y) => (visits[y.id].r || 0) - (visits[x.id].r || 0) || y.k - x.k)}));
    const any = rows.some(r => r.a.length);
    if (!any) { c.fillStyle = "#cdd8ee"; c.font = `500 30px ${F}`; c.fillText(tr("Ułóż miejsca w zakładce Ranking, a pojawią się tutaj."), 60, 420); }
    else rows.forEach((row, i) => {
      const y0 = 350 + i * 190; c.fillStyle = row.col; c.beginPath(); c.roundRect(60, y0, 120, 170, 22); c.fill();
      c.fillStyle = "#0b1626"; c.font = `800 72px ${F}`; c.textAlign = "center"; c.fillText(row.t, 120, y0 + 108); c.textAlign = "left";
      c.fillStyle = "rgba(255,255,255,.06)"; c.beginPath(); c.roundRect(196, y0, 824, 170, 22); c.fill();
      c.fillStyle = "#e8f0ff"; c.font = `600 27px ${F}`;
      let line = "", ly = y0 + 44, lines = 0, shown = 0;
      for (const r of row.a) { const nm = r.n.length > 26 ? r.n.slice(0, 25) + "…" : r.n; const t = line ? line + "  ·  " + nm : nm;
        if (c.measureText(t).width > 780) { if (lines >= 3) break; c.fillText(line, 216, ly); ly += 38; lines++; line = nm; } else line = t; shown++; }
      if (lines < 4 && line) c.fillText(line, 216, ly);
      if (shown < row.a.length) { c.fillStyle = acc; c.fillText("+" + (row.a.length - shown), 960, y0 + 150); }
    });
  } else {
    const pts = kind === "period" ? PD.places : vis;
    if (!pts.length) { c.fillStyle = "rgba(255,255,255,.05)"; c.beginPath(); c.roundRect(60, 350, 960, 880, 26); c.fill(); c.fillStyle = "#cdd8ee"; c.font = `500 30px ${F}`; c.fillText(kind === "period" ? tr(W ? "Brak wizyt w tym okresie." : "Brak miejsc w tym okresie.") : tr("Oznacz miejsca, a pojawią się tutaj na mapie."), 100, 420); }
    else {
      drawMapPanel(c, pts, 60, 350, 960, 770, 11, {labels: true});
      const cc = {}; pts.forEach(r => { const k = r.c.split(",")[0]; cc[k] = (cc[k] || 0) + 1; });
      const ks = Object.keys(cc).sort((a, b) => cc[b] - cc[a] || a.localeCompare(b)), top = ks.length > 8 ? ks.slice(0, 7) : ks, EM = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
      top.forEach((k, i) => { const X = 60 + (i % 4) * 242, Y = 1134 + Math.floor(i / 4) * 62;
        c.fillStyle = "rgba(255,255,255,.07)"; c.beginPath(); c.roundRect(X, Y, 228, 52, 16); c.fill();
        c.font = `34px ${EM}`; c.fillStyle = "#fff"; c.fillText(flag(k), X + 12, Y + 39);
        let nm = cname(k); if (nm.length > 11) nm = nm.slice(0, 10) + "…"; c.font = `600 23px ${F}`; c.fillStyle = "#e8f0ff"; c.fillText(nm, X + 62, Y + 35);
        c.textAlign = "right"; c.font = `800 28px ${FD}`; c.fillStyle = acc; c.fillText(String(cc[k]), X + 214, Y + 36); c.textAlign = "left"; });
      if (ks.length > 8) { const i = 7, X = 60 + (i % 4) * 242, Y = 1134 + 62; c.fillStyle = "rgba(255,255,255,.04)"; c.beginPath(); c.roundRect(X, Y, 228, 52, 16); c.fill(); c.font = `700 24px ${F}`; c.fillStyle = acc; c.fillText("+" + (ks.length - 7) + " " + tr("krajów"), X + 20, Y + 35); }
    }
    c.fillStyle = "#38e0a0"; c.beginPath(); c.arc(80, 1264, 9, 0, 7); c.fill(); c.fillStyle = "#cdd8ee"; c.font = `500 24px ${F}`; c.fillText(tr("byłem") + " · " + pts.length, 100, 1272);
  }
  { const un = store && store.prof && store.prof.username, url = (location.protocol.indexOf("http") === 0 ? location.host + location.pathname.replace(/\/$/, "") : "bartoszkrop.github.io/Skied-Hiked-there");
    c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(60, 1284, 960, 2);
    c.textAlign = "left"; c.fillStyle = acc; c.font = `800 34px ${FD}`; c.fillText("MOUNTAINED THERE" + (un ? "  ·  @" + un : ""), 60, 1324);
    c.textAlign = "right"; c.fillStyle = "#8ea3c6"; c.font = `500 22px ${F}`; c.fillText(url, 1020, 1322); c.textAlign = "left"; }
  return cv;
}
function shareCanvas(kind, per, tall){
  const base = shareCanvasBase(kind, per); if (!tall) return base;
  const W = MODE === "w", FD = "Barlow Condensed, Arial Narrow, sans-serif", cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920;
  const c = cv.getContext("2d"), F = "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif";
  const g = c.createLinearGradient(0, 0, 0, 1920);
  const c0 = W ? "#14305a" : "#3b2a1c", c1 = W ? "#070d19" : "#15110c";
  g.addColorStop(0, c0); g.addColorStop(285 / 1920, c0); g.addColorStop(1635 / 1920, c1); g.addColorStop(1, c1);
  c.fillStyle = g; c.fillRect(0, 0, 1080, 1920);
  c.drawImage(base, 0, 285);
  const url = (location.protocol.indexOf("http") === 0 ? location.host + location.pathname.replace(/\/$/, "") : "bartoszkrop.github.io/Skied-Hiked-there"), un = store && store.prof && store.prof.username;
  c.textAlign = "center"; c.fillStyle = "#fff"; c.font = `800 56px ${FD}`; c.fillText(tr("Zrób swoją mapę").toUpperCase(), 540, 1700);
  c.fillStyle = W ? "#5ad1ff" : "#f2a65a"; c.font = `700 38px ${F}`; c.fillText(url, 540, 1760);
  if (un) { c.fillStyle = "#9db3d8"; c.font = `600 30px ${F}`; c.fillText("@" + un, 540, 1810); }
  c.textAlign = "left"; return cv;
}
async function openShare(kind, per){
  try { await Promise.all([document.fonts.load('800 40px "Barlow Condensed"'), document.fonts.load('700 30px "Barlow Condensed"'), document.fonts.load("600 26px Barlow"), document.fonts.load("500 22px Barlow")]); } catch(e){}
  let ov = $("shareov"); if (!ov) { ov = document.createElement("div"); ov.id = "shareov"; document.body.append(ov); }
  if ((kind === "map" || kind === "period") && !GEO && !LANDR) { ov.innerHTML = `<div style="width:min(420px,86vw);padding:30px">${skel(5)}</div>`; ov.style.display = "flex"; await loadGeo(); }
  const cv = shareCanvas(kind, per, true); ov.innerHTML = ""; ov.append(cv);
  const row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px";
  const sv = Object.assign(document.createElement("button"), {className:"btn pri", textContent:"Pobierz 9:16 (TikTok)"}), sq = Object.assign(document.createElement("button"), {className:"btn", textContent:"Pobierz 4:5"}), cl = Object.assign(document.createElement("button"), {className:"btn", textContent:"Zamknij"});
  const msg = document.createElement("div"); msg.className = "small";
  sv.onclick = () => cv.toBlob(b => saveBlob("ski-been-" + kind + "-9x16.png", b, msg), "image/png");
  sq.onclick = () => shareCanvas(kind, per, false).toBlob(b => saveBlob("ski-been-" + kind + "-4x5.png", b, msg), "image/png");
  cl.onclick = () => { ov.style.display = "none"; };
  row.append(sv, sq, cl); ov.append(row, msg); ov.style.display = "flex";
}
function accountCard(){
  if (!SBC || !window.supabase) return "";
  const on = store.mode === "sb" || !!store.authed;
  return `<div class="card">` + (on ? `<h3>Konto</h3>` : "") + (on
    ? `<div class="sub">Zalogowano jako <b>${esc((store.prof && store.prof.username) ? "@" + store.prof.username : (store.name || "konto"))}</b>. E-mail służy tylko do awaryjnego resetu hasła. Dane zapisują się tylko na koncie, więc masz to samo na telefonie i komputerze.</div>${(() => { const p = store.prof || {}; const link = p.username && p.is_public !== false ? location.origin + location.pathname + "#u/" + p.username : ""; return `<div class="fld" style="margin-top:12px"><label>NAZWA UŻYTKOWNIKA (żeby inni Cię znaleźli)</label><div style="display:flex;gap:8px"><input id="uname" class="lin" value="${esc(p.username || "")}" placeholder="np. bartek_ski" autocapitalize="none" style="flex:1"><button class="btn pri" id="usave">Zapisz</button></div></div><div class="fld" style="margin-top:12px"><label>WIDOCZNOŚĆ KONTA</label><div class="seg big" id="upriv"><button data-v="1" class="${p.is_public !== false ? "on" : ""}">Publiczne</button><button data-v="0" class="${p.is_public === false ? "on" : ""}">Prywatne</button></div><div class="small" id="uprivd" style="margin-top:6px">${p.is_public === false ? "Obserwować Cię można tylko po Twojej akceptacji, a mapę widzą tylko zaakceptowani obserwujący." : "Każdy może Cię obserwować i zobaczyć Twoją mapę."}</div></div><div class="small" style="margin:6px 0">Twoje notatki i gwiazdki pokazują się jako opinie na kartach miejsc i pomagają innym.</div><div class="small" id="umsg" style="min-height:16px"></div>${link ? `<div class="small" style="word-break:break-all">Twój link: ${esc(link)} <button class="btn sm" id="ucopy">${navigator.share ? "Udostępnij" : "Kopiuj"}</button></div>` : ""}`; })()}${store.admin ? `<button class="btn" id="ladm" style="width:100%;margin-top:10px">${IC.tool} Zgłoszone miejsca (admin)</button>` : ""}<button class="btn" id="lrfsh" style="width:100%;margin-top:10px">↻ Odśwież dane z konta</button><div style="display:flex;gap:8px;margin-top:10px"><button class="btn bad" id="lout" style="flex:1">Wyloguj</button><button class="btn" id="lclose" style="flex:1">Zamknij</button></div>`
    : `<div class="lg"><div class="lgi">${IC.user}</div><h3 style="margin:6px 0 4px">Zaloguj się</h3>
       <div class="sub" style="margin-bottom:14px">Podaj e-mail i hasło. Dzięki temu masz te same dane na telefonie i komputerze.</div></div>
       <input id="lnick" class="lin" autocapitalize="none" autocomplete="username" maxlength="20" placeholder="nick (przy zakładaniu konta), np. bartek_ski" style="margin-bottom:8px">
       <input id="lemail" class="lin" type="email" inputmode="email" autocomplete="email" placeholder="e-mail (tylko do resetu hasła)">
       <input id="lpass" class="lin" type="password" autocomplete="current-password" placeholder="hasło (min. 6 znaków)" style="margin-top:8px">
       <div style="display:flex;gap:8px"><button class="btn pri lbtn" id="lin" style="flex:1">Zaloguj</button><button class="btn lbtn" id="lup" style="flex:1">Załóż konto</button></div>
       <button class="btn lcl" id="lsend" style="margin-top:8px;font-size:13px">Nie pamiętam hasła</button>
       <div class="small" id="lmsg" style="margin-top:10px;text-align:center;min-height:16px"></div>
       <div class="small" style="margin-top:6px;text-align:center">Po nicku inni Cię znajdą. E-mail jest używany tylko awaryjnie, do resetu hasła. Jeśli konto jest puste, dołączą do niego dane wpisane w tej przeglądarce.</div>
       <button class="btn lcl" id="lclose">Zamknij</button>`) + `</div>`;
}
function updateAcct(){
  const b = $("acct"); if (!b) return;
  if (!SBC || !window.supabase) { b.style.display = "none"; return; }
  b.style.display = ""; const on = store.mode === "sb" || !!store.authed;
  b.innerHTML = IC.user; b.title = on ? "Profil: " + ((store.prof && store.prof.username) ? "@" + store.prof.username : (store.name || "konto")) : "Zaloguj się"; b.setAttribute("aria-label", b.title); b.classList.toggle("on", on); updateBell(); { const rb = $("rfsh"); if (rb) rb.style.display = store.mode === "sb" ? "" : "none"; }
}
/* znajomi, zaproszenia, powiadomienia */
const SOC = {followers: [], friends: [], inReq: [], outReq: [], inInv: [], outInv: [], notes: [], seen: false, ov: "", sig: "", fsig: "", tk: 0, err: "", newIds: new Set(), rt: null};
const ago = d => { const x = (Date.now() - new Date(d).getTime()) / 1000; return x < 60 ? "teraz" : x < 3600 ? Math.floor(x / 60) + " min temu" : x < 86400 ? Math.floor(x / 3600) + " godz. temu" : Math.floor(x / 86400) + " dn. temu"; };
const socOn = () => !!(SBC && window.supabase && store.sb && store.authed && store.mode === "sb" && !RO);
const SOCERR = {"user not found": "Nie ma takiego użytkownika.", "set username first": "Najpierw ustaw nazwę użytkownika w koncie.", "that is you": "To Ty.", "already member": "Ta osoba już jest w wyjeździe.", "only owner invites": "Zapraszać może tylko właściciel wyjazdu.", "no such request": "To zaproszenie już nie jest aktualne.", "no such invite": "To zaproszenie już nie jest aktualne."};
async function socAct(rpc, args){
  try { const r = await store.sb.rpc(rpc, args); if (r.error) throw r.error; return r.data == null ? true : r.data; }
  catch(e){ const m = String((e && e.message) || e); toast(SOCERR[m] || ("Nie udało się: " + m.slice(0, 70))); return null; }
}
async function sendFriendReq(u){
  const r = await socAct("send_friend_request", {uname: u});
  if (r) { toast(r === "following" ? "Obserwujesz @" + u + " ✓" : r === "already" ? "Już obserwujesz @" + u : "Wysłano prośbę do @" + u + ". Czeka na akceptację."); await socLoad(); }
  return r;
}
function updateBell(){
  const b = $("bell"); if (!b) return;
  const on = !!(SBC && window.supabase && store && store.authed && !RO); b.style.display = on ? "" : "none";
  const n = SOC.inReq.length + SOC.inInv.length + SOC.notes.filter(x => !x.read && x.kind !== "friend_req" && x.kind !== "trip_inv").length, g = $("bdg");
  if (g) { g.style.display = n ? "flex" : "none"; g.textContent = n > 9 ? "9+" : String(n); }
  b.title = n ? "Powiadomienia (" + n + ")" : "Powiadomienia";
}
async function socLoad(){
  if (!socOn()) { updateBell(); return; }
  const tk = ++SOC.tk;
  try {
    const me = String((store.prof && store.prof.username) || "").toLowerCase(), sb = store.sb;
    const [a, b, c0, c1] = await Promise.all([sb.from("friend_requests").select("*"), sb.from("trip_invites").select("*").eq("status", "pending"), sb.from("notifications").select("*").eq("read", false).order("created_at", {ascending: false}), sb.from("notifications").select("*").eq("read", true).order("created_at", {ascending: false}).limit(25)]);
    if (tk !== SOC.tk) return;
    const er = a.error || b.error || c0.error || c1.error, c = {data: [...(c0.data || []), ...(c1.data || [])]};
    if (er) { SOC.err = String(er.message || er.code || "błąd"); updateBell(); return; }
    SOC.err = "";
    const fr = a.data || [], iv = b.data || [], low = x => String(x || "").toLowerCase();
    SOC.friends = fr.filter(r => r.status === "accepted" && low(r.from_name) === me).map(r => low(r.to_name)).sort();
    SOC.followers = fr.filter(r => r.status === "accepted" && low(r.to_name) === me).map(r => low(r.from_name)).sort();
    SOC.inReq = fr.filter(r => r.status === "pending" && low(r.to_name) === me);
    SOC.outReq = fr.filter(r => r.status === "pending" && low(r.from_name) === me);
    SOC.inInv = iv.filter(r => low(r.to_name) === me); SOC.outInv = iv.filter(r => low(r.from_name) === me);
    const key = n => n.id + "|" + n.created_at, known = new Set(SOC.notes.map(key));
    SOC.notes = c.data;
    const fresh = SOC.seen ? SOC.notes.filter(n => !n.read && !known.has(key(n))) : [];
    SOC.seen = true;
    if (fresh.length) {
      toast(fresh[0].text + (fresh.length > 1 ? "  (+" + (fresh.length - 1) + ")" : ""));
      fresh.forEach(n => SOC.newIds.add(n.id));
      if (fresh.some(n => /^trip_/.test(n.kind) && n.kind !== "trip_inv")) loadShared(true);
    }
    if (!SOC.migrated && (store.friends || []).length) { SOC.migrated = true; const old = (store.friends || []).map(x => String(x).toLowerCase()).filter(x => x && x !== me && !SOC.friends.includes(x)); setFriends([]); for (const u of old) { try { await store.sb.rpc("send_friend_request", {uname: u}); } catch(e){} } socLoad(); return; }
    if (SOC.friends.join(",") !== SOC.fsig) { SOC.fsig = SOC.friends.join(","); loadFriendsData(); }
    updateBell();
    const sig = JSON.stringify([SOC.friends, SOC.inReq.map(r => r.id), SOC.outReq.map(r => r.id), SOC.inInv.map(r => r.id), SOC.outInv.map(r => r.id), SOC.notes.map(key)]);
    if (sig !== SOC.sig) { SOC.sig = sig; redrawSoc(); }
  } catch(e){ if (tk === SOC.tk) { SOC.err = String((e && e.message) || e); updateBell(); } }
}
function redrawSoc(){
  const ov = $("acctov"); if (!ov || ov.style.display === "none") return;
  if (SOC.ov === "inbox") { ov.innerHTML = inboxCard(); bindInbox(); }
  else if (SOC.ov === "friends") { const ae = document.activeElement; if (ae && ae.id === "fsq") return; const q = ($("fsq") && $("fsq").value) || ""; openFriends(); if (q) { $("fsq").value = q; $("fsgo").click(); } }
  else if (SOC.ov === "share") { const m = $("tmm"); if (m && !SOC.shareRedraw) return; if (SOC.shareRedraw) SOC.shareRedraw(); }
}
function socStart(){
  socLoad();
  if (SOC.iv) return; SOC.iv = setInterval(() => { if (!document.hidden) socLoad(); }, 15000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") socLoad(); });
  window.addEventListener("focus", () => socLoad());
}
function socRealtime(){
  try { if (SOC.rt || !store.sb || !store.sb.channel) return; SOC.rt = store.sb.channel("notif-" + store.uid).on("postgres_changes", {event: "*", schema: "public", table: "notifications", filter: "user_id=eq." + store.uid}, () => socLoad()).subscribe(); } catch(e){}
}
function groupNotes(L){
  const G = [], idx = {}, LB = {trip_comment: "komentarz", trip_item: "nowy cel", trip_cost: "wydatek", trip_edit: "zmiana"};
  L.forEach(n => {
    if (!LB[n.kind]) { G.push(n); return; }
    const k = n.ref + "|" + (n.read ? 1 : 0); let g = idx[k];
    if (!g) { g = idx[k] = {id: n.id, ids: [], kind: n.kind, ref: n.ref, read: n.read, created_at: n.created_at, who: [], what: [], nm: ((n.text || "").match(/„(.*)”/) || [])[1] || "Wyjazd", cnt: 0}; G.push(g); }
    g.ids.push(n.id); g.cnt++; const u = ((n.text || "").match(/^@(\S+)/) || [])[1]; if (u && !g.who.includes(u)) g.who.push(u); if (!g.what.includes(LB[n.kind])) g.what.push(LB[n.kind]);
    if (n.created_at > g.created_at) g.created_at = n.created_at;
  });
  G.forEach(g => { if (g.ids) { g.text = g.cnt === 1 && g.who.length ? "@" + g.who[0] + " wprowadził(a) zmianę w wyjeździe „" + g.nm + "”: " + g.what[0] : "Zmiany w wyjeździe „" + g.nm + "”: " + g.what.join(", ") + (g.who.length ? " · " + g.who.map(x => "@" + x).join(", ") : ""); g.kind = "trip_edit"; } });
  return G.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
function followBack(n){
  if (n.kind !== "follow" || !n.ref) return "";
  const u = String(n.ref).toLowerCase(), fl = new Set([...(store.friends || []), ...SOC.friends].map(x => String(x).toLowerCase()));
  if (fl.has(u)) return `<span class="small" style="flex:none;color:var(--ok)">obserwujesz ✓</span>`;
  if ((SOC.outReq || []).some(r => String(r.to_name).toLowerCase() === u && r.status !== "accepted")) return `<span class="small" style="flex:none">prośba wysłana</span>`;
  return `<button class="btn sm pri fbk" data-u="${esc(u)}" style="flex:none">Zaobserwuj też</button>`;
}
function inboxCard(){
  const acts = [
    ...SOC.inReq.map(r => `<div class="frow"><span>🤝 <b>@${esc(r.from_name)}</b> prosi o możliwość obserwowania Cię</span><span style="display:flex;gap:6px;flex:none"><button class="btn sm pri fra" data-id="${esc(r.id)}">Akceptuj</button><button class="btn sm frd" data-id="${esc(r.id)}">Odrzuć</button></span></div>`),
    ...SOC.inInv.map(r => `<div class="frow"><span>👥 <b>@${esc(r.from_name)}</b> zaprasza Cię do wyjazdu „${esc(r.trip_name || "Wyjazd")}”</span><span style="display:flex;gap:6px;flex:none"><button class="btn sm pri tia" data-id="${esc(r.id)}">Dołącz</button><button class="btn sm tid" data-id="${esc(r.id)}">Odrzuć</button></span></div>`)];
  const notes = groupNotes(SOC.notes.filter(n => n.kind !== "friend_req" && n.kind !== "trip_inv")), nw = notes.filter(n => !n.read), old = notes.filter(n => n.read);
  return `<div class="card" style="width:min(480px,94vw);max-height:88vh;overflow:auto"><h3>Powiadomienia</h3>
    ${SOC.err ? `<div class="small" style="color:#ff8a8a">Powiadomienia nie działają: ${esc(SOC.err.slice(0, 90))}. Uruchom w Supabase plik social.sql.</div>` : ""}
    ${acts.length ? `<div class="sech" style="margin-top:6px">Do zaakceptowania</div>${acts.join("")}` : ""}
    <div class="sech">Aktywność</div>
    ${notes.length ? (() => { const row = n => `<div class="nrow go ${SOC.newIds.has(n.id) || (n.ids || []).some(i => SOC.newIds.has(i)) ? "nw" : ""}" data-k="${esc(n.kind)}" data-r="${esc(n.ref || "")}"><i class="dot"></i><div style="flex:1;min-width:0"><div>${esc(n.text)}</div><div class="tm">${esc(ago(n.created_at))}${n.read ? " · ✓ widziane" : ""}</div></div>${followBack(n)}</div>`; return (nw.length ? `<div class="small" style="margin:6px 0 2px;font-weight:700">Nowe (${nw.length})</div>` + nw.map(row).join("") : "") + (old.length ? `<div class="small" style="margin:10px 0 2px;color:var(--mute)">Wcześniej</div>` + old.map(row).join("") : ""); })() : `<div class="small" style="padding:6px 0">Na razie cicho. Tu pojawią się komentarze i zmiany we wspólnych wyjazdach, zaproszenia, nowi obserwujący i akceptacje.</div>`}
    <button class="btn" id="lclose" style="width:100%;margin-top:12px">Zamknij</button></div>`;
}
function bindInbox(){
  const cl = $("lclose"); if (cl) cl.onclick = closeAccount;
  document.querySelectorAll("#acctov .fra,#acctov .frd").forEach(b => b.onclick = async () => { b.disabled = true; const acc = b.classList.contains("fra"); if (await socAct("respond_friend_request", {rid: b.dataset.id, acc})) toast(acc ? "Zaakceptowano ✓" : "Odrzucono"); await socLoad(); });
  document.querySelectorAll("#acctov .tia,#acctov .tid").forEach(b => b.onclick = async () => { b.disabled = true; const acc = b.classList.contains("tia"); if (await socAct("respond_trip_invite", {iid: b.dataset.id, acc})) { toast(acc ? "Dołączono do wyjazdu ✓" : "Odrzucono"); if (acc) await loadShared(true); } await socLoad(); });
  document.querySelectorAll("#acctov .fbk").forEach(b => b.onclick = async e => { e.stopPropagation(); b.disabled = true; b.textContent = "…"; await sendFriendReq(b.dataset.u); if (SOC.ov === "inbox") { const ov = $("acctov"); if (ov) { ov.innerHTML = inboxCard(); bindInbox(); } } });
  document.querySelectorAll("#acctov .nrow").forEach(r => r.onclick = () => {
    const k = r.dataset.k, id = r.dataset.r;
    if (/^trip_/.test(k)) { const tj = SHT.find(x => x.id === id); closeAccount(); if (tj) { if (MODE !== (tj.mode || "s")) setMode(tj.mode || "s"); tripOpen = id; } show("wyjazdy"); renderTrips(); }
    else if (k === "friend_ok" || k === "follow") openFriends();
  });
}
async function openInbox(){
  if (!socOn()) return;
  SOC.ov = "inbox"; SOC.newIds = new Set(SOC.notes.filter(n => !n.read).map(n => n.id));
  const ov = ovBox(); ov.innerHTML = inboxCard(); ov.scrollTop = 0; bindInbox();
  const ids = SOC.notes.filter(n => !n.read).map(n => n.id);
  if (ids.length) { SOC.notes.forEach(n => { n.read = true; }); updateBell(); try { await store.sb.from("notifications").update({read: true}).in("id", ids); } catch(e){} }
  socLoad();
}
function friendsCard(){
  if (!(SBC && window.supabase && store.sb)) return `<div class="card"><h3>Obserwowani</h3><div class="small">Obserwowanie działa po zalogowaniu na stronie z kontami.</div><div style="margin-top:10px"><button class="btn" id="lclose" style="width:100%">Zamknij</button></div></div>`;
  const F = SOC.friends, fr = (u, btns, sub) => `<div class="frow"><span>@${esc(u)}${sub ? ` <span class="small">· ${sub}</span>` : ""}</span><span style="display:flex;gap:6px;flex:none">${btns}</span></div>`;
  const tab = SOC.ftab === "ers" ? "ers" : "ing", nIn = SOC.inReq.length;
  const ing = `<div class="sub">Wyszukaj kogoś po nazwie użytkownika. Publiczne konto obserwujesz od razu, a prywatne dopiero po akceptacji właściciela. Na karcie miejsca zobaczysz, kto z obserwowanych tam był.</div>
    ${store.authed ? "" : `<div class="small">Zaloguj się, żeby obserwować.</div>`}
    ${SOC.err && store.authed ? `<div class="small" style="color:#ff8a8a;margin-bottom:6px">Obserwowanie nie działa: ${esc(SOC.err.slice(0, 90))}. Uruchom w Supabase pliki social.sql i social2.sql.</div>` : ""}
    ${store.authed && store.prof && store.prof.username ? `<button class="btn" id="fshare" style="width:100%;margin-bottom:10px">${navigator.share ? "Wyślij" : "Skopiuj"} link do mojej mapy</button>${store.prof.is_public === false ? `<div class="small" style="margin:-6px 0 10px">Masz konto prywatne, więc link pokaże mapę tylko osobom, które zaakceptujesz.</div>` : ""}` : ""}
    <div style="display:flex;gap:8px"><input id="fsq" class="lin" placeholder="nazwa użytkownika" autocapitalize="none" style="flex:1"><button class="btn pri" id="fsgo">Szukaj</button></div><div id="fsres" class="small" style="margin:8px 0"></div>
    ${F.length ? F.map(u => fr(u, `<button class="btn sm pri fgo" data-u="${esc(u)}">Zobacz</button><button class="btn sm bad ffr" data-u="${esc(u)}">Przestań</button>`)).join("") : `<div class="small">Jeszcze nikogo. Wyszukaj kogoś powyżej.</div>`}
    ${SOC.outReq.length ? `<div class="sech">Wysłane prośby</div>${SOC.outReq.map(r => fr(r.to_name, `<button class="btn sm ffr" data-u="${esc(r.to_name)}">Anuluj</button>`, "czeka na akceptację")).join("")}` : ""}`;
  const ers = `<div class="sub">Osoby, które Cię obserwują. Możesz usunąć kogoś z obserwujących.</div>
    ${nIn ? `<div class="sech">Prośby o obserwowanie Ciebie</div>${SOC.inReq.map(r => fr(r.from_name, `<button class="btn sm pri fra" data-id="${esc(r.id)}">Akceptuj</button><button class="btn sm frd" data-id="${esc(r.id)}">Odrzuć</button>`)).join("")}<div class="sech">Obserwujący</div>` : ""}
    ${SOC.followers.length ? SOC.followers.map(u => fr(u, `<button class="btn sm fgo" data-u="${esc(u)}">Zobacz</button><button class="btn sm bad ffl" data-u="${esc(u)}">Usuń</button>`)).join("") : `<div class="small">Nikt Cię jeszcze nie obserwuje.</div>`}`;
  return `<div class="card" style="width:min(480px,94vw);max-height:88vh;overflow:auto"><h3>Obserwowani</h3>
    <div class="seg big" id="ftabs" style="margin:6px 0 10px"><button data-t="ing" class="${tab === "ing" ? "on" : ""}">Obserwujesz · ${F.length}</button><button data-t="ers" class="${tab === "ers" ? "on" : ""}">Obserwujący · ${SOC.followers.length}${nIn ? ` <span class="bdg" style="position:static;display:inline-block;margin-left:3px">${nIn}</span>` : ""}</button></div>
    ${tab === "ing" ? ing : ers}
    <div style="margin-top:12px"><button class="btn" id="lclose" style="width:100%">Zamknij</button></div></div>`;
}
function bindFriends(){
  const cl = $("lclose"); if (cl) cl.onclick = closeAccount;
  { const sh = $("fshare"); if (sh) sh.onclick = () => shareLink("Moja mapa", "Zobacz moją mapę:", location.origin + location.pathname + "#u/" + store.prof.username); }
  document.querySelectorAll("#ftabs button").forEach(b => b.onclick = () => { SOC.ftab = b.dataset.t; openFriends(); });
  document.querySelectorAll("#acctov .fgo").forEach(b => b.onclick = () => openProfile(b.dataset.u));
  const reopen = q => { openFriends(); if (q) { $("fsq").value = q; $("fsgo").click(); } }, curq = () => ($("fsq") && $("fsq").value) || "";
  document.querySelectorAll("#acctov .ffl").forEach(b => b.onclick = async () => { const q = curq(); b.disabled = true; await socAct("remove_follower", {uname: b.dataset.u}); await socLoad(); reopen(q); });
  document.querySelectorAll("#acctov .ffr").forEach(b => b.onclick = async () => { const q = curq(); b.disabled = true; await socAct("remove_friend", {uname: b.dataset.u}); await socLoad(); reopen(q); });
  document.querySelectorAll("#acctov .fra,#acctov .frd").forEach(b => b.onclick = async () => { const q = curq(), acc = b.classList.contains("fra"); b.disabled = true; if (await socAct("respond_friend_request", {rid: b.dataset.id, acc})) toast(acc ? "Zaakceptowano ✓" : "Odrzucono"); await socLoad(); reopen(q); });
  const fg = $("fsgo"); if (fg) { const go = async () => {
    const q = ($("fsq").value || "").trim().toLowerCase().replace(/^@/, ""), m = $("fsres"); if (q.length < 2) { m.textContent = "Wpisz co najmniej 2 znaki."; return; }
    m.textContent = "Szukam…";
    try { const r = await store.sb.rpc("find_users", {q}); if (r.error) throw r.error;
      m.innerHTML = (r.data || []).length ? r.data.map(x => { const u = String(x.username).toLowerCase(), isF = SOC.friends.includes(u), out = SOC.outReq.find(y => String(y.to_name).toLowerCase() === u), inn = SOC.inReq.find(y => String(y.from_name).toLowerCase() === u);
        const act = isF ? `<button class="btn sm ffr2" data-u="${esc(u)}">Obserwujesz ✓</button>` : out ? `<button class="btn sm ffr2" data-u="${esc(u)}">Wysłano · anuluj</button>` : store.authed ? `<button class="btn sm pri fiv" data-u="${esc(u)}">${x.is_public === false ? "Poproś" : "Obserwuj"}</button>` : "";
        return `<div class="frow"><span>@${esc(x.username)}${x.is_public === false ? ` <span class="small">· prywatne ${IC.lock}</span>` : ""}</span><span style="display:flex;gap:6px;flex:none">${x.is_public !== false || isF ? `<button class="btn sm fgo2" data-u="${esc(x.username)}">Zobacz</button>` : ""}${act}</span></div>`; }).join("") : "Nikogo nie znaleziono.";
      m.querySelectorAll(".fgo2").forEach(b => b.onclick = () => openProfile(b.dataset.u));
      m.querySelectorAll(".fiv").forEach(b => b.onclick = async () => { b.disabled = true; await sendFriendReq(b.dataset.u); reopen(q); });
      m.querySelectorAll(".ffr2").forEach(b => b.onclick = async () => { b.disabled = true; await socAct("remove_friend", {uname: b.dataset.u}); await socLoad(); reopen(q); });
    } catch(e){ m.textContent = "Nie udało się wyszukać: " + String((e && e.message) || e).slice(0,70); } };
    fg.onclick = go; $("fsq").onkeydown = e => { if (e.key === "Enter") go(); }; }
}
const DDC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
function ddClose() { document.querySelectorAll("body > .ddm").forEach(m => { m.style.display = ""; if (m._w) m._w.append(m); }); document.querySelectorAll(".dd.open").forEach(w => { w.classList.remove("open"); const m = w.querySelector(".ddm"); if (m) m.style.display = ""; }); }
function stChips() {
  const sel = $("fstat"); if (!sel) return; let w = $("stchips");
  if (!w) { w = document.createElement("div"); w.id = "stchips"; w.className = "stchips"; w.setAttribute("role", "tablist"); sel.closest(".frowm").before(w); sel.style.display = "none"; sel.dataset.dd = "1";
    w.onclick = e => { const b = e.target.closest("button"); if (!b || sel.value === b.dataset.v) return; sel.value = b.dataset.v; sel.dispatchEvent(new Event("change", {bubbles: true})); syncDD(); };
    sel.addEventListener("change", () => syncDD()); }
  const sig = [...sel.options].map(o => o.value + ":" + o.text).join("|") + "#" + sel.value;
  if (w._sig === sig) return; w._sig = sig;
  w.innerHTML = [...sel.options].map(o => `<button type="button" role="tab" data-v="${esc(o.value)}" class="${o.value === sel.value ? "on" : ""}" aria-selected="${o.value === sel.value}">${esc(o.text)}</button>`).join("");
}
function syncDD() { document.querySelectorAll("select[data-dd]").forEach(s => { if (s._lab) s._lab(); }); stChips(); }
function ddEnh(sel) {
  if (sel.dataset.dd) return; sel.dataset.dd = "1";
  const w = document.createElement("div"), b = document.createElement("button"), m = document.createElement("div");
  w.className = "dd"; b.type = "button"; b.className = "ddb"; m.className = "ddm"; b.setAttribute("aria-haspopup", "listbox");
  ["width", "flex", "minWidth", "maxWidth", "margin", "marginTop"].forEach(k => { if (sel.style[k]) w.style[k] = sel.style[k]; });
  if (sel.style.padding) b.style.padding = sel.style.padding; if (sel.style.fontSize) b.style.fontSize = sel.style.fontSize; if (sel.style.minHeight) b.style.minHeight = sel.style.minHeight;
  sel.style.display = "none"; sel.after(w); w.append(b, m);
  const lab = () => { const o = sel.options[sel.selectedIndex]; b.innerHTML = "<span>" + esc(o ? o.text : "") + "</span>" + DDC; };
  const items = () => [...m.children];
  const build = () => { m.innerHTML = ""; [...sel.options].forEach((o, i) => { const it = document.createElement("div"); it.className = "ddi" + (i === sel.selectedIndex ? " on" : ""); it.setAttribute("role", "option"); const sp = document.createElement("span"); sp.textContent = o.text; it.append(sp); it.onclick = e => { e.stopPropagation(); sel.selectedIndex = i; ddClose(); lab(); sel.dispatchEvent(new Event("change", {bubbles: true})); }; m.append(it); }); };
  const open = () => { ddClose(); build(); window.__ddAt = Date.now(); w.classList.add("open"); const r = b.getBoundingClientRect(); m._w = w; document.body.append(m); m.style.display = "block"; const h = Math.min(m.scrollHeight, 280), below = innerHeight - r.bottom - 10, up = below < h && r.top > below; m.style.maxHeight = Math.max(120, Math.min(280, up ? r.top - 10 : below)) + "px"; m.style.minWidth = r.width + "px"; m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + "px"; m.style[up ? "bottom" : "top"] = up ? (innerHeight - r.top + 4) + "px" : (r.bottom + 4) + "px"; m.style[up ? "top" : "bottom"] = "auto"; const on = m.querySelector(".on"); if (on) on.scrollIntoView({block: "nearest"}); };
  b.onclick = e => { e.stopPropagation(); w.classList.contains("open") ? ddClose() : open(); };
  b.onkeydown = e => { if (e.key === "Escape") ddClose(); else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!w.classList.contains("open")) open(); const n = sel.options.length, i = Math.max(0, Math.min(n - 1, sel.selectedIndex + (e.key === "ArrowDown" ? 1 : -1))); sel.selectedIndex = i; build(); lab(); sel.dispatchEvent(new Event("change", {bubbles: true})); } };
  sel.addEventListener("change", lab); sel._lab = lab; lab();
}
{ let pend = 0; const run = () => { pend = 0; document.querySelectorAll("select.sel:not([data-dd]), #v-lista .toolbar select:not(#fstat):not([data-dd])").forEach(ddEnh); stChips(); document.querySelectorAll("input[type=date]:not([data-dd])").forEach(dpEnh); };
  new MutationObserver(() => { if (!pend) pend = requestAnimationFrame(run); }).observe(document.body, {childList: true, subtree: true}); run();
  document.addEventListener("click", ddClose); { let iw = innerWidth; addEventListener("resize", () => { if (innerWidth !== iw) { iw = innerWidth; ddClose(); } }); } document.addEventListener("scroll", e => { if (Date.now() - (window.__ddAt || 0) < 700) return; if (!(e.target.closest && e.target.closest(".ddm"))) ddClose(); }, true); }
async function shareLink(title, text, url) { try { if (navigator.share) { await navigator.share({title, text, url}); return; } } catch (e) { if (e && e.name === "AbortError") return; } try { await navigator.clipboard.writeText(url); toast("Skopiowano link ✓"); } catch (e) { prompt("Skopiuj link:", url); } }
function dlgBox(msg, btns) { return new Promise(res => { const old = $("appdlg"); if (old) old.remove(); const o = document.createElement("div"); o.id = "appdlg"; o.innerHTML = '<div class="dlgc" role="alertdialog"><div class="dlgm"></div><div class="dlgb"></div></div>'; o.querySelector(".dlgm").textContent = msg; const bb = o.querySelector(".dlgb"); const fin = v => { o.remove(); document.removeEventListener("keydown", kd, true); res(v); }; const kd = e => { if (e.key === "Escape") { e.stopPropagation(); fin(false); } }; btns.forEach(b => { const x = document.createElement("button"); x.className = "btn" + (b.pri ? " pri" : ""); x.textContent = b.t; x.onclick = () => fin(b.v); bb.append(x); }); o.addEventListener("click", e => { if (e.target === o) fin(false); }); document.addEventListener("keydown", kd, true); document.body.append(o); bb.lastChild.focus(); }); }
window.alert = m => { dlgBox(String(m), [{t: "OK", pri: 1, v: true}]); };
const appCode = (m, code) => new Promise(res => { const old = $("appdlg"); if (old) old.remove(); const o = document.createElement("div"); o.id = "appdlg"; o.innerHTML = '<div class="dlgc" role="alertdialog"><div class="dlgm" style="white-space:pre-line"></div><input class="lin dlgi" inputmode="numeric" autocomplete="off" style="margin:10px 0 0;text-align:center;letter-spacing:3px"><div class="dlgb"></div></div>'; o.querySelector(".dlgm").textContent = m + "\nWpisz " + code + ", aby potwierdzić."; const inp = o.querySelector(".dlgi"); const bb = o.querySelector(".dlgb"); const fin = v => { o.remove(); document.removeEventListener("keydown", kd, true); res(v); }; const kd = e => { if (e.key === "Escape") { e.stopPropagation(); fin(false); } else if (e.key === "Enter" && inp.value.trim() === code) fin(true); }; const no = document.createElement("button"); no.className = "btn"; no.textContent = "Anuluj"; no.onclick = () => fin(false); const ok = document.createElement("button"); ok.className = "btn pri"; ok.textContent = "Potwierdź"; ok.disabled = true; ok.style.opacity = ".45"; ok.onclick = () => { if (inp.value.trim() === code) fin(true); }; inp.oninput = () => { const g = inp.value.trim() === code; ok.disabled = !g; ok.style.opacity = g ? "" : ".45"; }; bb.append(no, ok); o.addEventListener("click", e => { if (e.target === o) fin(false); }); document.addEventListener("keydown", kd, true); document.body.append(o); setTimeout(() => inp.focus(), 50); });
const appConfirm = m => dlgBox(String(m), [{t: "Anuluj", v: false}, {t: "Potwierdź", pri: 1, v: true}]);
const CALI = '<svg class="cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
function dpEnh(inp) {
  if (inp.dataset.dd) return; inp.dataset.dd = "1";
  const w = document.createElement("div"), b = document.createElement("button"), m = document.createElement("div");
  w.className = "dd"; b.type = "button"; b.className = "ddb"; m.className = "ddm dpm";
  inp.style.display = "none"; inp.after(w); w.append(b, m);
  const MN = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
  const iso = (y, mo, d) => y + "-" + String(mo + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0"), todayS = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };
  const lab = () => { const v = inp.value; b.innerHTML = '<span style="' + (v ? "" : "opacity:.6") + '">' + esc(v ? new Date(v + "T12:00:00").toLocaleDateString(LOC(), {weekday: "short", day: "numeric", month: "short", year: "numeric"}) : "Wybierz datę") + "</span>" + CALI; };
  let vy = 0, vm = 0;
  const draw = () => { const off = (new Date(vy, vm, 1).getDay() + 6) % 7, dim = new Date(vy, vm + 1, 0).getDate(), ts = todayS();
    let h = '<div class="dph"><button type="button" class="dpn" data-n="-1">‹</button><b>' + MN[vm] + " " + vy + '</b><button type="button" class="dpn" data-n="1">›</button></div><div class="dpg">' + ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map(x => "<i>" + x + "</i>").join("");
    for (let i = 0; i < off; i++) h += "<span></span>";
    for (let d = 1; d <= dim; d++) { const s2 = iso(vy, vm, d); h += '<button type="button" class="dpd' + (s2 === inp.value ? " on" : "") + (s2 === ts ? " td" : "") + '" data-d="' + s2 + '">' + d + "</button>"; }
    m.innerHTML = h + '</div><div class="dpf"><button type="button" class="dpt">Dziś</button><button type="button" class="dpc">Wyczyść</button></div>'; };
  const set = v => { inp.value = v; lab(); ddClose(); inp.dispatchEvent(new Event("input", {bubbles: true})); inp.dispatchEvent(new Event("change", {bubbles: true})); };
  m.onclick = e => { e.stopPropagation(); const t = e.target.closest("button"); if (!t) return; if (t.dataset.n) { vm += +t.dataset.n; if (vm < 0) { vm = 11; vy--; } if (vm > 11) { vm = 0; vy++; } draw(); } else if (t.dataset.d) set(t.dataset.d); else if (t.classList.contains("dpt")) set(todayS()); else if (t.classList.contains("dpc")) set(""); };
  b.onclick = e => { e.stopPropagation(); if (w.classList.contains("open")) { ddClose(); return; } ddClose(); const d0 = inp.value ? new Date(inp.value + "T12:00:00") : new Date(); vy = d0.getFullYear(); vm = d0.getMonth(); draw(); w.classList.add("open"); m.style.display = "block"; const r = b.getBoundingClientRect(), h = m.offsetHeight, up = innerHeight - r.bottom - 10 < h && r.top > innerHeight - r.bottom; m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + "px"; if (up) { m.style.bottom = (innerHeight - r.top + 4) + "px"; m.style.top = "auto"; } else { m.style.top = (r.bottom + 4) + "px"; m.style.bottom = "auto"; } };
  b.onkeydown = e => { if (e.key === "Escape") ddClose(); };
  lab();
}
document.addEventListener("toggle", e => { const d = e.target; if (!d || d.tagName !== "DETAILS" || !d.open || Date.now() - (window.__rrT || 0) < 600) return; d.classList.add("anim"); setTimeout(() => d.classList.remove("anim"), 320); }, true);
const APPV = "v252";
function settingsCard(){
  return `<div class="card"><h3>Ustawienia</h3><div class="fld"><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="tourbtn" type="button">Pokaż przewodnik</button><button class="btn sm" id="bugbtn" type="button">Zgłoś błąd lub pomysł</button></span></div><div class="fld"><label>JĘZYK / LANGUAGE / SPRACHE</label><select class="sel" id="langsel"><option value="pl">Polski</option><option value="en">English</option><option value="de">Deutsch</option></select></div><div class="fld"><label>MOTYW</label><div class="seg big" id="themeseg"><button data-v="auto">Jak w systemie</button><button data-v="light">Jasny</button><button data-v="dark">Ciemny</button></div></div><div class="fld"><label>MAPA</label><div class="seg big" id="mlseg"><button data-v="0">Klasyczna</button><button data-v="1">Nowa (test)</button></div><div class="small" style="margin-top:4px">Nowa mapa ma kontury lądów i cieniowanie gór po przybliżeniu. Jeśli przycina, wróć do klasycznej.</div></div>${(isStandalone() || !SBC) ? "" : `<div class="fld" style="margin-top:12px"><label>APLIKACJA</label><button class="btn" id="instset" style="width:100%">${IC.phone} Dodaj do ekranu głównego</button><div class="small" id="instmsg" style="margin-top:6px"></div></div>`}<div style="margin-top:10px"><button class="btn" id="lclose" style="width:100%">Zamknij</button></div><div class="small" style="opacity:.55;margin-top:10px;text-align:center">Wersja ${APPV}</div></div>`;
}
function ovBox(){
  let ov = $("acctov"); if (!ov) { ov = document.createElement("div"); ov.id = "acctov"; document.body.append(ov); ov.addEventListener("click", e => { if (e.target === ov) closeAccount(); }); }
  clearTimeout(closeAccount._t); const fresh = ov.style.display !== "flex" || ov.classList.contains("out"); ov.classList.remove("out"); ov.style.display = "flex"; ov.style.flexDirection = "column"; ov.style.alignItems = "center"; if (fresh) { ov.classList.remove("in"); void ov.offsetWidth; ov.classList.add("in"); } return ov;
}
const tripsPre = () => { tripOpen = null; tripsTab = "trips"; renderTrips(); };
function tourDemo(){
  const W = MODE === "w", iso = k => { const d = new Date(); d.setDate(d.getDate() + k); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const pool = R.filter(r => r.y != null && (W || (r.hikes || []).some(h => !h.del))).sort((x, y) => y.k - x.k), b0 = pool[0];
  const near = pool.filter(r => r !== b0 && km2(b0, r) < 60).slice(0, 3), far = pool.find(r => km2(b0, r) > 120);
  const mkI = (r, day, v, cm) => { const h = W ? null : (r.hikes || []).find(z => !z.del); return {id: newTripId(), p: r.id, n: W ? r.n : h.n, m: W ? "w" : undefined, day, by: "test2", v, cm: cm || []}; };
  const items = [];
  if (b0) items.push(mkI(b0, 1, {test1: 1, test2: 1, test3: 1}, [{u: "test3", t: W ? "Tu jest najlepszy śnieg!" : "Ten szlak koniecznie!"}]));
  if (near[0]) items.push(mkI(near[0], 1, {test1: 1, test3: -1}));
  if (near[1]) items.push(mkI(near[1], 2, {test2: 1}));
  if (far) items.push(mkI(far, 3, {}));
  if (near[2]) items.push(mkI(near[2], 0, {test1: 1, test2: 1}));
  const cs = [
    {id: newTripId(), w: "Nocleg", a: 1260, cu: "PLN", by: "test1", at: Date.now()},
    {id: newTripId(), w: W ? "Skipassy" : "Bilety i parking", a: 96, cu: "EUR", fr: 4.3, by: "test2", sp: ["test1", "test2"], at: Date.now()},
    {id: newTripId(), w: W ? "Obiad na stoku" : "Obiad w schronisku", a: 78, cu: "CHF", fr: 4.6, by: "test3", at: Date.now()}
  ];
  return {id: "tour-demo", name: "Przykładowy wyjazd", from: iso(3), to: iso(5), note: "Nocleg w pensjonacie, dojazd dwoma autami.", items, dn: {1: "Wyjście o 7:00, śniadanie wcześniej."}, costs: cs, pack: [{id: newTripId(), n: "Rezerwacja noclegu", ok: true, who: "test1"}, {id: newTripId(), n: "Ubezpieczenie", ok: false, who: "test3"}], shop: [{id: newTripId(), n: "Makaron", ok: true}, {id: newTripId(), n: "Woda i batony", ok: false}], settle: [], cc: [], cur: "zł", rt: {EUR: 4.3, CHF: 4.6, USD: 4}, rs: {EUR: "m", CHF: "m", USD: "m"}, rd: Date.now(), mode: MODE, shared: true, owner_name: "test1", members: ["test2", "test3"], rsvp: {test1: "y", test2: "y", test3: "m"}, demo: true};
}
const TOUR = [
  {t: "Witaj", x: "Pokażę to, czego nie widać na pierwszy rzut oka, przede wszystkim planer wyjazdów. Możesz pominąć w każdej chwili."},
  {v: "mapa", s: ".legend", t: "Legenda to przełącznik", x: "Zielony to miejsca, w których byłeś, żółty to planowane, niebieski to jeszcze nie. <b>Kliknij kolor w legendzie, żeby ukryć albo pokazać punkty tego rodzaju</b>, na przykład tylko Twoje plany albo same nieodwiedzone."},
  {v: "mapa", pre: () => { TOURSA = showAll; showAll = true; mapRefresh(); }, el: () => { const m = $("map").getBoundingClientRect(), cx = innerWidth / 2, cy = (m.top + m.bottom) / 2; let best = null, bd = 1e9; dots.forEach(d => { const q = d.c.getBoundingClientRect(); if (q.width < 1) return; const x = q.left + q.width / 2, y = q.top + q.height / 2; if (x < 40 || x > innerWidth - 40 || y < m.top + 110 || y > m.bottom - 90) return; const dd = Math.hypot(x - cx, y - cy); if (dd < bd) { bd = dd; best = d.c; } }); return best; }, pad: 12, t: "Karta miejsca", x: "Kropka na mapie to miejsce. Dotknij jej, a otworzy się karta: oznaczysz wizytę, odhaczysz pojedyncze szlaki, ocenisz miejsce i przeczytasz opinie innych. Wszystkie opinie są publiczne, więc Twoja pomaga następnym."},
  {v: "mapa", pre: () => openMapFilters(), s: "#mfv", t: "Trzy tryby mapy", x: "To pole Tryb w filtrach mapy.<br>• <b>Zwykły</b>: Twoje miejsca, wizyty i plany.<br>• <b>Znajomi</b>: mapa ze znajomymi, gdzie byli i co planują.<br>• Trzeci tryb zostawiam Tobie do odkrycia."},
  {v: "mapa", pre: () => openMapFilters(), s: ".mfg2", t: "Pozostałe filtry", x: "Kraj, ocena, wielkość i wysokość (zima) albo grupa (lato), a także pogoda: opady, chmury i dzień prognozy. Aktywne filtry pokazują się potem jako małe żetony na mapie. Wyczyść resetuje je i wraca do trybu zwykłego."},
  {v: "mapa", s: "#frbtn", t: "Znajomi", x: "Dodaj znajomych po nicku. Dzięki temu działa tryb znajomi, a w wyjazdach możesz planować razem z nimi."},
  {v: "wyjazdy", s: '#nav button[data-t="wyjazdy"]', t: "Wyjazdy", x: "Planer wyjazdów. Nowy wyjazd zaczynasz przyciskiem na dole listy: nazwa, daty i cele (zimą także ośrodek bazowy). Z listy miejsc robisz konkretny plan z dniami, kosztami i wspólnymi ustaleniami. Pokażę go na przykładowym wyjeździe."},
  {v: "wyjazdy", s: "#tseg", t: "Pakowanie", x: "Druga zakładka to osobne listy rzeczy do zabrania, z gotowymi podpowiedziami. Odhaczasz spakowane rzeczy bez planowania wyjazdu, a listę możesz zduplikować na kolejny raz."},
  {v: "wyjazdy", demo: 1, s: "#tname", t: "Przykładowy wyjazd", x: "Otwieram demo z trzema osobami: test1, test2 i test3. To tylko pokaz, nic z niego nie zapisuje się na Twoim koncie."},
  {v: "wyjazdy", demo: 1, s: ".tday.t1 .tit", t: "Cele w dniach", x: "Cele przypisane do dnia pokazują pod nazwą prognozę pogody na ten dzień (po ustawieniu dat wyjazdu). Nazwa otwiera wyszukiwanie w Google, a znacznik po lewej oznacza, że cel jest zrobiony."},
  {v: "wyjazdy", demo: 1, s: ".thandle", t: "Układanie dni", x: "Chwyć uchwyt i przeciągnij cel na inny dzień albo w inne miejsce w dniu. Cele bez dnia czekają w sekcji Do rozplanowania. Jeśli dzień jest zbyt długi albo miejsca są daleko od siebie, pojawi się ostrzeżenie."},
  {v: "wyjazdy", demo: 1, s: ".tvg", t: "Głosy i komentarze", x: "Gdy wyjazd jest wspólny, każdy może dać plus albo minus celowi i go skomentować. Cele bez dnia ustawiają się według wyniku głosowania, więc najlepsze są na górze."},
  {v: "wyjazdy", demo: 1, s: "#rsvseg", t: "Kto jedzie", x: "Każdy uczestnik odpowiada Jadę, Może albo Nie jadę. Pod spodem widać podsumowanie, ile osób jedzie i kto jeszcze nie odpowiedział."},
  {v: "wyjazdy", demo: 1, s: ".tact", t: "Kalendarz, mapa, znajomi", x: "Kalendarz dodaje dni z przypisanymi celami do kalendarza na Twoim urządzeniu. Mapa pokazuje trasę wyjazdu dzień po dniu. Przycisk współdzielenia zaprasza znajomych po nicku, a oni widzą i edytują ten sam plan."},
  {v: "wyjazdy", demo: 1, el: () => { const rows = []; (TOURDEMO ? TOURDEMO.costs : []).forEach(c => { const card = [...document.querySelectorAll(".tcd .card")].find(x => x.textContent.includes(c.w) && !x.style.cssText.includes("--acc")); if (card) rows.push(card.closest(".swr") || card); }); if (!rows.length) return null; return {getBoundingClientRect: () => { const q = rows.map(x => x.getBoundingClientRect()), l = Math.min(...q.map(x => x.left)), tp = Math.min(...q.map(x => x.top)), rt = Math.max(...q.map(x => x.right)), bt = Math.max(...q.map(x => x.bottom)); return {left: l, top: tp, right: rt, bottom: bt, width: rt - l, height: bt - tp}; }, scrollRef: rows[0]}; }, t: "Wydatki", x: "Tu trzy wydatki, każdy w innej walucie: złotych, euro i frankach. Każdy ma osobę, która zapłaciła, i osoby, na które się dzieli. Obcą walutę aplikacja przelicza na walutę rozliczenia, a kurs widać pod kwotą. Nowy wydatek dodajesz plusem przy nagłówku Koszty."},
  {v: "wyjazdy", demo: 1, s: ".tfx > summary", t: "Waluty i kursy", x: "Rozliczasz w jednej walucie, a wydatki mogą być w różnych: euro, funty, dolary, franki, korony i inne. Kursy większości walut ustawiają się same, a własną walutę dodasz ręcznie."},
  {v: "wyjazdy", demo: 1, s: ".swr", t: "Własne wydatki", x: "Wydatki, które sam dodałeś, możesz edytować (kwota, data, kurs, podział) albo usunąć ikonami obok kwoty. Cudzych wydatków nie zmienisz."},
  {v: "wyjazdy", demo: 1, s: ".tcd > .card", t: "Rozliczenie", x: "Aplikacja sama liczy, kto komu ile oddaje, po przeliczeniu wszystkich walut. Gdy ktoś odda pieniądze, klika Rozliczone i dług znika z listy."},
  {v: "wyjazdy", demo: 1, s: ".tsd > summary", t: "Lista zakupów", x: "Wspólna lista do kupienia. Po odhaczeniu możesz wpisać, ile to kosztowało, a kwota trafi do kosztów i rozliczenia."},
  {v: "wyjazdy", demo: 1, s: ".tpd > summary", t: "Do ogarnięcia", x: "Sprawy przed wyjazdem, za które odpowiada konkretna osoba, na przykład rezerwacja albo ubezpieczenie. Własne rzeczy do zabrania odhaczasz w zakładce Pakowanie."},
  {v: "wyjazdy", demo: 1, s: "#tact", t: "Obecny wyjazd", x: "W trakcie terminu wyjazd włącza się sam jako obecny, a tym przyciskiem ustawisz to ręcznie. Dzięki temu skróty do dodawania działają od razu na nim."},
  {v: "wyjazdy", demo: 1, s: "#tfin", t: "Zakończ wyjazd", x: "Po powrocie kliknij to, a miejsca z wyjazdu zapiszą się na mapie jako odwiedzone. Nie musisz zaznaczać ich po kolei."},
  {v: "wyjazdy", demo: 1, s: "#fabx", t: "Szybkie akcje", x: "Okrągły przycisk w rogu, gdy masz wyjazd. Dodaje wydatek, rzecz do sklepu, rzecz do zabrania albo znajomego bez wchodzenia w szczegóły wyjazdu."},
  {v: "statystyki", s: '#nav button[data-t="statystyki"]', t: "Staty", x: "Podsumowanie Twoich miejsc, krajów i szlaków oraz rankingi tego, co zaznaczyłeś."},
  {v: "statystyki", cond: () => SBC && store && store.sb && !RO, s: "#rkscope", t: "Ranking społeczności", x: () => "Przełącznik na Społeczność pokazuje rankingi wszystkich użytkowników: gdzie ludzie najczęściej byli, gdzie chcą jechać i co jest najwyżej oceniane." + (MODE === "s" ? " Latem jest tam nawet ranking szarlotek ze schronisk." : "")},
  {t: "Gotowe", x: "Dodaj pierwsze miejsce, w którym byłeś. Przewodnik wrócisz w Ustawieniach."}
];
function startTour(force){
  const STEPS = TOUR.filter(q => (!q.only || q.only === MODE) && (!q.cond || q.cond()));
  try { if (!force && (localStorage.getItem("skibeen.tour") === "1" || RO || Object.keys(wVisits).length + Object.keys(sVisits).length)) return; } catch(e){}
  if ($("tour")) return;
  let i = 0; const ov = document.createElement("div"); ov.id = "tour";
  ov.style.cssText = "position:fixed;inset:0;z-index:9998";
  const end = () => { try { localStorage.setItem("skibeen.tour", "1"); } catch(e){} ov.remove(); if (TOURSA !== null) { showAll = TOURSA; TOURSA = null; try { mapRefresh(); } catch(e){} } TOURDEMO = null; TOURME = ""; tripOpen = null; try { closeAccount(); show("mapa"); updateFab(); } catch(e){} try { instAfterOnboarding(); } catch(e){} };
  const draw = () => {
    const t = STEPS[i], last = i === STEPS.length - 1, W = innerWidth, H = innerHeight;
    try { closeAccount(); } catch(e){}
    if (TOURSA !== null) { showAll = TOURSA; TOURSA = null; try { mapRefresh(); } catch(e){} }
    TOURDEMO = t.demo ? (TOURDEMO || tourDemo()) : null; TOURME = t.demo ? "test1" : "";
    if (t.v) { try { show(t.v); } catch(e){} }
    if (t.v === "wyjazdy") { try { if (t.demo) { tripOpen = "tour-demo"; tripsTab = "trips"; renderTrips(); } else tripsPre(); } catch(e){} }
    else if (!t.v) { tripOpen = null; }
    if (t.pre) { try { t.pre(); } catch(e){} }
    ov.innerHTML = '<div style="position:fixed;inset:0;background:rgba(5,10,20,.78)"></div>';
    const place = first => {
      if (!$("tour") || STEPS[i] !== t) return;
      let el = t.el ? t.el() : t.s ? document.querySelector(t.s) : null; for (let u = 0; el && u < 4 && el.getBoundingClientRect().width < 4; u++) el = el.parentElement;
      if (el && t.demo && first) { const sc = $("v-wyjazdy"), rr0 = el.getBoundingClientRect(); sc.scrollTop += rr0.top - H * 0.25; }
      let r = el ? el.getBoundingClientRect() : null;
      if (r && (r.width < 4 || r.height < 4)) r = null;
      const cw = Math.min(330, W - 24), cx = r ? r.left + r.width / 2 : W / 2;
      const cl = Math.max(12, Math.min(W - cw - 12, cx - cw / 2));
      const pad = t.pad || 6, below = r ? (r.top + r.height / 2) < H / 2 : true;
      const hole = r ? `<div style="position:fixed;left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;border-radius:12px;box-shadow:0 0 0 100vmax rgba(5,10,20,.78);outline:2px solid var(--accent);pointer-events:none"></div>` : `<div style="position:fixed;inset:0;background:rgba(5,10,20,.78)"></div>`;
      const pos = !r ? `top:50%;transform:translateY(-50%)` : below ? `top:${r.bottom + pad + 16}px` : `bottom:${H - r.top + pad + 16}px`;
      const ax = r ? Math.max(18, Math.min(cw - 30, cx - cl - 6)) : 0;
      const arrow = r ? `<div style="position:absolute;${below ? "top:-7px" : "bottom:-7px"};left:${ax}px;width:14px;height:14px;background:var(--bg2);transform:rotate(45deg);border:1px solid var(--line);border-${below ? "right" : "left"}:0;border-${below ? "bottom" : "top"}:0"></div>` : "";
      ov.innerHTML = hole + `<div class="card" style="position:fixed;left:${cl}px;width:${cw}px;${pos};text-align:left;padding:16px;margin:0;background:var(--bg2);backdrop-filter:none"><div class="small" style="margin-bottom:4px">${i + 1} / ${STEPS.length}</div><h3 style="margin:0 0 6px">${t.t}</h3><p style="color:var(--mute);margin:0 0 14px;line-height:1.45;font-size:14px">${typeof t.x === "function" ? t.x() : t.x}</p><div style="display:flex;gap:8px"><button class="btn" id="tskip" style="flex:1">${last ? "Zamknij" : "Pomiń"}</button><button class="btn pri" id="tnext" style="flex:2">${last ? (t.btn || "Zaczynamy") : "Dalej"}</button></div>${arrow}</div>`;
      $("tskip").onclick = end; $("tnext").onclick = () => { if (last) end(); else { i++; draw(); } };
    };
    setTimeout(() => place(true), t.v ? 420 : 0); setTimeout(() => place(false), (t.v ? 420 : 0) + 500);
  };
  document.body.append(ov); draw();
}
function openSettings(){ SOC.ov = ""; ovBox().innerHTML = settingsCard(); bindSettings(); const cl = $("lclose"); if (cl) cl.onclick = closeAccount; }
function bindSettings(){
  { const sg = $("themeseg"); if (sg) { const cur = () => { let v = "auto"; try { v = localStorage.getItem("skibeen.theme") || "auto"; } catch(e){} return v; }, mark = () => sg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === cur())); mark(); sg.onclick = e => { const b = e.target.closest("button"); if (!b) return; try { localStorage.setItem("skibeen.theme", b.dataset.v); } catch(e){} applyTheme(); mark(); }; } }
  { const tb = $("tourbtn"); if (tb) tb.onclick = () => { closeAccount(); startTour(true); }; }
  { const bb = $("bugbtn"); if (bb) bb.onclick = openBugReport; }
  { const sg = $("mlseg"); if (sg) { const mark = () => sg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === (mlOn ? "1" : "0"))); mark(); sg.onclick = e => { const b = e.target.closest("button"); if (!b) return; mlSet(b.dataset.v === "1"); mark(); }; } }
  const ib = $("instset"); if (ib) ib.onclick = async () => { if (!(await doInstall())) $("instmsg").textContent = installText(); };
  const ls = $("langsel"); if (ls) { ls.value = LANG; ls.onchange = () => { try { localStorage.setItem("skibeen.lang", ls.value); } catch(e){} location.reload(); }; }
}
/* opinie społeczności (Supabase: get_place_opinions + opinion_likes) */
const OPN = {}, OPS = {sort: "likes"};
let RATE = {w: {}, s: {}}, RATEH = {}, rateT = 0;
const opKey = id => MODE + "|" + id;
const fmtAvg = a => (Math.round(a * 10) / 10).toFixed(1).replace(".", ",");
async function loadRatings(force){
  if (!(SBC && store && store.sb)) return; if (!force && Date.now() - rateT < 300000) return; rateT = Date.now();
  try { const out = {w: {}, s: {}};
    await Promise.all(["w", "s"].map(async md => { const r = await store.sb.rpc("get_place_ratings", {md}); if (r.error || !r.data) return; r.data.forEach(x => { out[md][x.place_id] = {a: +x.avg_rating, n: +x.n}; }); }));
    const rh = await store.sb.rpc("get_hike_ratings"); const oh = {}; if (!rh.error && rh.data) rh.data.forEach(x => { (oh[x.place_id] = oh[x.place_id] || {})[x.hike] = {a: +x.avg_rating, n: +x.n}; });
    RATE = out; RATEH = oh; renderList(); if (curId) renderSheet();
  } catch(e){}
}
const RKOPEN = {}; let COMP = null, compT = 0; let COM = {w: null, s: null}, comT = {w: 0, s: 0}, statScope = (() => { try { return localStorage.getItem("sht_rks") === "c" ? "c" : "m"; } catch (e) { return "m"; } })();
async function loadCommunity(force){
  const md = MODE; if (!(SBC && store && store.sb)) return; if (!force && COM[md] && Date.now() - comT[md] < 300000) return; comT[md] = Date.now();
  try { const r = await store.sb.rpc("get_community_stats", {md}); if (r.error) throw r.error; const o = {}; (r.data || []).forEach(x => { o[x.place_id] = {v: +x.visited, p: +x.planned}; }); COM[md] = o; }
  catch (e) { COM[md] = {err: 1}; }
  if (md === "s" && (force || !COMP || Date.now() - compT > 300000)) { compT = Date.now(); try { const r = await store.sb.rpc("get_community_pies"); if (r.error) throw r.error; COMP = (r.data || []).map(x => ({n: x.pie, pid: x.place_id, a: x.avg_rating == null ? null : +x.avg_rating, nr: +x.n_rated, ate: +x.n_ate})); } catch (e) { COMP = {err: 1}; } }
  if (statScope === "c" && $("v-statystyki").classList.contains("on") && MODE === md) renderStats();
}
const rateOf = id => (RATE[MODE] || {})[id];
function ratingLine(id){ const q = rateOf(id); return q && q.n ? `<span style="color:var(--warn)">★ ${fmtAvg(q.a)}</span> <span class="small">(${q.n} ${plur(q.n, "ocena", "oceny", "ocen")})</span>` : ""; }
function opinionsHtml(id){
  const o = OPN[opKey(id)]; if (!o) return "";
  const fr = (store.friends || []).map(x => String(x).toLowerCase());
  const base = o.list.filter(x => x.author !== store.uid && !fr.includes(String(x.username).toLowerCase()));
  const hasFr = !!friendsHtml(id), sel = base.length > 1 ? `<select id="opsort" style="font:inherit;font-size:12px;padding:2px 4px;border-radius:8px;background:var(--bg2);color:var(--text);border:1px solid rgba(255,255,255,.2)"><option value="likes"${OPS.sort === "likes" ? " selected" : ""}>Najpopularniejsze</option><option value="new"${OPS.sort === "new" ? " selected" : ""}>Najnowsze</option></select>` : "", head = `<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 4px"><span class="small" style="font-weight:700">${hasFr ? "Pozostali" : "Wszyscy"}${base.length ? " (" + base.length + ")" : ""}</span>${sel}</div>`;
  if (!base.length) return `<div>${head}<div class="small">${rateOf(id) ? "Brak opinii z tekstem." : "Jeszcze nikt nie dodał opinii."} Po wizycie dodaj gwiazdki i notatkę, a pojawią się tutaj.</div></div>`;
  const L = base.slice().sort(OPS.sort === "new" ? (a, b) => String(b.last_visit || "").localeCompare(String(a.last_visit || "")) || b.likes - a.likes : (a, b) => b.likes - a.likes || String(b.last_visit || "").localeCompare(String(a.last_visit || "")));
  const n = o.shown || 3, V = L.slice(0, n);
  return `<div>${head}${V.map(x => { const lv = String(x.last_visit || ""), ym = /^(\d{4})-(\d{2})$/.exec(lv); return `<div class="frow" style="align-items:flex-start;gap:8px"><div style="min-width:0;flex:1"><b class="nick" data-u="${esc(x.username)}">@${esc(x.username)}</b>${x.rating ? ` <span style="color:var(--warn)">${"★".repeat(x.rating)}</span>` : ""}${ym ? ` <span class="small">${esc(fmtYM(ym[1], ym[2] === "00" ? "" : ym[2]))}</span>` : (lv.length === 4 ? ` <span class="small">${esc(lv)}</span>` : "")}${x.note ? `<div class="small" style="white-space:pre-wrap;margin-top:2px">${esc(x.note)}</div>` : ""}</div><button class="btn sm opl ${x.liked ? "pri" : ""}" data-a="${esc(x.author)}">♥ ${x.likes}</button></div>`; }).join("")}${L.length > n ? `<button class="btn sm opmore" style="margin-top:6px">Pokaż kolejne (${L.length - n})</button>` : ""}</div>`;
}
function friendsHtml(id){
  const r = byId[id], W = MODE === "w", v = visits[id]; if (!r || RO) return "";
  const fa = friendsAt(id), fp = friendsPlan(id); if (!fa.length && !fp.length) return "";
  const meV = !!(v && v.s === "v"), meP = !!(v && v.s === "p"), n = new Set([...fa, ...fp].map(x => x.u)).size;
  const av = (u, c) => `<span class="av" style="--c:${c}">${esc(String(u).charAt(0).toUpperCase())}</span>`;
  const nk = x => `<b class="nick" data-u="${esc(x.u)}">@${esc(x.u)}</b>${x.e.pd ? ` <span class="small">${esc(fmtPd(x.e.pd))}</span>` : ""}`;
  const ban = fp.length ? `<div class="frban${meP ? "" : " plain"}"><span class="fi">${meP ? "🤝" : "🗓"}</span><div><b>${meP ? "Planujecie razem" : "Chcą tu pojechać"}</b><div class="small">${fp.map(nk).join(", ")}</div></div></div>` : "";
  const col = meV ? "#9aa6b2" : "#38e0a0";
  const rows = fa.map(x => { const lk = ((OPN[opKey(id)] || {}).list || []).find(z => String(z.username).toLowerCase() === String(x.u).toLowerCase()), ys = [...new Set((x.e.stays || []).map(k => k.y).filter(Boolean))].sort().join(", "), hd = x.e.done ? Object.keys(x.e.done).length : 0, nt = (x.e.n || "").trim();
    return `<div class="frp">${av(x.u, col)}<div class="frm"><div><b class="nick" data-u="${esc(x.u)}">@${esc(x.u)}</b> <span class="small">${esc(ys)}${!W && hd ? (ys ? " · " : "") + hd + " " + plur(hd, "szlak", "szlaki", "szlaków") : ""}</span>${x.e.r ? ` <span style="color:var(--warn)">${"★".repeat(x.e.r)}</span>` : ""}</div>${nt ? `<div class="small" data-nt style="white-space:pre-wrap;margin-top:2px">${IC.note} ${esc(nt.length > 160 ? nt.slice(0, 159) + "…" : nt)}</div>` : ""}${W ? "" : Object.keys(x.e.done || {}).map(i => { const h = r.hikes[i]; if (!h) return ""; const st = (x.e.hr && x.e.hr[i]) || 0, hn = ((x.e.hn && x.e.hn[i]) || "").trim(); return `<div class="small" style="margin-top:4px"><b>${esc(h.n)}</b> ${st ? `<span style="color:var(--warn)">${"★".repeat(st)}</span>` : ""}${hn ? `<div data-nt style="white-space:pre-wrap">${IC.note} ${esc(hn.length > 160 ? hn.slice(0, 159) + "…" : hn)}</div>` : ""}</div>`; }).join("")}</div>${lk ? `<button class="btn sm opl ${lk.liked ? "pri" : ""}" data-a="${esc(lk.author)}" style="flex:none">♥ ${lk.likes}</button>` : ""}</div>`; }).join("");
  const inner = ban + (rows ? (fp.length ? `<div class="small frh" style="margin:6px 0 2px">Byli</div>` : "") + rows : "");
  return meV ? `<details class="frdet"><summary>${IC.users} Znajomi w tym miejscu · ${n}</summary><div class="frcard">${inner}</div></details>` : `<div class="frcard"><div class="small frh">${IC.users} Znajomi</div>${inner}</div>`;
}
function bindOpinions(id){
  document.querySelectorAll("#opfr .opl, #opsec .opl").forEach(b => b.onclick = () => likeOpinion(id, b.dataset.a));
  const m = document.querySelector("#opsec .opmore"); if (m) m.onclick = () => { const o = OPN[opKey(id)]; o.shown = (o.shown || 3) + 5; paintOpinions(id); };
  const so = $("opsort"); if (so) so.onchange = () => { OPS.sort = so.value; const o = OPN[opKey(id)]; if (o) o.shown = 3; paintOpinions(id); };
}
function paintOpinions(id){ if (curId !== id) return; const b = $("opsec"); if (!b) return; const f = $("opfr"); if (f) f.innerHTML = friendsHtml(id); b.innerHTML = opinionsHtml(id); bindOpinions(id); }
async function loadOpinions(id){
  const k = opKey(id), o = OPN[k]; if (o && Date.now() - o.t < 60000) { bindOpinions(id); return; }
  try { const r = await store.sb.rpc("get_place_opinions", {pid: id, md: MODE}); if (r.error) throw r.error;
    OPN[k] = {t: Date.now(), list: (r.data || []).map(x => Object.assign({}, x, {likes: +x.likes || 0})), shown: o ? o.shown : 3};
  } catch(e){ return; }
  paintOpinions(id);
}
async function likeOpinion(id, author){
  if (!store.authed) { openAccount(); return; }
  if (author === store.uid) return;
  const o = OPN[opKey(id)], x = o && o.list.find(y => y.author === author); if (!x) return;
  const was = x.liked; x.liked = !was; x.likes += x.liked ? 1 : -1; paintOpinions(id);
  try { const r = x.liked ? await store.sb.from("opinion_likes").insert({author, place_id: id, mode: MODE, liker: store.uid}) : await store.sb.from("opinion_likes").delete().eq("author", author).eq("place_id", id).eq("mode", MODE).eq("liker", store.uid);
    if (r && r.error) throw r.error; }
  catch(e){ x.liked = was; x.likes += was ? 1 : -1; paintOpinions(id); }
}
function hideNickPop(){ const p = $("nickpop"); if (p) p.style.display = "none"; }
function showNickPop(el, u){
  let p = $("nickpop"); if (!p) { p = document.createElement("div"); p.id = "nickpop"; document.body.append(p); }
  const lu = String(u).toLowerCase(), isFr = SOC.friends.includes(lu), pend = SOC.outReq.some(r => r.to_name === lu), canF = !!(store.authed && store.sb && lu !== String((store.prof && store.prof.username) || "").toLowerCase());
  p.innerHTML = `<div class="nh">@${esc(u)}</div><button data-a="p">${IC.user} Profil</button>${canF ? `<button data-a="f">${isFr ? "✕ Przestań obserwować" : pend ? "✕ Anuluj prośbę" : "+ Obserwuj"}</button>` : ""}`;
  p.style.display = "flex";
  const r = el.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
  p.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + "px";
  p.style.top = (r.bottom + 6 + h > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + "px";
  p.onclick = async e => { const b = e.target.closest("button"); if (!b) return; hideNickPop();
    if (b.dataset.a === "p") openProfile(u);
    else { if (isFr || pend) await socAct("remove_friend", {uname: lu}); else await sendFriendReq(lu); await socLoad(); try { await loadFriendsData(); } catch(e){} if (curId) renderSheet(); renderList(); } };
}
document.addEventListener("click", e => { const n = e.target.closest && e.target.closest(".nick"); if (n) { e.stopPropagation(); showNickPop(n, n.dataset.u); return; } if (!e.target.closest || !e.target.closest("#nickpop")) hideNickPop(); }, true);
function openHikeReport(r, h){
  if (!store.authed) { alert("Zaloguj się, żeby zgłaszać błędy."); return; }
  const T = [["time", "Zły czas lub dystans"], ["diff", "Zła trudność"], ["close", "Szlak zamknięty / wyłączony"], ["desc", "Błędny opis"], ["name", "Zła nazwa"], ["other", "Inny problem"]], DF = ["łatwa", "średnia", "trudna"];
  ovBox().innerHTML = `<div class="card" style="width:min(440px,94vw)"><h3>Zgłoś błąd w szlaku</h3><div class="sub"><b>${esc(h.n)}</b> · ${esc(r.n)}</div>
    <div class="fld"><label>CO JEST NIE TAK</label><select id="hrt" class="sel">${T.map(x => `<option value="${x[0]}">${esc(x[1])}</option>`).join("")}</select></div>
    <div id="hrf"></div>
    <div class="fld"><label id="hrxl">DODATKOWA UWAGA (OPCJONALNIE)</label><textarea id="hrx" class="lin" rows="2" maxlength="80" placeholder="np. zimą szlak bywa zamknięty"></textarea></div><div class="small" id="hrm" style="min-height:16px"></div>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn" id="hrc" style="flex:1">Anuluj</button><button class="btn pri" id="hrs" style="flex:2">Wyślij</button></div></div>`;
  const draw = () => { const k = $("hrt").value; $("hrm").textContent = "";
    $("hrf").innerHTML = k === "time" ? `<div style="display:flex;gap:8px"><div class="fld" style="flex:1"><label>PRAWIDŁOWY CZAS</label><input id="hf_t" class="lin" value="${esc(h.t || "")}" placeholder="np. 4–5 h" maxlength="20"></div><div class="fld" style="flex:1"><label>DYSTANS (KM)</label><input id="hf_km" class="lin" inputmode="decimal" value="${h.km || ""}" placeholder="np. 9" maxlength="5"></div></div>`
      : k === "diff" ? `<div class="fld"><label>PRAWIDŁOWA TRUDNOŚĆ</label><select id="hf_d" class="sel">${DF.map(x => `<option value="${x}" ${x === h.d ? "selected" : ""}>${x[0].toUpperCase() + x.slice(1)}</option>`).join("")}</select></div>`
      : k === "desc" ? `<div class="fld"><label>PRAWIDŁOWY OPIS</label><textarea id="hf_o" class="lin" rows="4" maxlength="200">${esc(h.o || "")}</textarea></div>`
      : k === "name" ? `<div class="fld"><label>PRAWIDŁOWA NAZWA</label><input id="hf_n" class="lin" value="${esc(h.n)}" maxlength="70"></div>`
      : k === "close" ? `<div class="small" style="margin:2px 0 6px">Szlak zostanie ukryty po zatwierdzeniu zgłoszenia.</div>` : "";
    $("hrxl").textContent = k === "other" ? "OPISZ PROBLEM" : "DODATKOWA UWAGA (OPCJONALNIE)"; };
  $("hrt").onchange = draw; draw(); $("hrc").onclick = closeAccount;
  $("hrs").onclick = async () => { const k = $("hrt").value, m = $("hrm"), g = id => ($(id) ? $(id).value.trim() : ""), fix = {k: h.on || h.n}; let lab = T.find(x => x[0] === k)[1];
    if (k === "time") { const t = g("hf_t"), km = parseFloat(g("hf_km").replace(",", ".")); if (t && t !== (h.t || "")) fix.t = t.slice(0, 20); if (km > 0 && km <= 200 && km !== h.km) fix.km = Math.round(km * 10) / 10; if (!fix.t && !fix.km) { m.textContent = "Wpisz inny czas albo dystans."; return; } }
    else if (k === "diff") { const d = g("hf_d"); if (!d || d === h.d) { m.textContent = "Wybierz inną trudność niż obecna."; return; } fix.d = d; }
    else if (k === "desc") { const o = g("hf_o"); if (o.length < 5 || o === (h.o || "")) { m.textContent = "Wpisz poprawiony opis."; return; } fix.o = o.slice(0, 200); }
    else if (k === "name") { const n = g("hf_n"); if (n.length < 2 || n === h.n) { m.textContent = "Wpisz inną nazwę niż obecna."; return; } fix.n = n.slice(0, 70); }
    else if (k === "close") fix.del = 1;
    else if (g("hrx").length < 3) { m.textContent = "Opisz, co jest nie tak."; return; }
    const hasFix = k !== "other", ex = g("hrx"), tail = hasFix ? "##fix" + JSON.stringify(fix) : "", head = "#id:" + r.id + " · szlak „" + h.n.slice(0, 50) + "”: " + lab, room = 500 - tail.length - head.length - 3;
    const note = head + (ex && room > 8 ? " — " + ex.slice(0, room) : "") + tail;
    $("hrs").disabled = true; m.textContent = "Wysyłam…";
    try { const ins = await store.sb.from("suggestions").insert({user_id: store.uid, username: (store.prof && store.prof.username) || store.name || "", mode: "s", name: ("Szlak do poprawy: " + r.n).slice(0, 120), country: "", note}); if (ins && ins.error) throw ins.error; closeAccount(); toast("Dzięki! Zgłoszenie wysłane ✓"); } catch (e) { $("hrs").disabled = false; m.textContent = "Nie udało się: " + String((e && e.message) || e).slice(0, 90); } };
}
function askTosia(what){
  const t = prompt(what + "\n\nTo nieodwracalnie zmienia dane u wszystkich. Aby potwierdzić, wpisz imię psa małymi literami:");
  if (t === null) return false; if (t.trim() !== "tosia") { alert("Niepoprawne słowo. Nic nie zmieniono."); return false; } return true;
}
async function ovrApply(r, mode, mutate){
  const oid = "ovr:" + r.id; let prev = null; try { const pv = await store.sb.from("extra_places").select("data").eq("id", oid).maybeSingle(); prev = pv && pv.data && pv.data.data; } catch(e){}
  const data = mutate(Object.assign({}, prev || {}));
  const dl = await store.sb.from("extra_places").delete().eq("id", oid); if (dl && dl.error) throw dl.error;
  const ins = await store.sb.from("extra_places").insert({id: oid, mode, data}); if (ins && ins.error) throw ins.error;
  applyExtra([{id: oid, mode, data}]); try { localStorage.removeItem("skibeen.extra"); } catch(e){}
}
function openAddHike(r, pre){
  const p = pre || {}, adm = !!store.admin;
  ovBox().innerHTML = `<div class="card"><h3>Dodaj szlak: ${esc(r.n)}</h3><div class="sub">${adm ? "Jako admin dodajesz od razu, bez zatwierdzania." : "Zgłoszenie trafi do zatwierdzenia."}</div>
    <div class="fld"><label>NAZWA SZLAKU</label><input id="ahn" class="lin" value="${esc(p.n || "")}"></div>
    <div style="display:flex;gap:8px"><div class="fld" style="flex:1"><label>TRUDNOŚĆ</label><select id="ahd" class="sel"><option>łatwa</option><option ${p.d === "średnia" || !p.d ? "selected" : ""}>średnia</option><option ${p.d === "trudna" ? "selected" : ""}>trudna</option></select></div><div class="fld" style="flex:1"><label>CZAS</label><input id="aht" class="lin" placeholder="np. 3–4 h" value="${esc(p.t || "")}"></div></div>
    <div class="fld"><label>KRÓTKI OPIS (OPCJONALNIE)</label><textarea id="aho" class="lin" rows="2">${esc(p.o || "")}</textarea></div>
    <div class="small" id="ahm" style="min-height:16px"></div>
    <div style="display:flex;gap:8px"><button class="btn pri" id="ahsave" style="flex:1">${adm ? "Dodaj" : "Wyślij"}</button><button class="btn" id="lclose" style="flex:1">Anuluj</button></div></div>`;
  $("lclose").onclick = closeAccount;
  $("ahsave").onclick = async () => {
    const m = $("ahm"), h = {n: $("ahn").value.trim().slice(0, 100), d: $("ahd").value, t: $("aht").value.trim().slice(0, 30), o: $("aho").value.trim().slice(0, 300), s: ""};
    if (h.n.length < 2) { m.textContent = "Wpisz nazwę szlaku."; return; }
    $("ahsave").disabled = true; m.textContent = "Zapisuję…";
    try {
      if (adm) { const oid = "ovr:" + r.id; let prev = null; try { const pv = await store.sb.from("extra_places").select("data").eq("id", oid).maybeSingle(); prev = pv && pv.data && pv.data.data; } catch(e){}
        const data = Object.assign({}, prev || {}, {addHikes: [...((prev && prev.addHikes) || []), h]});
        const dl = await store.sb.from("extra_places").delete().eq("id", oid); if (dl && dl.error) throw dl.error;
        const ins = await store.sb.from("extra_places").insert({id: oid, mode: "s", data}); if (ins && ins.error) throw ins.error;
        applyExtra([{id: oid, mode: "s", data: {addHikes: [h]}}]); if (p.sid) await store.sb.from("suggestions").delete().eq("id", p.sid);
        try { localStorage.removeItem("skibeen.extra"); } catch(e){} renderAll(); m.textContent = "Dodano ✓"; }
      else { const ins = await store.sb.from("suggestions").insert({user_id: store.uid, username: (store.prof && store.prof.username) || store.name || "", mode: "s", name: ("Szlak: " + r.n).slice(0, 120), country: "", note: ("#id:" + r.id + " · szlak: " + [h.n, h.d, h.t, h.o].join("; ")).slice(0, 500)}); if (ins && ins.error) throw ins.error; m.textContent = "Dzięki! Zgłoszenie wysłane ✓"; $("ahsave").style.display = "none"; return; }
      setTimeout(closeAccount, 500);
    } catch(e){ $("ahsave").disabled = false; m.textContent = "Nie udało się: " + String((e && e.message) || e).slice(0, 90); }
  };
}
async function adminHidePlace(r){
  if (!askTosia("Usunięcie miejsca: " + r.n)) return;
  try { const ins = await store.sb.from("suggestions").insert({user_id: store.uid, username: (store.prof && store.prof.username) || store.name || "", mode: MODE, name: ("Usunięcie miejsca: " + r.n).slice(0, 120), country: "", note: ("#id:" + r.id + " · usuń miejsce").slice(0, 500)}); if (ins && ins.error) throw ins.error;
    closeSheet(); alert("Dodano do propozycji zmian. Usunięcie zatwierdzisz w panelu admina.");
  } catch(e){ alert("Nie udało się: " + String((e && e.message) || e).slice(0, 90)); }
}
function openEditPlace(r, pre){
  const W = MODE === "w", p = pre || {};
  ovBox().innerHTML = `<div class="card"><h3>Edytuj: ${esc(r.n)}</h3><div class="sub">Zmiana jest widoczna u wszystkich użytkowników.</div>
    <div class="fld"><label>NAZWA</label><input id="epn" class="lin" value="${esc(p.n || r.n)}"></div>
    ${W ? `<div style="display:flex;gap:8px"><div class="fld" style="flex:1"><label>KM TRAS</label><input id="epk" class="lin" inputmode="decimal" value="${p.k !== "" && p.k != null ? p.k : Math.round(r.k * 10) / 10}"></div><div class="fld" style="flex:1"><label>MAX WYSOKOŚĆ M</label><input id="epe" class="lin" inputmode="numeric" value="${p.e !== "" && p.e != null ? p.e : (r.e || "")}"></div></div><div class="fld"><label>STRONA OŚRODKA (URL)</label><input id="epw" class="lin" value="${esc(r.w || "")}" placeholder="https://…"></div><div class="fld"><label>KATEGORIA CEN</label><select id="ept" class="sel"><option value="0">Automatyczna (szacunek)</option>${[1,2,3,4].map(i => `<option value="${i}" ${r.pt === i ? "selected" : ""}>${"$".repeat(i)} ${PT_NAMES[i]}</option>`).join("")}</select></div>` : ""}
    <div class="small" id="epm" style="min-height:16px"></div>
    <div style="display:flex;gap:8px"><button class="btn pri" id="epsave" style="flex:1">Zapisz</button><button class="btn" id="lclose" style="flex:1">Anuluj</button></div>
    <button class="btn sm" id="eprev" style="margin-top:8px;width:100%">Przywróć oryginalne dane</button></div>`;
  $("lclose").onclick = closeAccount;
  const done = async () => { try { localStorage.removeItem("skibeen.extra"); } catch(e){} buildCountrySelect(); buildDots(); renderAll(); };
  $("epsave").onclick = async () => {
    const m = $("epm"), n = $("epn").value.trim().slice(0, 120); if (n.length < 2) { m.textContent = "Wpisz nazwę."; return; }
    const data = {n}; if (W) { const k = parseFloat($("epk").value.replace(",", ".")), e = parseInt($("epe").value), w = $("epw").value.trim(); if (k >= 0) data.k = k; if (e >= 0) data.e = e; if (/^https?:\/\//i.test(w)) data.w = w; data.pt = +($("ept") && $("ept").value) || 0; }
    $("epsave").disabled = true; m.textContent = "Zapisuję…";
    try { const oid = "ovr:" + r.id; let prevOv = null; try { const pv = await store.sb.from("extra_places").select("data").eq("id", oid).maybeSingle(); prevOv = pv && pv.data && pv.data.data; } catch(e){} const d = await store.sb.from("extra_places").delete().eq("id", oid); if (d && d.error) throw d.error;
      const ins = await store.sb.from("extra_places").insert({id: oid, mode: W ? "w" : "s", data: Object.assign({}, prevOv || {}, data)}); if (ins && ins.error) throw ins.error;
      applyExtra([{id: oid, mode: W ? "w" : "s", data}]); if (p.sid) await store.sb.from("suggestions").delete().eq("id", p.sid);
      await done(); m.textContent = "Zapisano ✓"; setTimeout(closeAccount, 500); }
    catch(e){ $("epsave").disabled = false; m.textContent = "Nie udało się: " + String((e && e.message) || e).slice(0, 90); }
  };
  $("eprev").onclick = async () => { if (!(await appConfirm("Usunąć wszystkie Twoje zmiany tego miejsca? Po odświeżeniu wróci oryginał."))) return; try { await store.sb.from("extra_places").delete().eq("id", "ovr:" + r.id); try { localStorage.removeItem("skibeen.extra"); } catch(e){} $("epm").textContent = "Przywrócono. Odśwież stronę (przycisk w koncie)."; } catch(e){ $("epm").textContent = "Błąd."; } };
}
function openSuggest(q, fix){
  const W = MODE === "w";
  if (!store.authed) { ovBox().innerHTML = `<div class="card"><h3>Zgłoś brakujące miejsce</h3><div class="sub">Zaloguj się, żeby zgłosić miejsce.</div><button class="btn" id="lclose" style="width:100%">Zamknij</button></div>`; $("lclose").onclick = closeAccount; return; }
  ovBox().innerHTML = `<div class="card"><h3>${fix ? "Zaproponuj poprawę" : "Zgłoś brakujące miejsce"}</h3><div class="sub">${fix ? "Podaj poprawne wartości dla: <b>" + esc(fix.n) + "</b>. Obecnie: " + (W ? Math.round(fix.k || 0) + " km tras, " + (fix.e || "?") + " m." : "") : "Nie ma " + (W ? "ośrodka" : "miejsca") + ", którego szukasz? Napisz, co dodać. Zobaczę to i dopiszę."}</div><div class="fld"${fix ? ' style="display:none"' : ""}><label>NAZWA</label><div style="display:flex;gap:8px"><input id="sgn" class="lin" style="flex:1" value="${esc(q || "")}" placeholder="${W ? "np. nazwa ośrodka" : "np. nazwa miejscowości"}">${fix ? "" : `<button type="button" class="btn pri" id="sgfind">Znajdź</button>`}</div><div class="small" id="sgres" style="min-height:16px;margin-top:6px"></div>${fix ? "" : `<button type="button" class="wpskip" id="sgman" style="margin:4px 0 0;text-align:left">Wpisz współrzędne ręcznie</button><div id="sgxy" style="display:none;gap:8px;margin-top:6px"><input id="sgy" class="lin" inputmode="decimal" placeholder="szerokość, np. 46.02" style="flex:1"><input id="sgx" class="lin" inputmode="decimal" placeholder="długość, np. 7.74" style="flex:1"></div>`}</div><div class="fld"${fix ? ' style="display:none"' : ""}><label>KRAJ / REGION</label><input id="sgc" class="lin" placeholder="np. Włochy, Dolomity"></div>${W ? `<div style="display:flex;gap:8px"><div class="fld" style="flex:1"><label>KM TRAS (OPCJONALNIE)</label><input id="sgk" class="lin" inputmode="decimal" placeholder="np. 120"></div><div class="fld" style="flex:1"><label>MAX WYSOKOŚĆ M (OPC.)</label><input id="sge" class="lin" inputmode="numeric" placeholder="np. 2800"></div></div>` : ""}<div class="fld"><label>UWAGA (OPCJONALNIE)</label><textarea id="sgt" class="lin" rows="2" placeholder="np. link do strony, ile km tras"></textarea></div><div class="small" id="sgm" style="min-height:16px"></div><div style="display:flex;gap:8px"><button class="btn pri" id="sgsend" style="flex:1">Wyślij</button><button class="btn" id="lclose" style="flex:1">Zamknij</button></div></div>`;
  if (fix) { const f = document.createElement("div"); f.className = "fld"; f.innerHTML = `<label>NOWA NAZWA (OPCJONALNIE)</label><input id="sgnn" class="lin" placeholder="np. poprawna nazwa ośrodka">`; $("sgt").parentElement.before(f); }
  $("lclose").onclick = closeAccount;
  let xy = null;
  const sgFind = async () => { const nq = $("sgn").value.trim(), res = $("sgres"); if (nq.length < 2) return; res.textContent = "Szukam…"; xy = null;
    try { const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&accept-language=pl&q=" + encodeURIComponent(nq)); const j = await r.json();
      if (!j.length) { res.textContent = "Nic nie znaleziono. Wpisz nazwę i kraj ręcznie."; return; }
      res.innerHTML = j.map((p, k) => `<div class="frow" style="align-items:flex-start"><span style="min-width:0">${esc(String(p.display_name).slice(0, 100))}</span><button type="button" class="btn sm pri sguse" data-k="${k}">To to</button></div>`).join("");
      res.querySelectorAll(".sguse").forEach(b => b.onclick = () => { const p = j[+b.dataset.k], a = p.address || {}; xy = {lat: (+p.lat).toFixed(4), lon: (+p.lon).toFixed(4), cc: String(a.country_code || "").toUpperCase()};
        if (p.name) $("sgn").value = p.name; $("sgc").value = [a.country, a.state || a.region || a.county].filter(Boolean).join(", ").slice(0, 120); res.textContent = "Wybrano: " + String(p.display_name).slice(0, 90) + " ✓"; });
    } catch (e) { res.textContent = "Nie udało się połączyć. Wpisz nazwę i kraj ręcznie."; } };
  if ($("sgman")) $("sgman").onclick = () => { const b = $("sgxy"); b.style.display = b.style.display === "none" ? "flex" : "none"; if (b.style.display === "flex") $("sgy").focus(); };
  const manXY = () => { if (!$("sgy")) return null; const y = parseFloat($("sgy").value.replace(",", ".")), x = parseFloat($("sgx").value.replace(",", ".")); return (isFinite(y) && isFinite(x) && Math.abs(y) <= 90 && Math.abs(x) <= 180) ? {lat: y.toFixed(4), lon: x.toFixed(4), cc: "", man: 1} : null; };
  if ($("sgfind")) { $("sgfind").onclick = sgFind; $("sgn").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); sgFind(); } }); }
  $("sgsend").onclick = async () => {
    const n = $("sgn").value.trim(), m = $("sgm"); if (n.length < 2) { m.textContent = "Wpisz nazwę."; return; }
    if (fix && !($("sgk") && $("sgk").value.trim()) && !($("sge") && $("sge").value.trim()) && !($("sgnn") && $("sgnn").value.trim()) && !$("sgt").value.trim()) { m.textContent = "Wpisz nową nazwę, poprawne km, wysokość albo uwagę."; return; }
    $("sgsend").disabled = true; m.textContent = "Wysyłam…";
    try { const r = await store.sb.from("suggestions").insert({user_id: store.uid, username: (store.prof && store.prof.username) || store.name || "", mode: MODE, name: (fix ? "Poprawka: " : "") + n.slice(0,112), country: $("sgc").value.trim().slice(0,120), note: [fix ? "#id:" + fix.id : "", ($("sgnn") && $("sgnn").value.trim()) ? "nazwa: " + $("sgnn").value.trim().slice(0,100) : "", (W && $("sgk") && $("sgk").value.trim()) ? "km: " + $("sgk").value.trim().replace(",", ".") : "", (W && $("sge") && $("sge").value.trim()) ? "wys.: " + $("sge").value.trim() + " m" : "", (() => { const c = fix ? null : (manXY() || xy); return c ? "#xy:" + c.lat + "," + c.lon + (c.cc ? " #cc:" + c.cc : "") + (c.man ? " #src:manual" : " #src:auto") : ""; })(), $("sgt").value.trim()].filter(Boolean).join(" · ").slice(0,500)});
      if (r && r.error) throw r.error; m.textContent = "Dzięki! Zgłoszenie wysłane ✓"; $("sgsend").style.display = "none"; }
    catch(e){ $("sgsend").disabled = false; m.textContent = "Nie udało się wysłać: " + String((e && e.message) || e).slice(0,80); }
  };
}
async function openAdmin(){
  ovBox().innerHTML = `<div class="card"><h3>Zgłoszone miejsca</h3><button class="btn pri" id="anew" style="width:100%;margin-bottom:10px">+ Dodaj nowe miejsce</button><div class="small" id="adl">Wczytuję…</div><div id="aex"></div><button class="btn" id="lclose" style="width:100%;margin-top:10px">Zamknij</button></div>`; $("lclose").onclick = closeAccount; $("anew").onclick = () => openAddPlace(null);
  try { const ex = await store.sb.from("extra_places").select("id,mode,data,created_at").order("created_at", {ascending: false}).limit(20); if (!ex.error && (ex.data || []).length) { $("aex").innerHTML = `<details style="margin:10px 0"><summary class="small" style="font-weight:700;cursor:pointer;padding:6px 2px">Historia zmian (ostatnie ${ex.data.length}) ▾</summary>` + ex.data.map(x => { const ov = String(x.id).startsWith("ovr:"); return `<div class="frow"><span>${ov ? (x.data.hidden ? "🚫 ukryty: " : "✎ zmieniony: ") : ""}${esc(x.data.n)} <span class="small">${x.mode === "s" ? "lato" : "zima"}${ov ? "" : " · " + esc(x.data.c || "")}</span></span><button class="btn sm bad aexdel" data-ov="${ov ? 1 : ""}" data-id="${esc(x.id)}">${ov ? "Cofnij" : "Usuń"}</button></div>`; }).join("") + "</details>"; document.querySelectorAll(".aexdel").forEach(b => b.onclick = async () => { if (!confirm(b.dataset.ov ? "Cofnąć tę zmianę? Oryginalne dane wrócą po odświeżeniu strony." : "Usunąć to miejsce z bazy? Zniknie u wszystkich.")) return; b.disabled = true; const d = await store.sb.from("extra_places").delete().eq("id", b.dataset.id); if (!(d && d.error)) { try { localStorage.removeItem("skibeen.extra"); } catch(e){} b.closest(".frow").remove(); } }); } } catch(e){}
  try { const r = await store.sb.from("suggestions").select("*").order("created_at", {ascending: false}).limit(200); if (r.error) throw r.error;
    const a = r.data || [], box = $("adl");
    const fixOf = x => { const n = x.note || "", i = n.indexOf("##fix"); if (i < 0) return null; try { return JSON.parse(n.slice(i + 5)); } catch (e) { return null; } };
    const pidOf = x => { const m = /#id:(\S+)/.exec(x.note || ""); return m ? m[1] : ""; };
    const pfOf = x => { const n = x.note || "", mk = /km:\s*([\d.,]+)/i.exec(n), me = /wys\.?:\s*(\d+)/i.exec(n), mn = /nazwa:\s*([^·]+)/i.exec(n), id = pidOf(x), rr = id && (byIdW[id] || byIdS[id]); if (!rr) return null; const o = {rr}; if (mn && mn[1].trim()) o.n = mn[1].trim().slice(0, 100); if (mk) { const k = parseFloat(mk[1].replace(",", ".")); if (k > 0 && k < 5000) o.k = k; } if (me) { const e = parseInt(me[1]); if (e > 0 && e < 9000) o.e = e; } return (o.n || o.k != null || o.e != null) ? o : null; };
    const DL = {t: "Czas", km: "Dystans", d: "Trudność", o: "Opis", n: "Nazwa"};
    const dif = (lab, a, b) => `<div><span class="small">${lab}:</span> <s>${esc(String(a == null || a === "" ? "—" : a))}</s> → <b>${esc(String(b))}</b></div>`;
    const rowAcc = x => { let kind = "", lines = "", title = "";
      if (/^Szlak do poprawy:/.test(x.name)) { const f = fixOf(x), rr = byIdS[pidOf(x)]; if (!f) return ""; const h = rr && rr.hikes && rr.hikes.find(z => (z.on || z.n) === f.k && !z.del); title = "Szlak „" + (h ? h.n : f.k) + "” · " + (rr ? rr.n : "?");
        if (!h) { kind = "stale"; lines = `<div class="small">Nie znaleziono tego szlaku (zmieniony lub usunięty).</div>`; } else { kind = "hf"; lines = f.del ? `<div><b>Zamknąć i ukryć ten szlak</b></div>` : ["t", "km", "d", "o", "n"].filter(k => f[k] != null).map(k => dif(DL[k], h[k], f[k])).join(""); } }
      else if (/^Poprawka:/.test(x.name)) { const q = pfOf(x); if (!q) return ""; kind = "pf"; title = q.rr.n; lines = (q.n ? dif("Nazwa", q.rr.n, q.n) : "") + (q.k != null && byIdW[q.rr.id] ? dif("Km tras", Math.round(q.rr.k * 10) / 10, q.k) : "") + (q.e != null && byIdW[q.rr.id] ? dif("Wysokość", q.rr.e ? q.rr.e + " m" : "", q.e + " m") : ""); if (!lines) return ""; }
      else return "";
      const n0 = String(x.note || ""), ex = (/ — ([^#]*?)(##fix|$)/.exec(n0) || [])[1];
      return `<div class="frow" style="align-items:flex-start" data-id="${esc(x.id)}"><div style="min-width:0"><b>${esc(title)}</b> <span class="small">${x.mode === "s" ? "lato" : "zima"}</span><div class="afd">${lines}</div>${ex && ex.trim() ? `<div class="small">Uwaga: ${esc(ex.trim())}</div>` : ""}<div class="small">od @${esc(x.username || "?")} · ${esc(String(x.created_at || "").slice(0, 10))}</div></div><span style="display:flex;gap:6px;flex-direction:column">${kind === "stale" ? "" : `<button class="btn sm pri aacc" data-i="${esc(x.id)}">Akceptuj</button>`}<button class="btn sm bad adel" data-id="${esc(x.id)}">Odrzuć</button></span></div>`; };
    const acceptSg = async x => { if (/^Szlak do poprawy:/.test(x.name)) { const f = fixOf(x), rr = byIdS[pidOf(x)]; if (!f || !rr) throw new Error("brak szlaku");
        if (f.del) { if (!(await appConfirm("Zamknąć i ukryć ten szlak u wszystkich?"))) return false; await ovrApply(rr, "s", d => { d.delHikes = [...(d.delHikes || []), f.k]; return d; }); }
        else { const e = {}; if (f.t) e.t = String(f.t).slice(0, 20); if (f.km > 0 && f.km <= 200) e.km = +f.km; if (["łatwa", "średnia", "trudna"].includes(f.d)) e.d = f.d; if (f.o) e.o = String(f.o).slice(0, 200); if (f.n) e.n = String(f.n).slice(0, 70); await ovrApply(rr, "s", d => { d.editHikes = Object.assign({}, d.editHikes); d.editHikes[f.k] = Object.assign({}, d.editHikes[f.k], e); return d; }); } }
      else { const q = pfOf(x); if (!q) throw new Error("brak miejsca"); const mode = byIdW[q.rr.id] ? "w" : "s"; await ovrApply(q.rr, mode, d => { if (q.n) d.n = q.n; if (mode === "w") { if (q.k != null) d.k = q.k; if (q.e != null) d.e = q.e; } return d; }); }
      await store.sb.from("suggestions").delete().eq("id", x.id); return true; };
    box.innerHTML = a.length ? a.map(x => rowAcc(x) || `<div class="frow" style="align-items:flex-start" data-id="${esc(x.id)}"><div style="min-width:0"><b>${esc(x.name)}</b> <span class="small">${x.mode === "s" ? "lato" : "zima"}${x.country ? " · " + esc(x.country) : ""}</span>${x.note ? `<div class="small" style="white-space:pre-wrap">${esc(String(x.note).replace(/ ?#(xy|cc|src):\S+/g, "").trim())}</div>` : ""}${/#xy:/.test(x.note || "") ? `<div class="small" style="color:${/#src:manual/.test(x.note) ? "var(--warn)" : "var(--accent)"}">${/#src:manual/.test(x.note) ? "✎ współrzędne wpisane ręcznie przez użytkownika: sprawdź na podglądzie" : "📍 współrzędne znalezione automatycznie"}</div>` : ""}<div class="small"><a href="https://www.google.com/maps/search/${encodeURIComponent((x.name || "").replace(/^(Szlak|Poprawka|Usunięcie[^:]*): /, "") + " " + (x.country || ""))}" target="_blank" rel="noopener" style="color:var(--accent)">Znajdź na mapie ↗</a></div><div class="small">od @${esc(x.username || "?")} · ${esc(String(x.created_at || "").slice(0,10))}</div></div><span style="display:flex;gap:6px;flex-direction:column"><button class="btn sm pri ${/^Poprawka:/.test(x.name) ? "afix" : /^Szlak:/.test(x.name) ? "ahk" : /^Usunięcie/.test(x.name) ? "adok" : "aadd"}" data-i="${esc(x.id)}">${/^Poprawka:/.test(x.name) ? "Zastosuj" : /^Szlak:/.test(x.name) ? "Zatwierdź" : /^Usunięcie/.test(x.name) ? "Usuń" : "Dodaj"}</button><button class="btn sm bad adel" data-id="${esc(x.id)}">Usuń</button></span></div>`).join("") : "Brak zgłoszeń.";
    box.querySelectorAll(".aacc").forEach(b => b.onclick = async () => { const x = a.find(y => String(y.id) === b.dataset.i); b.disabled = true;
      try { const ok = await acceptSg(x); if (ok === false) { b.disabled = false; return; } try { localStorage.removeItem("skibeen.extra"); } catch (e) {} buildCountrySelect(); buildDots(); renderAll(); b.closest(".frow").remove(); toast("Zaakceptowano ✓"); }
      catch (e) { b.disabled = false; alert("Nie udało się: " + String((e && e.message) || e).slice(0, 90)); } });
    box.querySelectorAll(".afix").forEach(b => b.onclick = () => { const x = a.find(y => String(y.id) === b.dataset.i), pid = /#id:(\S+)/.exec(x.note || ""), mk = /km:\s*([\d.,]+)/i.exec(x.note || ""), me = /wys\.?:\s*(\d+)/i.exec(x.note || ""), mn = /nazwa:\s*([^·]+)/i.exec(x.note || "");
      const rr = pid && (byIdW[pid[1]] || byIdS[pid[1]]); if (!rr) { alert("Nie znaleziono tego miejsca. Popraw ręcznie lub usuń zgłoszenie."); return; }
      openEditPlace(rr, {n: mn ? mn[1].trim() : "", k: mk ? parseFloat(mk[1].replace(",", ".")) : "", e: me ? parseInt(me[1]) : "", sid: x.id}); });
    box.querySelectorAll(".ahk").forEach(b => b.onclick = () => { const x = a.find(y => String(y.id) === b.dataset.i), pid = /#id:(\S+)/.exec(x.note || ""), t = /szlak:\s*(.*)$/i.exec(x.note || ""), rr = pid && byIdS[pid[1]]; if (!rr || !t) { alert("Nie znaleziono miejsca lub szlaku."); return; }
      const q = t[1].split(";").map(z => z.trim()); const prevM = MODE; openAddHike(rr, {n: q[0], d: q[1], t: q[2], o: q.slice(3).join("; "), sid: x.id}); });
    box.querySelectorAll(".adok").forEach(b => b.onclick = async () => { const x = a.find(y => String(y.id) === b.dataset.i), pid = /#id:(\S+)/.exec(x.note || ""), th = /usuń szlak:\s*(.*)$/i.exec(x.note || ""), isP = /usuń miejsce/i.test(x.note || "");
      const isS = /^Usunięcie szlaku/.test(x.name), rr = pid && (isS ? byIdS[pid[1]] : (byIdW[pid[1]] || byIdS[pid[1]])); if (!rr || (isS && !th)) { alert("Nie znaleziono miejsca lub szlaku (może już usunięte). Usuń zgłoszenie."); return; }
      if (!askTosia((isS ? "ZATWIERDZENIE usunięcia szlaku „" + th[1].trim() + "” z: " : "ZATWIERDZENIE usunięcia miejsca: ") + rr.n)) return;
      b.disabled = true; const mode = byIdW[rr.id] ? "w" : "s";
      try { await ovrApply(rr, mode, d => { if (isS) d.delHikes = [...(d.delHikes || []), th[1].trim()]; else { d.hidden = true; d.n = d.n || rr.n; } return d; });
        await store.sb.from("suggestions").delete().eq("id", x.id); buildCountrySelect(); buildDots(); renderAll(); b.closest(".frow").remove();
      } catch(e){ b.disabled = false; alert("Nie udało się: " + String((e && e.message) || e).slice(0, 90)); } });
    box.querySelectorAll(".aadd").forEach(b => b.onclick = () => { const x = a.find(y => String(y.id) === b.dataset.i); openAddPlace(x); });
    box.querySelectorAll(".adel").forEach(b => b.onclick = async () => { b.disabled = true; const d = await store.sb.from("suggestions").delete().eq("id", b.dataset.id); if (!(d && d.error)) b.closest(".frow").remove(); });
  } catch(e){ $("adl").textContent = "Nie udało się wczytać: " + String((e && e.message) || e).slice(0,80); }
}
function openAddPlace(sg){
  const w0 = !(sg && sg.mode === "s");
  ovBox().innerHTML = `<div class="card"><h3>Dodaj miejsce</h3>
    <div class="fld"><label>TRYB</label><select class="sel" id="apm"><option value="w">Zima (ośrodek)</option><option value="s">Lato (miejsce do chodzenia)</option></select></div>
    <div class="fld"><label>NAZWA</label><div style="display:flex;gap:8px"><input id="apn" class="lin" value="${esc((sg && sg.name) || "")}" style="flex:1"><button class="btn pri" id="apg">Znajdź</button></div><div class="small" id="apmsg" style="min-height:16px">„Znajdź" wypełni kraj, region i współrzędne z OpenStreetMap. Możesz też wkleić „46.85, 9.53" w pole szerokości.</div><a class="small" id="apmap" target="_blank" rel="noopener" style="color:var(--accent)" href="#">Szukaj w Google Maps ↗</a></div>
    <div style="display:flex;gap:8px"><div class="fld" style="flex:1"><label>KRAJ (KOD)</label><input id="apc" class="lin" maxlength="2" placeholder="IT" value=""></div><div class="fld" style="flex:2"><label>REGION</label><input id="apr" class="lin"></div></div>
    <div style="display:flex;gap:8px"><div class="fld" style="flex:1"><label>SZEROKOŚĆ (LAT)</label><input id="apy" class="lin" inputmode="decimal"></div><div class="fld" style="flex:1"><label>DŁUGOŚĆ (LON)</label><input id="apx" class="lin" inputmode="decimal"></div></div>
    <div id="apprev" style="display:none;margin:0 0 10px"><iframe id="apfr" title="Podgląd miejsca" loading="lazy" style="width:100%;height:150px;border:0;border-radius:12px;background:var(--bg2)"></iframe><div class="small" id="apsrc" style="margin-top:4px"></div></div>
    <div id="apw"><div style="display:flex;gap:8px"><div class="fld" style="flex:1"><label>KM TRAS</label><input id="apk" class="lin" inputmode="decimal"></div><div class="fld" style="flex:1"><label>MAX WYSOKOŚĆ (M)</label><input id="ape" class="lin" inputmode="numeric"></div></div><div class="fld"><label>STRONA WWW</label><input id="apu" class="lin" placeholder="https://"></div></div>
    <div id="aps" style="display:none"><div class="fld"><label>SZLAKI (JEDEN W LINII: nazwa; łatwa/średnia/trudna; czas; opis)</label><textarea id="aph" class="lin" rows="5" placeholder="Five Lakes Walk; średnia; 3–4 h; Pięć jezior z widokiem na Matterhorn"></textarea></div></div>
    <div class="small" id="apst" style="min-height:16px"></div>
    <div style="display:flex;gap:8px"><button class="btn pri" id="apsave" style="flex:1">Zapisz</button><button class="btn" id="apback" style="flex:1">Wstecz</button></div></div>`;
  const sync = () => { const s = $("apm").value === "s"; $("apw").style.display = s ? "none" : ""; $("aps").style.display = s ? "" : "none"; };
  $("apm").value = w0 ? "w" : "s"; $("apm").onchange = sync; sync();
  if (sg && sg.note) { const xm = /#xy:(-?[\d.]+),(-?[\d.]+)/.exec(sg.note), cm = /#cc:([A-Z]{2})/.exec(sg.note); if (xm) { $("apy").value = xm[1]; $("apx").value = xm[2]; } if (cm) $("apc").value = cm[1]; }
  if (sg && sg.note) { const mk = /km:\s*([\d.,]+)/i.exec(sg.note), me = /wys\.?:\s*(\d+)/i.exec(sg.note); if (mk) $("apk").value = mk[1].replace(",", "."); if (me) $("ape").value = me[1]; }
  $("apback").onclick = openAdmin;
  { let tm = 0; const prev = () => { clearTimeout(tm); tm = setTimeout(() => { const y = parseFloat($("apy").value.replace(",", ".")), x = parseFloat($("apx").value.replace(",", ".")), b = $("apprev"); if (!isFinite(y) || !isFinite(x)) { b.style.display = "none"; return; } b.style.display = "block"; const u = "https://www.openstreetmap.org/export/embed.html?bbox=" + [x - .03, y - .018, x + .03, y + .018].map(n => n.toFixed(5)).join("%2C") + "&layer=mapnik&marker=" + y + "%2C" + x; if ($("apfr").dataset.u !== u) { $("apfr").dataset.u = u; $("apfr").src = u; } }, 350); };
    $("apy").addEventListener("input", prev); $("apx").addEventListener("input", prev); window.__apPrev = prev; if ($("apy").value) prev();
    if (sg && sg.note && /#xy:/.test(sg.note)) { $("apsrc").style.color = /#src:manual/.test(sg.note) ? "var(--warn)" : "var(--accent)"; $("apsrc").textContent = /#src:manual/.test(sg.note) ? "✎ Współrzędne wpisane ręcznie przez użytkownika: sprawdź, czy pin trafia w miejsce." : "📍 Współrzędne znalezione automatycznie w OpenStreetMap."; } }
  { const upd = () => { const q = $("apn").value.trim(); $("apmap").href = "https://www.google.com/maps/search/" + encodeURIComponent(q + " " + ($("apc").value || "")); }; $("apn").addEventListener("input", upd); upd(); }
  { const pc = v => { const m = /(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)/.exec(v); if (m) { $("apy").value = m[1].replace(",", "."); $("apx").value = m[2].replace(",", "."); } };
    $("apy").addEventListener("paste", e => { const t = (e.clipboardData || window.clipboardData).getData("text"); if (/[,;\s]/.test(t.trim()) && /\d/.test(t)) { e.preventDefault(); pc(t); } });
    if (sg && sg.name && !$("apy").value && !(sg.note && /#xy:/.test(sg.note))) setTimeout(() => $("apg") && $("apg").click(), 150); }
  $("apg").onclick = async () => {
    const q = $("apn").value.trim(), m = $("apmsg"); if (q.length < 2) return; m.textContent = "Szukam…";
    try { const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&accept-language=en&q=" + encodeURIComponent(q)); const j = await r.json();
      if (!j.length) { m.textContent = "Nic nie znaleziono. Wpisz współrzędne ręcznie."; return; }
      m.innerHTML = j.map((p, k) => `<div class="frow" style="align-items:flex-start"><span style="min-width:0">${esc(String(p.display_name).slice(0, 110))}</span><button class="btn sm pri apuse" data-k="${k}">Użyj</button></div>`).join("");
      m.querySelectorAll(".apuse").forEach(b => b.onclick = () => { const p = j[+b.dataset.k], a = p.address || {};
        $("apy").value = (+p.lat).toFixed(4); $("apx").value = (+p.lon).toFixed(4);
        if (a.country_code) $("apc").value = a.country_code.toUpperCase(); $("apr").value = a.state || a.region || a.county || "";
        if (p.name) $("apn").value = p.name;
        m.textContent = "Użyto: " + String(p.display_name).slice(0, 90); $("apsrc").textContent = ""; window.__apPrev(); });
    } catch(e){ m.textContent = "Nie udało się połączyć. Wpisz dane ręcznie."; } };
  $("apsave").onclick = async () => {
    const st = $("apst"), n = $("apn").value.trim(), mode = $("apm").value, c = $("apc").value.trim().toUpperCase(), y = parseFloat($("apy").value), x = parseFloat($("apx").value);
    if (n.length < 2 || !/^[A-Z]{2}$/.test(c) || !isFinite(x) || !isFinite(y)) { st.textContent = "Uzupełnij nazwę, kod kraju (2 litery) i współrzędne."; return; }
    const d = {n, c, r: $("apr").value.trim(), x, y};
    if (mode === "w") { d.k = parseFloat($("apk").value) || 0; d.e = parseInt($("ape").value) || 0; d.w = $("apu").value.trim(); }
    else { d.hikes = $("aph").value.split("\n").map(l => l.trim()).filter(Boolean).map(l => { const p = l.split(";").map(z => z.trim()); return {n: p[0], d: ["łatwa","średnia","trudna"].includes(p[1]) ? p[1] : "średnia", t: p[2] || "", o: p.slice(3).join("; ") || "", s: ""}; }); }
    const id = "x-" + (mode === "s" ? "s-" : "w-") + n.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
    $("apsave").disabled = true; st.textContent = "Zapisuję…";
    try { const r = await store.sb.from("extra_places").insert({id, mode, data: d}); if (r && r.error) throw r.error;
      if (sg && sg.id !== undefined) { try { await store.sb.from("suggestions").delete().eq("id", sg.id); } catch(e){} }
      try { localStorage.removeItem("skibeen.extra"); } catch(e){}
      applyExtra([{id, mode, data: d}]); buildCountrySelect(); buildDots(); renderAll();
      st.textContent = "Dodano ✓ Miejsce jest już widoczne dla wszystkich."; $("apsave").style.display = "none"; $("apback").textContent = "Wróć do zgłoszeń";
    } catch(e){ $("apsave").disabled = false; st.textContent = "Nie udało się: " + String((e && e.message) || e).slice(0, 90); }
  };
}
function openFriends(){ SOC.ov = "friends"; ovBox().innerHTML = friendsCard(); bindFriends(); }
function openAccount(){
  SOC.ov = "";
  const ov = ovBox(); ov.innerHTML = accountCard(); ov.scrollTop = 0; bindAccount();
}
function closeAccount(){ SOC.ov = ""; const ov = $("acctov"); if (!ov || ov.style.display === "none" || ov.classList.contains("out")) return; clearTimeout(closeAccount._t); if (matchMedia("(prefers-reduced-motion: reduce)").matches) { ov.style.display = "none"; return; } ov.classList.remove("in"); ov.classList.add("out"); closeAccount._t = setTimeout(() => { ov.style.display = "none"; ov.classList.remove("out"); }, 170); }
function bindAccount(){
  const us = $("usave"); if (us) us.onclick = async () => {
    const u = ($("uname").value || "").trim().toLowerCase(), m = $("umsg");
    if (!/^[a-z0-9_-]{3,20}$/.test(u)) { m.textContent = "Nazwa: 3–20 znaków, małe litery, cyfry, _ lub -."; return; }
    if (await saveProf({username: u}, m)) { openAccount(); }
  };
  const up = $("upriv"); if (up) up.onclick = async e => { const b = e.target.closest("button"); if (!b) return; const pub = b.dataset.v === "1"; if (await saveProf({is_public: pub}, $("umsg"))) { up.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); $("uprivd").textContent = pub ? "Każdy może Cię obserwować i zobaczyć Twoją mapę." : "Obserwować Cię można tylko po Twojej akceptacji, a mapę widzą tylko zaakceptowani obserwujący."; } };
  const uc = $("ucopy"); if (uc) uc.onclick = () => shareLink("Moja mapa", "Zobacz moją mapę:", location.origin + location.pathname + "#u/" + store.prof.username);
  const cl = $("lclose"); if (cl) cl.onclick = closeAccount;
  const ad = $("ladm"); if (ad) ad.onclick = openAdmin;
  const rf = $("lrfsh"); if (rf) rf.onclick = async () => { rf.disabled = true; rf.textContent = "Odświeżam…"; await refreshSb(); closeAccount(); };
  const o = $("lout"); if (o) o.onclick = async () => { await store.sb.auth.signOut(); closeAccount(); };
  const pw = async up => {
    const em = ($("lemail").value || "").trim(), pa = $("lpass").value || "";
    if (!/^\S+@\S+\.\S+$/.test(em)) { $("lmsg").textContent = "Podaj poprawny adres e-mail."; return; }
    if (pa.length < 6) { $("lmsg").textContent = "Hasło: minimum 6 znaków."; return; }
    let nick = ""; if (up) { nick = ($("lnick").value || "").trim().toLowerCase().replace(/^@/, ""); if (!/^[a-z0-9_-]{3,20}$/.test(nick)) { $("lmsg").textContent = "Nick: 3–20 znaków, małe litery, cyfry, _ lub -."; $("lnick").focus(); return; }
      try { const fr = await store.sb.rpc("nick_free", {q: nick}); if (fr && !fr.error && fr.data === false) { $("lmsg").textContent = "Ten nick jest już zajęty."; $("lnick").focus(); return; } } catch (e) {} }
    $("lmsg").textContent = "Chwilę…";
    const r = up ? await store.sb.auth.signUp({email: em, password: pa, options: {data: {nick}}}) : await store.sb.auth.signInWithPassword({email: em, password: pa});
    if (r.error) { $("lmsg").textContent = (/invalid login/i.test(r.error.message) ? "Zły e-mail lub hasło (albo konto jeszcze nie istnieje)." : r.error.message); return; }
    if (up && !r.data.session) { $("lmsg").textContent = "Konto utworzone, ale Supabase wymaga potwierdzenia e-mailem. Wyłącz „Confirm email”."; return; }
    const u = r.data && (r.data.user || (r.data.session && r.data.session.user)); if (u && store.uid !== u.id) attachUser(u); closeAccount();
  };
  const pi = $("lin"), pu = $("lup"); if (pi) pi.onclick = () => pw(false); if (pu) pu.onclick = () => pw(true);
  const b = $("lsend"); if (b) b.onclick = async () => {
    const em = ($("lemail").value || "").trim(); if (!/^\S+@\S+\.\S+$/.test(em)) { $("lmsg").textContent = "Podaj poprawny adres e-mail."; return; }
    b.disabled = true; $("lmsg").textContent = "Wysyłam…";
    const r = await store.sb.auth.resetPasswordForEmail(em, {redirectTo: location.origin + location.pathname});
    b.disabled = false; $("lmsg").textContent = r.error ? "Nie udało się wysłać: " + r.error.message : "Jeśli konto z tym e-mailem istnieje, wysłaliśmy link do ustawienia nowego hasła (sprawdź też spam).";
  };
}
function openRecovery(){
  ovBox().innerHTML = `<div class="card" style="width:min(380px,94vw)"><h3>Nowe hasło</h3><div class="sub">Ustaw nowe hasło do konta.</div><input id="rnp" class="lin" type="password" autocomplete="new-password" placeholder="nowe hasło (min. 6 znaków)" style="margin-top:10px"><div class="small" id="rmsg" style="min-height:16px;margin-top:6px"></div><div style="display:flex;gap:8px;margin-top:8px"><button class="btn" id="rcx" style="flex:1">Anuluj</button><button class="btn pri" id="rok" style="flex:2">Zapisz hasło</button></div></div>`;
  $("rcx").onclick = closeAccount;
  $("rok").onclick = async () => { const p = $("rnp").value || ""; if (p.length < 6) { $("rmsg").textContent = "Hasło: minimum 6 znaków."; return; } $("rok").disabled = true; const r = await store.sb.auth.updateUser({password: p}); $("rok").disabled = false; if (r.error) { $("rmsg").textContent = r.error.message; return; } closeAccount(); toast("Hasło zmienione ✓"); };
}
function szCard(){
  const m = {}; R.forEach(r => { const v = visits[r.id]; if (v && v.sz) Object.keys(v.sz).forEach(k => { (m[k] = m[k] || {hub:r.n, rs:[]}).rs.push(v.sz[k].r || 0); }); });
  const a = Object.keys(m).map(k => ({k, hub:m[k].hub, r:Math.max(...m[k].rs)})).sort((x,y) => y.r - x.r || x.k.localeCompare(y.k, "pl"));
  if (!a.length) return `<div class="card"><h3>Ranking szarlotek</h3><div class="sub">Przy szlakach do schronisk w Polsce zaznacz „Jadłem” i oceń szarlotkę. Tu pojawi się ranking.</div></div>`;
  return `<div class="card"><h3>Ranking szarlotek</h3><div class="sub">Zjedzonych: ${a.length}</div><table>` + a.map(x => `<tr><td>${esc(x.k)}</td><td class="r" style="color:var(--warn)">${x.r ? "★".repeat(x.r) : "bez oceny"}</td></tr>`).join("") + `</table></div>`;
}
function renderStats(){
  const s = stats(), W = MODE === "w";
  const vis = R.filter(r => isVis(r.id));
  const nv = r => visits[r.id].stays.length, rt = r => visits[r.id].r || 0, hd = r => Object.keys(visits[r.id].done).length;
  const tb = (h, rows) => { if (!rows.length) return `<div class="sub">Brak danych. Zaznacz miejsca, w których byłeś.</div>`; const key = statScope + MODE + statRank[statScope === "c" ? "c" + MODE : MODE], open = !!RKOPEN[key], tot = rows.length, shown = open ? rows : rows.slice(0, 10);
    return `<table><tr>${h.map((x, k) => `<th${k ? ' class="r"' : ""}>${x}</th>`).join("")}</tr>${shown.join("")}</table>${tot > 10 ? `<button class="btn" id="rkmore" data-k="${key}" style="width:100%;margin-top:8px">${open ? "Pokaż tylko top 10" : "Pokaż wszystkie (" + tot + ")"}</button>` : ""}`; };
  const nm = r => `${flag(r.c.split(",")[0])} ${esc(r.n)}`;
  const stars = n => n ? `<span style="color:var(--warn)">${"★".repeat(n)}</span>` : `<span class="small">bez oceny</span>`;
  const OPTS = W
    ? [["visits", "Najczęściej odwiedzane"], ["rating", "Najwyżej oceniane"], ["km", "Największe (km tras)"], ["country", "Według kraju"], ["year", "Wizyty według roku"], ["groups", "Grupy (domeny narciarskie)"], ["cprog", "Postęp w krajach"]]
    : [["hikerate", "Najwyżej oceniane szlaki"], ["rating", "Najwyżej oceniane miejsca"], ["hikes", "Najwięcej szlaków"], ["country", "Według kraju"], ["year", "Odwiedzone miejsca według roku"], ["sz", "Szarlotki"], ["cprog", "Postęp w krajach"]];
  const COPTS = W ? [["cv", "Gdzie ludzie najczęściej byli"], ["cp", "Gdzie najchętniej by pojechali"], ["cr", "Najwyżej oceniane"]] : [["cv", "Gdzie ludzie najczęściej byli"], ["cp", "Gdzie najchętniej by poszli"], ["cr", "Najwyżej oceniane miejsca"], ["ch", "Najwyżej oceniane szlaki"], ["cs", "Szarlotki (ranking ogólny)"]];
  const com = statScope === "c" && SBC && store && store.sb && !RO, OP = com ? COPTS : OPTS, ck = "c" + MODE;
  if (!OP.some(o => o[0] === statRank[com ? ck : MODE])) statRank[com ? ck : MODE] = OP[0][0];
  const pick = statRank[com ? ck : MODE]; if (com) loadCommunity();
  const by = {}; R.forEach(r => { const c = r.c.split(",")[0]; (by[c] = by[c] || {t:0, v:0, m:0}); by[c].t++; if (isVis(r.id)) { by[c].v++; by[c].m += W ? r.k : hd(r); } });
  const years = {}; vis.forEach(r => { const seen = new Set(); visits[r.id].stays.forEach(st => { const k = st.y || "bez roku"; if (W) years[k] = (years[k]||0) + 1; else if (!seen.has(k)) { seen.add(k); years[k] = (years[k]||0) + 1; } }); });
  let rankBody = "";
  if (pick === "visits") rankBody = tb(["#  Ośrodek", "Wizyty", "Ostatnio"], vis.slice().sort((a, b) => nv(b) - nv(a) || (lastYear(b.id) || "").localeCompare(lastYear(a.id) || "") || b.k - a.k).map((r, k) => `<tr><td>${k + 1}. ${nm(r)}</td><td class="r">${nv(r)}</td><td class="r">${lastYear(r.id) || "–"}</td></tr>`));
  else if (pick === "hikerate") { const hr = []; vis.forEach(r => { const m = visits[r.id].hr || {}; Object.keys(m).forEach(i => { if (m[i] && r.hikes[i] && !r.hikes[i].del) hr.push({h: r.hikes[i], r, v: m[i]}); }); });
    rankBody = tb(["#  Szlak / miejsce", "Ocena"], hr.sort((a, b) => b.v - a.v || a.h.n.localeCompare(b.h.n, "pl")).map((x, k) => `<tr><td>${k + 1}. ${esc(x.h.n)}<div class="small">${flag(x.r.c.split(",")[0])} ${esc(x.r.n)}</div></td><td class="r">${stars(x.v)}</td></tr>`)); }
  else if (pick === "rating") rankBody = tb(["#  " + (W ? "Ośrodek" : "Miejsce"), "Ocena"], vis.filter(r => rt(r)).sort((a, b) => rt(b) - rt(a) || (W ? b.k - a.k : hd(b) - hd(a))).map((r, k) => `<tr><td>${k + 1}. ${nm(r)}</td><td class="r">${stars(rt(r))}</td></tr>`));
  else if (pick === "km") rankBody = tb(["#  Ośrodek", "Trasy"], vis.slice().sort((a, b) => b.k - a.k).map((r, k) => `<tr><td>${k + 1}. ${nm(r)}</td><td class="r">${Math.round(r.k)} km</td></tr>`));
  else if (pick === "hikes") rankBody = tb(["#  Miejsce", "Szlaki"], vis.filter(r => hd(r)).sort((a, b) => hd(b) - hd(a)).map((r, k) => `<tr><td>${k + 1}. ${nm(r)}</td><td class="r">${hd(r)} / ${r.hikes.length}</td></tr>`));
  else if (pick === "country") rankBody = tb(["Kraj", "Byłem", W ? "Trasy" : "Szlaki"], Object.keys(by).sort((a, b) => by[b].v - by[a].v || by[b].t - by[a].t).map(c => `<tr><td>${flag(c)} ${esc(cname(c))}</td><td class="r">${by[c].v} / ${by[c].t}</td><td class="r">${Math.round(by[c].m)}${W ? " km" : ""}</td></tr>`));
  else if (pick === "year") rankBody = tb(["Rok", W ? "Wizyty" : "Miejsca"], Object.keys(years).sort().reverse().map(y => `<tr><td>${y}</td><td class="r">${years[y]} ${W ? plur(years[y],"wizyta","wizyty","wizyt") : plur(years[y],"miejsce","miejsca","miejsc")}</td></tr>`));
  if (com) {
    const cm = COM[MODE], pl = x => plur(x, "osoba", "osoby", "osób"), ctb = (h, rows, empty) => rows.length ? tb(h, rows) : `<div class="sub">${empty}</div>`;
    if (!cm) rankBody = skel(6);
    else if (cm.err) rankBody = `<div class="sub">Ranking społeczności nie jest jeszcze włączony. Właściciel apki musi uruchomić plik SQL w Supabase.</div>`;
    else if (pick === "cv" || pick === "cp") { const k = pick === "cv" ? "v" : "p", rows = R.filter(r => cm[r.id] && cm[r.id][k] > 0).sort((a, b) => cm[b.id][k] - cm[a.id][k] || (cm[b.id][k === "v" ? "p" : "v"] - cm[a.id][k === "v" ? "p" : "v"]) || a.n.localeCompare(b.n, "pl")).slice(0, 50);
      rankBody = ctb(["#  " + (W ? "Ośrodek" : "Miejsce"), pick === "cv" ? "Byli" : "Chcą"], rows.map((r, i) => `<tr><td>${i + 1}. ${nm(r)}</td><td class="r">${cm[r.id][k]} ${pl(cm[r.id][k])}</td></tr>`), pick === "cv" ? "Jeszcze nikt z publicznych kont nie zaznaczył tu odwiedzin." : "Jeszcze nikt z publicznych kont nie dodał tu planów."); }
    else if (pick === "cr") { const rr = RATE[MODE] || {}, rows = R.filter(r => rr[r.id] && rr[r.id].n > 0).sort((a, b) => rr[b.id].a - rr[a.id].a || rr[b.id].n - rr[a.id].n).slice(0, 50);
      rankBody = ctb(["#  " + (W ? "Ośrodek" : "Miejsce"), "Średnia"], rows.map((r, i) => `<tr><td>${i + 1}. ${nm(r)}</td><td class="r"><span style="color:var(--warn)">★ ${fmtAvg(rr[r.id].a)}</span> <span class="small">(${rr[r.id].n})</span></td></tr>`), "Jeszcze nikt z publicznych kont nie ocenił miejsc."); }
    else if (pick === "cs") { const cp = COMP; if (!cp) rankBody = skel(6); else if (cp.err) rankBody = `<div class="sub">Ranking szarlotek wymaga uruchomienia pliku SQL w Supabase.</div>`;
      else rankBody = ctb(["#  Szarlotka", "Średnia"], cp.slice().sort((a, b) => (a.a == null) - (b.a == null) || (b.a || 0) - (a.a || 0) || b.nr - a.nr || b.ate - a.ate || a.n.localeCompare(b.n, "pl")).map((x, i) => `<tr><td>${i + 1}. ${esc(x.n)}<div class="small">${byId[x.pid] ? esc(byId[x.pid].n) + " · " : ""}jadło: ${x.ate}</div></td><td class="r">${x.a == null ? `<span class="small">bez ocen</span>` : `<span style="color:var(--warn)">★ ${fmtAvg(x.a)}</span> <span class="small">(${x.nr})</span>`}</td></tr>`), "Jeszcze nikt z publicznych kont nie zaznaczył szarlotki."); }
    else { const hr = []; R.forEach(r => { const m = RATEH[r.id] || {}; Object.keys(m).forEach(i => { if (r.hikes[i] && !r.hikes[i].del && m[i].n > 0) hr.push({h: r.hikes[i], r, a: m[i].a, n: m[i].n}); }); });
      rankBody = ctb(["#  Szlak / miejsce", "Średnia"], hr.sort((a, b) => b.a - a.a || b.n - a.n).slice(0, 50).map((x, i) => `<tr><td>${i + 1}. ${esc(x.h.n)}<div class="small">${flag(x.r.c.split(",")[0])} ${esc(x.r.n)}</div></td><td class="r"><span style="color:var(--warn)">★ ${fmtAvg(x.a)}</span> <span class="small">(${x.n})</span></td></tr>`), "Jeszcze nikt z publicznych kont nie ocenił szlaków."); }
  }
  let rankCard = com ? `<div class="card">${rankBody}</div><div class="small" style="margin:-4px 4px 8px">Liczone tylko z publicznych kont, bez nazwisk.</div>` : pick === "sz" ? szCard() : pick === "groups" ? groupsHtml() : `<div class="card">${rankBody}</div>`;
  const planned = R.filter(r => isPlan(r.id)).length;
  const mx = (L, f) => L.reduce((m, r) => (!m || f(r) > f(m)) ? r : m, null), shortN = r => esc(r.n.length > 22 ? r.n.slice(0, 21) + "…" : r.n);
  const cCnt = {}; vis.forEach(r => r.c.split(",").forEach(c => { cCnt[c] = (cCnt[c] || 0) + 1; })); const favC = Object.keys(cCnt).sort((a, b) => cCnt[b] - cCnt[a])[0];
  const hi = W ? mx(vis.filter(r => r.e), r => r.e) : null, bigR = W ? mx(vis, r => r.k) : null, yr = String(new Date().getFullYear());
  const cards = W
    ? [[hi ? hi.e + " m" : "–", hi ? "najwyżej: " + shortN(hi) : "najwyższy punkt"], [bigR ? Math.round(bigR.k) + " km" : "–", bigR ? "największy: " + shortN(bigR) : "największy ośrodek"], [favC ? flag(favC) + " " + cCnt[favC] : "–", favC ? "najczęściej: " + esc(cname(favC)) : "ulubiony kraj"], [planned, "w planach"]]
    : [[R.filter(r => isVis(r.id) && visits[r.id].stays.some(x => x.y === yr)).length, "miejsc w tym roku"], [favC ? flag(favC) + " " + cCnt[favC] : "–", favC ? "najczęściej: " + esc(cname(favC)) : "ulubiony kraj"], [R.reduce((a, r) => a + (r.hikes || []).filter(h => !h.del).length, 0), "szlaków do zrobienia"], [planned, "w planach"]];
  /* postęp w krajach */
  const allC = {}; R.forEach(r => r.c.split(",").forEach(c => { allC[c] = (allC[c] || 0) + 1; }));
  const bar = (lab, a, b, extra) => { const pc = b ? Math.min(100, Math.round(100 * a / b)) : 0; return `<div class="pg${a >= b && b ? " full" : ""}"><div class="pgt"><span>${lab}</span><b>${a}<small> / ${b}</small></b></div><div class="pgb"><i style="width:${pc}%"></i></div>${extra || ""}</div>`; };
  const cs = Object.keys(allC).sort((a, b) => ((cCnt[b] || 0) / allC[b] - (cCnt[a] || 0) / allC[a]) || allC[b] - allC[a]), cOpen = !!RKOPEN["pgc" + MODE];
  const cList = cs.filter(c => cCnt[c]), cRest = cs.filter(c => !cCnt[c]);
  const cShow = cOpen ? cList.concat(cRest) : cList.length ? cList : cRest.slice(0, 5);
  const cCard = `<div class="card pgc">${cList.length ? "" : `<div class="sub">${W ? "Zaznacz ośrodki, a tu zobaczysz, ile już zaliczyłeś w każdym kraju." : "Zaznacz miejsca, a tu zobaczysz, ile już zaliczyłeś w każdym kraju."}</div>`}${cShow.map(c => bar(flag(c) + " " + esc(cname(c)), cCnt[c] || 0, allC[c])).join("")}${(cOpen || cRest.length > (cList.length ? 0 : 5)) ? `<button class="btn" id="pgmore" style="width:100%;margin-top:8px">${cOpen ? "Pokaż tylko moje kraje" : "Pokaż wszystkie kraje (" + cs.length + ")"}</button>` : ""}</div>`;
  if (!com && pick === "cprog") rankCard = cCard;
  $("stats").innerHTML = `
    <div class="big">${cards.map(c => `<div class="card"><div class="n">${c[0]}</div><div class="l">${c[1]}</div></div>`).join("")}</div>
    <div class="rkwrap"><div class="card rkhead"><h3>Rankingi</h3>${SBC && store && store.sb && !RO ? `<div class="seg" id="rkscope" style="margin-bottom:8px"><button data-s="m" class="${com ? "" : "on"}">Moje</button><button data-s="c" class="${com ? "on" : ""}">Społeczność</button></div>` : ""}<select class="sel" id="rkpick">${OP.map(o => `<option value="${o[0]}"${o[0] === pick ? " selected" : ""}>${o[1]}</option>`).join("")}</select></div>
    ${rankCard}</div>
    <div class="card"><h3>Udostępnij i eksportuj</h3>
      <div class="sub">Obraz do wrzucenia na TikToka/Instagram oraz pliki z Twoimi miejscami do map.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${W ? `<button class="btn pri" id="shrank">${IC.img} Obraz: ranking</button>` : ""}<button class="btn pri" id="shmap">${IC.img} Obraz: mapa</button></div>
      <div class="fld" style="margin-top:12px"><label>PODSUMOWANIE SEZONU / ROKU</label><div style="display:flex;gap:8px"><select class="sel" id="shper">${periodOptions().map(o => `<option value="${o.v}">${o.label}</option>`).join("") || `<option value="">${W ? "brak wizyt" : "brak lat"}</option>`}</select><button class="btn pri" id="shyear" style="white-space:nowrap">${IC.img} Obraz</button></div><div class="small" style="margin-top:6px">${W ? "Na podstawie dodanych wizyt (rok i miesiąc). Km to suma długości tras w ośrodkach, w których byłeś." : "Na podstawie dodanych lat (i miesięcy) przy odwiedzonych miejscach."}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" id="exgpx">Eksport GPX</button><button class="btn" id="exkml">Eksport KML (Google My Maps)</button></div>
      <div class="small" id="exmsg" style="margin-top:6px"></div>
    </div>
    ${RO ? "" : `<div class="card"><h3>Kopia zapasowa</h3>
      <div class="sub">Zapis: ${store.mode==="db" ? "na Twoim koncie Claude (przetrwa zmianę telefonu)" : "tylko w tej przeglądarce. Zrób kopię poniżej, żeby nie stracić danych"}. Kopia obejmuje zimę i lato.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="bcopy">Kopiuj dane</button><button class="btn" id="bdl">Pobierz plik</button></div>
      <div class="fld"><label>Wklej dane, żeby je wczytać (zastąpią obecne)</label><textarea id="bimp" placeholder='{"visits":{…},"hvisits":{…}}'></textarea></div>
      <button class="btn" id="bload">Wczytaj</button> <span class="small" id="bmsg"></span>
    </div>`}
    <div class="small" style="margin:6px 4px 24px">Ośrodki: © współtwórcy OpenStreetMap / OpenSkiMap (licencja ODbL); długości tras bywają zaniżone tam, gdzie mapowanie jest niepełne. Szlaki letnie to ręcznie wybrana lista orientacyjna, czasy i trudność sprawdź w mapach turystycznych przed wyjściem.</div>
    <div class="small" style="margin:-14px 4px 24px">Mapy: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style="color:var(--accent)">współtwórcy OpenStreetMap</a> (ODbL), kafelki <a href="https://openfreemap.org" target="_blank" rel="noopener" style="color:var(--accent)">OpenFreeMap</a>, dane <a href="https://openmaptiles.org" target="_blank" rel="noopener" style="color:var(--accent)">OpenMapTiles</a>, ukształtowanie terenu: Mapzen / AWS Terrain Tiles.</div>`;
  $("rkpick").onchange = e => { statRank[com ? ck : MODE] = e.target.value; renderStats(); };
  { const pm = $("pgmore"); if (pm) pm.onclick = () => { RKOPEN["pgc" + MODE] = !RKOPEN["pgc" + MODE]; renderStats(); }; }
  { const mb = $("rkmore"); if (mb) mb.onclick = () => { RKOPEN[mb.dataset.k] = !RKOPEN[mb.dataset.k]; renderStats(); }; }
  { const sc = $("rkscope"); if (sc) sc.onclick = e => { const b = e.target.closest("button"); if (!b) return; statScope = b.dataset.s; try { localStorage.setItem("sht_rks", statScope); } catch (x) {} renderStats(); }; }
  $("shyear").onclick = () => { const o = periodOptions().find(x => x.v === $("shper").value); if (o) openShare("period", o); };
  if ($("shrank")) $("shrank").onclick = () => openShare("ranking"); $("shmap").onclick = () => openShare("map");
  $("exgpx").onclick = () => saveBlob("ski-been-" + (MODE === "w" ? "zima" : "lato") + ".gpx", new Blob([exportGPX()], {type:"application/gpx+xml"}), $("exmsg"));
  $("exkml").onclick = () => saveBlob("ski-been-" + (MODE === "w" ? "zima" : "lato") + ".kml", new Blob([exportKML()], {type:"application/vnd.google-earth.kml+xml"}), $("exmsg"));
  if ($("bcopy")) $("bcopy").onclick = async () => { try { await navigator.clipboard.writeText(exportJSON()); $("bmsg").textContent = "Skopiowano ✓"; } catch(e){ $("bmsg").textContent = "Nie udało się skopiować, skopiuj ręcznie z pola poniżej."; $("bimp").value = exportJSON(); } };
  if ($("bload")) $("bload").onclick = () => {
    try { const o = JSON.parse($("bimp").value); if (!o || typeof o.visits !== "object") throw 0;
      wVisits = migrate(o.visits); if (o.hvisits) sVisits = migrate(o.hvisits); syncVisits(); scheduleSave(); renderAll(); $("bmsg").textContent = "Wczytano ✓"; }
    catch(e){ $("bmsg").textContent = "To nie wygląda na poprawne dane."; } };
  if ($("bdl")) $("bdl").onclick = () => saveBlob("ski-been-backup.json", new Blob([exportJSON(true)], {type:"application/json"}), $("bmsg"));
}


/* ogólne zgłoszenie błędu lub pomysłu (trafia do tabeli suggestions, jak inne zgłoszenia) */
function openBugReport(){
  const can = SBC && store && store.sb && store.uid;
  ovBox().innerHTML = `<div class="card" style="width:min(440px,94vw)"><h3>Zgłoś błąd lub pomysł</h3>
    <div class="sub">Napisz, co nie działa albo co byś zmienił. Wersja aplikacji i telefon dołączą się same.</div>
    ${can ? `<textarea id="bgt" rows="5" maxlength="1500" placeholder="Np. po kliknięciu X dzieje się Y…" style="width:100%;margin-top:8px"></textarea>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="bgc" style="flex:1">Anuluj</button><button class="btn pri" id="bgs" style="flex:2">Wyślij</button></div><div class="small" id="bgm" style="margin-top:6px"></div>`
    : `<div class="sub" style="margin-top:8px">Żeby wysłać zgłoszenie, zaloguj się (ikona osób u góry).</div><button class="btn" id="bgc" style="width:100%;margin-top:10px">Zamknij</button>`}</div>`;
  $("bgc").onclick = closeAccount; const t = $("bgt"); if (!t) return; setTimeout(() => t.focus(), 50);
  $("bgs").onclick = async () => { const v = t.value.trim(); if (v.length < 3) { $("bgm").textContent = "Napisz kilka słów."; return; } $("bgs").disabled = true;
    try { const {error} = await store.sb.from("suggestions").insert({user_id: store.uid, username: (store.prof && store.prof.username) || store.name || "", mode: MODE, name: ("Zgłoszenie: " + v.split("\n")[0]).slice(0, 120), country: "", note: (v + " · " + APPV + " · " + navigator.userAgent.slice(0, 160)).slice(0, 1900)});
      if (error) throw error; closeAccount(); toast("Wysłano, dzięki!"); track("zgloszenie"); } catch (e) { $("bgs").disabled = false; $("bgm").textContent = "Nie udało się wysłać. Spróbuj jeszcze raz."; } };
}
/* analityka: anonimowa (GoatCounter, bez cookies). Pusta nazwa = wyłączona. */
const GC = "";
function track(ev){ try { if (!GC || !window.goatcounter || !window.goatcounter.count) return; window.goatcounter.count({path: "ev-" + ev, title: ev, event: true}); } catch (e) {} }
if (GC && !/localhost|127\.0\.0\.1/.test(location.hostname)) { const sc = document.createElement("script"); sc.async = true; sc.src = "https://gc.zgo.at/count.js"; sc.dataset.goatcounter = "https://" + GC + ".goatcounter.com/count"; document.head.append(sc); }
