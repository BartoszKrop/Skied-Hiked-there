// Buduje stronę z plików w src/ do katalogu głównego (GitHub Pages serwuje main /).
// Wynik: index.html + assets/app.<hash>.js, assets/data.<hash>.js, assets/app.<hash>.css + sw.js.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { transform } from "esbuild";

const rd = p => readFileSync(p, "utf8");
const hash = s => createHash("sha256").update(s).digest("hex").slice(0, 10);

const jsFiles = readdirSync("src/js").filter(f => /^\d\d-.*\.js$/.test(f)).sort();
const appSrc = jsFiles.map(f => rd("src/js/" + f)).join("");
const appVer = (appSrc.match(/const APPV = "(v\d+)"/) || [])[1];
if (!appVer) throw new Error("Brak const APPV w src/js");

// Kod to zwykły (nie-modułowy) skrypt: funkcje są globalne i wołane z atrybutów onclick,
// więc esbuild nie zmienia nazw na najwyższym poziomie, tylko skraca resztę.
const app = (await transform(appSrc, { minify: true, target: "es2020", legalComments: "none", charset: "utf8" })).code;
const data = rd("src/js/data.js");
const css = (await transform(rd("src/app.css"), { loader: "css", minify: true, target: ["safari14", "chrome90", "firefox90"], charset: "utf8" })).code;

if (existsSync("assets")) rmSync("assets", { recursive: true });
mkdirSync("assets");
const out = {};
for (const [name, ext, body] of [["app", "js", app], ["data", "js", data], ["app", "css", css]]) {
  const fn = `assets/${name}.${hash(body)}.${ext}`; writeFileSync(fn, body); out[name + "." + ext] = fn;
}

let html = rd("src/index.html");
html = html.replace("<!--@CSS-->", `<link rel="stylesheet" href="${out["app.css"]}">`);
html = html.replace("<!--@JS-->", `<script src="${out["data.js"]}"></script>\n<script src="${out["app.js"]}"></script>`);
writeFileSync("index.html", html);

const sw = rd("src/sw.js").replace("__VER__", appVer).replace('"__ASSETS__"', Object.values(out).map(f => JSON.stringify(f)).join(", "));
writeFileSync("sw.js", sw);

const kb = f => (readFileSync(f).length / 1024).toFixed(0) + " KB";
console.log(appVer, Object.values(out).map(f => f + " " + kb(f)).join(" · "), "· index.html " + kb("index.html"));
