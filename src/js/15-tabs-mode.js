/* ---------- zakładki i tryb ---------- */
{ const hd0 = document.querySelector("header"), still = matchMedia("(prefers-reduced-motion: reduce)");
  /* zwijanie nagłówka: wysokość płynnie się zmienia, a treść poniżej przesuwa się razem z nią */
  const setC = on => { const h0 = hd0.offsetHeight; document.body.classList.add("hm"); document.body.classList.toggle("hcomp", on); const h1 = hd0.offsetHeight; document.body.classList.remove("hm"); if (still.matches || h0 === h1) return;
    const hs = hd0.querySelector(".hstats"); hd0.style.transition = "none"; hd0.style.height = h0 + "px"; void hd0.offsetHeight; hd0.style.transition = "height .26s cubic-bezier(.2,.8,.3,1)"; hd0.style.height = h1 + "px";
    if (hs) { hs.classList.remove("hfade"); void hs.offsetWidth; hs.classList.add("hfade"); }
    clearTimeout(hd0._t); hd0._t = setTimeout(() => { hd0.style.height = ""; hd0.style.transition = ""; if (hs) hs.classList.remove("hfade"); }, 300); };
  const hc = () => { const v = document.querySelector(".view.on"); const y = (v && v.id !== "v-mapa") ? v.scrollTop : 0, on = document.body.classList.contains("hcomp"); if (!on && y > 56) setC(true); else if (on && y < 8) setC(false); };
  document.querySelectorAll(".view").forEach(v => v.addEventListener("scroll", hc, {passive: true})); window.__hc = hc; }
{ const mq = matchMedia("(min-width:1100px)"), hd = document.querySelector("header"), nv = $("nav");
  const sz = () => { document.body.style.setProperty("--hh", hd.offsetHeight + "px"); if (nv) document.body.style.setProperty("--navh", nv.offsetHeight + "px"); };
  const sync = () => { const was = document.body.classList.contains("wide"); document.body.classList.toggle("wide", mq.matches); sz(); if (was !== mq.matches && typeof show === "function" && show._t) show(show._t === "lista" ? "mapa" : show._t); };
  (mq.addEventListener ? mq.addEventListener("change", sync) : mq.addListener(sync)); new ResizeObserver(sz).observe(hd); if (nv) new ResizeObserver(sz).observe(nv); sync(); }
function show(t){
  if (document.body.classList.contains("wide") && t === "lista") t = "mapa";
  if (t === "grupy") { statRank.w = "groups"; t = "statystyki"; if (MODE === "w") renderStats(); }
  if (!["mapa","lista","ranking","grupy","statystyki","wyjazdy"].includes(t) || (t === "ranking" && MODE !== "w") || (t === "wyjazdy" && RO)) t = "mapa";
  { const ord = ["mapa", "lista", "ranking", "wyjazdy", "statystyki"], np = ord.indexOf(t), pp = ord.indexOf(show._t);
    if (show._t && show._t !== t && np >= 0 && pp >= 0) show._dir = np > pp ? "sl-r" : "sl-l"; else show._dir = ""; show._t = t; }
  document.body.classList.toggle("wtr", t === "wyjazdy"); document.querySelectorAll(".view").forEach(v => v.classList.toggle("on", v.id === "v-" + t)); if (document.body.classList.contains("wide") && t === "mapa") $("v-lista").classList.add("on"); updateFab(); if (window.__hc) window.__hc();
  if (show._dir) { const vw = $("v-" + t); if (vw) { vw.classList.remove("sl-l", "sl-r"); void vw.offsetWidth; vw.classList.add(show._dir); setTimeout(() => vw.classList.remove("sl-l", "sl-r"), 420); } }
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.t === (t === "lista" ? "mapa" : t)));
  try { if (!RO && location.hash !== "#" + t && !/access_token|error_description/.test(location.hash)) history.replaceState(null, "", "#" + t); } catch(e){}
  if (t === "mapa") requestAnimationFrame(() => { if (mapFitted) applyVB(); else fit(); });
  if (t === "wyjazdy") loadShared(false);
}
$("nav").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const t = b.dataset.t, same = show._t === t || (t === "mapa" && show._t === "lista"); if (t === "mapa" && (filmMode || frMode)) setView("n");
  if (same) { try {
    if (t === "wyjazdy") { tripOpen = null; packOpen = null; tripsTab = "trips"; costEditId = null; renderTrips(); }
    else if (t === "mapa" && show._t === "lista") { /* z listy wraca na mapę */ }
    else if (t === "mapa" && show._t === "mapa") { fit(); }
    else if (t === "statystyki") { statRank.w = statRank.w; }
    const vw = $("v-" + show._t); if (vw) vw.scrollTo ? vw.scrollTo({top: 0, behavior: "smooth"}) : (vw.scrollTop = 0);
  } catch(err){} }
  show(t); });
window.addEventListener("hashchange", () => show(location.hash.slice(1)));
let lastPt = {x: innerWidth / 2, y: innerHeight * .7};
addEventListener("pointerdown", e => { lastPt = {x: e.clientX, y: e.clientY}; }, true);
function toast(msg){ let t = $("toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); } t.textContent = msg; t.classList.remove("on"); void t.offsetWidth; t.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 2200); }
function toastUndo(msg, fn){ toast(msg); const t = $("toast"); t.classList.add("u"); const b = document.createElement("button"); b.textContent = "Cofnij"; b.className = "tundo"; b.onclick = () => { fn(); t.classList.remove("on", "u"); }; t.appendChild(b); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on", "u"), 6000); }
function burst(){ if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; const p = document.createElement("i"); p.className = "vring"; p.style.cssText = `left:${lastPt.x}px;top:${lastPt.y}px`; document.body.appendChild(p); setTimeout(() => p.remove(), 700); }
function buildFx(){ const h = document.querySelector("header"); if (!h) return; let f = $("fx"); if (!f) { f = document.createElement("div"); f.id = "fx"; h.prepend(f); } f.replaceChildren(); const W = MODE === "w"; if (matchMedia("(prefers-reduced-motion: reduce)").matches) { f.className = W ? "snow" : "sun"; return; } for (let i = 0; i < (W ? 16 : 0); i++) { const p = document.createElement("i"), sz = W ? 6 + Math.random() * 6 : 2 + Math.random() * 2.5; p.style.cssText = `left:${Math.random() * 100}%;width:${sz}px;height:${sz}px;animation-duration:${(W ? 9 : 14) + Math.random() * 9}s;animation-delay:-${Math.random() * 18}s;opacity:${.25 + Math.random() * .4}`; f.appendChild(p); } f.className = W ? "snow" : "sun"; if (!W) { const w = f.offsetWidth + 180; for (let i = 0; i < 4; i++) { const c = document.createElement("b"), d = 80 + Math.random() * 60; c.style.cssText = `top:${8 + Math.random() * 62}%;--w:${w}px;transform:scale(${.7 + Math.random() * .7});animation-duration:${d}s;animation-delay:-${Math.random() * d}s;opacity:${.55 + Math.random() * .4}`; f.appendChild(c); } } }
function modeFx(){ if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; const o = $("modefx"); if (o) o.remove(); const e = document.createElement("div"); e.id = "modefx"; e.style.background = MODE === "w" ? "radial-gradient(circle at 50% 0%, #2a6ab0, #0b1b34 70%)" : "radial-gradient(circle at 50% 0%, #e0944a, #2b1d12 70%)"; document.body.appendChild(e); setTimeout(() => e.remove(), 800); }
let _din = 0;
function dotsIn(){ try { gDots.classList.remove("din"); cancelAnimationFrame(_din); _din = requestAnimationFrame(() => { _din = requestAnimationFrame(() => { try { gDots.classList.add("din"); } catch (e) {} }); }); } catch (e) {} }
function skel(n){ return Array.from({length: n || 4}, (_, i) => `<span class="sk${i % 3 === 0 ? " l" : ""}" style="width:${88 - (i * 11) % 40}%"></span>`).join(""); }
let _fxT = 0;
function flipUI(){ dotsIn(); clearTimeout(_fxT); _fxT = setTimeout(buildFx, 320); const a = document.querySelector("main"), h = document.querySelector("header"); [a, h].forEach(e => e && e.classList.remove("flip")); requestAnimationFrame(() => [a, h].forEach(e => e && e.classList.add("flip"))); setTimeout(() => [a, h].forEach(e => e && e.classList.remove("flip")), 300); }
function countUp(){ document.querySelectorAll("#hstats b").forEach(b => { const to = parseFloat(b.textContent); if (!isFinite(to) || to <= 0 || to > 99999 || b.dataset.cu === String(to)) return; const from = parseFloat(b.dataset.cu) || 0; b.dataset.cu = String(to); if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; const t0 = performance.now(), dur = 700, txt = b.textContent; (function f(t){ const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = k < 1 ? String(Math.round(from + (to - from) * e)) : txt; if (k < 1) requestAnimationFrame(f); })(t0); }); }
const FILMS = [["", "Wszystkie"], ["sw", "Star Wars"], ["lotr", "Władca Pierścieni"], ["hob", "Hobbit"], ["got", "Gra o tron"], ["hp", "Harry Potter"], ["pirates", "Piraci z Karaibów"], ["bond", "James Bond"], ["ij", "Indiana Jones"], ["mi", "Mission: Impossible"], ["dune", "Diuna"], ["nar", "Narnia"], ["int", "Interstellar"], ["sm", "Dźwięki muzyki"]];
function dname(r){ if (!filmMode || !r.fl) return r.n; const k = fFilm && r.fl[fFilm] ? fFilm : Object.keys(r.fl).find(x => (r.fm || []).includes(x)) || Object.keys(r.fl)[0]; const f = r.fl[k]; return f ? f + " (" + r.n.replace(/\s*\(.*\)$/, "") + ")" : r.n; }
function viewVal(){ return filmMode ? "m" : frMode ? "f" : "n"; }
function setView(v){
  if (v === "m") { if (filmMode) return; setFrMode(false); enterFilm(); return; }
  if (v === "f") { if (!Object.keys(FRD).length) { toast("Brak znajomych do pokazania"); viewSync(); return; } exitFilm(); setFrMode(true); viewSync(); return; }
  exitFilm(); setFrMode(false); viewSync();
}
function viewSync(){ dotsIn(); ["fview", "mfv"].forEach(i => { const e = $(i); if (e) e.value = viewVal(); }); }
function filmBar(){ $("filmchips").innerHTML = FILMS.map(([v, l]) => `<button data-f="${v}" class="${fFilm === v ? "on" : ""}">${l}</button>`).join(""); }
function enterFilm(){
  if (MODE === "w") setMode("s");
  filmMode = true; fFilm = ""; fCountry = ""; fGroup = ""; fMinKm = 0; fMinEl = 0; fMinR = 0; fPrice = 0; fCat = ""; fWx = ""; fWd = 0; fWs = 0; fWc = 0; fQ = ""; $("q").value = "";
  [["fcountry", ""], ["fminr", "0"], ["fcat", ""], ["fwx", ""], ["fwd", "0"], ["fwc", "0"]].forEach(([i, v]) => { const e = $(i); if (e) e.value = v; });
  setFStat("all"); showAll = true; document.body.classList.add("film"); filmBar(); renderList(); mapRefresh(); show("mapa"); buildDots();
}
function exitFilm(quiet){
  if (!filmMode) return;
  filmMode = false; fFilm = ""; document.body.classList.remove("film");
  if (!quiet) { showAll = false; renderList(); mapRefresh(); buildDots(); }
}
$("filmback").addEventListener("click", () => exitFilm());
$("filmchips").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; fFilm = b.dataset.f; filmBar(); renderList(); mapRefresh(); buildDots(); try { fit(); } catch (e) {} });
function setMode(m){
  if (m === MODE) return;
  closeSheet(); MODE = m; syncVisits();
  const T = m === "w" ? WINTER : SUMMER; R = T.R; G = T.G; byId = m === "w" ? byIdW : byIdS;
  document.body.classList.toggle("summer", m === "s"); flipUI();
  document.querySelectorAll("#mode button").forEach(b => b.classList.toggle("on", b.dataset.m === m));
    document.querySelector('#nav button[data-t="ranking"]').style.display = m === "w" ? "" : "none";
  document.querySelector('#nav button[data-t="wyjazdy"]').style.display = RO ? "none" : "";
  if (tripOpen) { const tt = allTrips().find(x => x.id === tripOpen); if (!tt || (tt.mode || "s") !== m) tripOpen = null; } packOpen = null; if ($("v-wyjazdy").classList.contains("on")) renderTrips();
  try { localStorage.setItem(LSM, m); } catch(e){}
  exitFilm(true); fCountry = ""; fCat = ""; $("fcat").value = ""; $("frow6").style.display = "none"; $("frow5").classList.toggle("sm", m !== "w"); fQ = ""; fSort = "k"; fMinKm = 0; fMinEl = 0; fGroup = ""; fMinR = 0; fPrice = 0; $("fminr").value = "0"; $("fminkm").value = "0"; $("fminel").value = "0"; $("frow2").style.display = m === "w" ? "" : "none"; $("q").value = ""; fWx = ""; fWd = 0; fWs = 0; fWc = 0; fixWxOpts(m); $("fwc").value = "0"; $("fwx").value = ""; $("fwd").value = "0"; $("fws").value = "0"; $("fwsort").value = ""; $("fsort").value = "k"; setFStat("all");
  $("fsort").options[0].textContent = m === "w" ? "Najwięksi" : "Najwięcej szlaków"; $("lview").style.display = m === "s" ? "" : "none";
  buildCountrySelect(); buildGroupSelect(); showAll = false; buildDots(); renderAll();
  const cur = (document.querySelector(".view.on") || {}).id || "v-mapa";
  if (cur === "v-ranking") show("mapa"); else if (cur !== "v-wyjazdy") { if (mapFitted) applyVB(); else fit(); }
}
document.querySelectorAll(".brand .tg").forEach(el => el.addEventListener("click", () => setMode(MODE === "w" ? "s" : "w")));
$("mode").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setMode(b.dataset.m); });
