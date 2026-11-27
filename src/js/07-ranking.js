/* ---------- ranking ---------- */
function renderTiers(){
  const vis = R.filter(r => isVis(r.id)).sort((x,y)=>(visits[y.id].r||0)-(visits[x.id].r||0) || y.k-x.k);
  const chip = r => `<button class="m on chip" data-id="${esc(r.id)}">${esc(r.n)}</button>`;
  const rows = TIERS.map(([t,c]) => {
    const a = vis.filter(r => visits[r.id].t === t);
    return `<div class="tier"><div class="lab" style="background:${c}">${t}</div><div class="box" data-t="${t}">${a.map(chip).join("")}</div></div>`;
  }).join("");
  const none = vis.filter(r => !visits[r.id].t);
  const plans = R.filter(r => isPlan(r.id));
  const wish = plans.length ? `<div class="card" style="margin-top:14px"><h3>📅 Lista życzeń</h3><div class="members" style="margin-top:8px">${plans.slice().sort((x,y)=>y.k-x.k).map(r => `<button class="m" data-id="${esc(r.id)}" style="border-color:rgba(255,198,92,.5);color:var(--warn)">${esc(r.n)}</button>`).join("")}</div></div>` : "";
  $("tiers").innerHTML = (vis.length ? `<div class="hint">Przytrzymaj miejsce i przeciągnij do wybranego tieru (S–D). Z powrotem na dół, żeby zdjąć tier. Dotknięcie otwiera szczegóły.</div>` : `<div class="empty">Oznacz kilka miejsc jako "Byłem", a potem ułożysz je tutaj w tier listę.</div>`) + rows +
    (vis.length ? `<div class="card" style="margin-top:14px"><h3>Do ułożenia</h3><div class="sub">Miejsca, w których byłeś i które nie mają jeszcze tieru.</div><div class="members pool box" data-t="">${none.map(chip).join("") || `<span class="small">Wszystko ułożone ✓</span>`}</div></div>` : "") + wish;
}
(function(){
  let drag = null;
  const host = $("tiers");
  const boxAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest(".box[data-t]") : null; };
  const noScroll = e => { if (drag && drag.on) e.preventDefault(); };
  document.addEventListener("touchmove", noScroll, {passive:false});
  host.addEventListener("contextmenu", e => { if (e.target.closest(".chip")) e.preventDefault(); });
  const scroller = () => { let n = host; while (n && n !== document.body) { const o = getComputedStyle(n).overflowY; if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return n; n = n.parentElement; } return document.scrollingElement || document.documentElement; };
  let raf = 0;
  const autoScroll = () => { raf = 0; if (!drag || !drag.on) return; const y = drag.cy, H = window.innerHeight, edge = 110; let dy = 0;
    if (y < edge + 40) dy = -Math.ceil((edge + 40 - y) / 6); else if (y > H - edge - 50) dy = Math.ceil((y - (H - edge - 50)) / 6);
    if (dy) { const sc = scroller(); sc.scrollTop += Math.max(-24, Math.min(24, dy)); const b = boxAt(drag.cx, drag.cy); if (drag.over && drag.over !== b) drag.over.classList.remove("over"); if (b) b.classList.add("over"); drag.over = b; }
    raf = requestAnimationFrame(autoScroll); };
  host.addEventListener("pointerdown", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    drag = {c, id:c.dataset.id, x:e.clientX, y:e.clientY, on:false, g:null, pid:e.pointerId, over:null};
    const mouse = e.pointerType === "mouse";
    drag.timer = setTimeout(() => start(), mouse ? 0 : 230);
  });
  function start(){
    if (!drag) return; drag.on = true; drag.c.classList.add("drag");
    const g = drag.c.cloneNode(true); g.classList.add("ghost"); g.classList.remove("drag"); document.body.append(g); drag.g = g;
    g.style.left = drag.x + "px"; g.style.top = drag.y + "px";
    drag.cx = drag.x; drag.cy = drag.y; if (!raf) raf = requestAnimationFrame(autoScroll);
    try { host.setPointerCapture(drag.pid); } catch(_){}
  }
  host.addEventListener("pointermove", e => {
    if (!drag) return;
    if (!drag.on) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) { clearTimeout(drag.timer); if (e.pointerType === "mouse") start(); else drag = null; } if (!drag || !drag.on) return; }
    drag.cx = e.clientX; drag.cy = e.clientY; if (!raf) raf = requestAnimationFrame(autoScroll);
    drag.g.style.left = e.clientX + "px"; drag.g.style.top = e.clientY + "px";
    const b = boxAt(e.clientX, e.clientY); if (drag.over && drag.over !== b) drag.over.classList.remove("over"); if (b) b.classList.add("over"); drag.over = b;
  });
  function end(e, cancel){
    if (!drag) return; const d = drag; drag = null; clearTimeout(d.timer);
    if (!d.on) return;
    d.c.classList.remove("drag"); d.g.remove(); if (d.over) d.over.classList.remove("over");
    d.moved = true; host._swallow = true; setTimeout(() => host._swallow = false, 0);
    const b = cancel ? null : boxAt(e.clientX, e.clientY);
    if (b && visits[d.id]) { visits[d.id].t = b.dataset.t; scheduleSave(); renderAll(); }
  }
  host.addEventListener("pointerup", e => end(e, false));
  host.addEventListener("pointercancel", e => end(e, true));
  host.addEventListener("click", e => { if (host._swallow) { e.stopPropagation(); return; } const b = e.target.closest(".m"); if (b) openSheet(b.dataset.id); }, true);
})();

