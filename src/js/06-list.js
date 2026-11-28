/* ---------- lista ---------- */
let statRank = {w:"visits", s:"hikerate"}, fStat = "all", fCountry = "", fSort = "k", fQ = "", fMinKm = 0, fMinEl = 0, fGroup = "", fMinR = 0, fPrice = 0, fView = "p", fWx = "", fCat = "", fFilm = "", filmMode = false, fWd = 0, fWs = 0, fWc = 0, WXFAIL = 0;
const PT_NAMES = ["", "budżetowy", "średni", "drogi", "burżujski"];
const PT_TOP = /zermatt|st\.? moritz|courchevel|tignes|val d.is[eè]re|4 vall[eé]es|verbier|lech|z[uü]rs|cortina|kitz|gstaad|meg[eè]ve|m[eé]ribel|val thorens|davos|klosters|parsenn|crans-montana|st\. anton/i;
function priceTier(r){
  if (r.pt) return +r.pt; if (r._pt) return r._pt;
  const cs = String(r.c).split(","), c = cs[0], big = r.k >= 100; let t;
  if (cs.includes("CH")) t = r.k < 40 ? 2 : 3; else if (["PL", "SK", "CZ", "SI"].includes(c)) t = 1; else if (["AT", "IT", "FR"].includes(c)) t = r.k < 30 ? 1 : big ? 3 : 2; else t = 2;
  if (PT_TOP.test(r.n + " " + (r.l || ""))) t = 4;
  return (r._pt = t);
}
const pbadge = r => { return ""; const t = priceTier(r); return `<span class="pbadge p${t}" title="Szacunkowa kategoria cen: ${PT_NAMES[t]}"><b>${"$".repeat(t)}</b><i>${"$".repeat(4 - t)}</i></span>`; };
const WXA = {}; let WXL = null;
const wxa = id => WXA[MODE + ":" + id];
const wxOn = () => !!fWx || !!fWs || !!fWc || fSort === "ws" || fSort === "wd" || fSort === "wp" || fSort === "wc";
const wxAvg = a => { const v = (a || []).slice(0, 7).filter(x => x != null); return v.length ? v.reduce((q, x) => q + x, 0) / v.length : null; };
const wxV = (w, k) => fWd === 7 ? (k === "s" ? (w.s || []).slice(0, 7).reduce((q, x) => q + (+x || 0), 0) : wxAvg(w[k])) : (w[k] ? w[k][fWd] : null);
const wxOk = r => { if (!fWx && !fWs && !fWc) return true; const w = wxa(r.id); if (!w) return false; if (fWs && !(w.d != null && w.d >= fWs)) return false; if (fWc && !(wxV(w, "c") != null && wxV(w, "c") <= fWc)) return false; if (!fWx) return true; return fWx === "dry" ? (wxV(w, "p") != null && wxV(w, "p") <= (fWd === 7 ? 30 : 10)) : (wxV(w, "s") || 0) >= 1; };
const wxChip = r => { const w = wxa(r.id); if (!w) return ""; const p = wxV(w, "p"), sn = wxV(w, "s"), cl = wxV(w, "c"); return " · " + (p == null ? "" : (fWd === 7 ? "Ø " : "") + (MODE === "w" ? "🌨 " : "🌧 ") + Math.round(p) + "%") + (cl != null ? " · ☁ " + Math.round(cl) + "%" : "") + (sn >= .5 ? " · ❄ " + Math.round(sn) + " cm" : "") + (MODE === "w" && w.d != null ? " · ⛷ " + w.d + " cm" : ""); };
const wxMetric = (r, k) => { const w = wxa(r.id); if (!w) return null; return k === "wc" ? (wxV(w, "c") != null ? -wxV(w, "c") : null) : k === "wd" ? (w.d == null ? -1 : w.d) : k === "ws" ? (wxV(w, "s") || 0) : -(wxV(w, "p") == null ? 101 : wxV(w, "p")); };
const fixWxOpts = m => { const fs = $("fwsort"), fx = $("fwx"); [["ws", "❄ Najwięcej świeżego śniegu"], ["wd", "❄ Największa pokrywa"]].forEach(([v, t]) => { const o = fs.querySelector(`option[value="${v}"]`); if (m === "w" && !o) { const n = document.createElement("option"); n.value = v; n.textContent = t; fs.insertBefore(n, fs.querySelector('option[value="wp"]')); } else if (m !== "w" && o) o.remove(); }); fs.querySelector('option[value="wp"]').textContent = m === "w" ? "🌨 Najmniejsza szansa opadów" : "🌧 Najmniejsza szansa opadów"; $("fws").style.display = m === "w" ? "" : "none"; { const o = fs.querySelector('option[value="wc"]'); if (!o) { const n = document.createElement("option"); n.value = "wc"; n.textContent = "☀ Najmniej chmur"; fs.append(n); } } const so = fx.querySelector('option[value="snow"]'); if (m === "w" && !so) { const n = document.createElement("option"); n.value = "snow"; n.textContent = "Będzie śnieg (≥1 cm)"; fx.append(n); } else if (m !== "w" && so) so.remove(); };
async function wxAllLoad(){
  const key = "sht-wxa3-" + MODE, list = R.filter(r => r.y != null && r.x != null);
  try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c && Date.now() - c.t < 108e5) Object.assign(WXA, c.d); } catch (e) {}
  const need = list.filter(r => !wxa(r.id)); if (!need.length) return; if (WXL) return WXL;
  const M = MODE;
  WXL = (async () => {
    for (let i = 0; i < need.length; i += 50) {
      const ch = need.slice(i, i + 50);
      try {
        const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${ch.map(r => r.y.toFixed(3)).join(",")}&longitude=${ch.map(r => r.x.toFixed(3)).join(",")}&daily=precipitation_probability_max,snowfall_sum&hourly=snow_depth,cloud_cover&forecast_days=7&timezone=auto`)).json();
        (Array.isArray(j) ? j : [j]).forEach((o, k) => { const r = ch[k]; if (!r || !o || !o.daily) return; let d = null; const h = o.hourly; if (h && h.snow_depth && h.time) { const nowL = new Date(Date.now() + (o.utc_offset_seconds || 0) * 1000).toISOString().slice(0, 13) + ":00"; let ix = h.time.indexOf(nowL); if (ix < 0) ix = 0; if (h.snow_depth[ix] != null) d = Math.round(h.snow_depth[ix] * 100); }
          let cc = null; if (h && h.cloud_cover && h.time) { const ds = [...new Set(h.time.map(t => t.slice(0, 10)))]; cc = [0, 1, 2, 3, 4, 5, 6].map(di => { const v = []; h.time.forEach((t, hi) => { const hh = +t.slice(11, 13); if (t.slice(0, 10) === ds[di] && hh >= 8 && hh <= 17 && h.cloud_cover[hi] != null) v.push(h.cloud_cover[hi]); }); return v.length ? Math.round(v.reduce((q, x) => q + x, 0) / v.length) : null; }); }
          WXA[M + ":" + r.id] = {c: cc, p: o.daily.precipitation_probability_max || [], s: (o.daily.snowfall_sum || []).map(x => +x || 0), d}; });
      } catch (e) {}
      if (MODE === M) { renderList(); mapRefresh(); }
    }
    try { const dd = {}; Object.keys(WXA).forEach(k => { if (k.startsWith(M + ":")) dd[k] = WXA[k]; }); localStorage.setItem("sht-wxa3-" + M, JSON.stringify({t: Date.now(), d: dd})); } catch (e) {}
    if (need.some(r => !wxa(r.id))) WXFAIL = Date.now();
  })().finally(() => { WXL = null; if (MODE === M) renderList(); });
  return WXL;
}
const passF = r => (fStat==="all" || (fStat==="mine" && (marked(r.id) || !!fQ)) || (fStat==="yes" && isVis(r.id)) || (fStat==="plan" && isPlan(r.id)) || (fStat==="no" && !visits[r.id]) || (fStat==="fp" && friendsPlan(r.id).length > 0) || (fStat==="tog" && isPlan(r.id) && friendsPlan(r.id).length > 0) || (fStat==="pfv" && isPlan(r.id) && !isVis(r.id) && friendsAt(r.id).length > 0) || (fStat==="fv" && !isVis(r.id) && friendsAt(r.id).length > 0)) && (!fCountry || r.c.split(",").includes(fCountry)) && (!fMinKm || r.k >= fMinKm) && (!fMinEl || (r.e || 0) >= fMinEl) && (!fGroup || !G[+fGroup] || G[+fGroup].m.includes(r.id)) && (!fMinR || (((rateOf(r.id) || {}).n || 0) > 0 && rateOf(r.id).a >= fMinR)) && (!fPrice || (MODE === "w" && priceTier(r) === fPrice)) && (!fCat || MODE === "w" || (r.cs || ["g"]).includes(fCat)) && (MODE === "w" || (filmMode ? ((r.fm || []).length > 0 && (!fFilm || r.fm.includes(fFilm))) : !r.fo)) && wxOk(r);
const filtN = () => !!fCat + !!fWx + !!fWs + !!fWc + (fStat !== "all" && fStat !== "mine") + !!fCountry + !!fGroup + !!fMinKm + !!fMinEl + !!fMinR + !!fPrice;
function buildCountrySelect(){
  const cs = {}; R.forEach(r => r.c.split(",").forEach(c => cs[c] = (cs[c]||0) + 1));
  $("fcountry").innerHTML = `<option value="">Wszystkie kraje</option>` +
    Object.keys(cs).sort((a,b)=>cname(a).localeCompare(cname(b),"pl")).map(c => `<option value="${c}">${flag(c)} ${esc(cname(c))} (${cs[c]})</option>`).join("");
}
function buildGroupSelect(){ $("fgroup").innerHTML = `<option value="">Grupa</option>` + G.map((g, i) => g.m.length >= 2 ? `<option value="${i}">${esc(g.n)}</option>` : "").join(""); $("fgroup").value = fGroup; $("frow3").style.display = MODE === "w" && G.length ? "" : "none"; }
function setFStat(v){ fStat = v; $("fstat").value = v; }
function updMore(){}
function ownTxt(id){ const v = visits[id]; if (!v) return ""; return norm([v.n].concat(Object.values(v.hn || {})).filter(Boolean).join(" ")); }
function matchR(r, q){ return matchT(r.s, q) || (!!visits[r.id] && matchT(ownTxt(r.id), q)); }
function qSug(){
  const bx = $("qsug"), q = fQ || ""; if (q.length < 2) { bx.style.display = "none"; return; }
  const out = [], seen = new Set();
  const sc = (t, w) => { t = norm(t); return t.startsWith(q) ? 0 : t.split(/\s+/).some(x => x.startsWith(q.split(/\s+/)[0])) ? 1 : 2; };
  R.filter(r => matchR(r, q)).sort((a, b) => sc(a.n) - sc(b.n) || b.k - a.k).slice(0, 4).forEach(r => { out.push({id: r.id, t: r.n, sub: r.c.split(",").map(cname).join(", "), hub: 1}); seen.add(r.id); });
  let nt = 0; for (const r of R) { if (nt >= 3) break; for (const h of (r.hikes || [])) { if (h.del) continue; if (matchT(norm(h.n), q)) { out.push({id: r.id, t: h.n, sub: r.n}); nt++; break; } } }
  if (!out.length) { bx.style.display = "none"; return; }
  bx.innerHTML = out.slice(0, 7).map(o => `<div class="qr"><button type="button" class="qs" data-id="${esc(o.id)}"><b>${esc(o.t)}</b><span>${esc(o.sub)}</span></button>${o.hub ? `<button type="button" class="qt ${isVis(o.id) ? "on" : ""}" data-id="${esc(o.id)}" aria-label="Byłem">✓</button>` : ""}</div>`).join("");
  bx.querySelectorAll(".qt").forEach(b => b.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); const i = b.dataset.id; if (isVis(i)) { toast("Już zaznaczone ✓"); return; } setStatus(i, "v"); b.classList.add("on"); });
  bx.style.display = "block";
  bx.querySelectorAll(".qs").forEach(b => b.onpointerdown = e => { e.preventDefault(); bx.style.display = "none"; $("q").blur(); openSheet(b.dataset.id); });
}
function initListControls(){
  buildCountrySelect(); buildGroupSelect();
  $("fgroup").addEventListener("change", e => { fGroup = e.target.value; renderList(); mapRefresh(); });
  $("q").addEventListener("input", e => { fQ = norm(e.target.value.trim()); renderList(); qSug(); });
  $("q").addEventListener("focus", qSug); $("q").addEventListener("blur", () => setTimeout(() => { $("qsug").style.display = "none"; }, 180));
  $("fcat").addEventListener("change", e => { fCat = e.target.value; renderList(); mapRefresh(); });
  $("fview").addEventListener("change", e => setView(e.target.value));
  $("fcountry").addEventListener("change", e => { fCountry = e.target.value; renderList(); mapRefresh(); });
  $("fsort").addEventListener("change", e => { fSort = e.target.value; $("fwsort").value = ""; renderList(); });
  $("fwsort").addEventListener("change", e => { const v = e.target.value; fSort = v || "k"; $("fsort").value = v ? "_w" : "k"; renderList(); });
  $("fwc").addEventListener("change", e => { fWc = +e.target.value; renderList(); mapRefresh(); });
  $("fws").addEventListener("change", e => { fWs = +e.target.value; renderList(); mapRefresh(); });
  $("lview").style.display = MODE === "s" ? "" : "none";
  $("lview").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; fView = b.dataset.v; document.querySelectorAll("#lview button").forEach(x => x.classList.toggle("on", x === b)); renderList(); });
  $("fmore").onclick = () => { const o = $("fextra").style.display === "none"; $("fextra").style.display = o ? "" : "none"; $("fmore").classList.toggle("open", o); $("fextra").closest(".toolbar").classList.toggle("xo", o); };
  $("fwx").addEventListener("change", e => { fWx = e.target.value; renderList(); mapRefresh(); });
  $("fwd").addEventListener("change", e => { fWd = +e.target.value; renderList(); mapRefresh(); });
  fixWxOpts(MODE);
  document.querySelectorAll(".legend [data-c]").forEach(sp => sp.onclick = () => legToggle(sp.dataset.c)); { const fb = $("mfrm"); if (fb) fb.onclick = () => { const o = ["n"].concat(Object.keys(FRD).length ? ["f"] : [], ["m"]); setView(o[(o.indexOf(viewVal()) + 1) % o.length]); }; document.querySelectorAll(".legend span.lgf[data-f]").forEach(c => c.onclick = () => { if (frOff.has(c.dataset.f)) frOff.delete(c.dataset.f); else frOff.add(c.dataset.f); legSync(); applyVB(); }); } legSync();
  $("fminr").addEventListener("change", e => { fMinR = +e.target.value; renderList(); mapRefresh(); });
  $("fminkm").addEventListener("change", e => { fMinKm = +e.target.value; renderList(); mapRefresh(); });
  $("fminel").addEventListener("change", e => { fMinEl = +e.target.value; renderList(); mapRefresh(); });
  $("fstat").addEventListener("change", e => {
    setFStat(e.target.value);
    if (e.target.value === "plan") { fSort = "p"; $("fsort").value = "p"; } else if (fSort === "p") { fSort = "k"; $("fsort").value = "k"; }
    renderList(); mapRefresh();
  });
  $("list").addEventListener("click", e => { const ef = e.target.closest("#efix"); if (ef) { if (ef.dataset.q) { fQ = ""; $("q").value = ""; renderList(); mapRefresh(); } else { const el = $(ef.dataset.id); el.value = ef.dataset.d; el.dispatchEvent(new Event("change")); } return; }
    const t = e.target.closest(".tick"), it = e.target.closest(".item"); if (!it) return;
    const id = it.dataset.id;
    if (t && !visits[id]) setStatus(id, "v");
    openSheet(id);
  });
}
function emptyFix(){
  const F = {fstat:[() => fStat, v => { fStat = v; }, "all"], fcountry:[() => fCountry, v => { fCountry = v; }, ""], fgroup:[() => fGroup, v => { fGroup = v; }, ""], fminr:[() => fMinR, v => { fMinR = v; }, 0], fminkm:[() => fMinKm, v => { fMinKm = v; }, 0], fminel:[() => fMinEl, v => { fMinEl = v; }, 0], fprice:[() => fPrice, v => { fPrice = v; }, 0], fwx:[() => fWx, v => { fWx = v; }, ""], fws:[() => fWs, v => { fWs = v; }, 0], fwc:[() => fWc, v => { fWc = v; }, 0]};
  let best = null; const cnt = () => R.filter(r => passF(r) && matchR(r, fQ)).length;
  Object.keys(F).forEach(id => { const [g, st, d] = F[id], cur = g(); if (cur === d || cur === "" || cur == null) return; const el = $(id), o = el && [...el.options].find(x => x.value === String(cur)); st(d); const n = cnt(); st(cur); if (n > 0 && (!best || n > best.n)) best = {n, id, d, t: o ? o.textContent.trim() : id}; });
  if (fQ) { const q = fQ; fQ = ""; const n = cnt(); fQ = q; if (n > 0 && (!best || n > best.n)) best = {n, q: 1, t: "„" + q + "\""}; }
  if (!best) return "";
  return `<br><button type="button" class="btn sm" id="efix" data-id="${best.id || ""}" data-d="${best.d == null ? "" : best.d}" data-q="${best.q ? 1 : ""}" style="margin-top:10px">Zdejmij: ${esc(best.t)} → ${best.n}</button>`;
}
function renderList(){ setTimeout(syncDD, 0);
  { const n = filtN() - (fStat !== "all" && fStat !== "mine") - !!fCountry; const m = $("fmoren"); if (m) m.textContent = n > 0 ? " · " + n : ""; const b = $("fmore"); if (b) b.classList.toggle("act", n > 0); }
  if (wxOn() && !WXL && Date.now() - WXFAIL > 6e4 && R.some(r => r.y != null && !wxa(r.id))) wxAllLoad().then(() => {});
  try { updMore(); } catch(e){}
  try { fChips(); } catch(e){}
  let a = R.filter(r => passF(r) && matchR(r, fQ)); LISTIDS = a.map(r => r.id);
  const pr = id => (visits[id] && visits[id].s === "p") ? visits[id].pr : -1;
  if (fSort==="k") a.sort((x,y)=>y.k-x.k);
  else if (fSort==="n") a.sort((x,y)=>x.n.localeCompare(y.n,"pl"));
  else if (fSort==="ws" || fSort==="wd" || fSort==="wp" || fSort==="wc") { const mt = r => { const x = wxMetric(r, fSort); return x == null ? -1e9 : x; }; a.sort((x,y)=>mt(y)-mt(x) || y.k-x.k); }
  else if (fSort==="mr") { const mi = r => (visits[r.id] && visits[r.id].r) || 0, sc = r => { const q = rateOf(r.id); return q && q.n ? q.a : -1; }; a.sort((x,y)=>mi(y)-mi(x) || sc(y)-sc(x) || y.k-x.k); }
  else if (fSort==="r") { const sc = r => { const q = rateOf(r.id); return q && q.n ? q.a : -1; }; a.sort((x,y)=>sc(y)-sc(x) || ((rateOf(y.id)||{}).n||0)-((rateOf(x.id)||{}).n||0) || y.k-x.k); }
  else if (fSort==="fr") { const fc = r => friendsAt(r.id).length * 2 + friendsPlan(r.id).length; a.sort((x,y)=>fc(y)-fc(x) || y.k-x.k); }
  else if (fSort==="p") a.sort((x,y)=>pr(y.id)-pr(x.id) || y.k-x.k);
  else a.sort((x,y)=>cname(x.c.split(",")[0]).localeCompare(cname(y.c.split(",")[0]),"pl") || y.k-x.k);
  const W = MODE === "w";
  if (!W && fView === "h") { renderHikeList(); return; }
  $("list").innerHTML = a.length ? a.map(r => {
    const v = visits[r.id]; let extra = "";
    if (v && v.s === "v") {
      const n = v.stays.length;
      extra = " · " + (W ? (n ? n + " " + plur(n,"wizyta","wizyty","wizyt") + (() => { const dd = v.stays.reduce((q, x) => q + (+x.d || 0), 0); return dd ? ", " + dd + " " + plur(dd,"dzień","dni","dni") : ""; })() + (lastYear(r.id) ? ", ostatnio " + lastYear(r.id) : "") : "byłem") : (() => { const ys = [...new Set(v.stays.map(x => x.y).filter(Boolean))].sort(); return ys.length ? "byłem: " + ys.join(", ") : "byłem"; })()) + (v.t ? " · tier " + v.t : "");
      if (!W) { const dn = Object.keys(v.done).length; if (dn) extra += " · " + dn + "/" + liveN(r) + " szlaków"; }
    } else if (v && v.s === "p") extra = " · planuję" + (v.pr ? " · priorytet " + v.pr : "") + (v.pd ? " · " + esc(fmtPd(v.pd)) : "") + `<span class="lwx" data-r="${esc(r.id)}"></span>`;
    { const q = rateOf(r.id); if (q && q.n) extra += " · ★ " + fmtAvg(q.a); }
    if (wxOn()) extra += wxChip(r);
    return `<div class="item ${v ? (v.s==="v"?"v":"p") : ""}" data-id="${esc(r.id)}">
      <div class="flg">${flag(r.c.split(",")[0])}</div>
      <div class="t"><b>${esc(dname(r))}</b><small>${(() => { const hd = W ? (r.e ? "do " + r.e + " m" : "") : esc(r.r || ""); const ex = extra || ""; return hd + (hd ? ex : ex.replace(/^ · /, "")); })()}</small>${friendChips(r.id)}</div>
      <div class="kmb"><b>${W ? Math.round(r.k) : liveN(r)}</b>${W ? "km" : plur(liveN(r),"szlak","szlaki","szlaków")}</div>
      <button class="tick ${isVis(r.id)?"on":isPlan(r.id)?"plan":""}" aria-label="Byłem">${isPlan(r.id)?"📅":"✓"}</button>
    </div>`; }).join("") : `<div class="empty">Nic nie pasuje do filtrów.${emptyFix()}</div>`;
  if (!RO && SBC) $("list").insertAdjacentHTML("beforeend", `<div class="sugg"><button class="btn sm" id="sgbtn">+ Brakuje miejsca? Zgłoś</button></div>`);
  { let n = 0; document.querySelectorAll("#list .lwx").forEach(el => { if (n++ >= 25) return; const r = R.find(x => x.id === el.dataset.r); wxNow(r).then(w => { if (w && el.isConnected) el.innerHTML = " · " + wxNowHtml(r, w); }); }); }
  { const qb = $("qvadd"); if (qb) qb.style.display = (fQ && !a.length) ? "" : "none"; }
  const fc = $("fcount"); if (fc) fc.textContent = a.length + " " + (MODE === "w" ? plur(a.length, "ośrodek", "ośrodki", "ośrodków") : plur(a.length, "miejsce", "miejsca", "miejsc"));
}

function hikeFriendsRow(r, i){
  if (RO || !Object.keys(FRD).length) return "";
  const v = visits[r.id] || {}, meD = !!(v.done && v.done[i]), me = !!(v.hp && v.hp[i]), d = [], pl = [];
  Object.keys(FRD).forEach(f => { const e = frEntry(f, r.id); if (!e) return; if (e.done && e.done[i]) d.push({u: f, st: (e.hr && e.hr[i]) || 0}); else if (e.hp && e.hp[i]) pl.push({u: f}); });
  let h = "";
  if (d.length && !meD && true) h += `<span class="fc ${me ? "pv" : "fr"}">byli: ${d.slice(0, 3).map(x => "@" + esc(x.u) + (x.st ? " ★" + x.st : "")).join(", ")}${d.length > 3 ? " +" + (d.length - 3) : ""}</span>`;
  if (pl.length && !meD) h += `<span class="fc pl${me ? " both" : ""}">${me ? "🤝 razem: " : "chcą: "}${nickList(pl)}</span>`;
  return h ? `<div class="frl">${h}</div>` : "";
}
function renderHikeList(){
  const E = [];
  R.filter(r => passF(r)).forEach(r => { const v = visits[r.id] || {}; (r.hikes || []).forEach((h, i) => { if (h.del) return; if (fCat && (h.ct || "g") !== fCat) return; if (filmMode && !(h.fm || []).length) return; if (fFilm && !(h.fm || []).includes(fFilm)) return; if (fQ && !matchR(r, fQ) && !matchT(norm(h.n), fQ)) return; const g = RATEH[r.id] && RATEH[r.id][i]; E.push({r, h, i, my: (v.hr && v.hr[i]) || 0, g: g && g.n ? g : null, done: !!(v.done && v.done[i])}); }); });
  const ga = e => e.g ? e.g.a : -1, gn = e => e.g ? e.g.n : 0;
  if (fSort === "ws" || fSort === "wd" || fSort === "wp" || fSort === "wc") { const mt = e => { const x = wxMetric(e.r, fSort); return x == null ? -1e9 : x; }; E.sort((x, y) => mt(y) - mt(x)); }
  else if (fSort === "mr") E.sort((x, y) => y.my - x.my || ga(y) - ga(x) || gn(y) - gn(x));
  else if (fSort === "r") E.sort((x, y) => ga(y) - ga(x) || gn(y) - gn(x) || y.my - x.my);
  else if (fSort === "n") E.sort((x, y) => x.h.n.localeCompare(y.h.n, "pl"));
  else if (fSort === "c") E.sort((x, y) => cname(x.r.c.split(",")[0]).localeCompare(cname(y.r.c.split(",")[0]), "pl") || x.r.n.localeCompare(y.r.n, "pl"));
  else if (fSort === "p") { const pr = r => (visits[r.id] && visits[r.id].s === "p") ? visits[r.id].pr : -1; E.sort((x, y) => pr(y.r) - pr(x.r) || x.r.n.localeCompare(y.r.n, "pl")); }
  else E.sort((x, y) => (y.r.hikes || []).length - (x.r.hikes || []).length || x.r.n.localeCompare(y.r.n, "pl"));
  $("list").innerHTML = E.length ? E.map(e => `<div class="item ${e.done ? "v" : ""}" data-id="${esc(e.r.id)}">
      <div class="flg">${flag(e.r.c.split(",")[0])}</div>
      <div class="t"><b>${esc(e.h.n)}</b><small>${esc(e.r.n)}${wxOn() ? wxChip(e.r) : ""} · <span class="d${DIFF.indexOf(e.h.d)}">${esc(e.h.d)}</span>${e.h.t ? " · " + esc(e.h.t) : ""}${e.done ? " · <span>zrobiony</span> ✓" : ""}${e.my ? ` · <span>moja</span> <span style="color:var(--warn)">★ ${e.my}</span>` : ""}${e.g ? ` · <span>wszyscy</span> <span style="color:var(--warn)">★ ${fmtAvg(e.g.a)}</span> <span>(${e.g.n})</span>` : ""}</small>${hikeFriendsRow(e.r, e.i)}</div>
      <div class="kmb"><b>${e.my ? "★ " + e.my : "–"}</b>moja</div>
    </div>`).join("") : `<div class="empty">Nic nie pasuje do filtrów.</div>`;
  { const qb = $("qvadd"); if (qb) qb.style.display = (fQ && !E.length) ? "" : "none"; }
  const fc = $("fcount"); if (fc) fc.textContent = E.length + " " + plur(E.length, "szlak", "szlaki", "szlaków");
}

