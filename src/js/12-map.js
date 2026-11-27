/* ---------- mapa ---------- */
const svg = $("map"), NS = "http://www.w3.org/2000/svg";
const COS = Math.cos(47 * Math.PI / 180);
const px = lon => lon * COS, py = lat => -lat;
const WW = 360 * COS, WH = 180;
let vb = {x:0, y:0, w:10, h:10}, base = null, dots = [], gGrat, gLand, gTile, gDots, gLbl, gClu, CLU = [];
const mk = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };

function tileG(vb, wpx){
    const lon0 = vb.x / COS, lon1 = (vb.x + vb.w) / COS, lat0 = -vb.y, lat1 = -(vb.y + vb.h), mer = la => { const r = la * Math.PI / 180; return Math.log(Math.tan(r) + 1 / Math.cos(r)); };
    let z = Math.max(3, Math.min(16, Math.round(Math.log2(wpx * 360 / (256 * (lon1 - lon0)))))), tx0, tx1, ty0, ty1;
    for (;;) { const n = Math.pow(2, z); tx0 = Math.floor((lon0 + 180) / 360 * n); tx1 = Math.floor((lon1 + 180) / 360 * n); ty0 = Math.floor((1 - mer(Math.min(85, lat0)) / Math.PI) / 2 * n); ty1 = Math.floor((1 - mer(Math.max(-85, lat1)) / Math.PI) / 2 * n); if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= 30 || z <= 3) break; z--; }
    const n = Math.pow(2, z), la = ty => Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n))) * 180 / Math.PI; let o = "";
    for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) { if (x < 0 || x >= n || y < 0 || y >= n) continue; const a = x / n * 360 - 180, b = (x + 1) / n * 360 - 180, t0 = la(y), t1 = la(y + 1); o += `<image href="https://${"abc"[(x + y) % 3]}.tile.opentopomap.org/${z}/${x}/${y}.png" x="${px(a)}" y="${py(t0)}" width="${px(b) - px(a)}" height="${t0 - t1}" preserveAspectRatio="none" opacity=".92"/>`; }
    return o;
}
let TER = false, tileRaf = 0;
function tileUpd(force){
  if (tileRaf) return; tileRaf = requestAnimationFrame(() => { tileRaf = 0; if (!gTile) return;
    const on = TER && vb.w / COS < 28, str = on ? tileG(vb, svg.getBoundingClientRect().width || 360) : "";
    if (force || str !== gTile._s) { gTile.innerHTML = str; gTile._s = str; }
    const ta = $("tattr"); if (ta) ta.style.display = on ? "" : "none"; });
}
