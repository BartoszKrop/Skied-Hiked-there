let MODE = "w";
const WINTER = {R: DATA.resorts, G: DATA.groups};
const SUMMER = {R: (DATA.hubs || []).map(h => ({id:h.id, n:h.n, full:h.n, c:h.c, r:h.r, l:"", k:h.hikes.length, cs:[...new Set(h.hikes.map(k => k.ct || "g"))], g:[], x:h.x, y:h.y, ds:h.ds, fo:h.fo, fl:h.fl, fm:[...new Set(h.hikes.flatMap(k => k.fm || []))], hikes:h.hikes})), G: []};
const byIdW = {}, byIdS = {}; WINTER.R.forEach(r => byIdW[r.id] = r); SUMMER.R.forEach(r => byIdS[r.id] = r);
let R = WINTER.R, G = WINTER.G, byId = byIdW;
