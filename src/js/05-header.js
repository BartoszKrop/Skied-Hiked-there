/* ---------- nagłówek ---------- */
function renderHeader(){
  const s = stats(), W = MODE === "w";
  document.title = (W ? "Skied there" : "Hiked there") + " · Mountained there";
  $("progBar").style.width = (100 * s.n / R.length) + "%"; countUp();
  $("hstats").innerHTML =
    `<div><b>${s.n}</b><small>z ${R.length} ${W ? "ośrodków" : "miejsc"}</small></div>` +
    `<div><b>${s.countries.size}</b><small>${s.countries.size===1?"kraj":"krajów"}</small></div>` +
    `<div><b>${W ? Math.round(s.km) : s.hikes}</b><small>${W ? "km tras" : plur(s.hikes,"szlak","szlaki","szlaków")}</small></div>` +
    (W ? (s.days > 0 ? `<div><b>${s.days}</b><small>${plur(s.days,"dzień na nartach","dni na nartach","dni na nartach")}</small></div>` : `<div><b>${s.stays}</b><small>${plur(s.stays,"wizyta","wizyty","wizyt")}</small></div>`) : (() => { const pl = R.filter(r => isPlan(r.id)).length; return `<div><b>${pl}</b><small>${pl===1?"w planach":"w planach"}</small></div>`; })());
  { const bs = [...document.querySelectorAll("#hstats b")], prev = window.__hs || [], key = MODE; window.__hs = bs.map(b => +b.textContent); if (window.__hsk !== key) { window.__hsk = key; return; }
    bs.forEach((b, i) => { const to = +b.textContent, from = prev[i]; if (from === undefined || from === to || Math.abs(to - from) > 400) return; const t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / 550), e = 1 - Math.pow(1 - k, 3); b.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }); }
}

