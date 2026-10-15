#!/usr/bin/env node
// Legt eine Excalidraw-Zeichnung für den Vault an und exportiert sie als SVG
// (T-156). Grosse Bilder der Dokumentation sind Zeichnungen und keine
// Mermaid-Blöcke mehr: Mermaid ordnet dreissig Knoten selbst an, und keiner
// steht dort, wo man ihn sucht.
//
//   node scripts/excalidraw.mjs <beschreibung.json> [<ziel ohne Endung>]
//
// Die Beschreibung nennt Kästen (mit Lage und Grösse), Pfeile und Rahmen.
// Geschrieben werden `<ziel>.excalidraw.md` (Format des Obsidian-Plugins,
// unkomprimiert) und `<ziel>.excalidraw.svg` daneben — derselbe Name, den
// das Plugin beim automatischen Ausfuhr schreibt (`autoexportSVG`). Wer die
// Zeichnung danach in Obsidian ändert, überschreibt damit das SVG; die
// Beschreibung ist nur der Anfang und wird nicht nachgezogen.
//
// Beschreibung:
// {
//   "titel": "…",                       // steht als Kommentar im SVG
//   "rahmen": [{ "x", "y", "w", "h", "text" }],          // gestrichelt, Text oben links
//   "kaesten": [{ "id", "x", "y", "w", "h", "text", "farbe"?, "form"? }],
//   "pfeile": [{ "von", "nach", "text"?, "gestrichelt"? }],
//   "texte": [{ "x", "y", "text", "groesse"? }]
// }
// `farbe` ist ein Name aus FARBEN, `form` "rechteck" (Vorgabe) oder "ellipse".
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const FARBEN = {
  grau: { strich: "#495057", fuell: "#f1f3f5" },
  blau: { strich: "#1971c2", fuell: "#d0ebff" },
  gruen: { strich: "#2f9e44", fuell: "#d3f9d8" },
  gelb: { strich: "#e67700", fuell: "#fff3bf" },
  rot: { strich: "#c92a2a", fuell: "#ffe3e3" },
  violett: { strich: "#6741d9", fuell: "#e5dbff" },
  weiss: { strich: "#1e1e1e", fuell: "#ffffff" },
};
const SCHRIFT = 16;
const ZEILE = 1.25;

const [quelle, zielArg] = process.argv.slice(2);
if (!quelle) {
  console.error(
    "Aufruf: node scripts/excalidraw.mjs <beschreibung.json> [<ziel>]",
  );
  process.exit(1);
}
const spec = JSON.parse(readFileSync(quelle, "utf8"));
const ziel =
  zielArg ?? join(dirname(quelle), basename(quelle).replace(/\.json$/, ""));

// Feste Startwerte statt Zufall: ein zweiter Lauf schreibt dieselbe Datei,
// und der Diff zeigt nur, was sich an der Beschreibung geändert hat.
let saat = 1;
const zahl = () => (saat = (saat * 48271) % 2147483647);

const basis = (id, typ, x, y, w, h, extra = {}) => ({
  id,
  type: typ,
  x,
  y,
  width: w,
  height: h,
  angle: 0,
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 0,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: zahl(),
  version: 1,
  versionNonce: zahl(),
  isDeleted: false,
  boundElements: [],
  updated: 1,
  link: null,
  locked: false,
  ...extra,
});

const text = (id, x, y, w, inhalt, extra = {}) => {
  const zeilen = inhalt.split("\n").length;
  const groesse = extra.fontSize ?? SCHRIFT;
  return basis(id, "text", x, y, w, zeilen * groesse * ZEILE, {
    text: inhalt,
    originalText: inhalt,
    rawText: inhalt,
    fontSize: groesse,
    fontFamily: 2,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: null,
    autoResize: true,
    lineHeight: ZEILE,
    baseline: Math.round(groesse * 0.9),
    ...extra,
  });
};

const elemente = [];
const kasten = new Map();

for (const [i, r] of (spec.rahmen ?? []).entries()) {
  const id = `rahmen-${i}`;
  elemente.push(
    basis(id, "rectangle", r.x, r.y, r.w, r.h, {
      strokeStyle: "dashed",
      strokeColor: "#868e96",
    }),
  );
  elemente.push(
    text(`${id}-t`, r.x + 10, r.y + 6, r.w - 20, r.text, {
      textAlign: "left",
      verticalAlign: "top",
      fontSize: 14,
      strokeColor: "#868e96",
    }),
  );
}

for (const k of spec.kaesten) {
  const f = FARBEN[k.farbe ?? "weiss"] ?? FARBEN.weiss;
  const typ = k.form === "ellipse" ? "ellipse" : "rectangle";
  const el = basis(k.id, typ, k.x, k.y, k.w, k.h, {
    strokeColor: f.strich,
    backgroundColor: f.fuell,
    roundness: typ === "rectangle" ? { type: 3 } : { type: 2 },
    boundElements: [{ type: "text", id: `${k.id}-t` }],
  });
  const t = text(`${k.id}-t`, k.x + 6, 0, k.w - 12, k.text, {
    containerId: k.id,
    strokeColor: "#1e1e1e",
  });
  t.y = k.y + (k.h - t.height) / 2;
  elemente.push(el, t);
  kasten.set(k.id, el);
}

// Ein Pfeil geht vom Rand des einen Kastens zum Rand des anderen, auf der
// Geraden zwischen den Mitten.
const randpunkt = (k, zx, zy) => {
  const mx = k.x + k.width / 2;
  const my = k.y + k.height / 2;
  const dx = zx - mx;
  const dy = zy - my;
  if (dx === 0 && dy === 0) return [mx, my];
  const s = Math.min(
    Math.abs(k.width / 2 / (dx || 1e-9)),
    Math.abs(k.height / 2 / (dy || 1e-9)),
  );
  return [mx + dx * s, my + dy * s];
};

for (const [i, p] of (spec.pfeile ?? []).entries()) {
  const a = kasten.get(p.von);
  const b = kasten.get(p.nach);
  if (!a || !b)
    throw new Error(`Pfeil ${i}: Kasten ${a ? p.nach : p.von} fehlt`);
  const [x1, y1] = randpunkt(a, b.x + b.width / 2, b.y + b.height / 2);
  const [x2, y2] = randpunkt(b, a.x + a.width / 2, a.y + a.height / 2);
  const id = `pfeil-${i}`;
  const el = basis(id, "arrow", x1, y1, Math.abs(x2 - x1), Math.abs(y2 - y1), {
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    strokeStyle: p.gestrichelt ? "dashed" : "solid",
    startBinding: { elementId: a.id, focus: 0, gap: 4 },
    endBinding: { elementId: b.id, focus: 0, gap: 4 },
    startArrowhead: null,
    endArrowhead: "arrow",
    lastCommittedPoint: null,
    roundness: { type: 2 },
  });
  a.boundElements.push({ type: "arrow", id });
  b.boundElements.push({ type: "arrow", id });
  elemente.push(el);
  if (p.text) {
    el.boundElements.push({ type: "text", id: `${id}-t` });
    const t = text(`${id}-t`, 0, 0, 160, p.text, {
      containerId: id,
      fontSize: 13,
      strokeColor: "#495057",
    });
    t.x = (x1 + x2) / 2 - 80;
    t.y = (y1 + y2) / 2 - t.height / 2;
    elemente.push(t);
  }
}

for (const [i, t] of (spec.texte ?? []).entries()) {
  elemente.push(
    text(`text-${i}`, t.x, t.y, t.w ?? 400, t.text, {
      textAlign: "left",
      verticalAlign: "top",
      fontSize: t.groesse ?? 20,
    }),
  );
}

// --- .excalidraw.md: das Format, das das Plugin liest und schreibt -------
const szene = {
  type: "excalidraw",
  version: 2,
  source: "https://github.com/zsviczian/obsidian-excalidraw-plugin",
  elements: elemente,
  appState: { gridSize: 20, viewBackgroundColor: "#ffffff" },
  files: {},
};
const textteil = elemente
  .filter((e) => e.type === "text")
  .map((e) => `${e.text} ^${e.id}\n`)
  .join("\n");
const md = `---
excalidraw-plugin: parsed
tags: [excalidraw]
---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'

# Excalidraw Data

## Text Elements
${textteil}
%%
## Drawing
\`\`\`json
${JSON.stringify(szene, null, "\t")}
\`\`\`
%%
`;
writeFileSync(`${ziel}.excalidraw.md`, md);

// --- SVG: für docs/ und GitHub, das Excalidraw nicht zeichnen kann -------
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const xs = elemente.flatMap((e) =>
  e.type === "arrow" ? [e.x, e.x + e.points[1][0]] : [e.x, e.x + e.width],
);
const ys = elemente.flatMap((e) =>
  e.type === "arrow" ? [e.y, e.y + e.points[1][1]] : [e.y, e.y + e.height],
);
const rand = 20;
const minX = Math.min(...xs) - rand;
const minY = Math.min(...ys) - rand;
const breite = Math.max(...xs) - minX + rand;
const hoehe = Math.max(...ys) - minY + rand;
const r = (n) => Math.round(n * 10) / 10;

const svgText = (e) => {
  const zeilen = e.text.split("\n");
  const h = e.fontSize * ZEILE;
  const anker = e.textAlign === "left" ? "start" : "middle";
  const x = e.textAlign === "left" ? e.x : e.x + e.width / 2;
  const y0 =
    e.verticalAlign === "top"
      ? e.y + e.fontSize
      : e.y + e.height / 2 - ((zeilen.length - 1) * h) / 2 + e.fontSize * 0.35;
  return zeilen
    .map(
      (z, i) =>
        `<text x="${r(x)}" y="${r(y0 + i * h)}" font-size="${e.fontSize}" text-anchor="${anker}" fill="${e.strokeColor}">${esc(z)}</text>`,
    )
    .join("\n");
};

const teile = elemente.map((e) => {
  const strich = e.strokeStyle === "dashed" ? ' stroke-dasharray="6 4"' : "";
  const fuell =
    e.backgroundColor === "transparent" ? "none" : e.backgroundColor;
  if (e.type === "rectangle")
    return `<rect x="${r(e.x)}" y="${r(e.y)}" width="${r(e.width)}" height="${r(e.height)}" rx="${e.roundness ? 8 : 0}" fill="${fuell}" stroke="${e.strokeColor}"${strich}/>`;
  if (e.type === "ellipse")
    return `<ellipse cx="${r(e.x + e.width / 2)}" cy="${r(e.y + e.height / 2)}" rx="${r(e.width / 2)}" ry="${r(e.height / 2)}" fill="${fuell}" stroke="${e.strokeColor}"${strich}/>`;
  if (e.type === "arrow")
    return `<line x1="${r(e.x)}" y1="${r(e.y)}" x2="${r(e.x + e.points[1][0])}" y2="${r(e.y + e.points[1][1])}" stroke="${e.strokeColor}"${strich} marker-end="url(#spitze)"/>`;
  return "";
});
// Beschriftungen der Pfeile bekommen einen weissen Grund, sonst läuft die
// Linie durch die Schrift.
const unterlagen = elemente
  .filter((e) => e.type === "text" && e.containerId?.startsWith("pfeil-"))
  .map((e) => {
    const w =
      Math.max(...e.text.split("\n").map((z) => z.length)) * e.fontSize * 0.55 +
      8;
    return `<rect x="${r(e.x + e.width / 2 - w / 2)}" y="${r(e.y)}" width="${r(w)}" height="${r(e.height)}" fill="#ffffff"/>`;
  });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(minX)} ${r(minY)} ${r(breite)} ${r(hoehe)}" width="${r(breite)}" height="${r(hoehe)}" font-family="Helvetica, Arial, sans-serif">
<!-- ${esc(spec.titel ?? basename(ziel))} — erzeugt von scripts/excalidraw.mjs; nach einer Änderung in Obsidian schreibt das Plugin diese Datei neu -->
<defs><marker id="spitze" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#495057"/></marker></defs>
<rect x="${r(minX)}" y="${r(minY)}" width="${r(breite)}" height="${r(hoehe)}" fill="#ffffff"/>
${teile.join("\n")}
${unterlagen.join("\n")}
${elemente
  .filter((e) => e.type === "text")
  .map(svgText)
  .join("\n")}
</svg>
`;
writeFileSync(`${ziel}.excalidraw.svg`, svg);
console.log(
  `geschrieben: ${ziel}.excalidraw.md, ${ziel}.excalidraw.svg (${elemente.length} Elemente)`,
);
