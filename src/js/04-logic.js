/* ---------- logika ---------- */
const isVis = id => !!visits[id] && visits[id].s === "v";
const isPlan = id => !!visits[id] && visits[id].s === "p";
const newEntry = st => ({s: st, stays: [], pd: "", pr: 0, r: 0, t: "", n: "", done: {}, sz: {}, hr: {}, hn: {}});
function setStatus(id, st){
  const was = visits[id] && visits[id].s;
  if (!visits[id]) visits[id] = newEntry(st); else visits[id].s = st;
  scheduleSave(); renderAll();
  if (st !== was) { if (st === "v") { burst(); toast("Zapisano na mapie ✓ · " + R.filter(r => isVis(r.id)).length + " z " + R.length); } else if (st === "p") toast("Dodano do planów"); }
}
function stats(){
  const v = R.filter(r => isVis(r.id));
  const countries = new Set(); v.forEach(r => r.c.split(",").forEach(c => countries.add(c)));
  const km = v.reduce((s, r) => s + r.k, 0);
  let stays = 0, hikes = 0, days = 0; v.forEach(r => { stays += visits[r.id].stays.length; visits[r.id].stays.forEach(x => { days += +x.d || 0; }); hikes += Object.keys(visits[r.id].done).length; });
  const gdone = G.filter(g => g.m.length >= 2 && g.m.every(isVis)).length;
  return {n:v.length, countries, km, stays, days, hikes, gdone};
}
const lastYear = id => { const y = visits[id].stays.map(x => x.y).filter(Boolean).sort(); return y.length ? y[y.length-1] : ""; };

