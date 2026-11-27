/* ---------- arkusz szczegółów ---------- */
let curId = null, confirmDel = false, armedStay = -1;
const stayKey = st => st.y + "-" + (st.m || "00");
function openSheet(id){
  if (curId !== id) hkOpen.clear(); curId = id; confirmDel = false; armedStay = -1;
  if (visits[id] && visits[id].s === "v") visits[id].stays.sort((a,b) => stayKey(b).localeCompare(stayKey(a)));
  renderSheet(); clearTimeout(closeSheet._t); const bg = $("sheetbg"); bg.classList.remove("out"); bg.style.display = "block"; const sh = $("sheet"); const was = sh.style.display === "block" && !sh.classList.contains("out"); sh.classList.remove("out"); sh.style.display = "block"; if (was) { sh.scrollTop = 0; mapRefresh(); return; } sh.classList.remove("open"); void sh.offsetWidth; sh.classList.add("open"); sh.scrollTop = 0; mapRefresh();
}
function closeSheet(){ const sh = $("sheet"), bg = $("sheetbg"), vis = sh.style.display === "block" && !sh.classList.contains("out"); curId = null; mapRefresh(); if (_vPulse && Date.now() - _vPulse.t < 8000 && !document.body.classList.contains("wide")) { const pid = _vPulse.id; _vPulse = null; setTimeout(() => mapPulse(pid), 180); } clearTimeout(closeSheet._t);
  if (!vis || matchMedia("(prefers-reduced-motion: reduce)").matches) { bg.style.display = "none"; sh.style.display = "none"; sh.classList.remove("out"); bg.classList.remove("out"); return; }
  sh.classList.remove("open"); sh.classList.add("out"); bg.classList.add("out"); closeSheet._t = setTimeout(() => { sh.style.display = "none"; bg.style.display = "none"; sh.classList.remove("out"); bg.classList.remove("out"); }, 200); }
$("sheetbg").addEventListener("click", closeSheet);
function toggleHike(i){
  if (!visits[curId]) visits[curId] = newEntry("v");
  const v = visits[curId]; v.s = "v"; v.hr = v.hr || {}; v.hp = v.hp || {}; if (v.done[i]) { delete v.done[i]; delete v.hr[i]; } else { v.done[i] = 1; delete v.hp[i]; }
  scheduleSave(); renderAll(); renderSheet();
}
function togglePlanHike(i){
  if (!visits[curId]) visits[curId] = newEntry("p");
  const v = visits[curId]; v.hp = v.hp || {};
  if (v.hp[i]) delete v.hp[i]; else { v.hp[i] = 1; if (v.done[i]) { delete v.done[i]; if (v.hr) delete v.hr[i]; if (v.hn) delete v.hn[i]; } }
  scheduleSave(); renderAll(); renderSheet();
}
function setHikeRating(i, n){
  if (!visits[curId]) visits[curId] = newEntry("v");
  const v = visits[curId]; v.s = "v"; v.hr = v.hr || {}; v.done[i] = 1;
  if (v.hr[i] === n) delete v.hr[i]; else v.hr[i] = n;
  scheduleSave(); renderAll(); renderSheet();
}
let szOpenSk = null; const hkOpen = new Set();
function toggleSz(sk){
  if (!visits[curId]) visits[curId] = newEntry("v");
  const v = visits[curId]; v.s = "v"; v.sz = v.sz || {};
  if (v.sz[sk]) delete v.sz[sk]; else v.sz[sk] = {r: 0};
  scheduleSave(); renderAll(); renderSheet();
}
function setSzRating(sk, n){
  const v = visits[curId]; if (!v || !v.sz || !v.sz[sk]) return;
  v.sz[sk].r = (v.sz[sk].r === n) ? 0 : n; scheduleSave(); renderAll(); renderSheet();
}
function hsh(str){ let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function sheetNav(){
  const L = LISTIDS, i = L.indexOf(curId); if (i < 0 || L.length < 2) return "";
  const cc = (byId[curId].c || "").split(",")[0], C = L.filter(id => byId[id] && (byId[id].c || "").split(",")[0] === cc), k = C.indexOf(curId);
  return `<div class="snav"><button type="button" id="sprev" ${i ? "" : "disabled"} aria-label="Poprzednie">‹</button><span>${C.length > 1 ? `${esc(cname(cc))} · ${k + 1} / ${C.length}` : `${i + 1} / ${L.length}`}</span><button type="button" id="snext" ${i < L.length - 1 ? "" : "disabled"} aria-label="Następne">›</button></div>`;
}
function renderSheet(){
  const r = byId[curId]; if (!r) return; const v = visits[curId], W = MODE === "w";
  const tags = W ? r.g.map(g => `<span>${esc(g)}</span>`).join("") : "";
  const href = (W && r.w) ? esc(r.w) : "https://www.google.com/search?q=" + encodeURIComponent(W ? r.n + " skipass cennik" : r.n + " szlaki piesze");
  const mapHref = W ? `https://openskimap.org/#13/${r.y}/${r.x}` : `https://hiking.waymarkedtrails.org/#?map=13!${r.y}!${r.x}`;
  const link = `<a class="lnk" target="_blank" rel="noopener" href="${href}">${W ? (r.w ? "Strona ośrodka ↗" : "Więcej informacji ↗") : "Więcej informacji ↗"}</a>`;
  const showOp = !RO && SBC && store.sb && !(v && v.s === "v");
  const fa = [];
  const opblock = !showOp ? "" : `<div class="sect"><div class="sh" style="justify-content:flex-start;gap:10px"><b>Opinie</b>${ratingLine(r.id)}</div><div id="opfr">${friendsHtml(r.id)}</div><div id="opsec">${opinionsHtml(r.id)}</div></div>`;
  const secOn = r.id === "h-camino";
  let lastSec = null, lastDf = -2;
  const hikeCards = W ? "" : hikeOrder(r).map(i => { const h = r.hikes[i]; if (h.del) return "";
    const d = !!(v && v.done[i]), pl = !!(v && v.hp && v.hp[i]); if (RO && !d) return "";
    const onlyPlan = !!(v && v.s === "p");
    const dfi = DIFF.indexOf(h.d), dfh = (!secOn && dfi !== lastDf && r.hikes.length > 3) ? `<div class="small dfh" style="margin:12px 0 4px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${["Łatwe", "Średnie", "Trudne"][dfi < 0 ? 1 : dfi]}</div>` : ""; if (!secOn) lastDf = dfi;
    const sh = dfh + ((secOn && h.s && h.s !== lastSec) ? `<div class="small" style="margin:12px 0 6px;font-weight:700;letter-spacing:.03em;text-transform:uppercase">${esc(h.s)}</div>` : ""); if (secOn && h.s) lastSec = h.s;
    const note = (v && v.hn && v.hn[i]) || "";
    const noteUi = RO ? (note ? `<div class="hnro" data-nt>${IC.note} ${esc(note)}</div>` : "") : (d ? `<textarea class="hnote" data-h="${i}" rows="2" placeholder="Notatka do tego szlaku…">${esc(note)}</textarea>` : "");
    const hk = curId + ":" + i, op = hkOpen.has(hk);
    const q = RATEH[r.id] && RATEH[r.id][i], avg = (q && q.n) ? `<span class="hkavg">★ ${fmtAvg(q.a)} <i>(${q.n})</i></span>` : "";
    const myR = (d && v.hr && v.hr[i]) ? `<span class="hkmy">${"★".repeat(v.hr[i])}</span>` : "";
    const ate = !!(h.sk && v && v.sz && v.sz[h.sk]);
    const frH = hikeFriends(r, i, v);
    const szRow = (!RO && h.sk && v && v.s === "v") ? `<div class="szrow" style="margin:6px 0"><span style="flex:1;min-width:120px">🥧 ${esc(h.sk)}</span><button class="szb ${ate ? "on" : ""}" data-sk="${esc(h.sk)}">${ate ? "Jadłem ✓" : "Jadłem?"}</button>${ate ? `<span class="szs">${[1,2,3,4,5].map(k => `<button data-sk="${esc(h.sk)}" data-i="${k}" class="${((v.sz[h.sk].r||0)>=k)?"on":""}">★</button>`).join("")}</span>` : ""}</div>` : "";
    const stars = (d && !RO) ? `<div class="hkrl"><span class="small">Twoja ocena</span><div class="szs hs">${[1,2,3,4,5].map(k => `<button data-h="${i}" data-i="${k}" aria-label="${k} z 5" class="${(v.hr && v.hr[i] >= k) ? "on" : ""}">★</button>`).join("")}</div></div>` : "";
    const acts = `<div class="hka"><a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(h.n + " " + r.n + " szlak")}"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg> Więcej informacji</a>${!RO ? `<button class="btn sm hktrip" data-h="${i}">${IC.plus} Do wyjazdu</button>` : ""}${(!RO && SBC && store.sb) ? `<button class="btn sm hkrep" data-h="${i}">${IC.warn} Zgłoś błąd</button>` : ""}${(store.admin && !RO && SBC) ? `<button class="btn sm hkdel" data-h="${i}" title="Usuń szlak (admin)" aria-label="Usuń szlak (admin)">${IC.trash}</button>` : ""}</div>`;
    return sh + `<div class="hike hk2 ${d?"done":""} ${pl?"planned":""} ${op?"op":""}">
      ${RO ? `<button class="tick ${d?"on":""}" data-h="${i}" aria-label="Zrobiłem">✓</button>` : `<div class="tk2">${onlyPlan ? "" : `<button class="tick ${d?"on":""}" data-h="${i}" aria-label="Byłem">✓</button>`}<button class="tick plan ${pl?"pon":""}" data-p="${i}" aria-label="Planuję">◷</button></div>`}
      <div class="hb"><button type="button" class="hkhead" data-o="${i}" aria-expanded="${op}"><span class="hkt"><span class="hkn">${esc(h.n)}</span><span class="hkm"><span class="d${dfi < 0 ? 1 : dfi} hdf">${esc(h.d)}</span>${h.t ? `<span class="hkti">${IC.clock}${esc(h.t)}</span>` : ""}${myR}${avg}${ate ? `<span class="hkpie2">🥧</span>` : ""}${frH ? `<span class="hkfr">${IC.users}</span>` : ""}</span></span><span class="hkch">${IC.chev}</span></button>
      ${h.o ? `<p class="hkd">${esc(h.o)}</p>` : ""}${op ? `<div class="hkx">${frH}${stars}${noteUi}${szRow}${acts}</div>` : ""}</div></div>`; }).join("");
  const frsec = (!showOp && !RO && friendsHtml(r.id)) ? `<div id="opfr">${friendsHtml(r.id)}</div>` : "";
  const hikes = W ? "" : (RO && !hikeCards ? "" : `<div class="sect"><div class="sh"><b>${RO ? "Gdzie był" : "Dokąd można dojść"}</b>${(secOn || r.hikes.length < 4) ? "" : `<button class="btn sm" id="hkdir" type="button" onclick="toggleHkDir()" style="padding:4px 10px;font-size:12px">${hkDir > 0 ? "Od łatwych ↓" : "Od trudnych ↑"}</button>`}</div>${RO ? "" : `<div class="small" style="margin:-4px 0 8px">Zaznacz miejsca, w których byłeś. Albo po prostu „Byłem” powyżej, jeśli nie pamiętasz nazw.</div>`}${hikeCards}</div>`);
  const sks0 = W ? [] : [...new Set(r.hikes.map(h => h.sk).filter(Boolean))];
  const sks = RO ? sks0.filter(sk => v && v.sz && v.sz[sk]) : sks0;
  const szList = () => sks.map(sk => { const z = v.sz && v.sz[sk]; return `<div class="szrow"><span style="flex:1;min-width:140px">${esc(sk)}</span><button class="szb ${z?"on":""}" data-sk="${esc(sk)}">${z ? "Jadłem ✓" : "Jadłem?"}</button>${z ? `<span class="szs">${[1,2,3,4,5].map(i => `<button data-sk="${esc(sk)}" data-i="${i}" class="${(z.r||0)>=i?"on":""}">★</button>`).join("")}</span>` : ""}</div>`; }).join("");
  const szsec = (RO && sks.length && v && v.s === "v") ? `<div class="sect"><div class="sh"><b>Szarlotki w schroniskach</b></div>${szList()}</div>` : "";
  let body = "", top = "";
  if (!v) {
    top = `<div class="two" style="margin:4px 0 12px"><button class="btn ok" id="sadd">✓ Byłem</button><button class="btn warn" id="splan">${IC.cal} Planuję</button></div>`;
  } else {
    const seg = `<div class="seg" id="sstat" style="margin:4px 0 2px"><button data-s="v" class="${v.s==="v"?"on":""}">✓ Byłem</button><button data-s="p" class="${v.s==="p"?"on":""}">${IC.cal} Planuję</button></div>`;
    let mid = "";
    if (v.s === "v") {
      mid = `<div class="sect"><div class="sh"><b>${W ? "Wizyty" : "Kiedy byłem"}</b><button class="btn sm pri" id="saddstay">${W ? "+ Dodaj wizytę" : "+ Dodaj rok"}</button></div>
        ${v.stays.length ? v.stays.map((st,i) => `<div class="stay" data-i="${i}">
            <div class="dt"><select class="sel" data-k="y">${yearOpts(st.y, cy, Math.min(1980, +st.y || 1980), true)}</select></div>
            <div class="dt"><select class="sel" data-k="m">${monthOpts(st.m)}</select></div>
            ${W ? `<input class="lin sdy" inputmode="numeric" maxlength="2" placeholder="dni" aria-label="Dni na nartach" value="${+st.d > 0 ? +st.d : ""}">` : ""}
            <button class="x ${armedStay===i?"arm":""}" data-del="${i}">${armedStay===i?"Usunąć?":"✕"}</button></div>`).join("") : `<div class="small">${W ? "Jeszcze bez wizyt. Dodaj wizytę (rok, opcjonalnie miesiąc)." : "Jeszcze bez roku. Dodaj rok (i opcjonalnie miesiąc), w którym tu byłeś."}</div>`}
      </div>
      <div class="fld"><label>OCENA (GWIAZDKI)</label><div class="stars" id="sstars">${[1,2,3,4,5].map(i => `<button data-i="${i}" class="${(v.r||0)>=i?"on":""}">★</button>`).join("")}</div></div>
      `;
    } else {
      mid = "";
    }
    top = seg; body = mid + (v.s === "v" ? `<div class="fld"><label>NOTATKA / OPINIA</label><textarea id="snote" placeholder="np. śnieg, kolejki, z kim, gdzie jedliśmy…">${esc(v.n||"")}</textarea></div>` : "") + ``;
  }
  const t1 = W ? `<div class="tile"><b>${Math.round(r.k*10)/10}</b><span>km tras zjazdowych</span></div>` : `<div class="tile"><b>${liveN(r)}</b><span>szlaków poniżej</span></div>`;
  const gpill = (W && r.g.length) ? `<span class="gpill">${esc(r.g[r.g.length-1])}</span>` : "", t2 = W ? "" : `<div class="tile"><b>${v ? Object.keys(v.done).length : 0}/${liveN(r)}</b><span>zrobionych</span></div>`;
  $("sheet").innerHTML = `<div class="grab"></div>
    ${sheetNav()}<div class="hero hsil"><svg class="hsv" viewBox="0 0 200 80" preserveAspectRatio="xMaxYMax meet" aria-hidden="true"><path d="M0 80 L50 24 L74 52 L104 8 L150 62 L170 40 L200 80 Z"/></svg><div class="flg">${flag(r.c.split(",")[0])}</div><div><h2 class="${r.n.length > 26 ? "hl2" : r.n.length > 16 ? "hl1" : ""}">${esc(r.n)}${gpill}</h2><div class="meta">${r.c.split(",").map(c => esc(cname(c))).join(", ")}${W ? " " + pbadge(r) : ""}${(SBC && ratingLine(r.id)) ? " · " + ratingLine(r.id) : ""}</div></div><button class="hgear" id="hgear" title="Opcje" aria-label="Opcje"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg></button></div>
    ${r.ds ? `<div style="margin:10px 2px 2px;font-size:13px;line-height:1.5;color:var(--mute)">${esc(r.ds)}</div>` : ""}
    <div class="tiles">${t1}${t2}${W && r.e ? `<div class="tile"><b>${r.e} m</b><span>najwyższy punkt</span></div>` : W ? "" : (() => { const L = r.hikes.filter(x => !x.del), c = [0,1,2].map(i => L.filter(x => x.d === DIFF[i]).length); const T = c[0] + c[1] + c[2] || 1; return `<div class="tile dbt"><div class="dbar">${c.map((n, k) => n ? `<i class="db${k}" style="flex:${n}"></i>` : "").join("")}</div><span>${["łatwe", "średnie", "trudne"].map((w, k) => c[k] ? `${c[k]}&nbsp;<em class="dbl">${w}</em>` : "").filter(Boolean).join(" · ")}</span></div>`; })()}</div><div class="small wxn" id="wxn" style="margin:8px 2px 0;min-height:16px"></div>
    <a class="offl" target="_blank" rel="noopener" href="${href}">${W ? (r.w ? "Oficjalna strona ośrodka" : "Więcej informacji") : "Więcej informacji"} <span>↗</span></a>
    ${(W && r.auto && !RO && SBC) ? `<div class="small" style="margin:8px 2px;color:var(--warn)">⚠ Kilometry tras i wysokość dodane automatycznie, możliwe błędy. <button class="btn sm" id="sgfix" style="margin-left:4px">Zaproponuj poprawę</button></div>` : (W && r.auto) ? `<div class="small" style="margin:8px 2px;color:var(--warn)">⚠ Kilometry tras i wysokość dodane automatycznie, możliwe błędy.</div>` : ""}${top}${opblock}${frsec}${hikes}${szsec}${body}
    <div style="margin-top:12px"><button class="btn" id="sclose" style="width:100%">Zamknij</button></div>`;
  $("sclose").onclick = closeSheet;
  document.querySelectorAll("#sheet .fgo3").forEach(b => b.onclick = () => openProfile(b.dataset.u));
  document.querySelectorAll("#sheet .hnote").forEach(t => t.oninput = () => { const v = visits[curId]; if (!v) return; v.hn = v.hn || {}; const i = +t.dataset.h; if (t.value.trim()) v.hn[i] = t.value; else delete v.hn[i]; scheduleSave(); });
  { const fx = $("sgfix"); if (fx) fx.onclick = () => { closeSheet(); openSuggest(r.n, r); };
  { const go = d => { const L = LISTIDS, i = L.indexOf(curId) + d; if (i >= 0 && i < L.length) { hkOpen.clear(); curId = L[i]; confirmDel = false; armedStay = -1; renderSheet(); $("sheet").scrollTop = 0; mapRefresh(); } }; const a = $("sprev"), b = $("snext"); if (a) a.onclick = () => go(-1); if (b) b.onclick = () => go(1); }
  const hg = $("hgear"); if (hg) hg.onclick = e => { e.stopPropagation(); let p = $("nickpop"); if (!p) { p = document.createElement("div"); p.id = "nickpop"; document.body.append(p); }
    const canRep = !RO && SBC && store.sb; p.innerHTML = `<button data-a="w">${W ? (r.w ? "Strona ośrodka ↗" : "Ceny karnetów ↗") : "Szlaki i informacje ↗"}</button>${canRep ? `<button data-a="e">${IC.warn} Zgłoś błąd w danych</button>` : ""}${(canRep && !W) ? `<button data-a="h">＋ Dodaj brakujący szlak</button>` : ""}${(canRep && store.admin) ? `<button data-a="a">${IC.edit} Edytuj dane (admin)</button><button data-a="d" style="color:#ff8a8a">${IC.trash} Usuń ośrodek (admin)</button>` : ""}`; p.style.display = "flex";
    const b = hg.getBoundingClientRect(), w = p.offsetWidth; p.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, b.right - w)) + "px"; p.style.top = (b.bottom + 6) + "px";
    p.onclick = ev => { const bt = ev.target.closest("button"); if (!bt) return; hideNickPop(); if (bt.dataset.a === "w") window.open((W && r.w) ? r.w : "https://www.google.com/search?q=" + encodeURIComponent(W ? r.n + " skipass cennik" : r.n + " szlaki piesze"), "_blank", "noopener"); else if (bt.dataset.a === "a") { closeSheet(); openEditPlace(r, null); } else if (bt.dataset.a === "d") { adminHidePlace(r); } else if (bt.dataset.a === "h") { closeSheet(); openAddHike(r, null); } else { closeSheet(); openSuggest(r.n, r); } }; }; }
  if (!RO && SBC && store.sb && $("opsec")) loadOpinions(r.id);
  document.querySelectorAll("#sheet .hkrep").forEach(b => b.onclick = () => { const h = r.hikes[+b.dataset.h]; if (h) openHikeReport(r, h); });
  document.querySelectorAll("#sheet .hktrip").forEach(b => b.onclick = () => { const h = r.hikes[+b.dataset.h]; if (h) pickTripFor(r.id, h.n); });
  document.querySelectorAll("#sheet .hkdel").forEach(b => b.onclick = async () => { const h = r.hikes[+b.dataset.h]; if (!h) return;
    if (!askTosia("Usunięcie szlaku „" + h.n + "” (" + r.n + ")")) return;
    try { const ins = await store.sb.from("suggestions").insert({user_id: store.uid, username: (store.prof && store.prof.username) || store.name || "", mode: "s", name: ("Usunięcie szlaku: " + r.n).slice(0, 120), country: "", note: ("#id:" + r.id + " · usuń szlak: " + h.n).slice(0, 500)}); if (ins && ins.error) throw ins.error;
      alert("Dodano do propozycji zmian. Usunięcie zatwierdzisz w panelu admina.");
    } catch(e){ alert("Nie udało się: " + String((e && e.message) || e).slice(0, 90)); } });
  { const wb = $("wxn"); if (wb) wxNow(r).then(w => { if (w && wb.isConnected) wb.innerHTML = `<span style="opacity:.7">Teraz:</span> ` + wxNowHtml(r, w); }); }
  document.querySelectorAll("#sheet .hike .tick[data-h]").forEach(b => b.onclick = () => { const i = +b.dataset.h, k = curId + ":" + i; if (!(visits[curId] && visits[curId].done[i])) hkOpen.add(k); toggleHike(i); });
  document.querySelectorAll("#sheet .hkhead").forEach(b => b.onclick = () => { const k = curId + ":" + b.dataset.o; if (hkOpen.has(k)) hkOpen.delete(k); else hkOpen.add(k); renderSheet(); });
  document.querySelectorAll("#sheet .hike .tick[data-p]").forEach(b => b.onclick = () => togglePlanHike(+b.dataset.p));
  document.querySelectorAll("#sheet .szb").forEach(b => b.onclick = () => toggleSz(b.dataset.sk));
  document.querySelectorAll("#sheet .hkpie").forEach(b => b.onclick = () => { szOpenSk = szOpenSk === b.dataset.sk ? null : b.dataset.sk; renderSheet(); });
  document.querySelectorAll("#sheet .hkgear").forEach(b => b.onclick = () => { const m = document.querySelector('#sheet .hkmenu[data-h="' + b.dataset.h + '"]'); if (m) m.style.display = m.style.display === "none" ? "block" : "none"; });
  document.querySelectorAll("#sheet .hs button").forEach(b => b.onclick = () => setHikeRating(+b.dataset.h, +b.dataset.i));
  document.querySelectorAll("#sheet .szs:not(.hs) button").forEach(b => b.onclick = () => setSzRating(b.dataset.sk, +b.dataset.i));
  if (!v) { $("sadd").onclick = () => { setStatus(curId, "v"); renderSheet(); }; $("splan").onclick = () => { setStatus(curId, "p"); renderSheet(); }; return; }
  $("sstat").onclick = async e => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.s === v.s) {
      const has = (v.stays && v.stays.length) || v.r || (v.n || "").trim() || v.t || Object.keys(v.done || {}).length || Object.keys(v.hr || {}).length || Object.keys(v.hp || {}).length || Object.keys(v.hn || {}).length || Object.keys(v.sz || {}).length;
      if (has && !(await appConfirm("Odznaczyć? Twoje oceny, notatki i wizyty dla tego miejsca zostaną usunięte."))) return;
      const bk = JSON.parse(JSON.stringify(v)), bid = curId; delete visits[curId]; scheduleSave(); renderAll(); renderSheet(); toastUndo("Usunięto z mapy", () => { visits[bid] = bk; scheduleSave(); renderAll(); if (curId === bid) renderSheet(); }); return;
    }
    setStatus(curId, b.dataset.s); renderSheet(); };
  let nt; if ($("snote")) $("snote").oninput = e => { visits[curId].n = e.target.value; clearTimeout(nt); nt = setTimeout(scheduleSave, 400); };
  if (v.s === "p") {
    return;
  }
  $("saddstay").onclick = () => { visits[curId].stays.push({y: "", m: "", d: 0}); armedStay = -1; scheduleSave(); renderAll(); renderSheet(); };
  document.querySelectorAll("#sheet .stay").forEach(row => {
    const i = +row.dataset.i;
    row.querySelectorAll("select").forEach(inp => inp.onchange = e => { visits[curId].stays[i][inp.dataset.k] = e.target.value; visits[curId].stays = sortStays(visits[curId].stays); armedStay = -1; scheduleSave(); renderAll(); renderSheet(); });
    const dy = row.querySelector(".sdy"); if (dy) dy.oninput = () => { const n = Math.min(99, Math.max(0, parseInt(dy.value, 10) || 0)); visits[curId].stays[i].d = n; scheduleSave(); renderAll(); };
    row.querySelector(".x").onclick = () => {
      if (armedStay !== i) { armedStay = i; renderSheet(); setTimeout(() => { if (armedStay === i) { armedStay = -1; if (curId) renderSheet(); } }, 3000); }
      else { visits[curId].stays.splice(i, 1); armedStay = -1; scheduleSave(); renderAll(); renderSheet(); }
    };
  });
  $("sstars").onclick = e => { const b = e.target.closest("button"); if (!b) return; const i = +b.dataset.i; visits[curId].r = (visits[curId].r === i) ? 0 : i; scheduleSave(); renderAll(); renderSheet(); };
}

