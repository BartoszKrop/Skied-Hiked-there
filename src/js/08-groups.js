/* ---------- grupy ---------- */
function groupsHtml(){
  const a = G.filter(g => g.m.length >= 2).sort((x,y)=>{
    const px = x.m.filter(isVis).length / x.m.length, py = y.m.filter(isVis).length / y.m.length; return (py - px) || (y.k - x.k); });
  return `<div class="hint">Duże domeny narciarskie. Liczą się ośrodki z Twojej listy należące do grupy.</div>` +
    a.map(g => {
      const done = g.m.filter(isVis).length, tot = g.m.length, full = done === tot;
      return `<div class="card"><h3>${full?"🏆 ":""}${esc(g.n)}</h3>
        <div class="sub">${g.c.split(",").map(flag).join(" ")} ${Math.round(g.k)} km tras · ${done} z ${tot} ośrodków</div>
        <div class="bar"><i class="${full?"full":""}" style="width:${100*done/tot}%"></i></div>
        <div class="members">${g.m.map(id => `<button class="m ${isVis(id)?"on":""}" data-id="${esc(id)}">${esc(byId[id].n)}</button>`).join("")}</div></div>`;
    }).join("");
}
$("stats").addEventListener("click", e => { const b = e.target.closest(".m"); if (b) openSheet(b.dataset.id); });
