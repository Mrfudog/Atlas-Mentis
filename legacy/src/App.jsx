import { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";
const ModelCtx = createContext(null);
const SprungCtx = createContext(null);
const FilterCtx = createContext({ status: "alle", tag: "", suche: "" });
const passtFilter = (f, obj, name) => (f.status === "alle" || (obj.status || obj.status2 || "Ansatz") === f.status) && (!f.tag || (obj.tags || []).some((t) => t.toLowerCase().includes(f.tag.toLowerCase()))) && (!f.suche || String(name || obj.name || obj.titel || obj.t || "").toLowerCase().includes(f.suche.toLowerCase()));

/* ── Kanalgang v3 — EINE Karte, Netz & Fraktionen als Overlays ──
   Neu: falsche Richtung ab dem Einstieg, Knoten/Gänge selbst anlegen,
   verschieben, verbinden, löschen — alles persistiert. */

const MAP_SRC = "./karte.jpg";
let toastSetter = null;
const hinweis = (msg) => { if (toastSetter) toastSetter(String(msg)); else console.log(msg); };
let bestaetigenMerk = { msg: null, t: 0 };
const bestaetigen = (msg) => {
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  let r = false;
  try { r = window.confirm(msg); } catch { r = false; }
  if (r) return true;
  const dauer = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  if (dauer > 40) return false; // echter Dialog, vom Benutzer abgebrochen
  // Dialog blockiert (Sandbox): Zwei-Klick-Bestätigung
  if (bestaetigenMerk.msg === msg && Date.now() - bestaetigenMerk.t < 6000) { bestaetigenMerk = { msg: null, t: 0 }; return true; }
  bestaetigenMerk = { msg, t: Date.now() };
  hinweis("Zur Bestätigung nochmals klicken: " + msg);
  return false;
};
const KACHELN = [ // hochauflösende Detailkacheln (Artefakt: nur Kanalnetz-Region; Self-Host nutzt das Originalbild)
];
const VB = { w: 1000, h: 2038 }; // Kartenkoordinaten (waterdeep-3560-7256, 1000 breit)

const C = {
  bg: "#101613", wand: "#1b241f", wand2: "#232e28", linie: "#31403a",
  kreide: "#e8e4d8", dim: "#9aa89f", teal: "#45c4ae", amber: "#e0a83f",
  rot: "#e06054", lila: "#a98fe3", gold: "#f0cf5a", grau: "#8a978f",
};
const TYPEN = { Kampf: C.rot, Hindernis: C.amber, Begegnung: C.teal, Ressource: C.gold, Geschichte: C.lila };
const TYP_LISTE = Object.keys(TYPEN);
const frakNamen = (m) => ["keine", ...(m.fraktionen || []).map((f) => f.name)];
const frakFarbe = (m, name) => (m.fraktionen || []).find((f) => f.name === name)?.farbe || "#b9c4bc";
const SYMBOLE = { kreis: "● Kreis", raute: "◆ Raute", dreieckAb: "▼ Dreieck ab", dreieckAuf: "▲ Dreieck auf", quadrat: "■ Quadrat", stern: "★ Stern", auge: "◎ Auge", offen: "△ offen" };
const SYMBOL_STANDARD = { knoten: "kreis", beides: "raute", einstieg: "dreieckAb", ausstieg: "dreieckAuf", versteck: "auge", weiter: "offen" };
const STILE = { linie: "durchgezogen", gestrichelt: "gestrichelt", gepunktet: "gepunktet" };
const ARTEN = { knoten: "Knoten (●)", beides: "Ein-/Ausstieg (◆)", einstieg: "nur Einstieg (▼)", ausstieg: "nur Ausstieg (▲)", versteck: "Versteck (Auge)", weiter: "Fortsetzung (△)" };

const N = (id, name, x, y, art, extra = {}) => ({
  id, name, x, y, art, distrikt: "Brückendistrikt", fraktion: "keine",
  typ: null, encounter: "", markierung: false, zustand: "verborgen", notiz: "",
  sicherung: "offen", ...extra,
});
const E = (id, a, b, extra = {}) => ({ id, a, b, zustand: "verborgen", signal: "", ...extra });

const DEFAULT = {
  v: 7,
  nodes: Object.fromEntries([
    N("E0", "E0 Gully Kerzengasse", 650, 1519, "beides", { zustand: "erkundet", notiz: "Einstieg beim Zhentarim-Lagerhaus. Kratzer, Stofffetzen, Kenku-Federn. Schon hier: Entscheidung — den Zeichen nach oder der Strömung nach." }),
    N("K1", "K1 Einstiegskammer", 614, 1539, "knoten", { markierung: true, notiz: "Erster gelber Zehn-Speichen-Kreis." }),
    N("K2", "K2 Doppelkammer", 583, 1562, "knoten", { markierung: true, fraktion: "Das Auge", notiz: "Zeichen werden dichter. Abzweig hinab Richtung Meer — starker Sog." }),
    N("K3", "K3 Wehrkammer", 560, 1537, "knoten", { markierung: true, fraktion: "Das Auge", notiz: "Wehrrauschen übertönt jeden Schritt. Letzter Halt vor dem Versteck." }),
    N("X", "Augentor — Xanathar-Versteck", 542, 1508, "versteck", { markierung: true, fraktion: "Das Auge", notiz: "Gemaltes Auge über dem Bogen. Das Passwort steht phonetisch im Stimmenbuch. Cliffhanger endet vor der Tür." }),
    N("N1", "N1 Nordsammler", 609, 1459, "knoten", { notiz: "Gegenströmung von Norden, Laugengeruch." }),
    N("W1", "→ gegen Norden (Handelsdistrikt)", 622, 1389, "weiter", { distrikt: "Handelsdistrikt", notiz: "Offene Fortsetzung — bei Bedarf ausbauen." }),
    N("D1", "D1 Südsammler", 673, 1565, "knoten", { notiz: "Die falsche Richtung: breit, abschüssig, bequem — und ohne ein einziges Zeichen." }),
    N("W2", "→ Richtung Süddistrikt", 712, 1611, "weiter", { notiz: "Das System läuft weiter; hier verliert man nur Zeit und Licht." }),
    N("M1", "M1 Gezeitenkammer", 593, 1632, "knoten", { notiz: "Brackwasser, Gezeitenmarken. Bei Flut geflutet." }),
    N("AM", "Hafenauslass (Meer)", 586, 1686, "ausstieg", { notiz: "Gitter zum Hafenbecken — nur bei Ebbe passierbar." }),
    N("E2", "Gully Gerbergasse", 529, 1578, "beides", { notiz: "Weiterer Ein-/Ausstieg westlich — Fluchtweg oder zweiter Zugang." }),
  ].map((n) => [n.id, n])),
  edges: Object.fromEntries([
    E("e1", "E0", "K1", { zustand: "erkundet", signal: "Den frischen Kratzspuren und dem ersten gelben Zeichen nach — Strömung mässig entgegen." }),
    E("e0", "E0", "D1", { signal: "Die Strömung will hierhin: breit, abschüssig, keine Zeichen. Der bequeme Weg." }),
    E("eW2", "D1", "W2", { signal: "Der Sammler läuft weiter und weiter — irgendwo rauscht ein Wehr." }),
    E("e2", "K1", "K2", { signal: "Dem gelben Zeichen nach — Strömung nimmt zu." }),
    E("e3", "K2", "K3", { signal: "Zeichen alle zwanzig Schritt, hafenwärts reissend." }),
    E("e4", "K3", "X", { signal: "Glyphendichte auf Maximum; Fackelschein flackert hinter dem Bogen." }),
    E("e5", "K1", "N1", { signal: "Gegenströmung von Norden, Lauge beisst in der Nase." }),
    E("e6", "N1", "W1", { signal: "Breiter Sammler, verliert sich im Dunkel Richtung Norden." }),
    E("e7", "K2", "M1", { signal: "Der stärkste Sog — hinab, hohles Rauschen, Salzluft." }),
    E("e8", "M1", "AM", { signal: "Tageslicht flackert durch ein Gitter; Wellen schlagen dagegen." }),
    E("e9", "K3", "E2", { signal: "Enger Seitenkanal, oben Stimmen einer Gasse." }),
  ].map((e) => [e.id, e])),
  orte: Object.fromEntries([
    { id: "o1", name: "Trollgrindallee (Trollgrind)", x: 694, y: 502, f: "keine", sichtbar: true, b: "Heim & Taverne der Gruppe; Urkunde von Renaer. Keller = EA-Knoten mit Tunnel nach Unterwacht. Späterer Feuerball-Schauplatz." },
    { id: "o2", name: "Zhentarim-Lagerhaus", x: 650, y: 1519, f: "Zhentarim", sichtbar: true, b: "Kerzengasse. Ort der Rettung Renaers — fünf tote Kenku, ein Loch im Dach." },
    { id: "o3", name: "Drachenspiess", x: 668, y: 1539, f: "keine", sichtbar: true, b: "Hafentaverne; Station der Floon-Ermittlung." },
    { id: "o4", name: "Altes Xoblob", x: 681, y: 1508, f: "keine", sichtbar: true, b: "Kuriositätenladen — der alte Xoblob raucht und sieht alles." },
    { id: "o5", name: "Taverne zum Gähnenden Abgrund", x: 449, y: 1113, f: "Grauwacht", sichtbar: true, b: "Bergsdistrikt, über dem Schacht. Der offizielle, bewachte Weg nach Unterwacht." },
    { id: "o6", name: "Fährstation (Nebeldistrikt)", x: 255, y: 1136, f: "Das Auge", sichtbar: false, b: "Unter dem Berg: Hafen, Lift und Graumarkt — Herz des Nebeldistrikts." },
    { id: "o7", name: "Greifenstallungen", x: 278, y: 1121, f: "Grauwacht", sichtbar: true, b: "Turm der Greifenreiter auf Nebelwacht." },
    { id: "o8", name: "Greifenstatue", x: 275, y: 1162, f: "keine", sichtbar: true, b: "Eine der acht Statuen von Wasserfeste." },
    { id: "o9", name: "Kolar-Türme", x: 707, y: 1266, f: "Zhentarim", sichtbar: false, b: "Manshoons Sitz: Kraftfeld, extradimensionales Refugium, Experimente-Werkstatt im Keller." },
    { id: "o10", name: "Weirdbottle's Concoctions", x: 676, y: 1302, f: "Zhentarim", sichtbar: true, b: "Skeemos Tränke- & Giftladen (Doom Raiders)." },
    { id: "o11", name: "Söldnerhöfe Tashlyns", x: 784, y: 1562, f: "Zhentarim", sichtbar: true, b: "Söldner zu fairen Preisen (Doom Raiders)." },
    { id: "o12", name: "Cassalanter-Villa", x: 717, y: 472, f: "Cassalanter", sichtbar: true, b: "Wohltäter mit Asmodeus-Schrein unter dem Haus. Zerstörer von Kynrics Haus; Rooks Erinnerungen liegen im Tresor." },
    { id: "o13", name: "Gralhund-Villa", x: 762, y: 527, f: "Gralhunds", sichtbar: true, b: "Minderadel, zu gierig zum Aussteigen. Ein Nimblewright im Haus." },
    { id: "o14", name: "Brandath-Krypta", x: 743, y: 962, f: "keine", sichtbar: false, b: "Grabsdistrikt: Familiengruft der Brandaths — direkt über dem Tresor. Hier wurde ein Auge entnommen." },
    { id: "o15", name: "Sea Maidens Faire", x: 517, y: 1711, f: "Bregan D'aerthe", sichtbar: true, b: "Drei Karnevalsschiffe; unter dem Flaggschiff das Tauchboot Scarlet Marpenoth." },
    { id: "o16", name: "Trolltor", x: 231, y: 58, f: "Grauwacht", sichtbar: true, b: "Den Grautruppen vorbehalten (Klippendistrikt)." },
    { id: "o17", name: "Nordtore", x: 606, y: 152, f: "Grauwacht", sichtbar: true, b: "Nordtor an der High Road; die zwei Treppen-Tore des Klippendistrikts liegen daneben." },
    { id: "o18", name: "Südtor", x: 841, y: 1693, f: "Grauwacht", sichtbar: true, b: "Südliches Stadttor." },
    { id: "o19", name: "Flusstor", x: 824, y: 1210, f: "Grauwacht", sichtbar: true, b: "Osttor am Süddistrikt." },
    { id: "o20", name: "Fischerhof", x: 480, y: 1410, f: "keine", sichtbar: true, b: "Westende der Fischstrasse — alles, was das Meer hergibt." },
    { id: "o21", name: "Markt der Ferne", x: 534, y: 1446, f: "keine", sichtbar: true, b: "Exotische Waren an der Kreuzung Fisch-/Schiffsstrasse." },
    { id: "o22", name: "V1 Keller «Zur Ankerkette»", x: 575, y: 1562, f: "Das Auge", sichtbar: false, b: "Safehouse (versteckt); Falltür in den Sammler." },
    { id: "o23", name: "V2 Übergabe am Dreifachwehr", x: 591, y: 1552, f: "Das Auge", sichtbar: false, b: "Übergabeort (bekannt); Schmuggelzoll zwischen Oberfläche und Kanal." },
    { id: "o24", name: "V3 Speicher Fischstrasse 9", x: 513, y: 1423, f: "Das Auge", sichtbar: false, b: "Vorbereitungsplatz (versteckt), unter Strohmann gemietet." },
    { id: "o25", name: "V4 Toter Briefkasten «Wehrglyphe»", x: 679, y: 1343, f: "Zhentarim", sichtbar: false, b: "Übergabeort (versteckt) im Kanal — Losungsstein hinter der Wehrglyphe." },
    { id: "o26", name: "V5 Mietskeller Süddistrikt", x: 792, y: 1588, f: "Zhentarim", sichtbar: false, b: "Safehouse (versteckt); Maskendepot, Flucht über Nachbardach." },
    { id: "o27", name: "V6 Speicher am Flusstor", x: 797, y: 1227, f: "Zhentarim", sichtbar: false, b: "Vorbereitungsplatz (bekannt); Waffen unter Wolle." },
    { id: "o28", name: "V7 Posten am Tiefenabfluss", x: 485, y: 1498, f: "Das Auge", sichtbar: false, b: "Banden-Posten am inoffiziellen Übergang Richtung Nebelwachtviertel." },
    { id: "o29", name: "V8 Sims der Beobachter", x: 459, y: 1472, f: "Bregan D'aerthe", sichtbar: false, b: "Beobachtungsposten — kein Lager, keine Spuren." },
  ].map((o) => [o.id, o])),
  distrikte: {
    "Brückendistrikt": { Kampf: 7, Hindernis: 4, Begegnung: 4, Ressource: 2, Geschichte: 3 },
    "Handelsdistrikt": { Kampf: 4, Hindernis: 5, Begegnung: 4, Ressource: 3, Geschichte: 4 },
  },
  koordinaten: "wd3560",
  fraktionen: [
    { id: "f1", name: "Das Auge", farbe: "#8b5cf6", ftyp: "Bande" },
    { id: "f2", name: "Zhentarim", farbe: "#ea8c1f", ftyp: "Söldnernetzwerk" },
    { id: "f3", name: "Bregan D'aerthe", farbe: "#5a8fe0", ftyp: "Söldner" },
    { id: "f4", name: "Grauwacht", farbe: "#9aa5b1", ftyp: "Armee" },
    { id: "f5", name: "Cassalanter", farbe: "#e05252", ftyp: "Adelshaus" },
    { id: "f6", name: "Gralhunds", farbe: "#ca9b18", ftyp: "Adelshaus" },
  ],
  gegenstaende: {},
  rezepte: [],
  boards: [{ id: "bd1", name: "Meine Pinnwand", karten: [] }],
  lootTabellen: [],
  ansichten: {
    NPC: { "Quick-Add": ["name", "subtyp", "beschreibung"], Kurz: ["name", "subtyp", "hauptbeziehung", "worte", "beschreibung"], Spieler: ["name", "beschreibung"] },
    Gegenstand: { "Quick-Add": ["name", "gtyp", "beschreibung"], Kurz: ["name", "gtyp", "raritaet", "beschreibung"], Spieler: ["name", "gtyp", "raritaet", "beschreibung"] },
    Ort: { "Quick-Add": ["name", "beschreibung"], Kurz: ["name", "f", "distrikt", "beschreibung"], Spieler: ["name", "beschreibung"] },
    Quest: { "Quick-Add": ["titel", "beschreibung"], Kurz: ["titel", "status", "beschreibung"], Spieler: ["titel", "beschreibung", "schritte"] },
    Regel: { "Quick-Add": ["name", "art", "text"], Kurz: ["name", "art", "text"], Spieler: ["name", "art", "text"] },
    Encounter: { "Quick-Add": ["t", "typ", "notiz"], Kurz: ["t", "typ", "d", "f"], Spieler: ["t"] },
    Charakter: { "Quick-Add": ["name", "player", "subtitle"], Kurz: ["name", "subtitle", "player"], Spieler: ["name", "subtitle"], Kampf: ["ac", "hp", "temp", "speed", "init", "prof", "passives", "defenseNote"], Inventar: ["ausruestung"], Hintergrund: ["beschreibung", "hintergrund", "ziele", "languages"] },
  },
  seeds: [],
  aktuelleSitzungId: null,
  karten: [{ id: "wasserfeste", name: "Wasserfeste", ebene: "stadt", elternId: "vallehy", bild: "", w: 1000, h: 2038, x: null, y: null }, { id: "vallehy", name: "Vallehy", ebene: "region", elternId: "welt", bild: "", w: 1000, h: 700, x: null, y: null }, { id: "welt", name: "Die zivilisierte Welt", ebene: "welt", elternId: null, bild: "", w: 1000, h: 750, x: null, y: null }],
  aktiveKarteId: "wasserfeste",
  wissen: [],
  informationen: [],
  abwehrKategorien: [{ key: "resist", label: "Damage Resistance" }, { key: "immun", label: "Damage Immunity" }, { key: "condImmun", label: "Condition Immunity" }, { key: "verwund", label: "Vulnerability" }, { key: "schwaeche", label: "Weakness" }, { key: "spezial", label: "Spezialregel" }, { key: "verhalten", label: "Verhalten" }],
  kanalRegeln: {
    text: "Pro Knoten darf jeder Charakter EINE Aktion ausführen. Alle drei Knoten wird eine Ration gegessen und eine Fackel verbraucht. Eine kurze Rast ist nur an einem sicheren Punkt möglich.",
    aktionen: [
      { name: "Schleichen", text: "Gruppen-Heimlichkeit (Schurke führt); Erfolg: Slot umgehen oder kein Aufsehen." },
      { name: "Craften", text: "Ein Rezept mit mitgeführten Materialien beginnen/fortführen." },
      { name: "Sammeln / Jagen", text: "Überleben/Natur: Rationen, Material oder Verbrauchsgüter aus dem Bereich." },
      { name: "Rasten (Short Rest)", text: "Nur an einem sicheren Winkel; kostet 1 Ration pro Charakter." },
    ],
    rationAlle: 3, fackelAlle: 3,
  },
  reise: { knoten: 0 },
  menue: { vorbereitung: ["geschichte", "encounter", "monster", "karte", "daten", "quests", "npcs", "orte", "gegenstaende", "regeln", "zonen", "gruppe", "initiative", "board"], spiel: ["karte", "initiative", "geschichte", "gruppe", "board", "quests", "npcs", "orte", "encounter", "monster", "gegenstaende", "regeln", "zonen", "daten"] },
  kampf: { runde: 1, aktivIdx: 0, teilnehmer: [] },
  waffenEigenschaften: [
    { id: "we1", name: "Finesse", text: "Beim Angriff und Schaden wahlweise STR- oder DEX-Modifikator." },
    { id: "we2", name: "Leicht", text: "Geeignet für den Kampf mit zwei Waffen." },
    { id: "we3", name: "Schwer", text: "Kleine Kreaturen haben Nachteil auf Angriffswürfe." },
    { id: "we4", name: "Reichweite", text: "Nahkampfreichweite +5 ft." },
    { id: "we5", name: "Wurfwaffe", text: "Kann geworfen werden; Angriffs-/Schadensmodifikator wie im Nahkampf." },
    { id: "we6", name: "Zweihändig", text: "Braucht beide Hände." },
    { id: "we7", name: "Vielseitig", text: "Ein- oder zweihändig; zweihändig höherer Schadenswürfel." },
    { id: "we8", name: "Munition", text: "Verbraucht Munition; Fernkampf mit Normal-/Maximalreichweite." },
    { id: "we9", name: "Nachladen", text: "Nur ein Schuss pro Aktion, Bonusaktion oder Reaktion." },
    { id: "we10", name: "Spezial", text: "Besondere Regel — siehe Beschreibung." },
  ],
  regeln: [
    { id: "r1", name: "Blinded", art: "condition", text: "Kann nicht sehen; scheitert automatisch an Sichtproben. Angriffe gegen die Kreatur mit Vorteil, ihre Angriffe mit Nachteil." },
    { id: "r2", name: "Charmed", art: "condition", text: "Kann den Bezaubernden nicht angreifen; dieser hat Vorteil auf soziale Proben gegen sie." },
    { id: "r3", name: "Frightened", art: "condition", text: "Nachteil auf Proben und Angriffe, solange die Quelle sichtbar ist; nähert sich ihr nicht freiwillig." },
    { id: "r4", name: "Grappled", art: "condition", text: "Geschwindigkeit 0. Endet, wenn der Greifer handlungsunfähig ist oder die Kreatur ausser Reichweite gerät." },
    { id: "r5", name: "Incapacitated", art: "condition", text: "Keine Aktionen und Reaktionen." },
    { id: "r6", name: "Invisible", art: "condition", text: "Ohne Magie nicht sichtbar; gilt als stark verschleiert. Angriffe gegen sie mit Nachteil, ihre mit Vorteil." },
    { id: "r7", name: "Paralyzed", art: "condition", text: "Handlungsunfähig, kann sich nicht bewegen oder sprechen; scheitert an STR/DEX-Rettungen; Angriffe mit Vorteil, Treffer aus 5 ft. sind kritisch." },
    { id: "r8", name: "Poisoned", art: "condition", text: "Nachteil auf Angriffswürfe und Attributsproben." },
    { id: "r9", name: "Prone", art: "condition", text: "Bewegung nur kriechend; Angriffe mit Nachteil; Nahkampfangriffe gegen sie mit Vorteil, Fernkampf mit Nachteil." },
    { id: "r10", name: "Restrained", art: "condition", text: "Geschwindigkeit 0; Angriffe mit Nachteil, gegen sie mit Vorteil; Nachteil auf DEX-Rettungen." },
    { id: "r11", name: "Stunned", art: "condition", text: "Handlungsunfähig, kann sich nicht bewegen, spricht stockend; scheitert an STR/DEX-Rettungen; Angriffe mit Vorteil." },
    { id: "r12", name: "Unconscious", art: "condition", text: "Handlungsunfähig, liegend, lässt fallen; scheitert an STR/DEX-Rettungen; Angriffe mit Vorteil, Treffer aus 5 ft. kritisch." },
    { id: "r13", name: "Exhaustion", art: "condition", text: "Stufen 1–6: Nachteil auf Proben → halbe Geschwindigkeit → Nachteil auf Angriffe/Rettungen → halbe HP → Geschwindigkeit 0 → Tod." },
  ],
  distriktFarben: { "Brückendistrikt": "#e07b6a", "Handelsdistrikt": "#d9a441", "Süddistrikt": "#c9c46a", "Bergsdistrikt": "#b58ad1", "Norddistrikt": "#c4925a", "Seedistrikt": "#5aa7c4", "Feldsdistrikt": "#7fb069", "Grabsdistrikt": "#9aa5b1", "Klippendistrikt": "#a58a6b" },
  zonen: [
      {
          "id": "zf0",
          "typ": "fraktion",
          "label": "Das Auge — Nebeldistrikt & Schacht",
          "farbe": "#8b5cf6",
          "form": "ellipse",
          "lx": 259,
          "ly": 1136,
          "hatch": false,
          "dash": false,
          "cx": 259,
          "cy": 1136,
          "rx": 110,
          "ry": 148
      },
      {
          "id": "zf1",
          "typ": "fraktion",
          "label": "Kanäle: Das Auge",
          "farbe": "#8b5cf6",
          "form": "rect",
          "lx": 588,
          "ly": 1327,
          "hatch": true,
          "dash": false,
          "x": 469,
          "y": 1337,
          "w": 239,
          "h": 287
      },
      {
          "id": "zf2",
          "typ": "fraktion",
          "label": "Zhentarim — Kolar-Türme",
          "farbe": "#ea8c1f",
          "form": "circle",
          "lx": 707,
          "ly": 1204,
          "hatch": false,
          "dash": false,
          "cx": 707,
          "cy": 1266,
          "r": 49
      },
      {
          "id": "zf3",
          "typ": "fraktion",
          "label": "Zhentarim — Ostflanke Nebelwachts",
          "farbe": "#ea8c1f",
          "form": "rect",
          "lx": 441,
          "ly": 1018,
          "hatch": false,
          "dash": false,
          "x": 379,
          "y": 1033,
          "w": 123,
          "h": 219
      },
      {
          "id": "zf4",
          "typ": "fraktion",
          "label": "Doom Raiders",
          "farbe": "#ea8c1f",
          "form": "rect",
          "lx": 802,
          "ly": 1433,
          "hatch": false,
          "dash": true,
          "x": 741,
          "y": 1446,
          "w": 123,
          "h": 206
      },
      {
          "id": "zf5",
          "typ": "fraktion",
          "label": "Cassalanter-Villa",
          "farbe": "#dc2626",
          "form": "circle",
          "lx": 717,
          "ly": 433,
          "hatch": false,
          "dash": false,
          "cx": 717,
          "cy": 472,
          "r": 28
      },
      {
          "id": "zf6",
          "typ": "fraktion",
          "label": "Gralhund-Villa",
          "farbe": "#ca9b18",
          "form": "circle",
          "lx": 762,
          "ly": 494,
          "hatch": false,
          "dash": false,
          "cx": 762,
          "cy": 527,
          "r": 23
      },
      {
          "id": "zf7",
          "typ": "fraktion",
          "label": "Sea Maidens Faire",
          "farbe": "#2563eb",
          "form": "circle",
          "lx": 517,
          "ly": 1774,
          "hatch": false,
          "dash": false,
          "cx": 517,
          "cy": 1711,
          "r": 46
      },
      {
          "id": "zd0",
          "typ": "distrikt",
          "label": "Feldsdistrikt",
          "farbe": "#7fb069",
          "form": "rect",
          "lx": 472,
          "ly": 104,
          "hatch": false,
          "dash": false,
          "x": 227,
          "y": 52,
          "w": 490,
          "h": 206
      },
      {
          "id": "zd1",
          "typ": "distrikt",
          "label": "Seedistrikt",
          "farbe": "#5aa7c4",
          "form": "rect",
          "lx": 188,
          "ly": 336,
          "hatch": false,
          "dash": false,
          "x": 49,
          "y": 261,
          "w": 346,
          "h": 387
      },
      {
          "id": "zd2",
          "typ": "distrikt",
          "label": "Norddistrikt",
          "farbe": "#c4925a",
          "form": "rect",
          "lx": 609,
          "ly": 259,
          "hatch": false,
          "dash": false,
          "x": 397,
          "y": 207,
          "w": 426,
          "h": 452
      },
      {
          "id": "zd3",
          "typ": "distrikt",
          "label": "Bergsdistrikt",
          "farbe": "#b58ad1",
          "form": "rect",
          "lx": 498,
          "ly": 775,
          "hatch": false,
          "dash": false,
          "x": 395,
          "y": 736,
          "w": 258,
          "h": 478
      },
      {
          "id": "zd4",
          "typ": "distrikt",
          "label": "Grabsdistrikt",
          "farbe": "#9aa5b1",
          "form": "rect",
          "lx": 741,
          "ly": 865,
          "hatch": false,
          "dash": false,
          "x": 642,
          "y": 827,
          "w": 194,
          "h": 284
      },
      {
          "id": "zd5",
          "typ": "distrikt",
          "label": "Handelsdistrikt",
          "farbe": "#d9a441",
          "form": "rect",
          "lx": 704,
          "ly": 1149,
          "hatch": false,
          "dash": false,
          "x": 575,
          "y": 1162,
          "w": 258,
          "h": 219
      },
      {
          "id": "zd6",
          "typ": "distrikt",
          "label": "Brückendistrikt",
          "farbe": "#e07b6a",
          "form": "rect",
          "lx": 534,
          "ly": 1343,
          "hatch": false,
          "dash": false,
          "x": 446,
          "y": 1333,
          "w": 258,
          "h": 307
      },
      {
          "id": "zd7",
          "typ": "distrikt",
          "label": "Süddistrikt",
          "farbe": "#c9c46a",
          "form": "rect",
          "lx": 784,
          "ly": 1756,
          "hatch": false,
          "dash": false,
          "x": 694,
          "y": 1384,
          "w": 181,
          "h": 348
      },
      {
          "id": "zd8",
          "typ": "distrikt",
          "label": "Klippendistrikt",
          "farbe": "#a58a6b",
          "form": "rect",
          "lx": 1092,
          "ly": 556,
          "hatch": false,
          "dash": false,
          "x": 898,
          "y": 569,
          "w": 387,
          "h": 387
      }
  ],
  charaktere: [],
  kampagne: { id: "kp1", name: "Aus Nebel wacht…", beschreibung: "", todos: [] },
  arcs: [{ id: "a1", nummer: 1, titel: "Der Preis der Rettung", beschreibung: "Dragon Heist, Akt 1 — Lagerhaus, Renaer, Kanalgang zum Augentor.", todos: [] }],
  sitzungen: [],
  npcs: [],
  quests: [],
  variablen: [
    { key: "AB", label: "Attack bonus", standard: "+4", info: "Angriffsbonus für Waffen- und Zauberangriffe" },
    { key: "DC", label: "Save DC", standard: "12", info: "Rettungswurf-Schwierigkeit der Kreatur" },
    { key: "PB", label: "Proficiency bonus", standard: "+2", info: "" },
    { key: "DMG", label: "Damage", standard: "1d6+2", info: "Standard-Schaden eines Angriffs" },
    { key: "TYP", label: "Damage type", standard: "slashing", info: "" },
    { key: "REICHWEITE", label: "Reach/Range", standard: "5 ft.", info: "" },
    { key: "NAME", label: "Name", standard: "", info: "wird meist pro Eintrag gesetzt" },
  ],
  typen: [
    { id: "t1", name: "Ooze", art: "type", abwehr: [
      { kat: "immun", text: "slashing (teilt sich)", bekannt: false, lernen: "Nature DC 12" },
      { kat: "immun", text: "lightning", bekannt: false, lernen: "Arcana DC 13" },
      { kat: "verwund", text: "fire", bekannt: false, lernen: "Nature DC 12" },
      { kat: "condImmun", text: "prone, blinded", bekannt: false, lernen: "" },
      { kat: "schwaeche", text: "Meidet Feuer — flieht vor offenen Flammen", bekannt: false, lernen: "Beobachtung" } ] },
    { id: "t2", name: "Undead", art: "type", abwehr: [
      { kat: "immun", text: "poison", bekannt: false, lernen: "Religion DC 10" },
      { kat: "condImmun", text: "poisoned, exhaustion", bekannt: false, lernen: "Religion DC 10" },
      { kat: "schwaeche", text: "Turn Undead / radiant zwingt zum Rückzug", bekannt: false, lernen: "Religion DC 12" } ] },
    { id: "t3", name: "Devil", art: "type", abwehr: [
      { kat: "resist", text: "cold; bludgeoning, piercing, slashing from nonmagical attacks that aren't silvered", bekannt: false, lernen: "Religion DC 13" },
      { kat: "immun", text: "fire, poison", bekannt: false, lernen: "Religion DC 13" },
      { kat: "condImmun", text: "poisoned", bekannt: false, lernen: "" },
      { kat: "schwaeche", text: "Vertragsgebunden — erfüllt nur den Wortlaut des Auftrags", bekannt: false, lernen: "Rollenspiel" } ] },
    { id: "t4", name: "Wererat", art: "ancestry", abwehr: [
      { kat: "immun", text: "bludgeoning, piercing, slashing from nonmagical attacks not made with silvered weapons", bekannt: false, lernen: "Nature DC 12" },
      { kat: "schwaeche", text: "Silber — jede versilberte Waffe hebt die Immunität auf", bekannt: false, lernen: "Nature DC 12" } ] },
    { id: "t5", name: "Drow", art: "ancestry", abwehr: [
      { kat: "schwaeche", text: "Sunlight Sensitivity — Nachteil auf Angriffe und Wahrnehmung im Sonnenlicht", bekannt: false, lernen: "Nature DC 10" },
      { kat: "resist", text: "advantage on saves vs. charmed; immune to magical sleep", bekannt: false, lernen: "Arcana DC 12" } ] },
    { id: "t6", name: "Orc", art: "ancestry", abwehr: [
      { kat: "schwaeche", text: "Aggressive — stürmt vor, lässt Deckung und Formation liegen", bekannt: false, lernen: "Beobachtung" } ] },
  ],
  schemata: {
    Gegenstand: { subtypen: { waffe: [], ruestung: [], material: [], verbrauchsgut: [], werkzeug: [], wundersam: [], sonstiges: [] } },
    Regel: { subtypen: { Trait: [], Action: [], "Bonus Action": [], Reaction: [], "Villain Action": [], "Legendary Action": [], Condition: [], Regel: [], Eigenschaft: [],
      Zauber: [{ key: "grad", label: "Grad", typ: "zahl" }, { key: "schule", label: "Schule", typ: "text" }, { key: "zeit", label: "Zauberzeit", typ: "text" }, { key: "reichweite", label: "Reichweite", typ: "text" }, { key: "komponenten", label: "Komponenten", typ: "text" }, { key: "dauer", label: "Wirkdauer", typ: "text" }, { key: "klassen", label: "Klassen", typ: "tags" }],
      Feat: [{ key: "voraussetzung", label: "Voraussetzung", typ: "text" }] } },
    NPC: { subtypen: { Standard: [], Händler: [{ key: "sortiment", label: "Sortiment", typ: "absatz" }], Auftraggeber: [] } },
    Ort: { subtypen: { Standard: [], Taverne: [{ key: "wirt", label: "Wirt/in", typ: "verweis", ziel: "NPC" }, { key: "preise", label: "Preise", typ: "text" }], Laden: [{ key: "sortiment", label: "Sortiment", typ: "absatz" }] } },
    Charakter: { subtypen: { Standard: [{ key: "ausruestung", label: "Ausrüstung", typ: "absatz" }, { key: "zauber", label: "Zauber & Features (Regeln)", typ: "verweise", ziel: "Regel" }, { key: "hintergrund", label: "Hintergrund", typ: "absatz" }, { key: "ziele", label: "Ziele & Geheimnisse (SL)", typ: "absatz" }] } },
    Statblock: { subtypen: { Standard: [] } },
    Encounter: { subtypen: { Standard: [] } },
    Quest: { subtypen: { Haupt: [], Neben: [], Persönlich: [{ key: "charakter", label: "Charakter", typ: "verweis", ziel: "Charakter" }] } },
  },
  monster: {},
  bausteine: [
    { id: "b1", art: "Actions", name: "Weapon Attack (Vorlage)", text: "**{NAME}.** Melee Weapon Attack: {AB} to hit, reach {REICHWEITE}, one target. *Hit:* {DMG} {TYP} damage.", vars: { NAME: "Shortsword" }, tags: [] },
    { id: "b2", art: "Traits", name: "Moralbruch (Gekaufte Loyalität)", text: "**Moralbruch.** Fällt der Anführer oder sinkt die Kreatur unter die Hälfte ihrer HP, muss sie einen WIS-Rettungswurf DC {DC} bestehen oder ergibt sich bzw. flieht.", vars: {}, tags: ["fraktion:Gralhunds"] },
    { id: "b3", art: "Traits", name: "Das Auge wacht", text: "**Das Auge wacht.** In Sichtweite eines Gildenzeichens oder Gazers ist die Kreatur immun gegen Verängstigt.", vars: {}, tags: ["fraktion:Das Auge"] },
  ],
  encounters: [
    // ── Kampf (deine Liste) ──
    { t: "Ooze — teilt sich bei Hieb; immun Hieb & Blitz, verwundbar Feuer", typ: "Kampf", d: "Brückendistrikt", f: "keine", lvMin: 1, lvMax: 4 },
    { t: "Werratten — Ohren der Gilde; immun nichtmagisch ausser Silber", typ: "Kampf", d: "Brückendistrikt", f: "Das Auge", lvMin: 2, lvMax: 6 },
    { t: "Abwassermonster «Janitor» — frisst alles, verteidigt sein Revier", typ: "Kampf", d: "Brückendistrikt", f: "keine", lvMin: 3, lvMax: 8 },
    { t: "Spectator — Wächter des Auges; Strahlen stören statt töten", typ: "Kampf", d: "Brückendistrikt", f: "Das Auge", lvMin: 3, lvMax: 7 },
    // ── Hindernis (deine Liste) ──
    { t: "Starke Strömung — Athletik oder abgetrieben (1 Knoten zurück / Licht nass)", typ: "Hindernis", d: "Brückendistrikt", f: "keine" },
    { t: "Gitter — verklemmt: laut aufbrechen, langsam lösen oder Stärke", typ: "Hindernis", d: "Brückendistrikt", f: "keine" },
    { t: "Enger Kanal — Rüstung ablegen oder feststecken; grosse Wesen bleiben zurück", typ: "Hindernis", d: "Brückendistrikt", f: "keine" },
    // ── Begegnung (deine Liste + Vorschläge) ──
    { t: "Peters Leiche — frisch, die Faust um etwas geschlossen", typ: "Begegnung", d: "Brückendistrikt", f: "keine" },
    { t: "Überlebender Kenku aus dem Lagerhaus — spricht in Floons Stimme", typ: "Begegnung", d: "Brückendistrikt", f: "Das Auge", lvMin: 1, lvMax: 5 },
    { t: "Dungsammler-Trupp bei Wartung — Marke käuflich, Zeichen erklärbar", typ: "Begegnung", d: "alle", f: "keine" },
    { t: "Krokodil-Jägerin Brenna — teilt Beute & Wissen, wenn man ihr treibt", typ: "Begegnung", d: "Brückendistrikt", f: "keine", lvMin: 2, lvMax: 8 },
    { t: "Verirrter Grauwacht-Rekrut — peinlich berührt; ein Gefallen der Wache", typ: "Begegnung", d: "alle", f: "Grauwacht", lvMin: 1, lvMax: 6 },
    { t: "Aalfischer am Auslass — rudert bei Ebbe herein, kennt die Gezeiten", typ: "Begegnung", d: "Brückendistrikt", f: "keine" },
    { t: "Verletzter Kanalmolch — zutraulich, wenn gefüttert (möglicher Begleiter)", typ: "Begegnung", d: "alle", f: "keine", lvMin: 1, lvMax: 6 },
    { t: "Die Betende am versunkenen Schrein — frische Opfergaben, nasse Spuren", typ: "Begegnung", d: "alle", f: "keine" },
    { t: "Entflohener Gefangener der Gilde — kennt die Wachwechsel am Augentor", typ: "Begegnung", d: "Brückendistrikt", f: "Das Auge", lvMin: 1, lvMax: 6 },
    // ── Ressource (deine Liste + Vorschläge) ──
    { t: "Mossfläche — giftig; hoher DC: arkane Essenz (Kibbles)", typ: "Ressource", d: "Brückendistrikt", f: "keine" },
    { t: "Leuchtmoos-Ader — kaltes Licht, hält Tage (Licht ohne Feuer)", typ: "Ressource", d: "alle", f: "keine" },
    { t: "Pilzkolonie — Rationen-Ersatz; Patzer: Sporenhusten bis zur Rast", typ: "Ressource", d: "alle", f: "keine" },
    { t: "Gerberei-Rückstände — Lauge/Säure-Reagenz fürs Crafting", typ: "Ressource", d: "Brückendistrikt", f: "keine" },
    { t: "Treibgut-Cache — verlorene Hafenfracht: Öl, Seil, Werkzeug", typ: "Ressource", d: "Brückendistrikt", f: "keine", lvMin: 1, lvMax: 6 },
    { t: "Häutungsreste des Krokodils — Panzerplatten (Rüstungs-Crafting)", typ: "Ressource", d: "Brückendistrikt", f: "keine" },
    { t: "Kanalkarten-Fragment — Pfadverlauf + zwei Gefahrensymbole", typ: "Ressource", d: "alle", f: "keine" },
    { t: "Dungsammler-Marke — gewartete Strecken + Sperrgitter", typ: "Ressource", d: "alle", f: "keine" },
    { t: "Stinkkapseln ×2 — unterdrücken Witterung", typ: "Ressource", d: "alle", f: "keine" },
    // ── Geschichte (Vorschläge) ──
    { t: "Frisches Gildenzeichen über altem Zhentarim-Symbol — das Revier hat den Besitzer gewechselt", typ: "Geschichte", d: "Brückendistrikt", f: "Das Auge" },
    { t: "Floons abgerissener Manschettenknopf im Schlick — die Route stimmt", typ: "Geschichte", d: "Brückendistrikt", f: "keine" },
    { t: "Schmuggelmanifest, wasserfleckig: «Lieferung ans Auge — Hafentor-Sammler»", typ: "Geschichte", d: "Brückendistrikt", f: "Das Auge" },
    { t: "Ritzzeichnung: Strichmännchen unter einem grossen Auge — «ES SIEHT DICH»", typ: "Geschichte", d: "Brückendistrikt", f: "Das Auge" },
    { t: "Tote Zhentarim-Kuriere, Maske zurückgelassen — der Bandenkrieg ist hier unten", typ: "Geschichte", d: "Brückendistrikt", f: "Zhentarim" },
    { t: "Zwei Drow-Silhouetten auf einem Sims, die wortlos verschwinden", typ: "Geschichte", d: "alle", f: "Bregan D'aerthe" },
    { t: "Hochwassermarke mit Jahreszahl & verwitterte Gedenkplakette — die grosse Flut", typ: "Geschichte", d: "alle", f: "keine" },
    { t: "Vermauerter Ziertorbogen, zu schön für einen Kanal — warm unter der Hand", typ: "Geschichte", d: "alle", f: "keine" },
    { t: "Dungsammler-Wartungsraute mit Datum — jemand pflegt diese Strecke offiziell", typ: "Geschichte", d: "alle", f: "keine" },
  ].map((e, i) => ({ id: "enc" + i, lvMin: 1, lvMax: 20, notiz: "", monster: [], ...e })),
  gruppenstufe: 2,
  log: [],
};


const HEX_R = 20;
const SQ3 = Math.sqrt(3);
function hexRound(q, r) {
  let x = q, z = r, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return { q: rx, r: rz };
}
const hexCenter = (q, r) => ({ x: HEX_R * SQ3 * (q + r / 2), y: HEX_R * 1.5 * r });
const hexAt = (x, y) => hexRound((SQ3 / 3 * x - y / 3) / HEX_R, (2 / 3 * y) / HEX_R);
const hexSnap = (x, y) => { const h = hexAt(x, y); return hexCenter(h.q, h.r); };
const hexPfad = (cx, cy, f = 1) => Array.from({ length: 6 }, (_, i) => {
  const a = Math.PI / 180 * (60 * i - 30);
  return `${cx + HEX_R * f * Math.cos(a)},${cy + HEX_R * f * Math.sin(a)}`;
}).join(" ");

function HexGrid({ view, vhOf }) {
  const y0 = view.y, y1 = view.y + vhOf(view), x0 = view.x, x1 = view.x + view.w;
  const r0 = Math.floor(y0 / (1.5 * HEX_R)) - 1, r1 = Math.ceil(y1 / (1.5 * HEX_R)) + 1;
  const zellen = [];
  for (let r = r0; r <= r1; r++) {
    const q0 = Math.floor(x0 / (SQ3 * HEX_R) - r / 2) - 1, q1 = Math.ceil(x1 / (SQ3 * HEX_R) - r / 2) + 1;
    for (let q = q0; q <= q1; q++) {
      const c = hexCenter(q, r);
      zellen.push(<polygon key={q + "_" + r} points={hexPfad(c.x, c.y)} fill="none" stroke="#e8e4d8" strokeWidth="0.6" opacity="0.14" />);
      if (zellen.length > 2200) return <g pointerEvents="none">{zellen}</g>;
    }
  }
  return <g pointerEvents="none">{zellen}</g>;
}

function gebietZellen(g) {
  let x0, x1, y0, y1;
  if (g.form === "ellipse") { x0 = g.cx - g.rx; x1 = g.cx + g.rx; y0 = g.cy - g.ry; y1 = g.cy + g.ry; }
  else if (g.form === "circle") { x0 = g.cx - g.r; x1 = g.cx + g.r; y0 = g.cy - g.r; y1 = g.cy + g.r; }
  else if (g.form === "polygon") { const xs = (g.punkte || []).map((p) => p[0]), ys = (g.punkte || []).map((p) => p[1]); if (!xs.length) return []; x0 = Math.min(...xs); x1 = Math.max(...xs); y0 = Math.min(...ys); y1 = Math.max(...ys); }
  else { x0 = g.x; x1 = g.x + g.w; y0 = g.y; y1 = g.y + g.h; }
  const zellen = [];
  const r0 = Math.floor(y0 / (1.5 * HEX_R)) - 1, r1 = Math.ceil(y1 / (1.5 * HEX_R)) + 1;
  for (let r = r0; r <= r1; r++) {
    const q0 = Math.floor(x0 / (SQ3 * HEX_R) - r / 2) - 1, q1 = Math.ceil(x1 / (SQ3 * HEX_R) - r / 2) + 1;
    for (let q = q0; q <= q1; q++) {
      const c = hexCenter(q, r);
      let drin = false;
      if (g.form === "ellipse") drin = ((c.x - g.cx) / g.rx) ** 2 + ((c.y - g.cy) / g.ry) ** 2 <= 1;
      else if (g.form === "circle") drin = (c.x - g.cx) ** 2 + (c.y - g.cy) ** 2 <= g.r * g.r;
      else if (g.form === "polygon") { const P = g.punkte || []; let inside = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1]; if (((yi > c.y) !== (yj > c.y)) && (c.x < (xj - xi) * (c.y - yi) / (yj - yi) + xi)) inside = !inside; } drin = inside; }
      else drin = c.x >= g.x && c.x <= g.x + g.w && c.y >= g.y && c.y <= g.y + g.h;
      if (drin) zellen.push(c);
    }
  }
  return zellen;
}


function migriere(m) {
  if (!m.orte) m.orte = structuredClone(DEFAULT.orte);
  if (!m.gruppenstufe) m.gruppenstufe = DEFAULT.gruppenstufe;
  if (!m.monster) m.monster = {};
  if (!m.bausteine) m.bausteine = structuredClone(DEFAULT.bausteine);
  (m.encounters || []).forEach((e) => {
    if (e.lvMin == null) e.lvMin = 1; if (e.lvMax == null) e.lvMax = 20;
    if (e.notiz == null) e.notiz = ""; if (!Array.isArray(e.monster)) e.monster = [];
  });
  Object.values(m.nodes || {}).forEach((n) => { if (n.encounterId === undefined) n.encounterId = null; if (n.farbe === undefined) n.farbe = ""; if (n.symbol === undefined) n.symbol = ""; });
  Object.values(m.edges || {}).forEach((e) => { if (e.farbe === undefined) e.farbe = ""; if (e.stil === undefined) e.stil = "linie"; });
  if (!m.fraktionen) m.fraktionen = structuredClone(DEFAULT.fraktionen);
  if (!m.distriktFarben) m.distriktFarben = structuredClone(DEFAULT.distriktFarben);
  if (!m.zonen) m.zonen = structuredClone(DEFAULT.zonen);
  if (!m.charaktere) m.charaktere = [];
  if (!m.kampagne) m.kampagne = structuredClone(DEFAULT.kampagne);
  if (!m.kampagne.id) m.kampagne.id = "kp1";
  (m.quests || []).forEach((q) => { if (!q.kampagneId) q.kampagneId = m.kampagne.id; });
  if (!m.arcs) m.arcs = structuredClone(DEFAULT.arcs);
  if (!m.sitzungen) m.sitzungen = [];
  if (!m.npcs) m.npcs = [];
  if (!m.quests) m.quests = [];
  [m.kampagne, ...m.arcs, ...m.sitzungen, ...m.npcs, ...m.quests].forEach((x) => { if (x && !x.todos) x.todos = []; });
  if (!m.gegenstaende) m.gegenstaende = {};
  if (!m.boards) m.boards = structuredClone(DEFAULT.boards);
  if (!m.lootTabellen) m.lootTabellen = [];
  if (!m.ansichten) m.ansichten = structuredClone(DEFAULT.ansichten);
  Object.keys(DEFAULT.ansichten).forEach((k) => { if (!m.ansichten[k]) m.ansichten[k] = structuredClone(DEFAULT.ansichten[k]); });
  Object.keys(m.schemata).forEach((k) => { if (!m.ansichten[k]) m.ansichten[k] = { "Quick-Add": [], Kurz: [], Spieler: [] }; });
  ["Kampf", "Inventar", "Hintergrund"].forEach((k) => { if (!m.ansichten.Charakter[k]) m.ansichten.Charakter[k] = DEFAULT.ansichten.Charakter[k]; });
  if (!m.marker) m.marker = [];
  if (!m.wissen) m.wissen = [];
  if (!m.karten) m.karten = structuredClone(DEFAULT.karten);
  if (!m.aktiveKarteId) m.aktiveKarteId = "wasserfeste";
  Object.values(m.orte || {}).forEach((o) => { if (!o.karteId) o.karteId = "wasserfeste"; });
  (m.zonen || []).forEach((z) => { if (!z.karteId) z.karteId = "wasserfeste"; });
  (m.marker || []).forEach((mk) => { if (!mk.karteId) mk.karteId = "wasserfeste"; });
  if (!m.abwehrKategorien) m.abwehrKategorien = structuredClone(DEFAULT.abwehrKategorien);
  if (!m.informationen) {
    m.informationen = [];
    (m.typen || []).forEach((t) => (t.abwehr || []).forEach((a, i) => { if (a.bekannt) m.informationen.push({ id: "in" + Date.now() + Math.floor(Math.random() * 9999), titel: `${t.name}: ${a.text}`, art: "abwehr", typId: t.id, abwehrIdx: i, text: "", wissenId: null, gruppe: true, charaktere: [], sitzungId: null, ts: "", status: "Abgeschlossen" }); }));
  }
  (m.charaktere || []).forEach((c) => { if (!c.wissen) c.wissen = []; });
  [...(m.npcs || []), ...Object.values(m.orte || {}), ...Object.values(m.gegenstaende || {}), ...(m.fraktionen || []), ...(m.quests || [])].forEach((x) => { if (x.tarnname === undefined) x.tarnname = ""; });
  [...(m.sitzungen || []), ...(m.encounters || [])].forEach((x) => { if (!x.lootListe) x.lootListe = []; if (!x.lootTabellen) x.lootTabellen = []; });
  (m.fraktionen || []).forEach((f) => { if (f.uebergeordnet === undefined) f.uebergeordnet = null; if (f.rolleImVerbund === undefined) f.rolleImVerbund = ""; });
  if (!m.seeds) m.seeds = [];
  if (!m.kanalRegeln) m.kanalRegeln = structuredClone(DEFAULT.kanalRegeln);
  if (!m.reise) m.reise = { knoten: 0 };
  if (!m.menue) m.menue = structuredClone(DEFAULT.menue);
  ["vorbereitung", "spiel"].forEach((k) => { m.menue[k] = m.menue[k].filter((x) => x !== "daten"); if (!m.menue[k].includes("kompendium")) m.menue[k].push("kompendium"); if (!m.menue[k].includes("wissen")) m.menue[k].push("wissen"); });
  if (m.kampf && m.kampf.ticks === undefined) m.kampf.ticks = true;
  if (m.aktuelleSitzungId === undefined) m.aktuelleSitzungId = null;
  Object.values(m.nodes || {}).forEach((n) => { if (!n.historie) n.historie = []; if (!n.erlaubteTypen) n.erlaubteTypen = []; });
  ((m.kampf || {}).teilnehmer || []).forEach((t) => { if (!t.effekte) t.effekte = (t.zustaende || []).map((z, i) => ({ id: "ef" + Date.now() + i, name: z, ablaufBei: "ende", bezug: t.id, zuege: null, notiz: "" })); });
  if (!m.kampf) m.kampf = structuredClone(DEFAULT.kampf);
  if (!m.rezepte) m.rezepte = [];
  if (!m.waffenEigenschaften) m.waffenEigenschaften = structuredClone(DEFAULT.waffenEigenschaften);
  if (!m.regeln) m.regeln = structuredClone(DEFAULT.regeln);
  (m.fraktionen || []).forEach((f) => { if (f.ftyp === undefined) f.ftyp = ""; });
  Object.values(m.orte || {}).forEach((o) => { if (o.platziert === undefined) o.platziert = true; if (!o.beschreibung) o.beschreibung = o.b || ""; if (o.distrikt === undefined) o.distrikt = ""; if (!o.tags) o.tags = []; });
  (m.npcs || []).forEach((n) => { (n.beziehungen || []).forEach((b) => { if (!b.paarId) b.paarId = b.id; }); });
  if (m.koordinaten !== "wd3560") {
    const K = 1.2906, BX = -328.1, BY = -334.8;
    Object.values(m.nodes || {}).forEach((n) => { n.x = Math.round(n.x * K + BX); n.y = Math.round(n.y * K + BY); });
    Object.values(m.orte || {}).forEach((o) => { o.x = Math.round(o.x * K + BX); o.y = Math.round(o.y * K + BY); });
    m.koordinaten = "wd3560";
  }
  if (!m.variablen) m.variablen = structuredClone(DEFAULT.variablen);
  if (!m.schemata) m.schemata = structuredClone(DEFAULT.schemata);
  const ARTMAP = { condition: "Condition", regel: "Regel", eigenschaft: "Eigenschaft" };
  (m.regeln || []).forEach((r) => { if (ARTMAP[r.art]) r.art = ARTMAP[r.art]; if (!r.vars) r.vars = {}; if (!r.tags) r.tags = []; });
  (m.bausteine || []).forEach((b) => { if (!m.regeln.find((r) => r.id === b.id)) m.regeln.push({ id: b.id, name: b.name, art: String(b.art || "Trait").replace(/s$/, ""), text: b.text || "", vars: b.vars || {}, tags: b.tags || [], status: "Ansatz", zusatz: {} }); });
  m.bausteine = [];
  const st = (x) => { if (x && typeof x === "object") { if (!x.status) x.status = "Ansatz"; if (!x.zusatz) x.zusatz = {}; if (!x.tags) x.tags = []; } };
  [...(m.regeln || []), ...(m.encounters || []), ...Object.values(m.monster || {}), ...Object.values(m.gegenstaende || {}), ...(m.npcs || []), ...Object.values(m.orte || {}), ...(m.charaktere || []), ...(m.rezepte || [])].forEach(st);
  (m.encounters || []).forEach((e) => { if (!e.monsterAnzahl) e.monsterAnzahl = {}; if (!["Idee", "Ansatz", "Abgeschlossen"].includes(e.status)) e.status = "Ansatz"; });
  (m.npcs || []).forEach((n) => { if (!n.subtyp) n.subtyp = "Standard"; });
  Object.values(m.orte || {}).forEach((o) => { if (!o.subtyp) o.subtyp = "Standard"; });
  (m.charaktere || []).forEach((c) => { if (!c.subtyp) c.subtyp = "Standard"; });
  (m.quests || []).forEach((q) => { if (!q.subtyp) q.subtyp = "Haupt"; if (!q.status2) q.status2 = "Ansatz"; if (!q.zusatz) q.zusatz = {}; if (!q.tags) q.tags = []; });
  if (!m.typen) m.typen = structuredClone(DEFAULT.typen);
  Object.values(m.monster || {}).forEach((mon) => {
    if (!mon.vars) mon.vars = {};
    if (!mon.typen) mon.typen = [];
    if (mon.schwaechen === undefined) mon.schwaechen = "—";
    if (mon.passive === undefined) mon.passive = "";
    if (mon.condImmun === undefined) mon.condImmun = "—";
    SEKTIONEN.forEach(([k]) => (mon[k] || []).forEach((e) => { if (!e.vars) e.vars = {}; }));
  });
  // Prozent-Gewichte (alt) → Punkte 0–10
  Object.values(m.distrikte || {}).forEach((w) => {
    if (Math.max(...Object.values(w)) > 10) TYP_LISTE.forEach((t) => { w[t] = Math.max(0, Math.round((w[t] || 0) / 5)); });
  });
  return m;
}

const STORAGE_KEY = "kanalgang:v7";
const VIEW_DOCK = { x: 475, y: 1384, w: 297 };
const VIEW_STADT = { x: 0, y: 0, w: 1000 };

export default function Kanalgang() {
  const [model, setModel] = useState(null);
  const [spieler, setSpieler] = useState(false);
  const [netzAn, setNetzAn] = useState(true);
  const [gebieteAn, setGebieteAn] = useState(false);
  const [sel, setSel] = useState(null);
  const [wurf, setWurf] = useState(null);
  const [modus, setModus] = useState("normal"); // normal | knoten | verbinden | verschieben
  const [verbindeVon, setVerbindeVon] = useState(null);
  const [saveState, setSaveState] = useState("bereit");
  const [verfall, setVerfall] = useState(null);
  const hexAn = true; // Hexraster ist fixer Bestandteil
  const [anzeige, setAnzeige] = useState({ titel: true, markierung: true, sicherung: true, ortTitel: true, arten: { knoten: true, beides: true, einstieg: true, ausstieg: true, versteck: true, weiter: true } });
  const [anzeigeOffen, setAnzeigeOffen] = useState(false);
  const [orteAn, setOrteAn] = useState(true);
  const [distrikteAn, setDistrikteAn] = useState(false);
  const [tab, setTab] = useState("karte");
  const [modusApp, setModusApp] = useState("vorbereitung"); // vorbereitung | spiel
  const [mehrOffen, setMehrOffen] = useState(false);
  const [schmal, setSchmal] = useState(typeof window !== "undefined" && window.innerWidth < 720);
  useEffect(() => { const f = () => setSchmal(window.innerWidth < 720); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const [view, setView] = useState(VIEW_DOCK);
  const karte = model ? (model.karten.find((k) => k.id === model.aktiveKarteId) || model.karten[0]) : null;
  const KW = karte ? karte.w : VB.w, KH = karte ? karte.h : VB.h;
  const istStadt = !karte || karte.id === "wasserfeste";
  const svgRef = useRef(null);
  const drag = useRef(null);
  const saveTimer = useRef(null);
  const loaded = useRef(false);
  const [zoneSel, setZoneSel] = useState(null);
  const [ortZumPlatzieren, setOrtZumPlatzieren] = useState(null);
  const [markerWahl, setMarkerWahl] = useState("gruppe");
  const [polyPunkte, setPolyPunkte] = useState([]);
  const [karteZumSetzen, setKarteZumSetzen] = useState(null);
  const zoneDrag = useRef(null);
  const [sprung, setSprung] = useState(null); // {tab, id} — Absprung aus Sitzung/Szene in andere Tabs
  const [verlauf, setVerlauf] = useState([]);
  const [gfilter, setGfilter] = useState({ status: "alle", tag: "", suche: "", offen: false });
  const springe = (t, id) => { setVerlauf((v) => [...v.slice(-19), { tab, sprung }]); setSprung({ tab: t, id, n: Date.now() }); setTab(t); };
  const zurueck = () => { const v = verlauf[verlauf.length - 1]; if (!v) return; setVerlauf(verlauf.slice(0, -1)); setTab(v.tab); setSprung(v.sprung ? { ...v.sprung, n: Date.now() } : null); };
  const [toast, setToast] = useState("");
  useEffect(() => { toastSetter = setToast; return () => { toastSetter = null; }; }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 5000); return () => clearTimeout(t); }, [toast]);
  const zonenZellen = useMemo(() => (model ? model.zonen.map(gebietZellen) : []), [model && JSON.stringify(model.zonen)]);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        const geladen = r?.value ? JSON.parse(r.value) : structuredClone(DEFAULT);
        setModel(migriere(geladen));
      } catch { setModel(structuredClone(DEFAULT)); }
      loaded.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current || !model) return;
    setSaveState("speichert");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await window.storage.set(STORAGE_KEY, JSON.stringify(model)); setSaveState("gespeichert"); }
      catch { setSaveState("fehler"); }
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [model]);

  const upd = (fn) => setModel((m) => { const n = structuredClone(m); fn(n); return n; });

  const vh = (v) => v.w * (KH / KW);
  const massstab = () => { // SVG "meet": einheitlicher Massstab + zentrierter Versatz
    const r = svgRef.current.getBoundingClientRect();
    const sc = Math.min(r.width / view.w, r.height / vh(view));
    return { r, sc, offX: (r.width - view.w * sc) / 2, offY: (r.height - vh(view) * sc) / 2 };
  };
  const clientToMap = (ev) => {
    const { r, sc, offX, offY } = massstab();
    return { x: view.x + (ev.clientX - r.left - offX) / sc, y: view.y + (ev.clientY - r.top - offY) / sc };
  };
  const onWheel = (ev) => {
    const p = clientToMap(ev);
    const f = ev.deltaY > 0 ? 1.18 : 1 / 1.18;
    const w = Math.min(KW, Math.max(60, view.w * f));
    setView({ x: p.x - (p.x - view.x) * (w / view.w), y: p.y - (p.y - view.y) * (w / view.w), w });
  };
  const onDown = (ev) => { drag.current = { sx: ev.clientX, sy: ev.clientY, v: view, moved: false }; };
  const onMove = (ev) => {
    if (zoneDrag.current) {
      const p = clientToMap(ev); const zd = zoneDrag.current;
      upd((m) => { const z = m.zonen.find((x) => x.id === zd.id); if (!z) return;
        if (zd.kind === "vertex") z.punkte[zd.i] = [Math.round(p.x), Math.round(p.y)];
        else if (zd.kind === "center") { const dx = Math.round(p.x - zd.cx), dy = Math.round(p.y - zd.cy); if (z.form === "rect") { z.x = zd.x0 + dx; z.y = zd.y0 + dy; } else if (z.form === "polygon") z.punkte = zd.punkte.map((q) => [q[0] + dx, q[1] + dy]); else { z.cx = zd.x0 + dx; z.cy = zd.y0 + dy; } z.lx = zd.lx + dx; z.ly = zd.ly + dy; }
        else if (zd.kind === "size") { if (z.form === "rect") { z.w = Math.max(20, Math.round(p.x - z.x)); z.h = Math.max(20, Math.round(p.y - z.y)); } else if (z.form === "circle") z.r = Math.max(10, Math.round(Math.hypot(p.x - z.cx, p.y - z.cy))); else { z.rx = Math.max(10, Math.round(Math.abs(p.x - z.cx))); z.ry = Math.max(10, Math.round(Math.abs(p.y - z.cy))); } } });
      return;
    }
    if (!drag.current) return;
    const { sc } = massstab();
    const dx = (ev.clientX - drag.current.sx) / sc;
    const dy = (ev.clientY - drag.current.sy) / sc;
    if (Math.abs(ev.clientX - drag.current.sx) + Math.abs(ev.clientY - drag.current.sy) > 4) drag.current.moved = true;
    setView({ ...drag.current.v, x: drag.current.v.x - dx, y: drag.current.v.y - dy });
  };
  const onUp = () => { zoneDrag.current = null; setTimeout(() => { drag.current = null; }, 0); };
  const zoomBei = (f) => {
    const cx = view.x + view.w / 2, cy = view.y + vh(view) / 2;
    const w = Math.min(VB.w, Math.max(60, view.w * f));
    setView({ x: cx - w / 2, y: cy - (w * (KH / KW)) / 2, w });
  };
  const warDrag = () => drag.current?.moved;

  const kartenKlick = (ev) => {
    if (warDrag() || spieler) return;
    const p = clientToMap(ev);
    if (modus === "knoten") {
      const pp = hexAn ? hexSnap(p.x, p.y) : p;
      const id = "N" + Date.now().toString(36);
      const nr = Object.keys(model.nodes).length;
      upd((m) => { m.nodes[id] = N(id, "K" + nr + " Neuer Knoten", Math.round(pp.x), Math.round(pp.y), "knoten"); });
      setSel({ kind: "node", id }); setModus("normal");
    } else if (modus === "ort") {
      if (ortZumPlatzieren) {
        upd((m) => { const o = m.orte[ortZumPlatzieren]; if (o) { o.x = Math.round(p.x); o.y = Math.round(p.y); o.platziert = true; o.karteId = m.aktiveKarteId; } });
        setSel({ kind: "ort", id: ortZumPlatzieren }); setOrtZumPlatzieren(null); setModus("normal");
      } else {
        const id = "o" + Date.now().toString(36);
        upd((m) => { m.orte[id] = { id, name: "Neuer Ort", x: Math.round(p.x), y: Math.round(p.y), f: "keine", sichtbar: false, b: "", beschreibung: "", distrikt: "", tags: [], platziert: true, karteId: m.aktiveKarteId }; });
        setSel({ kind: "ort", id }); setModus("normal");
      }
    } else if (modus === "verschieben" && sel?.kind === "node") {
      const pp = hexAn ? hexSnap(p.x, p.y) : p;
      upd((m) => { m.nodes[sel.id].x = Math.round(pp.x); m.nodes[sel.id].y = Math.round(pp.y); });
      setModus("normal");
    } else if (modus === "karteMarker" && karteZumSetzen) {
      upd((m) => { const k = m.karten.find((x) => x.id === karteZumSetzen); if (k) { k.x = Math.round(p.x); k.y = Math.round(p.y); k.elternId = m.aktiveKarteId; } });
      setKarteZumSetzen(null); setModus("normal");
    } else if (modus === "zonePoly") {
      setPolyPunkte([...polyPunkte, [Math.round(p.x), Math.round(p.y)]]);
    } else if (modus === "marker") {
      const [typ, refId] = markerWahl.split(":");
      upd((m) => { const alt = m.marker.find((x) => x.typ === typ && (x.refId || "") === (refId || "")); if (alt) { alt.x = Math.round(p.x); alt.y = Math.round(p.y); } else m.marker.push({ id: "mk" + Date.now(), typ, refId: refId || null, x: Math.round(p.x), y: Math.round(p.y), karteId: m.aktiveKarteId }); });
      setModus("normal");
    } else if (modus === "zoneMitte" && zoneSel) {
      upd((m) => {
        const z = m.zonen.find((x) => x.id === zoneSel); if (!z) return;
        const px = Math.round(p.x), py = Math.round(p.y);
        if (z.form === "polygon") { const cx = z.punkte.reduce((a, q) => a + q[0], 0) / z.punkte.length, cy = z.punkte.reduce((a, q) => a + q[1], 0) / z.punkte.length; z.punkte = z.punkte.map((q) => [Math.round(q[0] + px - cx), Math.round(q[1] + py - cy)]); z.lx = px; z.ly = py; }
        else if (z.form === "rect") { z.x = px - Math.round(z.w / 2); z.y = py - Math.round(z.h / 2); z.lx = px; z.ly = py - Math.round(z.h / 2) - 6; }
        else { z.cx = px; z.cy = py; z.lx = px; z.ly = py - (z.form === "circle" ? z.r : z.ry) - 6; }
      });
      setModus("normal"); setTab("zonen");
    } else if (modus === "verschieben" && sel?.kind === "ort") {
      upd((m) => { m.orte[sel.id].x = Math.round(p.x); m.orte[sel.id].y = Math.round(p.y); });
      setModus("normal");
    }
  };

  const knotenKlick = (id) => {
    if (warDrag()) return;
    if (modus === "verbinden" && verbindeVon && id !== verbindeVon) {
      const gibts = Object.values(model.edges).some((e) => (e.a === verbindeVon && e.b === id) || (e.a === id && e.b === verbindeVon));
      if (!gibts) upd((m) => { const eid = "g" + Date.now().toString(36); m.edges[eid] = E(eid, verbindeVon, id); });
      setModus("normal"); setVerbindeVon(null); setSel({ kind: "node", id });
    } else setSel({ kind: "node", id });
  };

  const wuerfeln = (nodeId) => {
    const n = model.nodes[nodeId];
    if (n.sicherung === "gesichert") return; // gesichert: kein Encounter
    let pool = n.sicherung === "brüchig" ? ["Hindernis", "Ressource", "Geschichte"] : TYP_LISTE;
    if ((n.erlaubteTypen || []).length) pool = pool.filter((t) => n.erlaubteTypen.includes(t));
    if (!pool.length) { hinweis("Keine erlaubten Typen für diesen Knoten (Sicherung/Eingrenzung)."); return; }
    const w = model.distrikte[n.distrikt] || Object.values(model.distrikte)[0];
    const total = pool.reduce((s, k) => s + (w[k] || 0), 0) || 1;
    let r = Math.random() * total;
    const typ = pool.find((k) => (r -= w[k] || 0) < 0) || pool[0];
    setWurf({ nodeId, typ });
  };

  const verfallWuerfeln = () => {
    const bericht = [];
    upd((m) => {
      for (const n of Object.values(m.nodes)) {
        if (n.fraktion !== "keine" || !n.sicherung || n.sicherung === "offen") continue;
        const nachbarF = Object.values(m.edges).some((e) => {
          const o = e.a === n.id ? m.nodes[e.b] : e.b === n.id ? m.nodes[e.a] : null;
          return o && o.fraktion !== "keine";
        });
        const w = 1 + Math.floor(Math.random() * 8);
        const mod = nachbarF ? 1 : 0;
        const eff = Math.min(8, Math.max(1, w + mod));
        const stufen = eff <= 4 ? 0 : eff <= 6 ? 1 : eff === 7 ? 2 : 9;
        const kette = ["gesichert", "brüchig", "offen"];
        const alt = n.sicherung;
        n.sicherung = kette[Math.min(2, kette.indexOf(alt) + stufen)];
        bericht.push({ node: n.name, w, mod, alt, neu: n.sicherung });
        if (alt !== n.sicherung) m.log.unshift({ id: "v" + Date.now() + n.id, ts: new Date().toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }), node: n.name, typ: "Verfall", text: `W8: ${w}${mod ? (mod > 0 ? " +" : " ") + mod : ""} → ${alt} → ${n.sicherung}` });
      }
    });
    setVerfall(bericht);
  };

  if (!model) return <div style={{ background: C.bg, minHeight: "100vh", display: "grid", placeItems: "center", color: C.dim, fontFamily: "Georgia,serif" }}>Kanalgang wird geladen …</div>;

  const selNode = sel?.kind === "node" ? model.nodes[sel.id] : null;
  const selEdge = sel?.kind === "edge" ? model.edges[sel.id] : null;
  const selOrt = sel?.kind === "ort" ? (model.orte || {})[sel.id] : null;

  return (
    <ModelCtx.Provider value={model}><SprungCtx.Provider value={sprung}><FilterCtx.Provider value={gfilter}>
    <div style={{ background: C.bg, minHeight: "100vh", color: C.kreide, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,500;0,700;1,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        .serif{font-family:'Alegreya',Georgia,serif;}
        .knopf{border:1px solid ${C.linie};background:${C.wand2};color:${C.kreide};padding:5px 12px;border-radius:3px;font-size:13px;cursor:pointer;}
        .knopf:hover{border-color:${C.teal};}
        .knopf:focus-visible{outline:2px solid ${C.amber};outline-offset:1px;}
        .knopf.primaer{background:${C.amber};color:#241a08;border-color:${C.amber};font-weight:600;}
        .knopf.an{background:${C.teal};color:#0c1a16;border-color:${C.teal};font-weight:600;}
        .knopf.leise{background:transparent;color:${C.dim};}
        .knopf.gefahr{border-color:${C.rot};color:${C.rot};background:transparent;}
        select,input[type=text],input[type=number],textarea{background:${C.bg};color:${C.kreide};border:1px solid ${C.linie};border-radius:3px;padding:4px 8px;font-size:13px;font-family:inherit;}
        select:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid ${C.amber};outline-offset:1px;}
        .feld{display:flex;flex-direction:column;gap:3px;font-size:12px;color:${C.dim};min-width:0;}
        .feld input,.feld select,.feld textarea{width:100%;max-width:100%;min-width:0;box-sizing:border-box;}
        input,select,textarea{box-sizing:border-box;max-width:100%;}
        textarea{resize:vertical;}
        .kasten{max-width:100%;}
        main{overflow-x:hidden;}
        .ansicht-aktiv ~ *{display:none !important;}
        @media (max-width:720px){ .kasten [style*="grid-template-columns"],.panel [style*="grid-template-columns"]{grid-template-columns:1fr !important;} .kasten [style*="max-height"]{max-height:none !important;} }
        svg text{user-select:none;}
        @media (prefers-reduced-motion:reduce){*{transition:none!important;}}
      `}</style>

      {!spieler && (
        <div style={{ position: "fixed", right: 14, bottom: schmal ? 66 : 14, zIndex: 45, display: "flex", gap: 6, alignItems: "center", background: gfilter.offen ? C.wand : "transparent", border: gfilter.offen ? `1px solid ${C.teal}` : "none", borderRadius: 4, padding: gfilter.offen ? 8 : 0, boxShadow: gfilter.offen ? "0 6px 20px rgba(0,0,0,.5)" : "none" }}>
          {gfilter.offen && <>
            <input type="text" value={gfilter.suche} placeholder="Suche" style={{ width: 120 }} onChange={(ev) => setGfilter({ ...gfilter, suche: ev.target.value })} />
            <select value={gfilter.status} onChange={(ev) => setGfilter({ ...gfilter, status: ev.target.value })}><option value="alle">alle Status</option>{STATUS_LISTE.map((st) => <option key={st}>{st}</option>)}</select>
            <input type="text" value={gfilter.tag} placeholder="Tag" style={{ width: 90 }} onChange={(ev) => setGfilter({ ...gfilter, tag: ev.target.value })} />
            <button className="knopf leise" style={{ fontSize: 11 }} onClick={() => setGfilter({ ...gfilter, status: "alle", tag: "", suche: "" })}>leeren</button>
          </>}
          <button className={"knopf " + ((gfilter.status !== "alle" || gfilter.tag || gfilter.suche) ? "primaer" : "")} style={{ fontSize: 12 }} onClick={() => setGfilter({ ...gfilter, offen: !gfilter.offen })}>⌕ Filter</button>
        </div>
      )}
      {toast && (
        <div role="status" onClick={() => setToast("")} style={{ position: "fixed", left: "50%", bottom: 22, transform: "translateX(-50%)", zIndex: 50, background: C.wand2, color: C.kreide, border: `1px solid ${C.amber}`, borderRadius: 4, padding: "8px 14px", fontSize: 13, boxShadow: "0 6px 20px rgba(0,0,0,.5)", maxWidth: "90vw", cursor: "pointer" }}>{toast}</div>
      )}
      <header style={{ maxWidth: 1160, margin: "0 auto", padding: "24px 20px 12px", display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <h1 className="serif" style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{model.kampagne.name}</h1>
        <p style={{ margin: 0, color: C.dim, fontSize: 13, flex: 1 }}>{model.kampagne.beschreibung || "Kanalgang · Wasserfeste"}</p>
        {!spieler && <span style={{ fontSize: 11, color: saveState === "fehler" ? C.rot : C.dim }}>{saveState === "speichert" ? "speichert …" : saveState === "fehler" ? "Speichern fehlgeschlagen — nur diese Sitzung" : "gespeichert"}</span>}
      </header>

      {!spieler && <QuickActions model={model} upd={upd} />}
      {verlauf.length > 0 && !spieler && <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px 6px" }}><button className="knopf" style={{ fontSize: 12 }} onClick={zurueck}>← Zurück ({verlauf.length})</button></div>}
      {(() => {
        const alle = spieler
          ? [["karte", "Karte"], ["gruppe", "Gruppe"], ["initiative", "Initiative"]]
          : [["karte", "Karte"], ["geschichte", "Geschichte"], ["quests", "Quests"], ["orte", "Orte"], ["encounter", "Encounter"], ["monster", "Statblocks"], ["gegenstaende", "Gegenstände"], ["regeln", "Regeln"], ["zonen", "Fraktionen & Geschöpfe"], ["wissen", "Wissen"], ["gruppe", "Gruppe"], ["initiative", "Initiative"], ["board", "Pinnwand"], ["kompendium", "Kompendium & Daten"]];
        const primaer = spieler ? alle.map((x) => x[0]) : (model.menue[modusApp] || []);
        const geordnet = [...alle].sort((a, b) => { const ia = primaer.indexOf(a[0]), ib = primaer.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
        const knopf = ([k, l]) => <button key={k} className={"knopf " + (tab === k ? "an" : "")} onClick={() => { setTab(k); setMehrOffen(false); }}>{l}</button>;
        const modusKnopf = !spieler && <button className={"knopf " + (modusApp === "spiel" ? "primaer" : "leise")} title="Modus: ordnet die Navigation um" onClick={() => setModusApp(modusApp === "spiel" ? "vorbereitung" : "spiel")}>{modusApp === "spiel" ? "▶ Spiel" : "✎ Vorbereitung"}</button>;
        if (!schmal) return (
          <nav style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px 10px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {modusKnopf}{geordnet.map(knopf)}
          </nav>
        );
        const haupt = geordnet.slice(0, Math.min(4, geordnet.length)), rest = geordnet.slice(4);
        return (
          <>
            {mehrOffen && <div onClick={() => setMehrOffen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 60 }}>
              <div onClick={(ev) => ev.stopPropagation()} style={{ position: "absolute", left: 0, right: 0, bottom: 56, background: C.wand, borderTop: `1px solid ${C.linie}`, padding: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>{modusKnopf}{rest.map(knopf)}</div>
            </div>}
            <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 56, zIndex: 61, background: C.wand, borderTop: `1px solid ${C.linie}`, display: "grid", gridTemplateColumns: `repeat(${haupt.length + (rest.length ? 1 : 0)}, 1fr)` }}>
              {haupt.map(([k, l]) => <button key={k} onClick={() => { setTab(k); setMehrOffen(false); }} style={{ border: "none", background: tab === k ? C.wand2 : "transparent", color: tab === k ? C.teal : C.kreide, fontSize: 12, fontFamily: "inherit" }}>{l}</button>)}
              {rest.length > 0 && <button onClick={() => setMehrOffen(!mehrOffen)} style={{ border: "none", background: mehrOffen ? C.wand2 : "transparent", color: C.kreide, fontSize: 12, fontFamily: "inherit" }}>Mehr…</button>}
            </nav>
          </>
        );
      })()}

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: schmal ? "0 10px 80px" : "0 20px 60px" }}>
      {tab === "karte" && (<>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
          <button className={"knopf " + (netzAn ? "an" : "")} onClick={() => setNetzAn(!netzAn)}>Kanalnetz {netzAn ? "ausblenden" : "einblenden"}</button>
          {!spieler && <button className={"knopf " + (gebieteAn ? "an" : "")} onClick={() => setGebieteAn(!gebieteAn)}>Fraktionsgebiete {gebieteAn ? "ausblenden" : "einblenden"}</button>}
          <button className={"knopf " + (distrikteAn ? "an" : "")} onClick={() => setDistrikteAn(!distrikteAn)}>Distrikte {distrikteAn ? "aus" : "ein"}</button>
          <button className={"knopf " + (orteAn ? "an" : "")} onClick={() => setOrteAn(!orteAn)}>Orte {orteAn ? "ausblenden" : "einblenden"}</button>
          {!spieler && orteAn && <button className={"knopf " + (modus === "ort" ? "primaer" : "")} onClick={() => setModus(modus === "ort" ? "normal" : "ort")}>+ Ort setzen</button>}
          {!spieler && <button className={"knopf " + (modus === "marker" ? "primaer" : "")} onClick={() => setModus(modus === "marker" ? "normal" : "marker")}>⚑ Marker setzen</button>}
          {!spieler && netzAn && <button className={"knopf " + (modus === "knoten" ? "primaer" : "")} onClick={() => setModus(modus === "knoten" ? "normal" : "knoten")}>+ Knoten setzen</button>}
          {!spieler && <button className="knopf" onClick={verfallWuerfeln}>Zeitsprung: Verfall würfeln</button>}
          {!spieler && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: C.dim }}>Gruppenstufe
            <input type="number" min="1" max="20" value={model.gruppenstufe} style={{ width: 56 }}
              onChange={(ev) => upd((m) => { m.gruppenstufe = Math.max(1, Math.min(20, +ev.target.value || 1)); })} />
          </label>}

          {netzAn && (
            <span style={{ position: "relative" }}>
              <button className={"knopf " + (anzeigeOffen ? "an" : "")} onClick={() => setAnzeigeOffen(!anzeigeOffen)}>Anzeige ▾</button>
              {anzeigeOffen && (
                <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 20, background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 10, display: "grid", gap: 6, minWidth: 210, boxShadow: "0 6px 18px rgba(0,0,0,.5)" }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" checked={anzeige.titel} onChange={(ev) => setAnzeige({ ...anzeige, titel: ev.target.checked })} /> Titel anzeigen
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" checked={anzeige.markierung} onChange={(ev) => setAnzeige({ ...anzeige, markierung: ev.target.checked })} /> gelbe Markierungen
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" checked={anzeige.sicherung} onChange={(ev) => setAnzeige({ ...anzeige, sicherung: ev.target.checked })} /> Sicherungsringe
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" checked={anzeige.ortTitel} onChange={(ev) => setAnzeige({ ...anzeige, ortTitel: ev.target.checked })} /> Orts-Titel
                  </label>
                  <div style={{ borderTop: `1px solid ${C.linie}`, margin: "2px 0", paddingTop: 6, fontSize: 11, color: C.dim }}>Symbole</div>
                  {Object.entries(ARTEN).map(([k, v]) => (
                    <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                      <input type="checkbox" checked={anzeige.arten[k]} onChange={(ev) => setAnzeige({ ...anzeige, arten: { ...anzeige.arten, [k]: ev.target.checked } })} /> {v}
                    </label>
                  ))}
                </div>
              )}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button className="knopf" onClick={() => zoomBei(1 / 1.35)} aria-label="Hineinzoomen">+</button>
          <button className="knopf" onClick={() => zoomBei(1.35)} aria-label="Herauszoomen">−</button>
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12 }}>
            {(() => { const pfad = []; let k = karte; while (k) { pfad.unshift(k); k = model.karten.find((x) => x.id === k.elternId); } return pfad.map((k, i) => <span key={k.id}>{i > 0 && <span style={{ color: C.dim }}> › </span>}<button className={"knopf " + (k.id === karte.id ? "an" : "leise")} style={{ fontSize: 12, padding: "2px 8px" }} onClick={() => { upd((m) => { m.aktiveKarteId = k.id; }); setView(k.id === "wasserfeste" ? VIEW_DOCK : { x: 0, y: 0, w: k.w }); }}>{k.name}</button></span>); })()}
          </span>
          {istStadt && <button className="knopf" onClick={() => setView(VIEW_DOCK)}>Brückendistrikt</button>}
          <button className="knopf" onClick={() => setView({ x: 0, y: 0, w: KW })}>Ganze Karte</button>
          <button className={"knopf " + (spieler ? "primaer" : "")} onClick={() => { setSpieler(!spieler); setSel(null); setModus("normal"); setGebieteAn(false); setTab("karte"); }}>{spieler ? "Zur SL-Ansicht" : "Spieler-Ansicht"}</button>
          {!spieler && <button className="knopf leise" onClick={() => { if (bestaetigen("Alles zurücksetzen? Knoten, Pool, Erkundung und Log gehen verloren.")) { setSel(null); setWurf(null); setModus("normal"); setModel(structuredClone(DEFAULT)); } }}>Zurücksetzen</button>}
        </div>

        {modus !== "normal" && (
          <div style={{ background: C.wand2, border: `1px solid ${C.amber}`, borderRadius: 3, padding: "6px 12px", marginBottom: 8, fontSize: 13 }}>
            {modus === "knoten" && "Auf die Karte klicken, um den neuen Knoten zu platzieren."}
            {modus === "ort" && (
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                Auf die Karte klicken, um {ortZumPlatzieren ? `«${model.orte[ortZumPlatzieren]?.name}»` : "einen neuen Ort"} zu platzieren.
                <select value={ortZumPlatzieren || ""} onChange={(ev) => setOrtZumPlatzieren(ev.target.value || null)}>
                  <option value="">neuer Ort</option>
                  {Object.values(model.orte).filter((o) => o.platziert === false || o.x == null).map((o) => <option key={o.id} value={o.id}>{o.name} (noch nicht auf der Karte)</option>)}
                </select>
              </span>
            )}
            {modus === "karteMarker" && `Auf die Karte klicken, um «${model.karten.find((k) => k.id === karteZumSetzen)?.name}» hier zu verorten.`}
            {modus === "zonePoly" && (
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>Gebiet einziehen: nacheinander auf die Eckpunkte klicken ({polyPunkte.length} Punkte).
                <button className="knopf primaer" style={{ fontSize: 12 }} disabled={polyPunkte.length < 3} onClick={() => { const pts = polyPunkte; const cx = Math.round(pts.reduce((a, q) => a + q[0], 0) / pts.length), cy = Math.round(pts.reduce((a, q) => a + q[1], 0) / pts.length); const id = "z" + Date.now(); upd((m) => m.zonen.push({ id, typ: "fraktion", label: "Neue Zone", farbe: "#9aa5b1", form: "polygon", punkte: pts, lx: cx, ly: cy, hatch: false, dash: false, karteId: m.aktiveKarteId })); setPolyPunkte([]); setZoneSel(id); setModus("normal"); }}>Fertig</button>
                <button className="knopf leise" style={{ fontSize: 12 }} onClick={() => { setPolyPunkte([]); setModus("normal"); }}>Abbrechen</button>
              </span>
            )}
            {modus === "marker" && (
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>Marker platzieren/verschieben:
                <select value={markerWahl} onChange={(ev) => setMarkerWahl(ev.target.value)}>
                  <option value="gruppe">★ Gruppe</option>
                  {model.charaktere.map((c) => <option key={c.id} value={"charakter:" + c.id}>{c.name}</option>)}
                  {model.npcs.map((n) => <option key={n.id} value={"geschoepf:" + n.id}>{n.name} (Geschöpf)</option>)}
                </select>
                {model.marker.some((x) => markerWahl === (x.typ + (x.refId ? ":" + x.refId : ""))) && <button className="knopf leise" style={{ fontSize: 12 }} onClick={() => upd((m) => { m.marker = m.marker.filter((x) => markerWahl !== (x.typ + (x.refId ? ":" + x.refId : ""))); })}>von Karte entfernen</button>}
              </span>
            )}
            {modus === "zoneMitte" && `Auf die Karte klicken, um den Mittelpunkt der Zone «${model.zonen.find((z) => z.id === zoneSel)?.label || ""}» zu setzen.`}
            {modus === "verbinden" && `Zielknoten anklicken, um einen Gang von ${model.nodes[verbindeVon]?.name} zu ziehen.`}
            {modus === "verschieben" && `Neue Position für ${selNode?.name || selOrt?.name || "die Auswahl"} anklicken.`}
            <button className="knopf leise" style={{ marginLeft: 10, fontSize: 12 }} onClick={() => { setModus("normal"); setVerbindeVon(null); }}>Abbrechen</button>
          </div>
        )}

        {verfall && !spieler && (
          <div style={{ background: C.wand2, border: `1px solid ${C.teal}`, borderRadius: 3, padding: "6px 12px", marginBottom: 8, fontSize: 12.5 }}>
            <strong>Verfallsprobe (verdeckt):</strong>{" "}
            {verfall.length === 0 ? "keine gesicherten Knoten." :
              verfall.map((b) => `${b.node}: W8 ${b.w}${b.mod ? (b.mod > 0 ? "+" : "") + b.mod : ""} → ${b.neu}${b.alt !== b.neu ? "" : " (hält)"}`).join(" · ")}
            <button className="knopf leise" style={{ marginLeft: 10, fontSize: 12 }} onClick={() => setVerfall(null)}>ausblenden</button>
          </div>
        )}
        <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${vh(view)}`}
          onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onClick={kartenKlick}
          style={{ width: "100%", height: schmal ? "70vh" : 640, display: "block", background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 4, cursor: ["knoten", "verschieben", "ort", "zoneMitte", "marker", "zonePoly", "karteMarker"].includes(modus) ? "crosshair" : "grab", touchAction: "none" }}
          role="img" aria-label="Stadtkarte mit Kanalnetz-Overlay">
          <defs>
            <pattern id="hatch" width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="9" stroke="#8b5cf6" strokeWidth="2.2" />
            </pattern>
            <filter id="sw"><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncR type="linear" slope="0.72" /><feFuncG type="linear" slope="0.72" /><feFuncB type="linear" slope="0.72" /></feComponentTransfer></filter>
          </defs>
          <image href={istStadt ? MAP_SRC : (karte.bild || "")} x="0" y="0" width={KW} height={KH} preserveAspectRatio="none" filter={netzAn && istStadt ? "url(#sw)" : undefined} />
          {!istStadt && !karte.bild && <text x={KW / 2} y={KH / 2} fontSize="28" fill={C.dim} textAnchor="middle">Kein Kartenbild — im Orte-Tab unter «Karten & Ebenen» hinterlegen</text>}
          {istStadt && KACHELN.filter((k) => k.src).map((k, i) => (
            <image key={i} href={k.src} x={k.x} y={k.y} width={k.w} height={k.h} preserveAspectRatio="none" filter={netzAn ? "url(#sw)" : undefined} />
          ))}
          {model.zonen.map((g, i) => {
            if ((g.karteId || "wasserfeste") !== karte.id) return null;
            if (g.typ === "distrikt" ? !distrikteAn : !(gebieteAn && !spieler)) return null;
            const zellen = zonenZellen[i] || [];
            const aktivZ = zoneSel === g.id && modus === "zoneMitte";
            return (
              <g key={g.id} pointerEvents="none">
                {zellen.map((c, j) => (
                  <polygon key={j} points={hexPfad(c.x, c.y, 0.96)}
                    fill={g.hatch ? "url(#hatch)" : g.farbe} opacity={g.hatch ? 0.5 : g.typ === "distrikt" ? 0.16 : 0.22}
                    stroke={g.farbe} strokeWidth={aktivZ ? 2.5 : 1} strokeOpacity={g.dash || aktivZ ? 0.9 : 0.5} strokeDasharray={g.dash ? "4 3" : ""} />
                ))}
                <text x={g.lx} y={g.ly} fontSize="13" fontWeight="700" fill={g.farbe} textAnchor="middle" style={{ paintOrder: "stroke", stroke: "#101613", strokeWidth: 3 }}>{g.label}</text>
              </g>
            );
          })}
          {model.karten.filter((k) => k.elternId === karte.id && k.x != null).map((k) => (
            <g key={k.id} style={{ cursor: "pointer" }} onClick={(ev) => { ev.stopPropagation(); if (!warDrag()) { upd((m) => { m.aktiveKarteId = k.id; }); setView({ x: 0, y: 0, w: k.w }); } }}>
              <rect x={k.x - 14} y={k.y - 10} width="28" height="20" rx="3" fill={C.gold} stroke="#101613" strokeWidth="1.5" />
              <text x={k.x} y={k.y + 4} fontSize="11" fontWeight="700" fill="#101613" textAnchor="middle">▣</text>
              <text x={k.x} y={k.y - 15} fontSize="12" fontWeight="700" fill={C.gold} textAnchor="middle" style={{ paintOrder: "stroke", stroke: "#101613", strokeWidth: 3 }}>{k.name} ↓</text>
            </g>
          ))}
          {polyPunkte.length > 0 && <g pointerEvents="none"><polyline points={polyPunkte.map((q) => q.join(",")).join(" ")} fill="none" stroke={C.amber} strokeWidth="2" strokeDasharray="4 3" />{polyPunkte.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r="4" fill={C.amber} />)}</g>}
          {!spieler && zoneSel && (() => { const z = model.zonen.find((x) => x.id === zoneSel); if (!z) return null; const sZ = Math.max(0.55, Math.min(1.6, view.w / 380)); const R = 6 * sZ;
            const griff = (x, y, kind, i, form) => <circle key={kind + i} cx={x} cy={y} r={R} fill={kind === "center" ? C.gold : kind === "size" ? C.amber : C.kreide} stroke="#101613" strokeWidth={1.5 * sZ} style={{ cursor: "grab" }}
              onPointerDown={(ev) => { ev.stopPropagation(); zoneDrag.current = { id: z.id, kind, i, cx: z.form === "rect" ? z.x + z.w / 2 : z.form === "polygon" ? z.punkte.reduce((a, q) => a + q[0], 0) / z.punkte.length : z.cx, cy: z.form === "rect" ? z.y + z.h / 2 : z.form === "polygon" ? z.punkte.reduce((a, q) => a + q[1], 0) / z.punkte.length : z.cy, x0: z.form === "rect" ? z.x : z.cx, y0: z.form === "rect" ? z.y : z.cy, punkte: z.punkte ? z.punkte.map((q) => [...q]) : null, lx: z.lx, ly: z.ly }; }} />;
            const g = [];
            if (z.form === "rect") { g.push(griff(z.x + z.w / 2, z.y + z.h / 2, "center", 0)); g.push(griff(z.x + z.w, z.y + z.h, "size", 0)); g.push(<rect key="r" x={z.x} y={z.y} width={z.w} height={z.h} fill="none" stroke={C.amber} strokeWidth={1.5 * sZ} strokeDasharray="5 4" pointerEvents="none" />); }
            else if (z.form === "circle") { g.push(griff(z.cx, z.cy, "center", 0)); g.push(griff(z.cx + z.r, z.cy, "size", 0)); }
            else if (z.form === "ellipse") { g.push(griff(z.cx, z.cy, "center", 0)); g.push(griff(z.cx + z.rx, z.cy + z.ry, "size", 0)); }
            else if (z.form === "polygon") { g.push(<polygon key="p" points={(z.punkte || []).map((q) => q.join(",")).join(" ")} fill="none" stroke={C.amber} strokeWidth={1.5 * sZ} strokeDasharray="5 4" pointerEvents="none" />); (z.punkte || []).forEach((q, i) => g.push(griff(q[0], q[1], "vertex", i))); g.push(griff(z.punkte.reduce((a, q) => a + q[0], 0) / z.punkte.length, z.punkte.reduce((a, q) => a + q[1], 0) / z.punkte.length, "center", 0)); }
            return <g>{g}</g>; })()}
          {(model.marker || []).filter((mk) => (mk.karteId || "wasserfeste") === karte.id).map((mk) => {
            const sM = Math.max(0.55, Math.min(1.6, view.w / 380)); const R = 8 * sM;
            const nm = mk.typ === "gruppe" ? "Gruppe" : mk.typ === "charakter" ? model.charaktere.find((c) => c.id === mk.refId)?.name : model.npcs.find((n) => n.id === mk.refId)?.name;
            if (!nm) return null;
            const col = mk.typ === "gruppe" ? C.gold : mk.typ === "charakter" ? C.teal : C.rot;
            return (
              <g key={mk.id} style={{ cursor: "pointer" }} onClick={(ev) => { ev.stopPropagation(); if (!warDrag()) { setMarkerWahl(mk.typ + (mk.refId ? ":" + mk.refId : "")); setModus("marker"); } }}>
                {mk.typ === "gruppe" ? <polygon points={Array.from({ length: 10 }, (_, i) => { const r2 = i % 2 ? R * 0.5 : R * 1.3; const a2 = -Math.PI / 2 + i * Math.PI / 5; return `${mk.x + Math.cos(a2) * r2},${mk.y + Math.sin(a2) * r2}`; }).join(" ")} fill={col} stroke="#101613" strokeWidth={1.5 * sM} />
                  : <circle cx={mk.x} cy={mk.y} r={R} fill={col} stroke="#101613" strokeWidth={1.5 * sM} />}
                {mk.typ !== "gruppe" && <text x={mk.x} y={mk.y + R * 0.4} fontSize={R} fontWeight="700" fill="#101613" textAnchor="middle">{nm[0]}</text>}
                <text x={mk.x} y={mk.y - R - 4 * sM} fontSize={10 * sM} fontWeight="700" fill={col} textAnchor="middle" style={{ paintOrder: "stroke", stroke: "#101613", strokeWidth: 3 * sM }}>{nm}</text>
              </g>
            );
          })}
          {istStadt && netzAn && hexAn && view.w <= 820 && <HexGrid view={view} vhOf={vh} />}
          {orteAn && <Orte model={model} spieler={spieler} sel={sel} zoomW={view.w} anzeige={anzeige}
            onOrt={(id) => { if (!warDrag()) setSel({ kind: "ort", id }); }} />}
          {istStadt && netzAn && <Netz model={model} spieler={spieler} sel={sel} zoomW={view.w} hexAn={hexAn} anzeige={anzeige}
            onNode={knotenKlick} onEdge={(id) => { if (!warDrag()) setSel({ kind: "edge", id }); }} />}
        </svg>
        {!spieler && <KanalRegeln model={model} upd={upd} />}
        {!spieler && <details style={{ marginTop: 8 }}><summary style={{ cursor: "pointer", color: C.amber, fontSize: 13 }}>Zonen bearbeiten ({model.zonen.length})</summary><div style={{ marginTop: 6, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 12, color: C.dim, display: "flex", gap: 4, alignItems: "center" }}>Griffe zeigen für<select value={zoneSel || ""} onChange={(ev) => setZoneSel(ev.target.value || null)}><option value="">— keine —</option>{model.zonen.map((z) => <option key={z.id} value={z.id}>{z.label} ({z.typ})</option>)}</select></label>
            <button className={"knopf " + (modus === "zonePoly" ? "primaer" : "")} style={{ fontSize: 12 }} onClick={() => { setPolyPunkte([]); setModus(modus === "zonePoly" ? "normal" : "zonePoly"); }}>✎ Gebiet einziehen (Klicks)</button>
            <span style={{ fontSize: 11.5, color: C.dim }}>Gold = verschieben · Bernstein = Grösse · Weiss = Eckpunkt</span>
          </div><ZonenTab model={model} upd={upd} teil="zonen" starteMitte={(id) => { setZoneSel(id); setModus("zoneMitte"); }} /></div></details>}
        <p style={{ color: C.dim, fontSize: 11.5, margin: "6px 0 0" }}>Ziehen = verschieben · Mausrad oder +/− = zoomen · Hexraster ab mittlerer Zoomstufe · {netzAn ? "Karte in Schwarz-Weiss, solange das Netz eingeblendet ist." : "Netz ausgeblendet — Karte in Farbe."}</p>

        {!spieler && (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginTop: 16 }}>
              <Panel titel={selNode ? "Knoten" : selEdge ? "Gang" : selOrt ? "Ort" : "Auswahl"}>
                {!sel && <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Knoten, Gang oder Ort anklicken — oder oben «+ Knoten setzen» / «+ Ort setzen». Am Knoten den Encounter-Typ auswürfeln oder setzen; der Pool schlägt dann nach Distrikt und Fraktion vor. Die Orte-Ebene ist das Nachschlagewerk der Kampagne.</p>}
                {selOrt && <OrtPanel o={selOrt} model={model} upd={upd}
                  starteVerschieben={() => setModus("verschieben")}
                  loeschen={() => { if (!bestaetigen(selOrt.name + " löschen?")) return; upd((m) => { delete m.orte[selOrt.id]; }); setSel(null); }} />}
                {selNode && <KnotenPanel n={selNode} model={model} upd={upd} wuerfeln={wuerfeln} setWurf={setWurf} waehleKante={(id) => setSel({ kind: "edge", id })}
                  starteVerbinden={() => { setModus("verbinden"); setVerbindeVon(selNode.id); }}
                  starteVerschieben={() => setModus("verschieben")}
                  loeschen={() => { if (!bestaetigen(selNode.name + " samt Gängen löschen?")) return; upd((m) => { delete m.nodes[selNode.id]; for (const k of Object.keys(m.edges)) if (m.edges[k].a === selNode.id || m.edges[k].b === selNode.id) delete m.edges[k]; }); setSel(null); }} />}
                {selEdge && <KantenPanel e={selEdge} model={model} upd={upd}
                  loeschen={() => { upd((m) => { const e = m.edges[selEdge.id]; delete m.edges[selEdge.id]; [e.a, e.b].forEach((nid) => { const n = m.nodes[nid]; if (n && n.art === "weiter" && !Object.values(m.edges).some((x) => x.a === nid || x.b === nid)) delete m.nodes[nid]; }); }); setSel(null); }} />}
              </Panel>
              <Panel titel={wurf ? `Wurf: ${model.nodes[wurf.nodeId]?.name || ""}` : "Wurf & Vorschläge"}>
                {!wurf && <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>«Typ auswürfeln» an einem Knoten — Gewichtung nach Distrikt. Der Typ lässt sich übersteuern; Vorschläge filtern nach Typ, Distrikt und Fraktion des Knotens.</p>}
                {wurf && <WurfPanel wurf={wurf} setWurf={setWurf} model={model} upd={upd} wuerfeln={wuerfeln} />}
              </Panel>
              <Panel titel={`Log (${model.log.length})`}>
                {model.log.length === 0 && <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Festgehaltene Encounter landen hier.</p>}
                <div style={{ display: "grid", gap: 8, maxHeight: 340, overflowY: "auto" }}>
                  {model.log.map((l) => (
                    <div key={l.id} style={{ borderLeft: `3px solid ${TYPEN[l.typ] || C.kreide}`, paddingLeft: 8, fontSize: 12.5 }}>
                      <div style={{ color: C.dim }}>{l.ts} · {l.node} · <span style={{ color: TYPEN[l.typ] }}>{l.typ}</span>
                        <button className="knopf leise" style={{ padding: "0 6px", marginLeft: 4, fontSize: 11 }} onClick={() => upd((m) => { m.log = m.log.filter((x) => x.id !== l.id); })}>✕</button>
                      </div>
                      <div>{l.text || <em style={{ color: C.dim }}>ohne Text</em>}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          </>
        )}
        {spieler && <p className="serif" style={{ color: C.dim, fontSize: 13, marginTop: 12, fontStyle: "italic" }}>Ihr seht, was ihr erkundet habt. Gestrichelte Gänge kennt ihr nur vom Luftzug.</p>}
      </>)}

      {tab === "encounter" && !spieler && <Pool model={model} upd={upd} />}
      {tab === "monster" && !spieler && <MonsterTab model={model} upd={upd} sprung={sprung} />}
      {tab === "geschichte" && !spieler && <GeschichteTab model={model} upd={upd} springe={springe} />}
      {tab === "quests" && !spieler && <QuestTab model={model} upd={upd} sprung={sprung} />}

      {tab === "orte" && !spieler && <><KartenVerwaltung model={model} upd={upd} verorten={(id) => { setKarteZumSetzen(id); setModus("karteMarker"); setTab("karte"); }} zeigen={(id) => { const k = model.karten.find((x) => x.id === id); upd((m) => { m.aktiveKarteId = id; }); setView(id === "wasserfeste" ? VIEW_DOCK : { x: 0, y: 0, w: k.w }); setTab("karte"); }} /><OrteTab model={model} upd={upd} sprung={sprung} platzieren={(id) => { setOrtZumPlatzieren(id); setModus("ort"); setTab("karte"); }} /><ZonenTab model={model} upd={upd} teil="distrikte" starteMitte={() => {}} /></>}
      {tab === "gegenstaende" && !spieler && <GegenstaendeTab model={model} upd={upd} sprung={sprung} />}
      {tab === "regeln" && !spieler && <RegelnTab model={model} upd={upd} sprung={sprung} />}
      {tab === "zonen" && !spieler && <><ZonenTab model={model} upd={upd} teil="fraktionen" starteMitte={() => {}} /><NpcTab model={model} upd={upd} sprung={sprung} /></>}
      {tab === "gruppe" && <GruppeTab model={model} upd={upd} spieler={spieler} />}
      {tab === "initiative" && <InitiativeTab model={model} upd={upd} spieler={spieler} springe={springe} />}
      {tab === "board" && !spieler && <BoardTab model={model} upd={upd} />}

      {tab === "wissen" && !spieler && <WissenTab model={model} upd={upd} springe={springe} />}
      {tab === "kompendium" && !spieler && <><KompendiumTab model={model} upd={upd} setModel={setModel} springe={springe} /><DatenTab model={model} setModel={setModel} /></>}
      </main>
    </div>
    </FilterCtx.Provider></SprungCtx.Provider></ModelCtx.Provider>
  );
}

function Netz({ model, spieler, sel, zoomW, hexAn, anzeige, onNode, onEdge }) {
  const pos = (n) => (hexAn ? hexSnap(n.x, n.y) : { x: n.x, y: n.y });
  const s = Math.max(0.55, Math.min(1.6, zoomW / 380));
  const R = 7 * s, F = 11 * s;
  const sichtbarN = (n) => !spieler || n.zustand !== "verborgen";
  const sichtbarE = (e) => !spieler || e.zustand !== "verborgen";
  const farbeKnoten = (n) => {
    if (n.farbe) return n.farbe;
    if (n.art === "einstieg" || n.art === "ausstieg" || n.art === "beides") return C.amber;
    if (n.art === "versteck") return C.gold;
    if (!spieler && n.typ) return TYPEN[n.typ];
    return C.teal;
  };
  return (
    <g>
      {Object.values(model.edges).map((e) => {
        const a0 = model.nodes[e.a], b0 = model.nodes[e.b];
        if (!a0 || !b0 || !sichtbarE(e)) return null;
        const a = { ...a0, ...pos(a0) }, b = { ...b0, ...pos(b0) };
        const offen = a0.art === "weiter" || b0.art === "weiter";
        const entdeckt = e.zustand === "entdeckt";
        const aktiv = sel?.kind === "edge" && sel.id === e.id;
        return (
          <g key={e.id} style={{ cursor: "pointer" }} onClick={(ev) => { ev.stopPropagation(); onEdge(e.id); }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={24 * s} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.farbe || C.teal} strokeWidth={(aktiv ? 4.6 : 3.4) * s}
              strokeDasharray={entdeckt ? `${3 * s} ${6 * s}` : offen ? `${8 * s} ${5 * s}` : e.stil === "gestrichelt" ? `${6 * s} ${5 * s}` : e.stil === "gepunktet" ? `${1.5 * s} ${4 * s}` : ""}
              opacity={entdeckt ? 0.6 : 0.95} strokeLinecap="round" style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,.9))" }} />
          </g>
        );
      })}
      {Object.values(model.nodes).map((n0) => {
        if (!sichtbarN(n0)) return null;
        if (anzeige && anzeige.arten[n0.art] === false) return null;
        const n = { ...n0, ...pos(n0) };
        const c = farbeKnoten(n);
        const sym = n.symbol || SYMBOL_STANDARD[n.art] || "kreis";
        const aktiv = sel?.kind === "node" && sel.id === n.id;
        const entdeckt = n.zustand === "entdeckt";
        const zeigNamen = !spieler || n.zustand === "erkundet";
        return (
          <g key={n.id} style={{ cursor: "pointer" }} onClick={(ev) => { ev.stopPropagation(); onNode(n.id); }}>
            {hexAn && n.art !== "weiter" && (
              <polygon points={hexPfad(n.x, n.y, 0.96)} fill={c} opacity="0.16" stroke={c} strokeWidth={0.9 * s} />
            )}
            {sym === "auge" && <g>
              <circle cx={n.x} cy={n.y} r={R * 2} fill="none" stroke={C.gold} strokeWidth={1.4 * s} opacity="0.9" />
              {Array.from({ length: 10 }).map((_, i) => {
                const a2 = (i / 10) * Math.PI * 2;
                return <line key={i} x1={n.x + Math.cos(a2) * R * 2} y1={n.y + Math.sin(a2) * R * 2}
                  x2={n.x + Math.cos(a2) * R * 2.7} y2={n.y + Math.sin(a2) * R * 2.7} stroke={C.gold} strokeWidth={1.4 * s} />;
              })}
            </g>}
            {!spieler && (!anzeige || anzeige.sicherung) && n.sicherung && n.sicherung !== "offen" && n.art !== "weiter" && (
              <circle cx={n.x} cy={n.y} r={R * 1.55} fill="none" stroke={C.teal} strokeWidth={1.4 * s}
                strokeDasharray={n.sicherung === "brüchig" ? `${3 * s} ${3 * s}` : ""} opacity="0.9" />
            )}
            {n.markierung && (!anzeige || anzeige.markierung) && n.art !== "versteck" && !spieler && (
              <circle cx={n.x + R * 1.7} cy={n.y - R * 1.7} r={R * 0.55} fill="none" stroke={C.gold} strokeWidth={1.3 * s} />
            )}
            {(() => {
              const RR = aktiv ? R * 1.25 : R;
              const fuellung = entdeckt ? C.bg : c;
              const sw = 2.2 * s;
              if (sym === "offen") return <polygon points={`${n.x - R},${n.y + R} ${n.x + R},${n.y + R} ${n.x},${n.y - R}`} fill="none" stroke={c} strokeWidth={2 * s} strokeDasharray={`${3 * s} ${3 * s}`} />;
              if (sym === "dreieckAb") return <polygon points={`${n.x - RR},${n.y - RR * 0.75} ${n.x + RR},${n.y - RR * 0.75} ${n.x},${n.y + RR}`} fill={fuellung} stroke={c} strokeWidth={sw} strokeLinejoin="round" />;
              if (sym === "dreieckAuf") return <polygon points={`${n.x - RR},${n.y + RR * 0.75} ${n.x + RR},${n.y + RR * 0.75} ${n.x},${n.y - RR}`} fill={fuellung} stroke={c} strokeWidth={sw} strokeLinejoin="round" />;
              if (sym === "raute") return <polygon points={`${n.x},${n.y - RR * 1.15} ${n.x + RR * 1.15},${n.y} ${n.x},${n.y + RR * 1.15} ${n.x - RR * 1.15},${n.y}`} fill={fuellung} stroke={c} strokeWidth={sw} strokeLinejoin="round" />;
              if (sym === "quadrat") return <rect x={n.x - RR * 0.9} y={n.y - RR * 0.9} width={RR * 1.8} height={RR * 1.8} rx={1.5 * s} fill={fuellung} stroke={c} strokeWidth={sw} />;
              if (sym === "stern") return <polygon points={Array.from({ length: 10 }, (_, i) => { const r2 = i % 2 ? RR * 0.5 : RR * 1.2; const a2 = -Math.PI / 2 + i * Math.PI / 5; return `${n.x + Math.cos(a2) * r2},${n.y + Math.sin(a2) * r2}`; }).join(" ")} fill={fuellung} stroke={c} strokeWidth={sw * 0.8} strokeLinejoin="round" />;
              return <circle cx={n.x} cy={n.y} r={RR} fill={fuellung} stroke={c} strokeWidth={sw} />;
            })()}
            {sym === "auge" && <circle cx={n.x} cy={n.y} r={R * 0.4} fill={C.bg} />}
            {(!anzeige || anzeige.titel) && (
              <text x={n.x} y={n.y - R - 6 * s} fontSize={F} fontWeight="700" fill={entdeckt && spieler ? C.dim : C.kreide} textAnchor="middle"
                fontFamily="'Alegreya', Georgia, serif" style={{ paintOrder: "stroke", stroke: "#101613", strokeWidth: 3 * s }}>
                {zeigNamen ? n.name : "?"}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function Orte({ model, spieler, sel, zoomW, anzeige, onOrt }) {
  const s = Math.max(0.55, Math.min(1.6, zoomW / 380));
  const R = 6 * s, F = 10 * s;
  return (
    <g>
      {Object.values(model.orte || {}).map((o) => {
        if (spieler && !o.sichtbar) return null;
        if (o.platziert === false || o.x == null) return null;
        if ((o.karteId || "wasserfeste") !== (model.aktiveKarteId || "wasserfeste")) return null;
        const c = o.farbe || (o.f === "keine" ? "#b9c4bc" : frakFarbe(model, o.f));
        const aktiv = sel?.kind === "ort" && sel.id === o.id;
        const sym = o.symbol || "quadrat";
        const RR = aktiv ? R * 1.2 : R;
        return (
          <g key={o.id} style={{ cursor: "pointer" }} onClick={(ev) => { ev.stopPropagation(); onOrt(o.id); }}>
            {sym === "quadrat" && <rect x={o.x - RR} y={o.y - RR} width={2 * RR} height={2 * RR} rx={1.5 * s} fill={c} opacity={0.92} stroke="#101613" strokeWidth={1.6 * s} />}
            {sym === "kreis" && <circle cx={o.x} cy={o.y} r={RR} fill={c} stroke="#101613" strokeWidth={1.6 * s} />}
            {sym === "raute" && <polygon points={`${o.x},${o.y - RR * 1.2} ${o.x + RR * 1.2},${o.y} ${o.x},${o.y + RR * 1.2} ${o.x - RR * 1.2},${o.y}`} fill={c} stroke="#101613" strokeWidth={1.6 * s} />}
            {sym === "stern" && <polygon points={Array.from({ length: 10 }, (_, i) => { const r2 = i % 2 ? RR * 0.5 : RR * 1.25; const a2 = -Math.PI / 2 + i * Math.PI / 5; return `${o.x + Math.cos(a2) * r2},${o.y + Math.sin(a2) * r2}`; }).join(" ")} fill={c} stroke="#101613" strokeWidth={1.2 * s} />}
            {sym === "dreieckAuf" && <polygon points={`${o.x - RR},${o.y + RR * 0.8} ${o.x + RR},${o.y + RR * 0.8} ${o.x},${o.y - RR}`} fill={c} stroke="#101613" strokeWidth={1.6 * s} />}
            {!spieler && !o.sichtbar && <rect x={o.x - R} y={o.y - R} width={2 * R} height={2 * R} rx={1.5 * s} fill="none" stroke={c} strokeWidth={1 * s} strokeDasharray={`${2 * s} ${2 * s}`} transform={`translate(${2.5 * s} ${-2.5 * s})`} opacity="0.8" />}
            {(!anzeige || (anzeige.titel && anzeige.ortTitel !== false)) && (
              <text x={o.x} y={o.y - R - 4 * s} fontSize={F} fontStyle="italic" fill={c} textAnchor="middle"
                fontFamily="'Alegreya', Georgia, serif" style={{ paintOrder: "stroke", stroke: "#101613", strokeWidth: 2.6 * s }}>
                {o.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function Panel({ titel, children }) {
  return (
    <div className="kasten panel" style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14 }}>
      <h2 className="serif" style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 700 }}>{titel}</h2>
      {children}
    </div>
  );
}
const ZUSTAENDE = ["verborgen", "entdeckt", "erkundet"];
function ZustandSchalter({ wert, setzen }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {ZUSTAENDE.map((z) => (
        <button key={z} className={"knopf " + (wert === z ? "primaer" : "")} style={{ fontSize: 12, padding: "3px 9px" }} onClick={() => setzen(z)}>{z}</button>
      ))}
    </div>
  );
}

function KnotenPanel({ n, model, upd, wuerfeln, setWurf, starteVerbinden, starteVerschieben, loeschen, waehleKante }) {
  const gaenge = Object.values(model.edges).filter((e) => e.a === n.id || e.b === n.id);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input type="text" value={n.name} onChange={(ev) => upd((m) => { m.nodes[n.id].name = ev.target.value; })} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="feld">Art
          <select value={n.art} onChange={(ev) => upd((m) => { m.nodes[n.id].art = ev.target.value; })}>
            {Object.entries(ARTEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "end", fontSize: 12.5, paddingBottom: 4 }}>
          <input type="checkbox" checked={n.markierung} onChange={(ev) => upd((m) => { m.nodes[n.id].markierung = ev.target.checked; })} />
          gelbe Markierung
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="feld">Distrikt
          <select value={n.distrikt} onChange={(ev) => upd((m) => { m.nodes[n.id].distrikt = ev.target.value; })}>
            {Object.keys(model.distrikte).map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="feld">Fraktion
          <select value={n.fraktion} onChange={(ev) => upd((m) => { m.nodes[n.id].fraktion = ev.target.value; })}>
            {frakNamen(model).map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="feld">Symbol
          <select value={n.symbol || ""} onChange={(ev) => upd((m) => { m.nodes[n.id].symbol = ev.target.value; })}>
            <option value="">Standard der Art</option>
            {Object.entries(SYMBOLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="feld">Farbe
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="color" value={n.farbe || "#45c4ae"} onChange={(ev) => upd((m) => { m.nodes[n.id].farbe = ev.target.value; })} style={{ width: 44, height: 28, padding: 0, background: "none", border: `1px solid ${C.linie}` }} />
            <button className="knopf leise" style={{ fontSize: 12 }} onClick={() => upd((m) => { m.nodes[n.id].farbe = ""; })}>automatisch</button>
          </div>
        </div>
      </div>
      {n.art !== "weiter" && (n.fraktion === "keine" ? (
        <div className="feld">Sicherung (nur Normalknoten)
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {["offen", "brüchig", "gesichert"].map((z) => (
              <button key={z} className={"knopf " + (n.sicherung === z ? (z === "gesichert" ? "an" : "primaer") : "")}
                style={{ fontSize: 12, padding: "3px 9px" }}
                onClick={() => upd((m) => { m.nodes[n.id].sicherung = z; })}>{z}</button>
            ))}
          </div>
          <span style={{ fontSize: 11 }}>Die investierte Zeit bestimmt die erreichte Stufe: im Durchgang gesichert → höchstens «brüchig» (nur Hindernis/Ressource/Geschichte); mit Zeit & Material → «gesichert» (kein Wurf). Verfall über «Zeitsprung» oben: W8 — 1–4 hält · 5–6 eine Stufe · 7 zwei Stufen · 8 alles; +1 neben Fraktionsknoten.</span>
        </div>
      ) : (
        <span style={{ fontSize: 11.5, color: C.rot }}>Fraktionsknoten — nie sicherbar.</span>
      ))}
      <div className="feld">Erlaubte Encounter-Typen (leer = alle; Gewichtung bleibt)
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {TYP_LISTE.map((t) => { const an = (n.erlaubteTypen || []).includes(t); return (
            <button key={t} className={"knopf " + (an ? "an" : "")} style={{ fontSize: 12, padding: "2px 9px", borderColor: TYPEN[t] }} onClick={() => upd((m) => { const x = m.nodes[n.id]; x.erlaubteTypen = an ? x.erlaubteTypen.filter((y) => y !== t) : [...(x.erlaubteTypen || []), t]; })}>{t}</button>
          ); })}
          {(n.erlaubteTypen || []).length > 0 && <button className="knopf leise" style={{ fontSize: 12 }} onClick={() => upd((m) => { m.nodes[n.id].erlaubteTypen = []; })}>alle</button>}
        </div>
      </div>
      <div className="feld">Encounter-Typ des Knotens
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button className="knopf primaer" disabled={n.sicherung === "gesichert"} style={n.sicherung === "gesichert" ? { opacity: 0.5, cursor: "not-allowed" } : {}}
            onClick={() => wuerfeln(n.id)}>{n.sicherung === "gesichert" ? "Gesichert — kein Wurf" : n.sicherung === "brüchig" ? "Typ auswürfeln (reduziert)" : "Typ auswürfeln"}</button>
          <select value={n.typ || ""} onChange={(ev) => { const t = ev.target.value || null; upd((m) => { m.nodes[n.id].typ = t; }); if (t) setWurf({ nodeId: n.id, typ: t }); }}>
            <option value="">— setzen —</option>
            {TYP_LISTE.map((t) => <option key={t}>{t}</option>)}
          </select>
          {n.typ && <span style={{ color: TYPEN[n.typ], fontWeight: 600, fontSize: 13 }}>{n.typ}</span>}
        </div>
      </div>
      {n.encounter && (
        <div style={{ fontSize: 12.5, borderLeft: `3px solid ${TYPEN[n.typ] || C.teal}`, paddingLeft: 8, display: "grid", gap: 6 }}>
          <div><span style={{ color: C.dim }}>Hinterlegt:</span> {n.encounter}</div>
          {n.encounterId && (model.encounters.find((e) => e.id === n.encounterId)?.monster || []).map((mid) => model.monster?.[mid] && (
            <details key={mid}>
              <summary style={{ cursor: "pointer", color: C.amber, fontSize: 12 }}>{model.monster[mid].name} — Statblock</summary>
              <div style={{ marginTop: 6 }}><Statblock m={model.monster[mid]} model={model} /></div>
            </details>
          ))}
        </div>
      )}
      <div className="feld">Was hier schon war ({(n.historie || []).length})
        <div style={{ display: "grid", gap: 4 }}>
          {(n.historie || []).map((h) => (
            <div key={h.id} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12.5, borderLeft: `3px solid ${TYPEN[h.typ] || (h.typ === "Aktion" ? C.teal : C.linie)}`, paddingLeft: 8 }}>
              <span style={{ color: C.dim, minWidth: 78 }}>{h.ts}{h.sitzungId ? " · #" + (model.sitzungen?.find((x) => x.id === h.sitzungId)?.nummer ?? "?") : ""}</span>
              <span style={{ flex: 1 }}><span style={{ color: TYPEN[h.typ] || C.teal }}>{h.typ}</span> — {h.text}</span>
              <button className="knopf leise" style={{ padding: "0 6px" }} onClick={() => upd((m) => { m.nodes[n.id].historie = m.nodes[n.id].historie.filter((x) => x.id !== h.id); })}>✕</button>
            </div>
          ))}
          {(n.historie || []).length === 0 && <span style={{ fontSize: 12, color: C.dim }}>Noch nichts — festgehaltene Encounter landen hier automatisch.</span>}
          <HistorieEintrag onAdd={(typ, text) => upd((m) => { m.nodes[n.id].historie = [...(m.nodes[n.id].historie || []), { id: "h" + Date.now(), ts: new Date().toISOString().slice(0, 10), sitzungId: m.aktuelleSitzungId || null, typ, text, encounterId: null }]; })} />
          <KnotenAktion model={model} onAdd={(text) => upd((m) => { m.nodes[n.id].historie = [...(m.nodes[n.id].historie || []), { id: "h" + Date.now(), ts: new Date().toISOString().slice(0, 10), sitzungId: m.aktuelleSitzungId || null, typ: "Aktion", text, encounterId: null }]; })} />
        </div>
      </div>
      <div className="feld">Erkundung
        <ZustandSchalter wert={n.zustand} setzen={(z) => upd((m) => {
          m.nodes[n.id].zustand = z;
          if (z === "erkundet") gaenge.forEach((e) => { if (m.edges[e.id].zustand === "verborgen") m.edges[e.id].zustand = "entdeckt"; });
        })} />
        <span style={{ fontSize: 11 }}>«erkundet» deckt die Abgänge als «entdeckt» auf.</span>
      </div>
      <div className="feld">SL-Notiz
        <textarea rows={2} value={n.notiz} onChange={(ev) => upd((m) => { m.nodes[n.id].notiz = ev.target.value; })} />
      </div>
      {gaenge.length > 0 && (
        <div className="feld">Abgänge & Signale (vorlesen)
          <div style={{ display: "grid", gap: 6 }}>
            {gaenge.map((e) => (
              <div key={e.id} style={{ fontSize: 12.5, borderLeft: `3px solid ${e.farbe || C.teal}`, paddingLeft: 8, display: "flex", gap: 6, alignItems: "flex-start" }}>
                <span style={{ flex: 1 }}><strong>{model.nodes[e.a]?.name?.split(" ")[0]}–{model.nodes[e.b]?.name?.split(" ")[0]}</strong> — {e.signal || "kein Signal hinterlegt"}</span>
                <button className="knopf leise" style={{ fontSize: 11, padding: "0 6px" }} onClick={() => waehleKante(e.id)}>bearbeiten</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="knopf" onClick={starteVerbinden}>Gang zu … ziehen</button>
        <button className="knopf" onClick={starteVerschieben}>Verschieben</button>
        <button className="knopf gefahr" onClick={loeschen}>Löschen</button>
      </div>
    </div>
  );
}

function OrtPanel({ o, model, upd, starteVerschieben, loeschen }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input type="text" value={o.name} onChange={(ev) => upd((m) => { m.orte[o.id].name = ev.target.value; })} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="feld">Fraktion
          <select value={o.f} onChange={(ev) => upd((m) => { m.orte[o.id].f = ev.target.value; })}>
            {frakNamen(model).map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "end", fontSize: 12.5, paddingBottom: 4 }}>
          <input type="checkbox" checked={o.sichtbar} onChange={(ev) => upd((m) => { m.orte[o.id].sichtbar = ev.target.checked; })} />
          für Spieler sichtbar
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="feld">Symbol
          <select value={o.symbol || "quadrat"} onChange={(ev) => upd((m) => { m.orte[o.id].symbol = ev.target.value; })}>
            {[["quadrat", "■ Quadrat"], ["kreis", "● Kreis"], ["raute", "◆ Raute"], ["stern", "★ Stern"], ["dreieckAuf", "▲ Dreieck"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="feld">Farbe
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="color" value={o.farbe || "#b9c4bc"} onChange={(ev) => upd((m) => { m.orte[o.id].farbe = ev.target.value; })} style={{ width: 44, height: 28, padding: 0, background: "none", border: `1px solid ${C.linie}` }} />
            <button className="knopf leise" style={{ fontSize: 12 }} onClick={() => upd((m) => { m.orte[o.id].farbe = ""; })}>Fraktionsfarbe</button>
          </div>
        </div>
      </div>
      <div className="feld">Beschreibung / Nachschlagen
        <textarea rows={4} value={o.beschreibung ?? o.b ?? ""} onChange={(ev) => upd((m) => { m.orte[o.id].beschreibung = ev.target.value; m.orte[o.id].b = ev.target.value; })} />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="knopf" onClick={starteVerschieben}>Verschieben</button>
        <button className="knopf" onClick={() => upd((m) => { m.orte[o.id].platziert = false; })}>Von der Karte nehmen</button>
        <button className="knopf gefahr" onClick={loeschen}>Löschen</button>
      </div>
    </div>
  );
}

function KanalRegeln({ model, upd }) {
  const [offen, setOffen] = useState(false);
  const r = model.kanalRegeln;
  const rf = (k, v) => upd((m) => { m.kanalRegeln[k] = v; });
  return (
    <div style={{ marginTop: 8 }}>
      <button className="knopf" style={{ fontSize: 12 }} onClick={() => setOffen(!offen)}>{offen ? "Regeln einklappen" : "Regeln des Kanalnetzes"}</button>
      {offen && (
        <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 12, marginTop: 6, display: "grid", gap: 8 }}>
          <T l="Grundregel" v={r.text} setzen={(v) => rf("text", v)} rows={2} />
          <div style={{ display: "flex", gap: 10 }}>
            <label className="feld" style={{ width: 130 }}>Ration alle … Knoten<input type="number" min="1" value={r.rationAlle} onChange={(ev) => rf("rationAlle", Math.max(1, +ev.target.value || 1))} /></label>
            <label className="feld" style={{ width: 130 }}>Fackel alle … Knoten<input type="number" min="1" value={r.fackelAlle} onChange={(ev) => rf("fackelAlle", Math.max(1, +ev.target.value || 1))} /></label>
          </div>
          <div className="feld">Aktionen (eine pro Charakter und Knoten)
            <div style={{ display: "grid", gap: 4 }}>
              {r.aktionen.map((a, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 1fr 30px", gap: 6 }}>
                  <input type="text" value={a.name} onChange={(ev) => upd((m) => { m.kanalRegeln.aktionen[i].name = ev.target.value; })} />
                  <input type="text" value={a.text} onChange={(ev) => upd((m) => { m.kanalRegeln.aktionen[i].text = ev.target.value; })} />
                  <button className="knopf leise" onClick={() => upd((m) => { m.kanalRegeln.aktionen.splice(i, 1); })}>✕</button>
                </div>
              ))}
              <div><button className="knopf" style={{ fontSize: 12 }} onClick={() => upd((m) => m.kanalRegeln.aktionen.push({ name: "Neue Aktion", text: "" }))}>+ Aktion</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KnotenAktion({ model, onAdd }) {
  const [char, setChar] = useState("");
  const [akt, setAkt] = useState("");
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <select value={char} onChange={(ev) => setChar(ev.target.value)} style={{ fontSize: 12 }}><option value="">Charakter …</option>{model.charaktere.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
      <select value={akt} onChange={(ev) => setAkt(ev.target.value)} style={{ fontSize: 12 }}><option value="">Aktion …</option>{model.kanalRegeln.aktionen.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}</select>
      <button className="knopf" style={{ fontSize: 12 }} disabled={!char || !akt} onClick={() => { onAdd(`${char}: ${akt}`); setAkt(""); }}>Aktion festhalten</button>
    </div>
  );
}

function HistorieEintrag({ onAdd }) {
  const [typ, setTyp] = useState("Begegnung");
  const [text, setText] = useState("");
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select value={typ} onChange={(ev) => setTyp(ev.target.value)} style={{ fontSize: 12 }}>{TYP_LISTE.map((t) => <option key={t}>{t}</option>)}</select>
      <input type="text" value={text} placeholder="Manuell nachtragen …" style={{ flex: 1 }} onChange={(ev) => setText(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter" && text.trim()) { onAdd(typ, text.trim()); setText(""); } }} />
      <button className="knopf" style={{ fontSize: 12 }} onClick={() => { if (text.trim()) { onAdd(typ, text.trim()); setText(""); } }}>+</button>
    </div>
  );
}

function KantenPanel({ e, model, upd, loeschen }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="serif" style={{ fontSize: 17 }}>{model.nodes[e.a]?.name} ⟷ {model.nodes[e.b]?.name}</div>
      <div className="feld">Erkundung
        <ZustandSchalter wert={e.zustand} setzen={(z) => upd((m) => {
          m.edges[e.id].zustand = z;
          if (z === "erkundet") [e.a, e.b].forEach((nid) => { if (m.nodes[nid] && m.nodes[nid].zustand !== "erkundet") m.nodes[nid].zustand = "erkundet"; });
        })} />
        <span style={{ fontSize: 11 }}>«erkundet» markiert beide Endknoten mit.</span>
      </div>
      <div className="feld">Signal am Abzweig (vorlesen)
        <textarea rows={2} value={e.signal} onChange={(ev) => upd((m) => { m.edges[e.id].signal = ev.target.value; })} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="feld">Linienstil
          <select value={e.stil || "linie"} onChange={(ev) => upd((m) => { m.edges[e.id].stil = ev.target.value; })}>
            {Object.entries(STILE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="feld">Farbe
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="color" value={e.farbe || "#45c4ae"} onChange={(ev) => upd((m) => { m.edges[e.id].farbe = ev.target.value; })} style={{ width: 44, height: 28, padding: 0, background: "none", border: `1px solid ${C.linie}` }} />
            <button className="knopf leise" style={{ fontSize: 12 }} onClick={() => upd((m) => { m.edges[e.id].farbe = ""; })}>Standard</button>
          </div>
        </div>
      </div>
      <button className="knopf gefahr" onClick={loeschen}>Gang löschen</button>
    </div>
  );
}

function WurfPanel({ wurf, setWurf, model, upd, wuerfeln }) {
  const n = model.nodes[wurf.nodeId];
  if (!n) return null;
  const g = model.gruppenstufe || 1;
  const passend = model.encounters.filter((e) =>
    e.typ === wurf.typ && (e.d === n.distrikt || e.d === "alle") && (e.f === "alle" || e.f === "keine" || e.f === n.fraktion)
    && (e.lvMin ?? 1) <= g && (e.lvMax ?? 20) >= g
  );
  const frei = wurf.frei || "";
  const setFrei = (t) => setWurf({ ...wurf, frei: t });
  const festhalten = (text, encId = null) => {
    upd((m) => {
      m.nodes[n.id].typ = wurf.typ;
      m.nodes[n.id].encounter = text;
      m.nodes[n.id].encounterId = encId;
      m.nodes[n.id].historie = [...(m.nodes[n.id].historie || []), { id: "h" + Date.now(), ts: new Date().toISOString().slice(0, 10), sitzungId: m.aktuelleSitzungId || null, typ: wurf.typ, text, encounterId: encId }];
      m.log.unshift({ id: "l" + Date.now(), ts: new Date().toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }), node: n.name, typ: wurf.typ, text });
    });
    setWurf(null);
  };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="serif" style={{ fontSize: 22, fontWeight: 700, color: TYPEN[wurf.typ] }}>{wurf.typ}</span>
        <select value={wurf.typ} onChange={(ev) => setWurf({ ...wurf, typ: ev.target.value })}>
          {TYP_LISTE.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className="knopf" onClick={() => wuerfeln(wurf.nodeId)}>Neu würfeln</button>
      </div>
      <div style={{ fontSize: 12, color: C.dim }}>Filter: {n.distrikt} · Fraktion {n.fraktion} · Gruppenstufe {g} — {passend.length} Vorschläge</div>
      <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto" }}>
        {passend.map((e) => (
          <button key={e.id} className="knopf" style={{ textAlign: "left", fontSize: 12.5, borderLeft: `3px solid ${e.f === "keine" ? C.grau : frakFarbe(model, e.f)}` }}
            onClick={() => festhalten(e.t, e.id)}>
            <div>{e.t}{e.f !== "keine" && <span style={{ color: C.dim }}> · {e.f}</span>}{((e.lvMin ?? 1) !== 1 || (e.lvMax ?? 20) !== 20) && <span style={{ color: C.dim }}> · St. {e.lvMin}–{e.lvMax}</span>}</div>
            {e.notiz && <div style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{e.notiz}</div>}
            {(e.monster || []).length > 0 && <div style={{ color: C.amber, fontSize: 11, marginTop: 2 }}>Statblocks: {(e.monster || []).map((mid) => model.monster[mid]?.name).filter(Boolean).join(", ")}</div>}
          </button>
        ))}
        {passend.length === 0 && <p style={{ color: C.dim, fontSize: 12.5, margin: 0 }}>Nichts im Pool für diese Kombination — eigenen Text festhalten oder den Pool erweitern.</p>}
      </div>
      <div className="feld">Eigener Text
        <div style={{ display: "flex", gap: 6 }}>
          <input type="text" style={{ flex: 1 }} value={frei} onChange={(ev) => setFrei(ev.target.value)} placeholder="Eigenen Encounter beschreiben …" />
          <button className="knopf primaer" onClick={() => frei.trim() && festhalten(frei.trim())}>Festhalten</button>
        </div>
      </div>
      <button className="knopf leise" onClick={() => setWurf(null)}>Verwerfen</button>
    </div>
  );
}

function Pool({ model, upd }) {
  const [neuerDistrikt, setNeuerDistrikt] = useState("");
  const [filterTyp, setFilterTyp] = useState("alle");
  const [bearbeite, setBearbeite] = useState(null);
  const [filterStatus, setFilterStatus] = useState("alle");
  const gf = useContext(FilterCtx);
  const liste = model.encounters.filter((e) => passtFilter(gf, e, e.t) && (filterTyp === "alle" || e.typ === filterTyp) && (filterStatus === "alle" || (e.status || "Ansatz") === filterStatus));
  const akt = model.encounters.find((e) => e.id === bearbeite) || null;
  const feld = (id, k, v) => upd((m) => { const x = m.encounters.find((y) => y.id === id); if (x) x[k] = v; });
  const neu = () => {
    const id = "enc" + Date.now();
    upd((m) => m.encounters.push({ id, t: "", typ: filterTyp === "alle" ? "Kampf" : filterTyp, d: Object.keys(model.distrikte)[0], f: "keine", lvMin: 1, lvMax: 20, notiz: "", monster: [], monsterAnzahl: {}, status: "Idee", zusatz: {}, tags: [] }));
    setBearbeite(id);
  };
  const spalten = "1fr 92px 110px 110px 60px 92px";
  return (
    <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
      <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14 }}>
        <h3 className="serif" style={{ margin: "0 0 10px", fontSize: 16 }}>Typ-Gewichtung je Distrikt (für den Wurf)</h3>
        <p style={{ color: C.dim, fontSize: 12, margin: "0 0 10px" }}>Punkte anklicken (0–10) — die Wahrscheinlichkeit eines Typs ist sein Anteil an der Punktesumme des Distrikts.</p>
        <div style={{ display: "grid", gap: 12 }}>
          {Object.entries(model.distrikte).map(([d, w]) => {
            const summe = TYP_LISTE.reduce((a, t) => a + (w[t] || 0), 0) || 1;
            return (
              <div key={d}>
                <div className="serif" style={{ fontSize: 14.5, marginBottom: 4 }}>{d}</div>
                <div style={{ display: "grid", gap: 3 }}>
                  {TYP_LISTE.map((t) => (
                    <div key={t} style={{ display: "grid", gridTemplateColumns: "110px auto 52px", gap: 10, alignItems: "center", fontSize: 12.5 }}>
                      <span style={{ color: TYPEN[t] }}>{t}</span>
                      <span style={{ display: "flex", gap: 3 }}>
                        {Array.from({ length: 10 }).map((_, i) => (
                          <button key={i} onClick={() => upd((m) => { m.distrikte[d][t] = (i + 1 === (w[t] || 0)) ? i : i + 1; })}
                            aria-label={t + " " + (i + 1)}
                            style={{ width: 15, height: 15, borderRadius: "50%", border: `1.5px solid ${TYPEN[t]}`, background: i < (w[t] || 0) ? TYPEN[t] : "transparent", cursor: "pointer", padding: 0 }} />
                        ))}
                      </span>
                      <span style={{ color: C.dim }}>{Math.round(((w[t] || 0) / summe) * 100)} %</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input type="text" placeholder="Neuer Distrikt" value={neuerDistrikt} onChange={(ev) => setNeuerDistrikt(ev.target.value)} style={{ width: 220 }} />
          <button className="knopf" onClick={() => { const d = neuerDistrikt.trim(); if (!d) return; upd((m) => { if (!m.distrikte[d]) m.distrikte[d] = { Kampf: 25, Hindernis: 25, Begegnung: 20, Ressource: 15, Geschichte: 15 }; }); setNeuerDistrikt(""); }}>Distrikt anlegen</button>
        </div>
      </div>

      <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <h3 className="serif" style={{ margin: 0, fontSize: 16, flex: 1 }}>Encounter-Pool ({model.encounters.length})</h3>
          <select value={filterTyp} onChange={(ev) => setFilterTyp(ev.target.value)}>
            <option value="alle">alle Typen</option>
            {TYP_LISTE.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={(ev) => setFilterStatus(ev.target.value)}><option value="alle">alle Status</option>{STATUS_LISTE.map((st) => <option key={st}>{st}</option>)}</select>
          <button className="knopf primaer" onClick={neu}>+ Neuer Encounter</button>
        </div>

        {akt && (
          <div style={{ background: C.wand2, border: `1px solid ${C.amber}`, borderRadius: 4, padding: 12, marginBottom: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <StatusWahl obj={akt} setzen={(v) => feld(akt.id, "status", v)} />
              <span style={{ fontSize: 11.5, color: C.dim }}>Abgeschlossen = bereit zum Spielen</span>
            </div>
            <div className="feld">Encounter — Kurzzeile (erscheint in Vorschlägen & Log)
              <textarea rows={2} value={akt.t} onChange={(ev) => feld(akt.id, "t", ev.target.value)} autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              <div className="feld">Typ
                <select value={akt.typ} onChange={(ev) => feld(akt.id, "typ", ev.target.value)}>
                  {TYP_LISTE.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="feld">Distrikt
                <select value={akt.d} onChange={(ev) => feld(akt.id, "d", ev.target.value)}>
                  {Object.keys(model.distrikte).map((d) => <option key={d}>{d}</option>)}
                  <option value="alle">alle Distrikte</option>
                </select>
              </div>
              <div className="feld">Fraktion
                <select value={akt.f} onChange={(ev) => feld(akt.id, "f", ev.target.value)}>
                  {frakNamen(model).map((f) => <option key={f}>{f}</option>)}
                  <option value="alle">alle Fraktionen</option>
                </select>
              </div>
              <div className="feld">Stufe (von – bis)
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="number" min="1" max="20" value={akt.lvMin ?? 1} style={{ width: 58 }}
                    onChange={(ev) => feld(akt.id, "lvMin", Math.max(1, Math.min(20, +ev.target.value || 1)))} />
                  <input type="number" min="1" max="20" value={akt.lvMax ?? 20} style={{ width: 58 }}
                    onChange={(ev) => feld(akt.id, "lvMax", Math.max(1, Math.min(20, +ev.target.value || 20)))} />
                </div>
              </div>
            </div>
            <div className="feld">Details (SL — DCs, Taktik, Loot)
              <textarea rows={4} value={akt.notiz || ""} onChange={(ev) => feld(akt.id, "notiz", ev.target.value)} />
            </div>
            <LootBox model={model} upd={upd} obj={akt} setzen={(k, v) => feld(akt.id, k, v)} />
            <div className="feld">Verknüpfte Statblocks (→ Tab «Statblocks»)
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {(akt.monster || []).map((mid) => model.monster[mid] && (
                  <span key={mid} style={{ background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, padding: "2px 8px", fontSize: 12, display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input type="number" min="1" value={(akt.monsterAnzahl || {})[mid] || 1} title="Anzahl" style={{ width: 44, padding: "0 4px" }} onChange={(ev) => feld(akt.id, "monsterAnzahl", { ...(akt.monsterAnzahl || {}), [mid]: Math.max(1, +ev.target.value || 1) })} />×
                    {model.monster[mid].name}
                    <button className="knopf leise" style={{ padding: "0 4px", fontSize: 11 }} onClick={() => feld(akt.id, "monster", akt.monster.filter((x) => x !== mid))}>✕</button>
                  </span>
                ))}
                <select value="" onChange={(ev) => { const v = ev.target.value; if (v && !(akt.monster || []).includes(v)) feld(akt.id, "monster", [...(akt.monster || []), v]); }}>
                  <option value="">+ Statblock …</option>
                  {Object.values(model.monster).sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.id} value={m.id}>{m.name} (CR {m.cr})</option>)}
                </select>
              </div>
            </div>
            {(akt.monster || []).length > 0 && (
              <div style={{ display: "grid", gap: 6 }}>
                <div><button className="knopf primaer" style={{ fontSize: 12 }} onClick={() => { upd((m) => { (akt.monster || []).forEach((mid) => monsterInKampf(m, mid, (akt.monsterAnzahl || {})[mid] || 1)); }); hinweis("In die Initiative übernommen."); }}>⚔ In Initiative übernehmen</button></div>
                {(akt.monster || []).map((mid) => model.monster[mid] && (
                  <details key={mid}>
                    <summary style={{ cursor: "pointer", fontSize: 12.5, color: C.amber }}>{model.monster[mid].name} — Statblock</summary>
                    <div style={{ marginTop: 6 }}><Statblock m={model.monster[mid]} model={model} /></div>
                  </details>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="knopf primaer" onClick={() => setBearbeite(null)}>Schliessen</button>
              <button className="knopf gefahr" onClick={() => { if (!bestaetigen("Encounter löschen?")) return; upd((m) => { m.encounters = m.encounters.filter((x) => x.id !== akt.id); }); setBearbeite(null); }}>Löschen</button>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: spalten, gap: 6, fontSize: 10.5, color: C.dim, marginBottom: 4, padding: "0 8px" }}>
          <span>Encounter</span><span>Typ</span><span>Distrikt</span><span>Fraktion</span><span>Stufe</span><span>Status</span>
        </div>
        <div style={{ display: "grid", gap: 4, maxHeight: 340, overflowY: "auto" }}>
          {liste.map((e) => (
            <div key={e.id} onClick={() => setBearbeite(e.id)}
              style={{ display: "grid", gridTemplateColumns: spalten, gap: 6, alignItems: "center", padding: "5px 8px", borderRadius: 3, cursor: "pointer", fontSize: 12.5, background: bearbeite === e.id ? C.wand2 : "transparent", border: `1px solid ${bearbeite === e.id ? C.amber : "transparent"}` }}>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={e.notiz || e.t}>{e.t || <em style={{ color: C.dim }}>ohne Text</em>}{e.notiz && <span style={{ color: C.dim }}> ✎</span>}</span>
              <span style={{ color: TYPEN[e.typ] }}>{e.typ}</span>
              <span style={{ color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.d}</span>
              <span style={{ color: e.f === "keine" ? C.dim : C.kreide, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.f === "keine" ? "—" : e.f}</span>
              <span style={{ color: C.dim }}>{e.lvMin ?? 1}–{e.lvMax ?? 20}</span>
              <span style={{ color: STATUS_FARBE[e.status || "Ansatz"] }}>{e.status || "Ansatz"}</span>
            </div>
          ))}
          {liste.length === 0 && <p style={{ color: C.dim, fontSize: 12.5, margin: 0 }}>Keine Encounter für diesen Filter.</p>}
        </div>
      </div>
    </div>
  );
}


/* ── Monster: Markdown-Parser & -Export (Basils Statblock-Format) ── */
const SEKTIONEN = [["traits", "Traits"], ["aktionen", "Actions"], ["bonus", "Bonus Actions"], ["reaktionen", "Reactions"], ["villain", "Villain Actions"], ["legendaer", "Legendary Actions"]];
const ATTRS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

function parseStatbloecke(text) {
  const fmRe = /^---[^\S\n]*\n([\s\S]*?)\n---[^\S\n]*\n?/gm;
  const bloecke = []; let m, prev = null;
  while ((m = fmRe.exec(text))) {
    if (prev) { prev.body = text.slice(prev.ende, m.index); bloecke.push(prev); }
    prev = { fm: m[1], ende: fmRe.lastIndex };
  }
  if (prev) { prev.body = text.slice(prev.ende); bloecke.push(prev); }
  return bloecke.map(parseEinen).filter(Boolean);
}
function parseEinen({ fm, body }) {
  const meta = {};
  const geschw = [];
  let listenKey = null;
  fm.split(/\n/).forEach((z) => {
    const li = z.match(/^\s+-\s+(.*)$/);
    if (li) { if (listenKey === "geschwindigkeit" || listenKey === "speed") geschw.push(li[1].trim()); return; }
    const kv = z.match(/^([\wäöüÄÖÜ]+):\s*(.*)$/);
    if (kv) {
      const key = kv[1].toLowerCase();
      meta[key] = kv[2].replace(/^"|"$/g, "").trim();
      listenKey = kv[2].trim() === "" ? key : null;
    }
  });
  if ((meta.typ || "").toLowerCase() !== "statblock" && !meta.name) return null;
  const zeilen = body.split(/\n/).map((z) => z.replace(/^>\s?/, ""));
  const mon = {
    id: "m" + Date.now().toString(36) + Math.floor(Math.random() * 999),
    name: meta.name || "Unbenannt", kreatur: (meta.kreatur || "").replace(/\[\[|\]\]/g, ""),
    cr: meta.cr || "", rolle: meta.rolle || "", groesse: meta["grösse"] || meta.groesse || "",
    ac: meta.ac || "", tp: meta.leben || "", tpFormel: meta["lebenswürfel"] || meta.lebenswuerfel || "",
    speed: geschw.join(", "), subtitel: "", acText: "", speedText: "",
    attr: { STR: "10 (+0)", DEX: "10 (+0)", CON: "10 (+0)", INT: "10 (+0)", WIS: "10 (+0)", CHA: "10 (+0)" },
    saves: "—", skills: "—", resist: "—", immun: "—", condImmun: "—", verwund: "—", sinne: "—", passive: "", sprachen: "—", prof: "+2",
    traits: [], aktionen: [], bonus: [], reaktionen: [], villain: [], legendaer: [], vars: {},
    schwaechen: "—", typen: (meta.typen || meta.types || "").split(/,\s*/).filter(Boolean),
  };
  const grab = (label) => {
    const re = new RegExp("\\*\\*" + label + "\\*\\*:?\\s*(.*)");
    for (const z of zeilen) { const g = z.match(re); if (g) return g[1].trim(); }
    return "";
  };
  mon.acText = grab("Rüstungsklasse") || grab("Armor Class") || grab("AC") || mon.ac;
  const tpZ = grab("Trefferpunkte") || grab("Hit Points") || grab("HP"); if (tpZ) { const t = tpZ.match(/^(\d+)\s*\(([^)]*)\)/); if (t) { mon.tp = t[1]; mon.tpFormel = t[2]; } else mon.tp = tpZ; }
  mon.speedText = grab("Geschwindigkeit") || grab("Speed") || mon.speed;
  for (const z of zeilen) { const sub = z.match(/^\*([^*].*?)\*$/); if (sub) { mon.subtitel = sub[1]; break; } }
  for (let i = 0; i < zeilen.length; i++) {
    if (/\|\s*STR\s*\|/.test(zeilen[i])) {
      for (let j = i + 1; j < Math.min(i + 4, zeilen.length); j++) {
        if (/\(/.test(zeilen[j]) && zeilen[j].includes("|")) {
          const zellen = zeilen[j].split("|").map((c) => c.trim()).filter(Boolean);
          ATTRS.forEach((a, k) => { if (zellen[k]) mon.attr[a] = zellen[k]; });
          break;
        }
      }
      break;
    }
  }
  mon.saves = grab("Saving Throws") || "—"; mon.skills = grab("Skills") || "—";
  mon.resist = grab("Damage Resistances") || "—"; mon.immun = grab("Damage Immunities") || grab("Immunities") || "—";
  mon.condImmun = grab("Condition Immunities") || "—";
  mon.schwaechen = grab("Weaknesses") || grab("Schwächen") || "—";
  mon.verwund = grab("Vulnerabilities") || "—";
  const sz = grab("Senses") || "—"; const pp = sz.match(/passive (?:Perception|Wahrnehmung)\s*(\d+)/i);
  mon.passive = pp ? pp[1] : ""; mon.sinne = sz.replace(/,?\s*passive (?:Perception|Wahrnehmung)\s*\d+/i, "").trim() || "—";
  mon.sprachen = grab("Languages") || "—"; mon.prof = grab("Proficiency Bonus") || "+2";
  let sektion = null, eintrag = null;
  const abschluss = () => { if (eintrag && sektion) { eintrag.t = eintrag.t.join("\n").replace(/\n+$/, "").trim(); mon[sektion].push(eintrag); } eintrag = null; };
  for (const z of zeilen) {
    const kopf = z.match(/^#+\s*(.+)$/);
    if (kopf) {
      abschluss();
      const nk = kopf[1].toLowerCase();
      const gefunden = [...SEKTIONEN].sort((a, b) => b[1].length - a[1].length).find(([, label]) => nk.includes(label.toLowerCase()));
      sektion = gefunden ? gefunden[0] : null; continue;
    }
    if (!sektion) continue;
    const start = z.match(/^\*\*(.+?[.!?]?)\*\*\s*(.*)$/);
    if (start) { abschluss(); eintrag = { n: start[1].replace(/\.$/, ""), t: [start[2]], vars: {} }; continue; }
    if (eintrag) { if (z.trim() === "" || z.trim() === "---") { eintrag.t.push(""); } else eintrag.t.push(z); }
  }
  abschluss();
  return mon;
}
const fill = (t, vars) => String(t || "").replace(/\{([A-ZÄÖÜ0-9_]+)\}/g, (g, k) => (vars && vars[k] ? vars[k] : g));
const effektiveVars = (e, mon, model) => {
  const out = {};
  varsVon(e?.t).forEach((k) => {
    const reg = (model?.variablen || []).find((v) => v.key === k);
    out[k] = (e?.vars && e.vars[k]) || (mon?.vars && mon.vars[k]) || (reg && reg.standard) || "";
  });
  return out;
};
const varsVon = (t) => [...new Set([...String(t || "").matchAll(/\{([A-ZÄÖÜ0-9_]+)\}/g)].map((x) => x[1]))];
function monsterZuMd(m, model) {
  const z = [];
  z.push("---", "typ: Statblock", `kreatur: ${m.kreatur ? '"[[' + m.kreatur + ']]"' : ""}`, `name: ${m.name}`, `cr: ${m.cr}`, `rolle: ${m.rolle}`, `grösse: ${m.groesse}`, `ac: ${m.ac || m.acText}`, `leben: ${m.tp}`, `lebenswürfel: ${m.tpFormel}`, "geschwindigkeit:");
  (m.speed || m.speedText || "").split(/,\s*/).filter(Boolean).forEach((g) => z.push("  - " + g));
  if ((m.typen || []).length) z.push("typen: " + m.typen.join(", "));
  z.push("cssclasses:", "  - statblock", "---", "", "");
  const b = [];
  b.push(`[!statblock] ${m.name}`, `*${m.subtitel}*`, "", "---",
    `**Armor Class** ${m.acText || m.ac}`, `**Hit Points** ${m.tp} (${m.tpFormel})`, `**Speed** ${m.speedText || m.speed}`, "", "---", "",
    "| STR | DEX | CON | INT | WIS | CHA |", "| --- | --- | --- | --- | --- | --- |",
    "| " + ATTRS.map((a) => m.attr[a]).join(" | ") + " |", "", "---", "",
    `**Saving Throws** ${m.saves}`, `**Skills** ${m.skills}`, `**Damage Resistances** ${m.resist}`, `**Immunities** ${m.immun}`, `**Condition Immunities** ${m.condImmun || "—"}`, `**Vulnerabilities** ${m.verwund}`, `**Weaknesses** ${m.schwaechen || "—"}`,
    `**Senses** ${[m.sinne !== "—" ? m.sinne : "", m.passive ? "passive Perception " + m.passive : ""].filter(Boolean).join(", ") || "—"}`, `**Languages** ${m.sprachen}`, `**Proficiency Bonus** ${m.prof}`, "", "---");
  SEKTIONEN.forEach(([schluessel, label]) => {
    const liste = m[schluessel] || [];
    if (!liste.length) return;
    b.push(`# ${label}`, "");
    liste.forEach((e) => { const txt = fill(e.t, effektiveVars(e, m, model)); b.push(`**${e.n}.** ${txt.split("\n")[0]}`); txt.split("\n").slice(1).forEach((r) => b.push(r)); b.push(""); });
  });
  return z.join("\n") + b.map((x) => (">" + (x ? " " + x : "")).replace(/^>\s\[!/, ">[!")).join("\n").replace(/^/, "") ;
}

function md(text) {
  return String(text || "").split("**").map((teil, i) => (i % 2 ? <strong key={i}>{teil}</strong> : teil));
}

const regelnIn = (text, model) => (model?.regeln || []).filter((r) => r.name && new RegExp("(^|[^\\wäöü])" + r.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^\\wäöü]|$)", "i").test(text || ""));
function Statblock({ m, model }) {
  const zeile = (l, w) => (w && w !== "—") ? <div><strong>{l}</strong> {w}</div> : null;
  const gesamt = [m.condImmun, m.schwaechen, ...SEKTIONEN.flatMap(([k]) => (m[k] || []).map((e) => e.n + " " + fill(e.t, effektiveVars(e, m, model))))].join(" ");
  const regeln = regelnIn(gesamt, model);
  const senses = [m.sinne !== "—" ? m.sinne : "", m.passive ? "passive Perception " + m.passive : ""].filter(Boolean).join(", ");
  return (
    <div style={{ background: "#151d18", border: `1px solid ${C.linie}`, borderLeft: `3px solid ${C.amber}`, borderRadius: 4, padding: "10px 12px", fontSize: 12.5, display: "grid", gap: 6 }}>
      <div>
        <div className="serif" style={{ fontSize: 16, fontWeight: 700 }}>{m.name} {m.cr !== "" && <span style={{ color: C.dim, fontSize: 12 }}>· CR {m.cr}{m.rolle ? " · " + m.rolle : ""}</span>}</div>
        {m.subtitel && <div style={{ fontStyle: "italic", color: C.dim }}>{m.subtitel}</div>}
        {(m.typen || []).length > 0 && <div style={{ color: C.amber, fontSize: 11.5 }}>{m.typen.join(" · ")}</div>}
      </div>
      <div style={{ borderTop: `1px solid ${C.linie}`, paddingTop: 6 }}>
        <strong>AC</strong> {m.acText || m.ac} · <strong>HP</strong> {m.tp}{m.tpFormel ? ` (${m.tpFormel})` : ""} · <strong>Speed</strong> {m.speedText || m.speed}
      </div>
      <table style={{ borderCollapse: "collapse", textAlign: "center", fontSize: 12 }}>
        <thead><tr>{ATTRS.map((a) => <th key={a} style={{ padding: "1px 7px", color: C.dim }}>{a}</th>)}</tr></thead>
        <tbody><tr>{ATTRS.map((a) => <td key={a} style={{ padding: "1px 7px" }}>{m.attr[a]}</td>)}</tr></tbody>
      </table>
      <div style={{ borderTop: `1px solid ${C.linie}`, paddingTop: 6, display: "grid", gap: 2 }}>
        {zeile("Saving Throws", m.saves)}{zeile("Skills", m.skills)}{zeile("Damage Resistances", m.resist)}{zeile("Damage Immunities", m.immun)}{zeile("Condition Immunities", m.condImmun)}{zeile("Vulnerabilities", m.verwund)}{zeile("Weaknesses", m.schwaechen)}{zeile("Senses", senses)}{zeile("Languages", m.sprachen)}{zeile("Proficiency Bonus", m.prof)}
      </div>
      {SEKTIONEN.map(([schluessel, label]) => {
        const liste = m[schluessel] || [];
        if (!liste.length) return null;
        return (
          <div key={schluessel} style={{ borderTop: `1px solid ${C.linie}`, paddingTop: 6 }}>
            <div className="serif" style={{ fontWeight: 700, marginBottom: 3 }}>{label}</div>
            <div style={{ display: "grid", gap: 5 }}>
              {liste.map((e, i) => <div key={i} style={{ whiteSpace: "pre-wrap" }}><strong>{e.n}.</strong> {md(fill(e.t, effektiveVars(e, m, model)))}</div>)}
            </div>
          </div>
        );
      })}
      {regeln.length > 0 && (
        <details style={{ borderTop: `1px solid ${C.linie}`, paddingTop: 6 }}>
          <summary style={{ cursor: "pointer", color: C.amber, fontSize: 12 }}>Regeln im Statblock: {regeln.map((r) => r.name).join(", ")}</summary>
          <div style={{ display: "grid", gap: 4, marginTop: 4, color: C.dim }}>{regeln.map((r) => <div key={r.id}><strong style={{ color: C.kreide }}>{r.name}.</strong> {r.text}</div>)}</div>
        </details>
      )}
    </div>
  );
}

const STATBLOCK_TYPEN = ["Trait", "Action", "Bonus Action", "Reaction", "Villain Action", "Legendary Action"];
const bausteineVon = (m) => (m.regeln || []).filter((r) => STATBLOCK_TYPEN.includes(r.art));
const STATUS_LISTE = ["Idee", "Ansatz", "Abgeschlossen"];
const STATUS_FARBE = { Idee: "#9aa89f", Ansatz: "#e0a83f", Abgeschlossen: "#45c4ae" };
const norm = (t) => String(t || "").toLowerCase().replace(/[^\wäöüß ]+/g, " ").replace(/\s+/g, " ").trim();
const woerter = (t) => new Set(norm(t).split(" ").filter((w) => w.length > 2));
const aehnlichkeit = (a, b) => { const A = woerter(a), B = woerter(b); if (!A.size || !B.size) return 0; let g = 0; A.forEach((w) => { if (B.has(w)) g++; }); return (2 * g) / (A.size + B.size); };
let KAT_LABEL = { resist: "Damage Resistance", immun: "Damage Immunity", condImmun: "Condition Immunity", verwund: "Vulnerability", schwaeche: "Weakness", spezial: "Spezialregel", verhalten: "Verhalten" };
const katLabelAus = (m) => { const o = {}; (m.abwehrKategorien || []).forEach((k) => { o[k.key] = k.label; }); KAT_LABEL = { ...KAT_LABEL, ...o }; return KAT_LABEL; };
/* Wissen-Ableitung: was kennt die Gruppe / ein Charakter */
const infoBekannt = (m, info, charId) => info.gruppe || (charId ? (info.charaktere || []).includes(charId) || (info.wissenId && (m.charaktere.find((c) => c.id === charId)?.wissen || []).includes(info.wissenId)) : (info.charaktere || []).length > 0 || (info.wissenId && m.charaktere.some((c) => (c.wissen || []).includes(info.wissenId))));
const sichtStatus = (m, art, id, charId) => {
  const infos = (m.informationen || []).filter((x) => x.art === "artikel" && x.artikelArt === art && x.artikelId === id && infoBekannt(m, x, charId));
  if (!infos.length) return "unbekannt";
  const spieler = ((m.ansichten[art] || {}).Spieler) || [];
  const nameKeys = ["name", "titel"];
  return infos.some((x) => (x.felder || []).length ? x.felder.some((k) => nameKeys.includes(k)) : spieler.some((k) => nameKeys.includes(k))) ? "aufgedeckt" : "verdeckt";
};
const SICHT_FARBE = { unbekannt: "#9aa89f", verdeckt: "#e0a83f", aufgedeckt: "#45c4ae" };
const abwehrBekannt = (m, typId, i, charId) => (m.informationen || []).some((x) => x.art === "abwehr" && x.typId === typId && x.abwehrIdx === i && infoBekannt(m, x, charId));
/* Kandidaten für einen Eintrag: gleichnamige/ähnliche Bausteine und Einträge anderer Monster */
function kandidaten(model, eintrag, eigeneId) {
  const nn = norm(eintrag.n);
  const bs = bausteineVon(model).filter((b) => norm(b.name) === nn || aehnlichkeit(b.text, eintrag.t) >= 0.6).map((b) => ({ art: "baustein", id: b.id, name: b.name, text: b.text, vars: b.vars }));
  const mons = [];
  Object.values(model.monster).forEach((mon) => { if (mon.id === eigeneId) return; SEKTIONEN.forEach(([k]) => (mon[k] || []).forEach((e) => { if (nn && (norm(e.n) === nn || aehnlichkeit(e.t, eintrag.t) >= 0.7)) mons.push({ art: "monster", id: mon.id, name: e.n, text: e.t, vars: e.vars, monster: mon.name }); })); });
  return { bs, mons };
}

/* ── Monster-Tab ── */
function MonsterTab({ model, upd, sprung }) {
  const [aktId, setAktId] = useState(null);
  const gfilterSb = useContext(FilterCtx);
  useEffect(() => { if (sprung?.tab === "monster" && sprung.id) setAktId(sprung.id); }, [sprung]);
  const [io, setIo] = useState("");
  const [bearbBaustein, setBearbBaustein] = useState(null);
  const [einfTag, setEinfTag] = useState("");
  const [bsGruppieren, setBsGruppieren] = useState(false);
  const [bsVar, setBsVar] = useState("");
  const [bsTag, setBsTag] = useState("");
  const [dupl, setDupl] = useState(null);
  const alleTags = [...new Set(bausteineVon(model).flatMap((b) => b.tags || []))].sort();
  const bsListe = bausteineVon(model)
    .filter((b) => !bsVar || varsVon(b.text).includes(bsVar))
    .filter((b) => !bsTag || (b.tags || []).includes(bsTag))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const bsGruppen = bsGruppieren ? SEKTIONEN.map(([, l]) => [l, bsListe.filter((b) => b.art === l.replace(/s$/, ""))]).filter(([, l]) => l.length) : [["", bsListe]];
  const duplikatePruefen = () => {
    const gruppen = {};
    bausteineVon(model).forEach((b) => { const k = norm(b.name); (gruppen[k] = gruppen[k] || { name: b.name, bausteine: [], monster: [] }).bausteine.push(b); });
    Object.values(model.monster).forEach((mon) => SEKTIONEN.forEach(([sk]) => (mon[sk] || []).forEach((e) => { const k = norm(e.n); if (!k) return; (gruppen[k] = gruppen[k] || { name: e.n, bausteine: [], monster: [] }).monster.push(mon.name); })));
    const treffer = Object.values(gruppen).filter((g) => g.bausteine.length > 1 || (g.bausteine.length === 0 && new Set(g.monster).size > 1));
    setDupl(treffer);
  };
  const bausteinAkt = bausteineVon(model).find((x) => x.id === bearbBaustein) || null;
  const bausteinFeld = (k, v) => upd((m) => { const bb = m.regeln.find((x) => x.id === bearbBaustein); if (bb) bb[k] = v; });
  const akt = aktId ? model.monster[aktId] : null;
  const feld = (k, v) => upd((m) => { m.monster[aktId][k] = v; });
  const neu = () => {
    const mon = parseStatbloecke("---\ntyp: Statblock\nname: New Monster\ncr: 1\nrolle: Soldier\n---\n")[0];
    mon.subtitel = "Medium humanoid, neutral";
    upd((m) => { m.monster[mon.id] = mon; }); setAktId(mon.id);
  };
  const importieren = () => {
    const liste = parseStatbloecke(io);
    if (!liste.length) { hinweis("Kein Statblock erkannt — Markdown inkl. Frontmatter (--- typ: Statblock …) einfügen."); return; }
    upd((m) => { liste.forEach((mon) => { const alt = Object.values(m.monster).find((x) => x.name === mon.name); if (alt) mon.id = alt.id; m.monster[mon.id] = mon; }); });
    setIo(""); hinweis(liste.length + " Monster importiert (gleichnamige ersetzt).");
  };
  const eintragFeld = (sk, i, k, v) => upd((m) => { m.monster[aktId][sk][i][k] = v; });
  const F = (l, k, mehrzeilig) => (
    <div key={k} className="feld">{l}{mehrzeilig
      ? <textarea rows={2} value={akt[k] ?? ""} onChange={(ev) => feld(k, ev.target.value)} />
      : <input type="text" value={akt[k] ?? ""} onChange={(ev) => feld(k, ev.target.value)} />}</div>
  );
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <h3 className="serif" style={{ margin: 0, fontSize: 16, flex: 1 }}>Statblocks ({Object.keys(model.monster).length})</h3>
          <button className="knopf primaer" onClick={neu}>+ New Statblock</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.values(model.monster).filter((m) => passtFilter(gfilterSb, m)).sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
            <button key={m.id} className={"knopf " + (aktId === m.id ? "primaer" : "")} onClick={() => setAktId(aktId === m.id ? null : m.id)}>
              {m.name} <span style={{ color: aktId === m.id ? "#241a08" : C.dim }}>CR {m.cr}</span>
            </button>
          ))}
          {Object.keys(model.monster).length === 0 && <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Noch keine Statblocks — unten Markdown importieren oder «+ New Statblock».</p>}
        </div>
      </div>

      {akt && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.2fr) minmax(300px, 1fr)", gap: 14, alignItems: "start" }}>
          <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14, display: "grid", gap: 10 }}>
            <StatusWahl obj={akt} setzen={(v) => feld("status", v)} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px", gap: 8 }}>
              {F("Name", "name")}{F("CR", "cr")}{F("Role (MCDM)", "rolle")}
            </div>
            {F("Size, type, alignment", "subtitel")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 130px", gap: 8 }}>
              {F("Armor Class", "acText")}{F("Hit Points", "tp")}{F("Hit Dice", "tpFormel")}
            </div>
            <div className="feld">Speed<input type="text" value={akt.speedText || akt.speed} onChange={(ev) => { feld("speedText", ev.target.value); feld("speed", ev.target.value); }} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
              {ATTRS.map((a) => <div key={a} className="feld">{a}<input type="text" value={akt.attr[a]} onChange={(ev) => upd((m) => { m.monster[aktId].attr[a] = ev.target.value; })} /></div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
              {F("Saving Throws", "saves")}{F("Skills", "skills", true)}
              {F("Damage Resistances", "resist", true)}{F("Damage Immunities", "immun", true)}
              {F("Condition Immunities", "condImmun", true)}{F("Vulnerabilities", "verwund", true)}
              {F("Weaknesses (ausnutzbar, lernbar)", "schwaechen", true)}{F("Senses", "sinne")}
              {F("Passive Perception", "passive")}{F("Languages", "sprachen")}{F("Proficiency Bonus", "prof")}
            </div>
            <div className="feld">Types & ancestries (→ Abwehr-Katalog)
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {(akt.typen || []).map((tn) => (
                  <span key={tn} style={{ background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, padding: "2px 8px", fontSize: 12, display: "inline-flex", gap: 6, alignItems: "center" }}>
                    {tn}<button className="knopf leise" style={{ padding: "0 4px", fontSize: 11 }} onClick={() => feld("typen", akt.typen.filter((x) => x !== tn))}>✕</button>
                  </span>
                ))}
                <select value="" onChange={(ev) => { const v = ev.target.value; if (v && !(akt.typen || []).includes(v)) feld("typen", [...(akt.typen || []), v]); }}>
                  <option value="">+ Typ / Ancestry …</option>
                  {model.typen.map((t) => <option key={t.id} value={t.name}>{t.name} ({t.art})</option>)}
                </select>
                <button className="knopf" style={{ fontSize: 12 }} onClick={() => upd((m) => {
                  const mon = m.monster[aktId];
                  const ziel = { resist: "resist", immun: "immun", condImmun: "condImmun", verwund: "verwund", schwaeche: "schwaechen" };
                  m.typen.filter((t) => (mon.typen || []).includes(t.name)).forEach((t) => t.abwehr.forEach((a) => {
                    const k = ziel[a.kat]; const alt = (mon[k] && mon[k] !== "—") ? mon[k] : "";
                    if (!alt.toLowerCase().includes(a.text.toLowerCase())) mon[k] = alt ? alt + "; " + a.text : a.text;
                  }));
                })}>Abwehr aus Typen übernehmen</button>
              </div>
            </div>
            <div className="feld">Statblock variables — gelten für alle Einträge, sofern dort nicht übersteuert
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {model.variablen.map((v) => (
                  <label key={v.key} style={{ display: "flex", flexDirection: "column", fontSize: 11.5, color: C.dim }} title={v.info}>
                    <span><span style={{ color: C.amber }}>{"{" + v.key + "}"}</span> {v.label}</span>
                    <input type="text" value={(akt.vars || {})[v.key] || ""} placeholder={v.standard || "…"} style={{ width: 110 }}
                      onChange={(ev) => upd((m) => { m.monster[aktId].vars = { ...(m.monster[aktId].vars || {}), [v.key]: ev.target.value }; })} />
                  </label>
                ))}
              </div>
            </div>
            {SEKTIONEN.map(([sk, label]) => (
              <div key={sk} className="feld">{label}
                <div style={{ display: "grid", gap: 8 }}>
                  {(akt[sk] || []).map((e, i) => {
                    const vs = varsVon(e.t);
                    return (
                      <div key={i} style={{ display: "grid", gap: 4, borderLeft: `3px solid ${C.linie}`, paddingLeft: 8 }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input type="text" value={e.n} style={{ flex: 1 }} onChange={(ev) => eintragFeld(sk, i, "n", ev.target.value)} />
                          <button className="knopf leise" title="als Baustein speichern (Variablen bleiben erhalten)" onClick={() => upd((m) => { m.regeln.push({ id: "b" + Date.now(), art: label.replace(/s$/, ""), name: e.n, text: "**" + e.n + ".** " + e.t, vars: { ...(e.vars || {}) } }); })}>▣</button>
                          <button className="knopf leise" onClick={() => upd((m) => { m.monster[aktId][sk].splice(i, 1); })}>✕</button>
                        </div>
                        {(() => {
                          if (!e.n || e.n === "New") return null;
                          const { bs, mons } = kandidaten(model, e, aktId);
                          const bsAndere = bs.filter((b) => !(norm(b.text) === norm("**" + e.n + ".** " + e.t)));
                          if (!bsAndere.length && !mons.length) return null;
                          return (
                            <div style={{ fontSize: 11.5, color: C.dim, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", background: C.bg, borderRadius: 3, padding: "4px 8px" }}>
                              <span style={{ color: C.amber }}>Ähnlich vorhanden:</span>
                              {bsAndere.map((b) => (
                                <button key={b.id} className="knopf" style={{ fontSize: 11, padding: "2px 8px" }} title={b.text}
                                  onClick={() => upd((m) => { const nm = b.text.match(/^\*\*(.+?)\.?\*\*\s*([\s\S]*)$/); const en = m.monster[aktId][sk][i]; en.t = nm ? nm[2] : b.text; en.vars = { ...(b.vars || {}), ...(en.vars || {}) }; })}>
                                  Baustein «{b.name}» übernehmen
                                </button>
                              ))}
                              {mons.slice(0, 3).map((mm, j) => <span key={j} title={mm.text}>{mm.monster}: {mm.name}</span>)}
                              {!bs.length && mons.length > 0 && (
                                <button className="knopf" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => upd((m) => { m.regeln.push({ id: "b" + Date.now(), art: label.replace(/s$/, ""), name: e.n, text: "**" + e.n + ".** " + e.t, vars: { ...(e.vars || {}) }, tags: [] }); })}>
                                  → als gemeinsamen Baustein anlegen
                                </button>
                              )}
                            </div>
                          );
                        })()}
                        <textarea rows={2} value={e.t} placeholder="Text — Variablen als {AB}, {DMG}, {DC} …" onChange={(ev) => eintragFeld(sk, i, "t", ev.target.value)} />
                        {vs.length > 0 && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
                            <span style={{ color: C.dim }}>Variablen:</span>
                            {vs.map((v) => {
                              const geerbt = (akt.vars || {})[v] || (model.variablen.find((x) => x.key === v)?.standard) || "";
                              return (
                                <label key={v} style={{ display: "flex", gap: 4, alignItems: "center" }} title={geerbt ? "geerbt: " + geerbt : "keine Vorgabe"}>
                                  <span style={{ color: C.amber }}>{"{" + v + "}"}</span>
                                  <input type="text" value={(e.vars || {})[v] || ""} placeholder={geerbt || "…"} style={{ width: 90 }} onChange={(ev) => upd((m) => { const en = m.monster[aktId][sk][i]; en.vars = { ...(en.vars || {}), [v]: ev.target.value }; })} />
                                </label>
                              );
                            })}
                            <span style={{ color: C.dim, width: "100%" }}>→ {fill(e.t, effektiveVars(e, akt, model))}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="knopf" style={{ fontSize: 12 }} onClick={() => upd((m) => { m.monster[aktId][sk] = [...(m.monster[aktId][sk] || []), { n: "New", t: "", vars: {} }]; })}>+ Entry</button>
                    <select value={einfTag} style={{ fontSize: 12 }} onChange={(ev) => setEinfTag(ev.target.value)}><option value="">alle Tags</option>{alleTags.map((t) => <option key={t}>{t}</option>)}</select>
                    <select value="" style={{ fontSize: 12 }} onChange={(ev) => {
                      const b = bausteineVon(model).find((x) => x.id === ev.target.value); if (!b) return;
                      const nm = b.text.match(/^\*\*(.+?)\.?\*\*\s*([\s\S]*)$/);
                      const eintrag = nm ? { n: nm[1], t: nm[2], vars: { ...(b.vars || {}) } } : { n: b.name, t: b.text, vars: { ...(b.vars || {}) } };
                      upd((m) => { m.monster[aktId][sk] = [...(m.monster[aktId][sk] || []), eintrag]; });
                    }}>
                      <option value="">Baustein einfügen …</option>
                      {bausteineVon(model).filter((b) => (!einfTag || (b.tags || []).includes(einfTag)) && (b.art === label.replace(/s$/, "") || !STATBLOCK_TYPEN.includes(b.art))).sort((a, b) => a.name.localeCompare(b.name)).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.art}{(b.tags || []).length ? " · " + b.tags.join(",") : ""})</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="knopf" onClick={() => setIo(monsterZuMd(akt, model))}>Markdown exportieren (ins Feld unten)</button>
              <button className="knopf gefahr" onClick={() => { if (!bestaetigen(akt.name + " löschen?")) return; upd((m) => { delete m.monster[aktId]; m.encounters.forEach((e) => { e.monster = (e.monster || []).filter((x) => x !== aktId); }); }); setAktId(null); }}>Löschen</button>
            </div>
          </div>
          <div style={{ position: "sticky", top: 10 }}><Statblock m={akt} model={model} /></div>
        </div>
      )}

      <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h3 className="serif" style={{ margin: 0, fontSize: 16, flex: 1 }}>Import / Export (.md)</h3>
          <button className="knopf primaer" onClick={importieren}>Importieren</button>
          <button className="knopf" onClick={() => setIo(Object.values(model.monster).map((m) => monsterZuMd(m, model)).join("\n\n"))}>Alle exportieren</button>
          <button className="knopf leise" onClick={() => setIo("")}>Leeren</button>
        </div>
        <textarea rows={8} value={io} onChange={(ev) => setIo(ev.target.value)} placeholder="Statblock-Markdown hier einfügen (eine oder mehrere Dateien, inkl. Frontmatter) — oder Export hier herauskopieren." style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5 }} />
      </div>

      <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h3 className="serif" style={{ margin: 0, fontSize: 16, flex: 1 }}>Variablen-Register ({model.variablen.length})</h3>
          <button className="knopf" onClick={() => {
            const alle = new Set(model.variablen.map((v) => v.key));
            const fehlend = new Set();
            bausteineVon(model).forEach((bb) => varsVon(bb.text).forEach((k) => { if (!alle.has(k)) fehlend.add(k); }));
            Object.values(model.monster).forEach((mon) => SEKTIONEN.forEach(([k]) => (mon[k] || []).forEach((e) => varsVon(e.t).forEach((v) => { if (!alle.has(v)) fehlend.add(v); }))));
            if (!fehlend.size) { hinweis("Alle verwendeten Variablen sind registriert."); return; }
            upd((m) => fehlend.forEach((k) => m.variablen.push({ key: k, label: k, standard: "", info: "" })));
          }}>Fehlende aus Bausteinen & Statblocks sammeln</button>
          <button className="knopf" onClick={() => upd((m) => m.variablen.push({ key: "NEU" + (m.variablen.length + 1), label: "Neue Variable", standard: "", info: "" }))}>+ Variable</button>
        </div>
        <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>Eine Variable ist überall dieselbe: {"{AB}"} in jedem Baustein und Eintrag meint denselben Angriffsbonus. Auflösung: Eintrag → Monster → Standard hier.</p>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 120px 1fr 30px", gap: 6, fontSize: 10.5, color: C.dim }}><span>Schlüssel</span><span>Bezeichnung</span><span>Standard</span><span>Hinweis</span><span /></div>
        {model.variablen.map((v, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 1fr 120px 1fr 30px", gap: 6, alignItems: "center" }}>
            <input type="text" value={v.key} onChange={(ev) => upd((m) => { m.variablen[i].key = ev.target.value.toUpperCase().replace(/[^A-ZÄÖÜ0-9_]/g, ""); })} />
            <input type="text" value={v.label} onChange={(ev) => upd((m) => { m.variablen[i].label = ev.target.value; })} />
            <input type="text" value={v.standard} onChange={(ev) => upd((m) => { m.variablen[i].standard = ev.target.value; })} />
            <input type="text" value={v.info} onChange={(ev) => upd((m) => { m.variablen[i].info = ev.target.value; })} />
            <button className="knopf leise" onClick={() => upd((m) => { m.variablen.splice(i, 1); })}>✕</button>
          </div>
        ))}
      </div>

      <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h3 className="serif" style={{ margin: 0, fontSize: 16, flex: 1 }}>Bausteine ({bausteineVon(model).length}) — wiederverwendbare Traits/Actions</h3>
          <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={bsGruppieren} onChange={(ev) => setBsGruppieren(ev.target.checked)} />nach Typ gruppieren</label>
          <select value={bsVar} onChange={(ev) => setBsVar(ev.target.value)}><option value="">alle Variablen</option>{model.variablen.map((v) => <option key={v.key} value={v.key}>{"{" + v.key + "}"}</option>)}</select>
          <select value={bsTag} onChange={(ev) => setBsTag(ev.target.value)}><option value="">alle Tags</option>{alleTags.map((t) => <option key={t}>{t}</option>)}</select>
          <button className="knopf" onClick={duplikatePruefen}>Duplikate prüfen</button>
          <button className="knopf primaer" onClick={() => { const id = "b" + Date.now(); upd((m) => m.regeln.push({ id, art: "Trait", name: "Neuer Baustein", text: "**{NAME}.** ", vars: {}, tags: [] })); setBearbBaustein(id); }}>+ Baustein</button>
        </div>
        {dupl && (
          <div style={{ background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, padding: 10, display: "grid", gap: 6, fontSize: 12.5 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}><strong>Duplikate</strong><span style={{ color: C.dim, flex: 1 }}>{dupl.length === 0 ? "keine gefunden" : dupl.length + " Gruppe(n)"}</span><button className="knopf leise" onClick={() => setDupl(null)}>ausblenden</button></div>
            {dupl.map((g, i) => (
              <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <strong>{g.name}</strong>
                {g.bausteine.length > 1 && <span style={{ color: C.amber }}>{g.bausteine.length}× als Baustein</span>}
                {g.monster.length > 0 && <span style={{ color: C.dim }}>bei: {[...new Set(g.monster)].join(", ")}</span>}
                {g.bausteine.length > 1 && <button className="knopf" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => { upd((m) => { const ids = g.bausteine.slice(1).map((b) => b.id); m.regeln = m.regeln.filter((b) => !ids.includes(b.id)); }); duplikatePruefen(); }}>zusammenführen (ersten behalten)</button>}
                {g.bausteine.length === 0 && <button className="knopf" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => { const mon = Object.values(model.monster).find((x) => x.name === g.monster[0]); let en = null, art = "Traits"; SEKTIONEN.forEach(([sk, l]) => (mon?.[sk] || []).forEach((e) => { if (!en && norm(e.n) === norm(g.name)) { en = e; art = l; } })); if (!en) return; upd((m) => m.regeln.push({ id: "b" + Date.now(), art: art.replace(/s$/, ""), name: en.n, text: "**" + en.n + ".** " + en.t, vars: { ...(en.vars || {}) }, tags: [] })); duplikatePruefen(); }}>als Baustein anlegen</button>}
              </div>
            ))}
          </div>
        )}
        {bausteinAkt && (
          <div style={{ background: C.wand2, border: `1px solid ${C.amber}`, borderRadius: 4, padding: 12, display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
              <select value={bausteinAkt.art} onChange={(ev) => bausteinFeld("art", ev.target.value)}>{STATBLOCK_TYPEN.map((l) => <option key={l}>{l}</option>)}</select>
              <input type="text" value={bausteinAkt.name} onChange={(ev) => bausteinFeld("name", ev.target.value)} placeholder="Name" />
            </div>
            <textarea rows={3} value={bausteinAkt.text} onChange={(ev) => bausteinFeld("text", ev.target.value)} placeholder="**{NAME}.** … {AB} … {DMG} …" />
            <div className="feld">Tags (z. B. class:Paladin, ancestry:Orc, fraktion:Das Auge)<TagFeld werte={bausteinAkt.tags} setzen={(v) => bausteinFeld("tags", v)} /></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
              <span style={{ color: C.dim }}>Vorbelegung der Variablen beim Einfügen (leer = Monster-/Registerwert):</span>
              {varsVon(bausteinAkt.text).map((k) => (
                <label key={k} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ color: C.amber }}>{"{" + k + "}"}</span>
                  <input type="text" value={(bausteinAkt.vars || {})[k] || ""} placeholder={model.variablen.find((v) => v.key === k)?.standard || "…"} style={{ width: 100 }}
                    onChange={(ev) => upd((m) => { const bb = m.regeln.find((x) => x.id === bausteinAkt.id); bb.vars = { ...(bb.vars || {}), [k]: ev.target.value }; })} />
                  {!model.variablen.some((v) => v.key === k) && <span style={{ color: C.rot }} title="nicht im Register">?</span>}
                </label>
              ))}
              {varsVon(bausteinAkt.text).length === 0 && <span style={{ color: C.dim }}>keine Variablen im Text</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="knopf primaer" onClick={() => setBearbBaustein(null)}>Schliessen</button>
              <button className="knopf gefahr" onClick={() => { if (!bestaetigen("Baustein löschen?")) return; upd((m) => { m.regeln = m.regeln.filter((x) => x.id !== bausteinAkt.id); }); setBearbBaustein(null); }}>Löschen</button>
            </div>
          </div>
        )}
        <div style={{ display: "grid", gap: 4 }}>
          {bsGruppen.map(([gruppe, liste]) => (
            <div key={gruppe || "alle"} style={{ display: "grid", gap: 4 }}>
              {gruppe && <div className="serif" style={{ color: C.dim, fontSize: 13, marginTop: 4 }}>{gruppe}</div>}
              {liste.map((b) => (
                <div key={b.id} onClick={() => setBearbBaustein(b.id)} style={{ display: "grid", gridTemplateColumns: bsGruppieren ? "180px 1fr" : "110px 180px 1fr", gap: 8, fontSize: 12, alignItems: "center", padding: "4px 8px", borderRadius: 3, cursor: "pointer", background: bearbBaustein === b.id ? C.wand2 : "transparent", border: `1px solid ${bearbBaustein === b.id ? C.amber : "transparent"}` }}>
                  {!bsGruppieren && <span style={{ color: C.dim }}>{b.art}</span>}
                  <strong>{b.name}</strong>
                  <span style={{ color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={b.text}>
                    {b.text} {varsVon(b.text).length > 0 && <span style={{ color: C.amber }}>[{varsVon(b.text).join(", ")}]</span>}
                    {(b.tags || []).map((t) => <span key={t} style={{ marginLeft: 6, background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, padding: "0 5px", fontSize: 10.5 }}>{t}</span>)}
                  </span>
                </div>
              ))}
            </div>
          ))}
          {bsListe.length === 0 && <span style={{ color: C.dim, fontSize: 12 }}>Keine Bausteine für diesen Filter.</span>}
        </div>
      </div>

      <AbwehrKatalog model={model} upd={upd} />
    </div>
  );
}

/* ── Abwehr-Katalog: Typen & Ancestries mit Resistenzen, Immunitäten, Verwundbarkeiten, Schwächen ── */
function AbwehrKatalog({ model, upd }) {
  const [offen, setOffen] = useState(null);
  katLabelAus(model);
  const [neuKat, setNeuKat] = useState("");
  const t = model.typen.find((x) => x.id === offen) || null;
  const tf = (k, v) => upd((m) => { const q = m.typen.find((x) => x.id === offen); if (q) q[k] = v; });
  const af = (i, k, v) => upd((m) => { const q = m.typen.find((x) => x.id === offen); if (q) q.abwehr[i][k] = v; });
  return (
    <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <h3 className="serif" style={{ margin: 0, fontSize: 16, flex: 1 }}>Abwehr-Katalog — Typen & Ancestries ({model.typen.length})</h3>
        <button className="knopf primaer" onClick={() => { const id = "t" + Date.now(); upd((m) => m.typen.push({ id, name: "Neuer Typ", art: "type", abwehr: [] })); setOffen(id); }}>+ Typ / Ancestry</button>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
        <span style={{ color: C.dim }}>Kategorien:</span>
        {model.abwehrKategorien.map((k, i) => <span key={k.key} style={{ background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, padding: "1px 6px", display: "inline-flex", gap: 4 }}><input type="text" value={k.label} style={{ width: 130, fontSize: 11, padding: "0 4px", border: "none" }} onChange={(ev) => upd((m) => { m.abwehrKategorien[i].label = ev.target.value; })} /><button className="knopf leise" style={{ padding: "0 3px", fontSize: 10 }} onClick={() => upd((m) => { m.abwehrKategorien.splice(i, 1); })}>✕</button></span>)}
        <input type="text" value={neuKat} placeholder="Neue Kategorie" style={{ width: 130 }} onChange={(ev) => setNeuKat(ev.target.value)} />
        <button className="knopf" style={{ fontSize: 11 }} onClick={() => { const l = neuKat.trim(); if (!l) return; upd((m) => m.abwehrKategorien.push({ key: l.toLowerCase().replace(/[^\wäöü]+/g, "_"), label: l })); setNeuKat(""); }}>+</button>
      </div>
      <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>Zentrale Quelle für Resistenzen, Immunitäten, Verwundbarkeiten und ausnutzbare Schwächen. Monster erben sie über ihre Typen («Abwehr aus Typen übernehmen»); die Gruppe lernt sie einzeln — «bekannt» schaltet einen Eintrag im Bestiarium der Spieler frei.</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[...model.typen].sort((a, b) => a.name.localeCompare(b.name)).map((x) => (
          <button key={x.id} className={"knopf " + (offen === x.id ? "primaer" : "")} onClick={() => setOffen(offen === x.id ? null : x.id)}>
            {x.name} <span style={{ color: offen === x.id ? "#241a08" : C.dim }}>{x.art} · {x.abwehr.filter((a, i) => abwehrBekannt(model, x.id, i)).length}/{x.abwehr.length} bekannt</span>
          </button>
        ))}
      </div>
      {t && (
        <div style={{ background: C.wand2, border: `1px solid ${C.amber}`, borderRadius: 4, padding: 12, display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 8 }}>
            <div className="feld">Name<input type="text" value={t.name} onChange={(ev) => tf("name", ev.target.value)} /></div>
            <div className="feld">Art<select value={t.art} onChange={(ev) => tf("art", ev.target.value)}><option value="type">Type (Ooze, Undead …)</option><option value="ancestry">Ancestry (Orc, Drow …)</option></select></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 150px 70px 30px", gap: 6, fontSize: 10.5, color: C.dim }}><span>Kategorie</span><span>Text</span><span>Wie lernbar (Check/DC)</span><span>Wissen</span><span /></div>
          {t.abwehr.map((a, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 1fr 150px 70px 30px", gap: 6, alignItems: "start" }}>
              <select value={a.kat} onChange={(ev) => af(i, "kat", ev.target.value)}>{model.abwehrKategorien.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
              <textarea rows={1} value={a.text} onChange={(ev) => af(i, "text", ev.target.value)} />
              <input type="text" value={a.lernen || ""} placeholder="Nature DC 12" onChange={(ev) => af(i, "lernen", ev.target.value)} />
              <button className={"knopf " + (abwehrBekannt(model, t.id, i) ? "an" : "leise")} style={{ fontSize: 11 }} title="Bekanntheit läuft über Informationen (Tab Wissen)" onClick={() => { if (abwehrBekannt(model, t.id, i)) return; upd((m) => m.informationen.push({ id: "in" + Date.now(), titel: `${t.name}: ${a.text}`, art: "abwehr", typId: t.id, abwehrIdx: i, text: "", wissenId: null, gruppe: true, charaktere: [], sitzungId: m.aktuelleSitzungId || null, ts: new Date().toISOString().slice(0, 10), status: "Abgeschlossen" })); }}>{abwehrBekannt(model, t.id, i) ? "bekannt" : "→ Info"}</button>
              <button className="knopf leise" onClick={() => upd((m) => { m.typen.find((x) => x.id === offen).abwehr.splice(i, 1); })}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <button className="knopf" onClick={() => upd((m) => m.typen.find((x) => x.id === offen).abwehr.push({ kat: "schwaeche", text: "", bekannt: false, lernen: "" }))}>+ Eintrag</button>
            <button className="knopf leise" onClick={() => setOffen(null)}>Schliessen</button>
            <button className="knopf gefahr" onClick={() => { if (!bestaetigen(t.name + " löschen?")) return; upd((m) => { m.typen = m.typen.filter((x) => x.id !== offen); Object.values(m.monster).forEach((mon) => { mon.typen = (mon.typen || []).filter((n) => n !== t.name); }); }); setOffen(null); }}>Löschen</button>
          </div>
          <div style={{ fontSize: 12, color: C.dim }}>Statblocks mit diesem Typ: {Object.values(model.monster).filter((mon) => (mon.typen || []).includes(t.name)).map((mon) => mon.name).join(", ") || "—"}</div>
        </div>
      )}
    </div>
  );
}

/* ── Daten-Tab (Export/Import des ganzen Stands) ── */
function DatenTab({ model, setModel }) {
  const [io, setIo] = useState("");
  const [meldung, setMeldung] = useState("");
  const upd = (fn) => setModel((m) => { const n = structuredClone(m); fn(n); return n; });
  const labels = { karte: "Karte", geschichte: "Geschichte", quests: "Quests", npcs: "NPCs", orte: "Orte", encounter: "Encounter", monster: "Statblocks", gegenstaende: "Gegenstände", regeln: "Regeln", zonen: "Fraktionen & Geschöpfe", gruppe: "Gruppe", initiative: "Initiative", board: "Pinnwand", daten: "Daten", kompendium: "Kompendium & Daten", wissen: "Wissen" };
  const verschiebe = (modus, i, d) => upd((m) => { const l = m.menue[modus]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; });
  return (
    <div style={{ display: "grid", gap: 14 }}>
    <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14, display: "grid", gap: 10 }}>
      <h3 className="serif" style={{ margin: 0, fontSize: 16 }}>Menü anpassen</h3>
      <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Reihenfolge je Modus; die ersten vier Einträge bilden auf Mobile die untere Leiste, der Rest liegt unter «Mehr…».</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {["vorbereitung", "spiel"].map((modus) => (
          <div key={modus}>
            <div className="serif" style={{ fontSize: 14, marginBottom: 4 }}>{modus === "spiel" ? "▶ Spiel" : "✎ Vorbereitung"}</div>
            {(model.menue[modus] || []).map((k, i) => (
              <div key={k} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, padding: "2px 0", color: i < 4 ? C.kreide : C.dim }}>
                <span style={{ width: 18, color: C.dim }}>{i + 1}</span><span style={{ flex: 1 }}>{labels[k] || k}</span>
                <button className="knopf leise" style={{ padding: "0 6px" }} onClick={() => verschiebe(modus, i, -1)}>↑</button>
                <button className="knopf leise" style={{ padding: "0 6px" }} onClick={() => verschiebe(modus, i, 1)}>↓</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
    <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14, display: "grid", gap: 10 }}>
      <h3 className="serif" style={{ margin: 0, fontSize: 16 }}>Daten sichern & übernehmen</h3>
      <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Export als JSON — extern sichern (Obsidian-Notiz, Datei). Bei Breaking Changes einer neuen Version hier wieder importieren; die Migration ergänzt fehlende Felder automatisch.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="knopf primaer" onClick={() => { setIo(JSON.stringify(model, null, 1)); setMeldung("Export erzeugt — Feld markieren & kopieren."); }}>Export erzeugen</button>
        <button className="knopf" onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(model)); setMeldung("In die Zwischenablage kopiert."); } catch { setMeldung("Zwischenablage nicht verfügbar — Feld manuell kopieren."); } }}>Direkt kopieren</button>
        <button className="knopf" onClick={() => {
          try {
            const roh = JSON.parse(io);
            if (!roh.nodes || !roh.encounters) throw new Error("kein Kanalgang-Export");
            if (!bestaetigen("Importieren? Der aktuelle Stand wird ersetzt.")) return;
            setModel(migriere(roh)); setMeldung("Import erfolgreich.");
          } catch (err) { setMeldung("Import fehlgeschlagen: " + err.message); }
        }}>Importieren</button>
        <button className="knopf leise" onClick={() => setIo("")}>Leeren</button>
      </div>
      {meldung && <span style={{ fontSize: 12, color: C.teal }}>{meldung}</span>}
      <textarea rows={14} value={io} onChange={(ev) => setIo(ev.target.value)} placeholder="Export erscheint hier — oder JSON zum Importieren einfügen." style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }} />
    </div>
    </div>
  );
}


/* ── Fraktionen & Distrikte ── */
function ZonenTab({ model, upd, starteMitte, teil }) {
  const [neuD, setNeuD] = useState("");
  const umbenennenFraktion = (alt, neu) => upd((m) => {
    const f = m.fraktionen.find((x) => x.name === alt); if (!f) return; f.name = neu;
    Object.values(m.nodes).forEach((n) => { if (n.fraktion === alt) n.fraktion = neu; });
    Object.values(m.orte).forEach((o) => { if (o.f === alt) o.f = neu; });
    m.encounters.forEach((e) => { if (e.f === alt) e.f = neu; });
  });
  const umbenennenDistrikt = (alt, neu) => upd((m) => {
    if (!neu || m.distrikte[neu]) return;
    m.distrikte[neu] = m.distrikte[alt]; delete m.distrikte[alt];
    m.distriktFarben[neu] = m.distriktFarben[alt] || "#9aa5b1"; delete m.distriktFarben[alt];
    Object.values(m.nodes).forEach((n) => { if (n.distrikt === alt) n.distrikt = neu; });
    m.encounters.forEach((e) => { if (e.d === alt) e.d = neu; });
  });
  const zoneFeld = (id, k, v) => upd((m) => { const z = m.zonen.find((x) => x.id === id); if (z) z[k] = v; });
  const Num = (z, k, l) => (
    <label key={z.id + k} className="feld" style={{ width: 70 }}>{l}<input type="number" value={z[k] ?? 0} onChange={(ev) => zoneFeld(z.id, k, +ev.target.value)} /></label>
  );
  const Box = (titel, extra, inhalt) => (
    <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><h3 className="serif" style={{ margin: 0, fontSize: 16, flex: 1 }}>{titel}</h3>{extra}</div>
      {inhalt}
    </div>
  );
  const farbfeld = (wert, setzen) => <input type="color" value={wert || "#9aa5b1"} onChange={(ev) => setzen(ev.target.value)} style={{ width: 40, height: 26, padding: 0, background: "none", border: `1px solid ${C.linie}` }} />;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {teil !== "orte" && Box(`Fraktionen (${model.fraktionen.length})`, <button className="knopf" onClick={() => upd((m) => m.fraktionen.push({ id: "f" + Date.now(), name: "Neue Fraktion", farbe: "#9aa5b1" }))}>+ Fraktion</button>, (<>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 150px 50px 30px", gap: 8, fontSize: 10.5, color: C.dim }}><span>Name</span><span>Fraktionstyp</span><span>übergeordnet · Rolle im Verbund</span><span>Farbe</span><span /></div>
        {(() => { const baum = (parent, tiefe) => model.fraktionen.filter((f) => (f.uebergeordnet || null) === parent).flatMap((f) => [
          <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1fr 150px 150px 50px 30px", gap: 8, alignItems: "center", paddingLeft: tiefe * 22 }}>
            <input type="text" value={(tiefe ? "└ " : "") + ""} readOnly style={{ display: "none" }} />
            <input type="text" value={f.name} onChange={(ev) => umbenennenFraktion(f.name, ev.target.value)} style={{ borderLeft: tiefe ? `3px solid ${f.farbe}` : undefined }} />
            <input type="text" list="fraktionstypen" value={f.ftyp || ""} placeholder="Typ (Bande, Armee …)" onChange={(ev) => upd((m) => { m.fraktionen.find((x) => x.id === f.id).ftyp = ev.target.value; })} />
            <div style={{ display: "flex", gap: 4 }}>
              <select value={f.uebergeordnet || ""} title="übergeordnete Fraktion" style={{ width: "50%" }} onChange={(ev) => upd((m) => { m.fraktionen.find((x) => x.id === f.id).uebergeordnet = ev.target.value || null; })}><option value="">— oben —</option>{model.fraktionen.filter((x) => x.id !== f.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              <input type="text" value={f.rolleImVerbund || ""} placeholder="Rolle" style={{ width: "50%" }} onChange={(ev) => upd((m) => { m.fraktionen.find((x) => x.id === f.id).rolleImVerbund = ev.target.value; })} />
            </div>
            <input type="text" list="fraktionstypen" value={f.ftyp || ""} placeholder="Typ (Bande, Armee …)" onChange={(ev) => upd((m) => { m.fraktionen.find((x) => x.id === f.id).ftyp = ev.target.value; })} />
            {farbfeld(f.farbe, (v) => upd((m) => { m.fraktionen.find((x) => x.id === f.id).farbe = v; }))}
            <button className="knopf leise" onClick={() => { if (bestaetigen(f.name + " entfernen? Zuordnungen fallen auf «keine» zurück.")) upd((m) => { m.fraktionen = m.fraktionen.filter((x) => x.id !== f.id); m.fraktionen.forEach((x) => { if (x.uebergeordnet === f.id) x.uebergeordnet = null; }); Object.values(m.nodes).forEach((n) => { if (n.fraktion === f.name) n.fraktion = "keine"; }); Object.values(m.orte).forEach((o) => { if (o.f === f.name) o.f = "keine"; }); m.encounters.forEach((e) => { if (e.f === f.name) e.f = "keine"; }); }); }}>✕</button>
          </div>, ...baum(f.id, tiefe + 1)]); return baum(null, 0); })()}
        <p style={{ color: C.dim, fontSize: 11.5, margin: 0 }}>Hierarchie: übergeordnete Fraktion + Rolle im Verbund (z. B. Grautruppen → Grauwacht «Armee»); Einrückung zeigt den Baum.</p>
        <datalist id="fraktionstypen">{["Bande", "Gilde", "Söldner", "Regierung", "Armee", "Stadtwache", "Geheimdienst", "politische Partei", "Monarchie", "Adelshaus", "Kult", "Kirche", "Handelshaus", "Familie"].map((t) => <option key={t} value={t} />)}</datalist>
        <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>Umbenennen zieht Knoten, Orte und Encounter mit. Die Farbe färbt Orte, Encounter-Markierungen und dient als Vorgabe für Zonen.</p>
        <div style={{ display: "grid", gap: 6 }}>
          {model.fraktionen.map((f) => {
            const mitglieder = (model.npcs || []).flatMap((n) => (n.beziehungen || []).filter((b) => b.zielTyp === "fraktion" && b.zielId === f.id).map((b) => ({ n, b })));
            if (!mitglieder.length) return null;
            return (
              <div key={f.id} style={{ fontSize: 12.5 }}>
                <strong style={{ color: f.farbe }}>{f.name}</strong>: {mitglieder.map(({ n, b }) => `${n.name} (${b.rolle}${b.text ? " — " + b.text : ""})`).join(" · ")}
              </div>
            );
          })}
          {!(model.npcs || []).some((n) => (n.beziehungen || []).some((b) => b.zielTyp === "fraktion")) && <span style={{ color: C.dim, fontSize: 12 }}>Mitglieder erscheinen hier, sobald NPCs im Tab «NPCs» eine Beziehung zu einer Fraktion haben (Anführer, Mitglied, Kontakt …).</span>}
        </div>
            </>))}

      {teil !== "fraktionen" && Box(`Distrikte (${Object.keys(model.distrikte).length})`, <span style={{ display: "flex", gap: 6 }}><input type="text" placeholder="Neuer Distrikt" value={neuD} onChange={(ev) => setNeuD(ev.target.value)} style={{ width: 180 }} /><button className="knopf" onClick={() => { const d = neuD.trim(); if (!d) return; upd((m) => { if (!m.distrikte[d]) { m.distrikte[d] = { Kampf: 5, Hindernis: 5, Begegnung: 4, Ressource: 3, Geschichte: 3 }; m.distriktFarben[d] = "#9aa5b1"; } }); setNeuD(""); }}>+ Distrikt</button></span>, (<>
        {Object.keys(model.distrikte).map((d) => (
          <div key={d} style={{ display: "grid", gridTemplateColumns: "1fr 50px 30px", gap: 8, alignItems: "center" }}>
            <input type="text" defaultValue={d} key={"n" + d} onBlur={(ev) => { const neu = ev.target.value.trim(); if (neu && neu !== d) umbenennenDistrikt(d, neu); }} />
            {farbfeld(model.distriktFarben[d], (v) => upd((m) => { m.distriktFarben[d] = v; }))}
            <button className="knopf leise" onClick={() => { if (bestaetigen(d + " entfernen?")) upd((m) => { delete m.distrikte[d]; delete m.distriktFarben[d]; }); }}>✕</button>
          </div>
        ))}
        <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>Umbenennen: Feld verlassen übernimmt den Namen (Gewichte, Knoten und Encounter ziehen mit). Die Typ-Gewichtung bleibt im Tab «Encounter».</p>
            </>))}

      {teil === "zonen" && Box(`Zonen auf der Karte (${model.zonen.length})`, <button className="knopf" onClick={() => upd((m) => m.zonen.push({ id: "z" + Date.now(), typ: "fraktion", label: "Neue Zone", farbe: "#9aa5b1", form: "rect", x: 560, y: 1500, w: 120, h: 120, lx: 620, ly: 1494, hatch: false, dash: false }))}>+ Zone</button>, (<>
        <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>Zonen werden auf das Hexraster gerastert. Fraktionszonen erscheinen über «Fraktionsgebiete», Distriktzonen über «Distrikte». Koordinaten in Kartenpixeln (1000 × 2038, y von oben).</p>
        {["fraktion", "distrikt"].map((typ) => (
          <div key={typ} style={{ display: "grid", gap: 8 }}>
            <div className="serif" style={{ fontSize: 14, color: C.dim }}>{typ === "fraktion" ? "Fraktionsgebiete" : "Distriktflächen"}</div>
            {model.zonen.filter((z) => z.typ === typ).map((z) => (
              <div key={z.id} style={{ borderLeft: `4px solid ${z.farbe}`, paddingLeft: 10, display: "grid", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 50px 150px", gap: 8, alignItems: "end" }}>
                  <label className="feld">Bezeichnung<input type="text" value={z.label} onChange={(ev) => zoneFeld(z.id, "label", ev.target.value)} /></label>
                  <label className="feld">Typ<select value={z.typ} onChange={(ev) => zoneFeld(z.id, "typ", ev.target.value)}><option value="fraktion">Fraktion</option><option value="distrikt">Distrikt</option></select></label>
                  <label className="feld">Farbe{farbfeld(z.farbe, (v) => zoneFeld(z.id, "farbe", v))}</label>
                  <label className="feld">Farbe übernehmen von
                    <select value="" onChange={(ev) => { const v = ev.target.value; if (!v) return; const f = model.fraktionen.find((x) => x.name === v); zoneFeld(z.id, "farbe", f ? f.farbe : (model.distriktFarben[v] || z.farbe)); }}>
                      <option value="">…</option>
                      {model.fraktionen.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
                      {Object.keys(model.distrikte).map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </label>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                  <label className="feld" style={{ width: 90 }}>Form
                    <select value={z.form} onChange={(ev) => upd((m) => { const q = m.zonen.find((x) => x.id === z.id); const cx = q.form === "rect" ? q.x + q.w / 2 : q.form === "polygon" ? q.punkte.reduce((a, p2) => a + p2[0], 0) / q.punkte.length : q.cx, cy = q.form === "rect" ? q.y + q.h / 2 : q.form === "polygon" ? q.punkte.reduce((a, p2) => a + p2[1], 0) / q.punkte.length : q.cy; const groesse = q.form === "rect" ? Math.max(q.w, q.h) / 2 : (q.r || q.rx || 40); q.form = ev.target.value; if (q.form === "polygon") { q.punkte = [[cx - groesse, cy - groesse], [cx + groesse, cy - groesse], [cx + groesse, cy + groesse], [cx - groesse, cy + groesse]].map((q2) => q2.map(Math.round)); } else if (q.form === "rect") { q.w = groesse * 2; q.h = groesse * 2; q.x = Math.round(cx - groesse); q.y = Math.round(cy - groesse); } else if (q.form === "circle") { q.cx = Math.round(cx); q.cy = Math.round(cy); q.r = groesse; } else { q.cx = Math.round(cx); q.cy = Math.round(cy); q.rx = groesse; q.ry = groesse; } })}>
                      <option value="rect">Rechteck</option><option value="circle">Kreis</option><option value="ellipse">Ellipse</option><option value="polygon">Polygon</option>
                    </select>
                  </label>
                  {z.form === "rect" && <>{Num(z, "x", "x")}{Num(z, "y", "y")}{Num(z, "w", "Breite")}{Num(z, "h", "Höhe")}</>}
                  {z.form === "circle" && <>{Num(z, "cx", "cx")}{Num(z, "cy", "cy")}{Num(z, "r", "Radius")}</>}
                  {z.form === "polygon" && <span style={{ fontSize: 12, color: C.dim }}>{(z.punkte || []).length} Punkte — auf der Karte ziehen</span>}
                  {z.form === "ellipse" && <>{Num(z, "cx", "cx")}{Num(z, "cy", "cy")}{Num(z, "rx", "rx")}{Num(z, "ry", "ry")}</>}
                  {Num(z, "lx", "Label x")}{Num(z, "ly", "Label y")}
                  <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={!!z.hatch} onChange={(ev) => zoneFeld(z.id, "hatch", ev.target.checked)} />Schraffur</label>
                  <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={!!z.dash} onChange={(ev) => zoneFeld(z.id, "dash", ev.target.checked)} />gestrichelt</label>
                  <button className="knopf" style={{ fontSize: 12 }} onClick={() => starteMitte(z.id)}>Mittelpunkt auf Karte setzen</button>
                  <button className="knopf gefahr" style={{ fontSize: 12 }} onClick={() => { if (bestaetigen("Zone «" + z.label + "» löschen?")) upd((m) => { m.zonen = m.zonen.filter((x) => x.id !== z.id); }); }}>Löschen</button>
                </div>
              </div>
            ))}
          </div>
        ))}
            </>))}
    </div>
  );
}

/* ── Gruppe (Party- und Spieler-Ansicht) ── */
function charakterAusJson(roh) {
  const c = roh.character || roh;
  if (!c || !c.name) throw new Error("kein Charakter gefunden (erwartet: { character: {…} })");
  const v = c.vitals || {};
  return {
    id: "c" + Date.now().toString(36) + Math.floor(Math.random() * 999),
    name: c.name, subtitle: c.subtitle || "", player: c.player || "", size: c.size || "", age: c.age || "",
    ac: v.AC ?? "", init: v.Initiative ?? "", speed: v.Speed ?? "", prof: v.Prof ?? (c.proficiencies?.["Proficiency Bonus"] ?? ""),
    hp: c.hitPointsMax ?? "", hitDice: c.hitDice || "",
    abilities: c.abilities || {}, passives: c.passives || [], saves: (c.savingThrows || []).map((x) => x.label || x),
    skills: c.skills || [], attacks: c.attacks || [], features: c.features || [],
    proficiencies: c.proficiencies || {}, languages: c.languagesAndCant || "", defenseNote: c.defenseNote || "",
    background: (c.background && c.background.description) || [], notiz: "",
  };
}
const stufeAus = (sub) => { const m = String(sub || "").match(/(\d+)/g); return m ? +m[m.length - 1] : null; };

function GruppeTab({ model, upd, spieler }) {
  const [io, setIo] = useState("");
  const [meldung, setMeldung] = useState("");
  const chars = model.charaktere || [];
  const importieren = () => {
    try {
      const roh = JSON.parse(io);
      const liste = Array.isArray(roh) ? roh : [roh];
      const neu = liste.map(charakterAusJson);
      upd((m) => { neu.forEach((c) => { const i = m.charaktere.findIndex((x) => x.name === c.name); if (i >= 0) { c.id = m.charaktere[i].id; c.notiz = m.charaktere[i].notiz; m.charaktere[i] = c; } else m.charaktere.push(c); }); });
      setIo(""); setMeldung(neu.length + " Charakter(e) importiert.");
    } catch (err) { setMeldung("Import fehlgeschlagen: " + err.message); }
  };
  const stufen = chars.map((c) => stufeAus(c.subtitle)).filter((x) => x);
  const mittel = stufen.length ? Math.round(stufen.reduce((a, b) => a + b, 0) / stufen.length) : null;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {!spieler && (
        <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, padding: 14, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <h3 className="serif" style={{ margin: 0, fontSize: 16, flex: 1 }}>Gruppe ({chars.length}) {mittel && <span style={{ color: C.dim, fontSize: 12 }}>· Ø Stufe {mittel} · Gruppenstufe {model.gruppenstufe}</span>}</h3>
            {mittel && mittel !== model.gruppenstufe && <button className="knopf" onClick={() => upd((m) => { m.gruppenstufe = mittel; })}>Gruppenstufe auf {mittel} setzen</button>}
            <button className="knopf primaer" onClick={importieren}>Charakter-JSON importieren</button>
            {meldung && <span style={{ fontSize: 12, color: C.teal }}>{meldung}</span>}
          </div>
          <textarea rows={4} value={io} onChange={(ev) => setIo(ev.target.value)} placeholder='Export eines Charakterbogens einfügen (Format: { "character": { … } } — oder eine Liste davon). Gleichnamige werden ersetzt, SL-Notizen bleiben.' style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }} />
        </div>
      )}
      {!spieler && <CharakterNeu upd={upd} />}
      {chars.length === 0 && <p style={{ color: C.dim, fontSize: 13 }}>Noch keine Charaktere in der Gruppe.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, alignItems: "start" }}>
        {chars.map((c) => <CharakterKarte key={c.id} c={c} upd={upd} spieler={spieler} />)}
      </div>
      <GruppenWissen model={model} spieler={spieler} />
      <Bestiarium model={model} upd={upd} spieler={spieler} />
    </div>
  );
}

function GruppenWissen({ model, spieler }) {
  const [wer, setWer] = useState("");
  const infos = model.informationen.filter((x) => infoBekannt(model, x, wer || null));
  const proWissen = {}; infos.forEach((x) => { const k = x.wissenId ? (model.wissen.find((w) => w.id === x.wissenId)?.name || "?") : "direkt erfahren"; (proWissen[k] = proWissen[k] || []).push(x); });
  const beschr = (x) => x.art === "abwehr" ? (() => { const t = model.typen.find((tt) => tt.id === x.typId); const a = t?.abwehr[x.abwehrIdx]; return a ? `${t.name}: ${KAT_LABEL[a.kat] || a.kat} — ${a.text}` : x.titel; })() : x.art === "artikel" ? `${x.titel}${x.text ? " — " + x.text : ""}` : x.titel + (x.text ? " — " + x.text : "");
  return (
    <div className="kasten" style={{ background: C.wand, border: `1px solid ${C.linie}`, borderLeft: `3px solid ${C.teal}`, borderRadius: 4, padding: 14, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <h3 className="serif" style={{ margin: 0, fontSize: 16, flex: 1 }}>Wissen & Informationen — {wer ? model.charaktere.find((c) => c.id === wer)?.name : "die Gruppe"}</h3>
        <select value={wer} onChange={(ev) => setWer(ev.target.value)}><option value="">Gruppe (alles Bekannte)</option>{model.charaktere.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      {wer && <div style={{ fontSize: 12.5 }}><span style={{ color: C.dim }}>Gelernte Wissen:</span> {(model.charaktere.find((c) => c.id === wer)?.wissen || []).map((id) => model.wissen.find((w) => w.id === id)?.name).filter(Boolean).join(", ") || "—"}</div>}
      {Object.entries(proWissen).map(([k, l]) => (
        <details key={k} open={!spieler}><summary style={{ cursor: "pointer", color: C.gold, fontSize: 13 }}>{k} ({l.length})</summary>
          <div style={{ display: "grid", gap: 3, marginTop: 4, fontSize: 12.5 }}>{l.map((x) => <div key={x.id}>• {beschr(x)}</div>)}</div>
        </details>
      ))}
      {!infos.length && <span style={{ color: C.dim, fontSize: 12.5 }}>Noch nichts bekannt.</span>}
    </div>
  );
}

/* ── Bestiarium: was die Gruppe über Typen & Ancestries weiss ── */
function Bestiarium({ model, upd, spieler }) {
  const typen = [...model.typen].filter((t) => t.abwehr.length).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: 14, display: "grid", gap: 10 }}>
      <h3 className="serif" style={{ margin: 0, fontSize: 16 }}>Bestiarium — {spieler ? "was ihr über eure Gegner wisst" : "Wissen der Gruppe (Haken = für Spieler sichtbar)"}</h3>
      {typen.length === 0 && <span style={{ color: C.dim, fontSize: 12.5 }}>Noch nichts eingetragen.</span>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
        {typen.map((t) => {
          const bekannt = t.abwehr.filter((a, i) => abwehrBekannt(model, t.id, i)), unbekannt = t.abwehr.length - bekannt.length;
          if (spieler && !bekannt.length) return null;
          return (
            <div key={t.id} style={{ background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, padding: 10, fontSize: 12.5, display: "grid", gap: 4 }}>
              <div className="serif" style={{ fontSize: 15, fontWeight: 700 }}>{t.name} <span style={{ color: C.dim, fontSize: 11 }}>{t.art}</span></div>
              {(spieler ? bekannt : t.abwehr).map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", color: abwehrBekannt(model, t.id, t.abwehr.indexOf(a)) ? C.kreide : C.dim }}>
                  {!spieler && <span style={{ fontSize: 11, color: C.dim }}>{abwehrBekannt(model, t.id, t.abwehr.indexOf(a)) ? "✔" : "–"}</span>}
                  <span><span style={{ color: a.kat === "schwaeche" ? C.gold : a.kat === "verwund" ? C.rot : C.amber }}>{KAT_LABEL[a.kat]}</span> — {a.text}{!spieler && a.lernen && <span style={{ color: C.dim }}> · {a.lernen}</span>}</span>
                </div>
              ))}
              {spieler && unbekannt > 0 && <div style={{ color: C.dim, fontStyle: "italic" }}>… und {unbekannt} weitere Eigenheit{unbekannt > 1 ? "en" : ""}, die ihr noch nicht kennt.</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CharakterNeu({ upd }) {
  const [offen, setOffen] = useState(false);
  const [f, setF] = useState({ name: "", player: "", hp: 10, temp: 0, ac: 10, pp: 10, Str: 10, Dex: 10, Con: 10, Int: 10, Wis: 10, Cha: 10 });
  const mod = (v) => { const m = Math.floor((+v - 10) / 2); return (m >= 0 ? "+" : "") + m; };
  if (!offen) return <div><button className="knopf" onClick={() => setOffen(true)}>+ Charakter (minimal)</button></div>;
  return (
    <Kasten titel="Neuer Charakter" farbe={C.teal}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
        <T l="Name" v={f.name} setzen={(v) => setF({ ...f, name: v })} /><T l="Spieler" v={f.player} setzen={(v) => setF({ ...f, player: v })} />
        {[["hp", "HP max"], ["temp", "Temp HP"], ["ac", "AC"], ["pp", "Passive Perception"]].map(([k, l]) => <div key={k} className="feld">{l}<input type="number" value={f[k]} onChange={(ev) => setF({ ...f, [k]: +ev.target.value })} /></div>)}
        {["Str", "Dex", "Con", "Int", "Wis", "Cha"].map((a) => <div key={a} className="feld">{a.toUpperCase()} ({mod(f[a])})<input type="number" value={f[a]} onChange={(ev) => setF({ ...f, [a]: +ev.target.value })} /></div>)}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="knopf primaer" onClick={() => { if (!f.name.trim()) return; upd((m) => m.charaktere.push({ id: "c" + Date.now(), name: f.name.trim(), subtitle: "", player: f.player, ac: f.ac, init: mod(f.Dex), speed: "", prof: "", hp: f.hp, temp: f.temp, hitDice: "", abilities: Object.fromEntries(["Str", "Dex", "Con", "Int", "Wis", "Cha"].map((a) => [a, { score: f[a], mod: mod(f[a]) }])), passives: ["Passive Perception " + f.pp], saves: [], skills: [], attacks: [], features: [], proficiencies: {}, languages: "", defenseNote: "", background: [], notiz: "" })); setOffen(false); setF({ ...f, name: "", player: "" }); }}>Anlegen</button>
        <button className="knopf leise" onClick={() => setOffen(false)}>Abbrechen</button>
      </div>
    </Kasten>
  );
}

function CharakterTabs({ c, upd, spieler }) {
  const model = useContext(ModelCtx);
  const [tab, setTab] = useState("");
  const namen = Object.keys(model?.ansichten?.Charakter || {}).filter((k) => !["Quick-Add", "Kurz", "Spieler"].includes(k));
  const cf = (k, v) => upd((m) => { const x = m.charaktere.find((y) => y.id === c.id); if (x) x[k] = v; });
  if (!model || !namen.length) return null;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button className={"knopf " + (tab === "" ? "an" : "")} style={{ fontSize: 11.5 }} onClick={() => setTab("")}>Übersicht</button>
        {namen.map((n) => <button key={n} className={"knopf " + (tab === n ? "an" : "")} style={{ fontSize: 11.5 }} onClick={() => setTab(n)}>{n}</button>)}
      </div>
      {tab && (spieler ? <AnsichtRender model={model} art="Charakter" obj={c} ansicht={tab} /> : <AnsichtForm model={model} art="Charakter" obj={c} ansicht={tab} setzen={cf} />)}
    </div>
  );
}

function CharakterBearbeiten({ c, upd }) {
  const [offen, setOffen] = useState(false);
  const model = useContext(ModelCtx);
  const cf = (k, v) => upd((m) => { const x = m.charaktere.find((y) => y.id === c.id); if (x) x[k] = v; });
  if (!offen) return <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><button className="knopf" style={{ fontSize: 12 }} onClick={() => setOffen(true)}>Bearbeiten</button><StatusWahl obj={c} setzen={(v) => cf("status", v)} /></div>;
  return (
    <div style={{ display: "grid", gap: 8, background: C.bg, borderRadius: 3, padding: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6 }}>
        <T l="Name" v={c.name} setzen={(v) => cf("name", v)} /><T l="Klasse/Stufe" v={c.subtitle} setzen={(v) => cf("subtitle", v)} /><T l="Spieler" v={c.player} setzen={(v) => cf("player", v)} />
        {[["hp", "HP max"], ["temp", "Temp"], ["ac", "AC"], ["speed", "Speed"], ["init", "Init"], ["prof", "Prof"]].map(([k, l]) => <T key={k} l={l} v={String(c[k] ?? "")} setzen={(v) => cf(k, v)} />)}
        {Object.keys(c.abilities || {}).map((a) => <div key={a} className="feld">{a.toUpperCase()}<input type="number" value={c.abilities[a].score} onChange={(ev) => { const sc = +ev.target.value; const md2 = Math.floor((sc - 10) / 2); cf("abilities", { ...c.abilities, [a]: { score: sc, mod: (md2 >= 0 ? "+" : "") + md2 } }); }} /></div>)}
      </div>
      <T l="Passives (kommagetrennt)" v={(c.passives || []).join(", ")} setzen={(v) => cf("passives", v.split(",").map((x) => x.trim()).filter(Boolean))} />
      {model && <ZusatzFelder upd={upd} model={model} art="Charakter" subtyp={c.subtyp || "Standard"} werte={c.zusatz} setzen={(z) => cf("zusatz", z)} />}
      <div><button className="knopf primaer" style={{ fontSize: 12 }} onClick={() => setOffen(false)}>Fertig</button></div>
    </div>
  );
}

function CharakterKarte({ c, upd, spieler }) {
  const ab = c.abilities || {};
  const mod = (n) => (n >= 0 ? "+" : "") + n;
  return (
    <div style={{ background: C.wand, border: `1px solid ${C.linie}`, borderLeft: `3px solid ${C.teal}`, borderRadius: 4, padding: 14, display: "grid", gap: 8, fontSize: 12.5 }}>
      <div>
        <div className="serif" style={{ fontSize: 18, fontWeight: 700 }}>{c.name}</div>
        <div style={{ color: C.dim }}>{c.subtitle}{c.player ? " · " + c.player : ""}</div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", borderTop: `1px solid ${C.linie}`, paddingTop: 6 }}>
        {[["AC", c.ac], ["HP", c.hp], ["Speed", c.speed], ["Init", c.init], ["Prof", c.prof]].map(([l, v]) => v !== "" && v != null && (
          <span key={l}><strong>{l}</strong> {v}</span>
        ))}
        {c.hitDice && <span style={{ color: C.dim }}>{c.hitDice}</span>}
      </div>
      <table style={{ borderCollapse: "collapse", textAlign: "center", fontSize: 12 }}>
        <thead><tr>{Object.keys(ab).map((k) => <th key={k} style={{ padding: "1px 6px", color: C.dim }}>{k.toUpperCase()}</th>)}</tr></thead>
        <tbody><tr>{Object.values(ab).map((a, i) => <td key={i} style={{ padding: "1px 6px" }}>{a.score} ({a.mod})</td>)}</tr></tbody>
      </table>
      {c.passives?.length > 0 && <div><strong>Passives</strong> {c.passives.join(" · ")}</div>}
      {c.saves?.length > 0 && <div><strong>Saving Throws</strong> {c.saves.join(", ")}</div>}
      {c.skills?.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", color: C.amber }}>Skills</summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px 10px", marginTop: 4 }}>
            {c.skills.map((sk) => <span key={sk.name} style={{ color: sk.tier > 0 ? C.kreide : C.dim }}>{sk.name} {mod(sk.mod)}{sk.tier > 1 ? "★" : sk.tier === 1 ? "•" : ""}</span>)}
          </div>
        </details>
      )}
      {c.attacks?.length > 0 && (
        <details open>
          <summary style={{ cursor: "pointer", color: C.amber }}>Attacks</summary>
          <div style={{ display: "grid", gap: 3, marginTop: 4 }}>
            {c.attacks.map((a, i) => <div key={i}><strong>{a.weapon}</strong> {a.toHit} · {a.damage}{a.properties ? <span style={{ color: C.dim }}> — {a.properties}</span> : null}</div>)}
          </div>
        </details>
      )}
      {c.features?.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", color: C.amber }}>Features</summary>
          <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
            {c.features.map((g, i) => (
              <div key={i}>
                <div style={{ color: C.dim }}>{g.title}</div>
                {(g.features || []).map((f, j) => <div key={j}><strong>{f.name}.</strong> {f.text}</div>)}
              </div>
            ))}
          </div>
        </details>
      )}
      {(c.defenseNote || c.languages) && (
        <details>
          <summary style={{ cursor: "pointer", color: C.amber }}>Defenses & Languages</summary>
          <div style={{ marginTop: 4, display: "grid", gap: 3 }}>{c.defenseNote && <div>{c.defenseNote}</div>}{c.languages && <div>{c.languages}</div>}</div>
        </details>
      )}
      {c.background?.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", color: C.amber }}>Background</summary>
          <div style={{ marginTop: 4, display: "grid", gap: 4, color: C.dim }}>{c.background.map((p, i) => <p key={i} style={{ margin: 0 }}>{p}</p>)}</div>
        </details>
      )}
      <CharakterTabs c={c} upd={upd} spieler={spieler} />
      {!spieler && <CharakterBearbeiten c={c} upd={upd} />}
      {!spieler && (
        <div className="feld">SL-Notiz (nicht in der Spieler-Ansicht)
          <textarea rows={2} value={c.notiz || ""} onChange={(ev) => upd((m) => { m.charaktere.find((x) => x.id === c.id).notiz = ev.target.value; })} />
          <div><button className="knopf gefahr" style={{ fontSize: 12 }} onClick={() => { if (bestaetigen(c.name + " entfernen?")) upd((m) => { m.charaktere = m.charaktere.filter((x) => x.id !== c.id); }); }}>Entfernen</button></div>
        </div>
      )}
    </div>
  );
}


/* ── Kernfelder je Art ── */
const ART_LABEL = { NPC: "Geschöpf", Gegenstand: "Gegenstand", Ort: "Ort", Quest: "Quest", Regel: "Regel", Encounter: "Encounter", Charakter: "Charakter", Statblock: "Statblock", Sitzung: "Sitzung", Rezept: "Rezept" };
const KERNFELDER = {
  NPC: { name: ["Name", "text"], subtyp: ["Geschöpfstyp", "subtyp"], beschreibung: ["Beschreibung", "absatz"], hauptbeziehung: ["Hauptbeziehung", "text"], worte: ["Tags zur Gruppe", "liste"], statblockId: ["Statblock", "verweis:Statblock"] },
  Gegenstand: { name: ["Name", "text"], gtyp: ["Gegenstandstyp", "subtyp"], raritaet: ["Rarität", "text"], stapel: ["Stapelgrösse", "text"], kupfer: ["Kupferpreis", "text"], beschreibung: ["Beschreibung", "absatz"], bild: ["Bild", "bild"] },
  Ort: { name: ["Name", "text"], f: ["Fraktion", "text"], distrikt: ["Distrikt", "text"], beschreibung: ["Beschreibung", "absatz"], tags: ["Tags", "liste"] },
  Quest: { titel: ["Titel", "text"], status: ["Spielstatus", "text"], beschreibung: ["Beschreibung", "absatz"], schritte: ["Schritte", "schritte"], belohnung: ["Belohnung", "text"] },
  Regel: { name: ["Name", "text"], art: ["Typ", "subtyp"], text: ["Text", "absatz"] },
  Encounter: { t: ["Kurzzeile", "text"], typ: ["Typ", "text"], d: ["Distrikt", "text"], f: ["Fraktion", "text"], notiz: ["Details", "absatz"] },
  Charakter: { name: ["Name", "text"], subtitle: ["Klasse/Stufe", "text"], player: ["Spieler", "text"], beschreibung: ["Beschreibung", "absatz"], ac: ["AC", "text"], hp: ["HP max", "text"], temp: ["Temp HP", "text"], speed: ["Speed", "text"], init: ["Initiative", "text"], prof: ["Proficiency", "text"], passives: ["Passives", "liste"], languages: ["Sprachen", "text"], defenseNote: ["Defenses", "text"] },
};
const alleFelder = (model, art) => {
  const kern = Object.entries(KERNFELDER[art] || {}).map(([key, [label, typ]]) => ({ key, label, typ, kern: true }));
  const zusatz = Object.values(((model.schemata[art] || {}).subtypen) || {}).flat().map((f) => ({ ...f, kern: false }));
  const seen = new Set(); return [...kern, ...zusatz].filter((f) => !seen.has(f.key) && seen.add(f.key));
};
const feldWert = (obj, f) => f.kern ? obj[f.key] : (obj.zusatz || {})[f.key];
/* generische Kurzansicht nach Ansichts-Schema */
function AnsichtRender({ model, art, obj, ansicht }) {
  const keys = ((model.ansichten[art] || {})[ansicht]) || [];
  const felder = alleFelder(model, art);
  return (
    <div style={{ display: "grid", gap: 3, fontSize: 12.5 }}>
      {keys.map((k) => { const f = felder.find((x) => x.key === k); if (!f) return null; let v = feldWert(obj, f); if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null;
        if (f.typ === "subtyp" && art === "Gegenstand") v = GTYPEN[v] || v;
        if (f.typ === "schritte") v = v.map((x) => (x.erledigt ? "☑ " : "☐ ") + x.text).join(" · ");
        if (f.typ === "verweis:Statblock") v = model.monster[v]?.name || "";
        if (f.typ === "bild") return <img key={k} src={v} alt="" style={{ maxWidth: 96 }} />;
        if (Array.isArray(v)) v = v.join(", ");
        return <div key={k} style={{ whiteSpace: "pre-wrap" }}><span style={{ color: C.dim }}>{f.label}: </span>{String(v)}</div>; })}
    </div>
  );
}
/* Quick-Add: Minimalform nach Ansicht "Quick-Add", erzeugt immer Status Idee */
function neuerArtikel(m, art, werte) {
  const id = art[0].toLowerCase() + Date.now() + Math.floor(Math.random() * 99);
  const basis = { NPC: { id, name: "", statblockId: null, beschreibung: "", hauptbeziehung: "", standing: "", worte: [], interaktionen: [], beziehungen: [], todos: [], subtyp: "Standard" },
    Gegenstand: neuerGegenstand(""), Ort: { id, name: "", x: null, y: null, f: "keine", sichtbar: false, b: "", beschreibung: "", distrikt: "", tags: [], platziert: false, subtyp: "Standard" },
    Quest: { id, titel: "", kampagneId: m.kampagne.id, status: "offen", auftraggeberId: null, fraktion: "keine", beschreibung: "", schritte: [], belohnung: "", todos: [], subtyp: "Haupt", status2: "Idee" },
    Regel: { id, name: "", art: "Regel", text: "", vars: {} }, Encounter: { id, t: "", typ: "Kampf", d: Object.keys(m.distrikte)[0], f: "keine", lvMin: 1, lvMax: 20, notiz: "", monster: [], monsterAnzahl: {}, lootListe: [], lootTabellen: [] },
    Charakter: { id, name: "", subtitle: "", player: "", ac: 10, hp: 10, temp: 0, speed: "", init: "", prof: "", abilities: {}, passives: [], saves: [], skills: [], attacks: [], features: [], proficiencies: {}, languages: "", defenseNote: "", background: [], notiz: "", subtyp: "Standard" } }[art];
  const o = { ...basis, ...werte, status: "Idee", zusatz: {}, tags: [] };
  if (art === "Gegenstand") o.id = basis.id;
  ({ NPC: () => m.npcs.push(o), Gegenstand: () => { m.gegenstaende[o.id] = o; }, Ort: () => { m.orte[o.id] = o; }, Quest: () => m.quests.push(o), Regel: () => m.regeln.push(o), Encounter: () => m.encounters.push(o), Charakter: () => m.charaktere.push(o) })[art]();
  return o.id;
}
function QuickAdd({ model, upd, art, onCreated, kompakt }) {
  const [offen, setOffen] = useState(false);
  const [w, setW] = useState({});
  const keys = ((model.ansichten[art] || {})["Quick-Add"]) || [];
  const felder = alleFelder(model, art).filter((f) => keys.includes(f.key) && f.kern);
  if (!offen) return <button className="knopf" style={{ fontSize: 12 }} onClick={() => setOffen(true)}>+ {ART_LABEL[art]} (Quick-Add)</button>;
  const subOpt = art === "Gegenstand" ? Object.entries(GTYPEN) : art === "Regel" ? Object.keys(model.schemata.Regel.subtypen).map((k) => [k, k]) : Object.keys((model.schemata[art] || { subtypen: {} }).subtypen).map((k) => [k, k]);
  return (
    <div style={{ display: "grid", gap: 6, background: C.bg, borderRadius: 3, padding: 8, gridTemplateColumns: kompakt ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))" }}>
      {felder.map((f) => (
        <div key={f.key} className="feld" style={f.typ === "absatz" ? { gridColumn: "1 / -1" } : {}}>{f.label}
          {f.typ === "absatz" ? <textarea rows={2} value={w[f.key] || ""} onChange={(ev) => setW({ ...w, [f.key]: ev.target.value })} />
            : f.typ === "subtyp" ? <select value={w[f.key] || subOpt[0]?.[0] || ""} onChange={(ev) => setW({ ...w, [f.key]: ev.target.value })}>{subOpt.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            : <input type="text" value={w[f.key] || ""} onChange={(ev) => setW({ ...w, [f.key]: ev.target.value })} />}
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, gridColumn: "1 / -1" }}>
        <button className="knopf primaer" style={{ fontSize: 12 }} onClick={() => { let id; upd((m) => { id = neuerArtikel(m, art, w); }); setW({}); setOffen(false); onCreated && onCreated(id); }}>Anlegen (Idee)</button>
        <button className="knopf leise" style={{ fontSize: 12 }} onClick={() => setOffen(false)}>Abbrechen</button>
      </div>
    </div>
  );
}

/* editierbare Ansicht nach Schema: kern-Felder direkt, Schema-Felder in zusatz */
function AnsichtForm({ model, art, obj, ansicht, setzen, upd }) {
  const keys = ((model.ansichten[art] || {})[ansicht]) || [];
  const felder = alleFelder(model, art);
  const w = obj.zusatz || {};
  const setK = (f, v) => f.kern ? setzen(f.key, v) : setzen("zusatz", { ...w, [f.key]: v });
  const subOpt = art === "Gegenstand" ? Object.entries(GTYPEN) : Object.keys((model.schemata[art] || { subtypen: {} }).subtypen).map((k) => [k, k]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
      {keys.map((k) => { const f = felder.find((x) => x.key === k); if (!f) return null; const v = feldWert(obj, f);
        const breit = ["absatz", "schritte", "verweise", "liste", "tags"].includes(f.typ);
        return (
          <div key={k} className="feld" style={breit ? { gridColumn: "1 / -1" } : {}}>{f.label}
            {f.typ === "absatz" ? <textarea rows={3} value={v || ""} onChange={(ev) => setK(f, ev.target.value)} />
              : f.typ === "subtyp" ? <select value={v || ""} onChange={(ev) => setK(f, ev.target.value)}>{subOpt.map(([kk, l]) => <option key={kk} value={kk}>{l}</option>)}</select>
              : f.typ === "zahl" ? <input type="number" value={v ?? ""} onChange={(ev) => setK(f, ev.target.value)} />
              : f.typ === "liste" || f.typ === "tags" ? <TagFeld werte={Array.isArray(v) ? v : []} setzen={(l) => setK(f, l)} />
              : f.typ === "verweis:Statblock" ? <select value={v || ""} onChange={(ev) => setK(f, ev.target.value || null)}><option value="">—</option>{Object.values(model.monster).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              : f.typ === "verweis" ? <select value={v || ""} onChange={(ev) => setK(f, ev.target.value)}><option value="">—</option>{refOptionen(model, ART_KEY[f.ziel] || "npc").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              : f.typ === "verweise" ? <Chips label="" ids={v || []} optionen={refOptionen(model, ART_KEY[f.ziel] || "npc")} setzen={(l) => setK(f, l)} leer={"+ " + (f.ziel || "")} />
              : f.typ === "schritte" ? <span style={{ fontSize: 12 }}>{(v || []).map((x) => (x.erledigt ? "☑ " : "☐ ") + x.text).join(" · ") || "—"}</span>
              : f.typ === "bild" ? (v ? <img src={v} alt="" style={{ maxWidth: 96 }} /> : <span style={{ fontSize: 12, color: C.dim }}>kein Bild</span>)
              : <input type="text" value={v ?? ""} onChange={(ev) => setK(f, ev.target.value)} />}
          </div>
        ); })}
      {keys.length === 0 && <span style={{ fontSize: 12, color: C.dim }}>Diese Ansicht hat noch keine Felder (Kompendium → Ansichten).</span>}
    </div>
  );
}
function TagFeld({ werte, setzen, platzhalter }) {
  const [neu, setNeu] = useState("");
  const l = werte || [];
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      {l.map((t) => <span key={t} style={{ background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, padding: "1px 7px", fontSize: 11.5, display: "inline-flex", gap: 4 }}>{t}<button className="knopf leise" style={{ padding: "0 3px", fontSize: 10 }} onClick={() => setzen(l.filter((x) => x !== t))}>✕</button></span>)}
      <input type="text" value={neu} placeholder={platzhalter || "Tag + Enter"} style={{ width: 140 }} onChange={(ev) => setNeu(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter" && neu.trim()) { ev.preventDefault(); if (!l.includes(neu.trim())) setzen([...l, neu.trim()]); setNeu(""); } }} />
    </div>
  );
}
function AnsichtWechsler({ model, art, obj, setzen }) {
  const [an, setAn] = useState("");
  const namen = Object.keys(model.ansichten[art] || {});
  if (!namen.length) return null;
  return (
    <div className={an ? "ansicht-aktiv" : ""} style={{ display: "grid", gap: 8, fontSize: 12 }}>
      <label style={{ color: C.dim, display: "flex", gap: 4, alignItems: "center" }}>Ansicht<select value={an} onChange={(ev) => setAn(ev.target.value)}><option value="">Vollständig (Bearbeiten)</option>{namen.map((n) => <option key={n}>{n}</option>)}</select></label>
      {an && (setzen ? <AnsichtForm model={model} art={art} obj={obj} ansicht={an} setzen={setzen} /> : <div style={{ background: C.bg, borderRadius: 3, padding: 8 }}><AnsichtRender model={model} art={art} obj={obj} ansicht={an} /></div>)}
    </div>
  );
}

/* ── Status & Zusatzfelder (Schema) ── */
function StatusWahl({ obj, setzen }) {
  const akt = obj.status || "Ansatz";
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
      <span style={{ color: C.dim }}>Status</span>
      {STATUS_LISTE.map((st) => <button key={st} className="knopf" style={{ fontSize: 11.5, padding: "2px 9px", borderColor: STATUS_FARBE[st], background: akt === st ? STATUS_FARBE[st] : "transparent", color: akt === st ? "#101613" : C.kreide }} onClick={() => setzen(st)}>{st}</button>)}
    </div>
  );
}
const ART_KEY = { NPC: "npc", Quest: "quest", Statblock: "monster", Gegenstand: "gegenstand", Ort: "ort", Sitzung: "sitzung", Charakter: "charakter", Regel: "regel" };
function ZusatzFelder({ model, art, subtyp, werte, setzen, upd }) {
  const [neu, setNeu] = useState(null); // {label, typ, insSchema}
  const schemaFelder = ((model.schemata[art] || {}).subtypen || {})[subtyp] || [];
  const w = werte || {};
  const set = (k, v) => setzen({ ...w, [k]: v });
  const opts = (ziel) => refOptionen(model, ART_KEY[ziel] || "npc");
  const lokal = w.__felder || [];
  const sichtbar = [...schemaFelder, ...lokal].filter((f) => f.key in w);
  const ergaenzbar = schemaFelder.filter((f) => !(f.key in w));
  const render = (f) => (
    <div key={f.key} className="feld" style={f.typ === "absatz" || f.typ === "verweise" ? { gridColumn: "1 / -1" } : {}}>
      <span style={{ display: "flex", justifyContent: "space-between" }}>{f.label}<button className="knopf leise" style={{ padding: "0 4px", fontSize: 10 }} title="Feld entfernen" onClick={() => { const n = { ...w }; delete n[f.key]; if (lokal.some((x) => x.key === f.key)) n.__felder = lokal.filter((x) => x.key !== f.key); setzen(n); }}>✕</button></span>
      {f.typ === "absatz" ? <textarea rows={3} value={w[f.key] || ""} onChange={(ev) => set(f.key, ev.target.value)} />
        : f.typ === "zahl" ? <input type="number" value={w[f.key] ?? ""} onChange={(ev) => set(f.key, ev.target.value)} />
        : f.typ === "auswahl" ? <select value={w[f.key] || ""} onChange={(ev) => set(f.key, ev.target.value)}><option value="">—</option>{(f.optionen || []).map((o) => <option key={o}>{o}</option>)}</select>
        : f.typ === "verweis" ? <select value={w[f.key] || ""} onChange={(ev) => set(f.key, ev.target.value)}><option value="">—</option>{opts(f.ziel).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        : f.typ === "verweise" ? <Chips label="" ids={w[f.key] || []} optionen={opts(f.ziel)} setzen={(v) => set(f.key, v)} leer={"+ " + (f.ziel || "")} />
        : f.typ === "tags" ? <input type="text" defaultValue={(w[f.key] || []).join(", ")} key={f.key + (w[f.key] || []).length} onBlur={(ev) => set(f.key, ev.target.value.split(",").map((t) => t.trim()).filter(Boolean))} />
        : <input type="text" value={w[f.key] || ""} onChange={(ev) => set(f.key, ev.target.value)} />}
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 8, borderLeft: `3px solid ${C.lila}`, paddingLeft: 8 }}>
      {sichtbar.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>{sichtbar.map(render)}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <select value="" style={{ fontSize: 12 }} onChange={(ev) => { const v = ev.target.value; if (v === "__neu") setNeu({ label: "", typ: "text", insSchema: false }); else if (v) set(v, ergaenzbar.find((f) => f.key === v)?.typ === "tags" ? [] : ""); }}>
          <option value="">+ Feld ergänzen …</option>
          {ergaenzbar.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          <option value="__neu">Neues Feld …</option>
        </select>
        {neu && <>
          <input type="text" value={neu.label} placeholder="Feldname" style={{ width: 150 }} onChange={(ev) => setNeu({ ...neu, label: ev.target.value })} />
          <select value={neu.typ} onChange={(ev) => setNeu({ ...neu, typ: ev.target.value })}>{["text", "absatz", "zahl", "tags"].map((t) => <option key={t}>{t}</option>)}</select>
          {upd && <label style={{ fontSize: 11.5, display: "flex", gap: 4 }}><input type="checkbox" checked={neu.insSchema} onChange={(ev) => setNeu({ ...neu, insSchema: ev.target.checked })} />ins Schema ({subtyp})</label>}
          <button className="knopf primaer" style={{ fontSize: 12 }} onClick={() => { const key = neu.label.trim().toLowerCase().replace(/[^\wäöü]+/g, "_"); if (!key) return; const f = { key, label: neu.label.trim(), typ: neu.typ }; if (neu.insSchema && upd) upd((m) => { const sub = m.schemata[art].subtypen; if (!sub[subtyp]) sub[subtyp] = []; if (!sub[subtyp].some((x) => x.key === key)) sub[subtyp].push(f); }); setzen({ ...w, [key]: neu.typ === "tags" ? [] : "", __felder: neu.insSchema ? lokal : [...lokal, f] }); setNeu(null); }}>OK</button>
          <button className="knopf leise" style={{ fontSize: 12 }} onClick={() => setNeu(null)}>✕</button>
        </>}
      </div>
    </div>
  );
}

/* ── Gemeinsame Bausteine: Todos, Chips ── */
function Todos({ liste, setzen }) {
  const [neu, setNeu] = useState("");
  const l = liste || [];
  return (
    <div className="feld">Todos ({l.filter((t) => !t.erledigt).length} offen)
      <div style={{ display: "grid", gap: 3 }}>
        {l.map((t, i) => (
          <div key={t.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={!!t.erledigt} style={{ width: 16, flex: "0 0 16px" }} onChange={(ev) => setzen(l.map((x, j) => (j === i ? { ...x, erledigt: ev.target.checked } : x)))} />
            <input type="text" value={t.text} style={{ flex: "1 1 auto", minWidth: 0, textDecoration: t.erledigt ? "line-through" : "none", color: t.erledigt ? C.dim : C.kreide }} onChange={(ev) => setzen(l.map((x, j) => (j === i ? { ...x, text: ev.target.value } : x)))} />
            <button className="knopf leise" style={{ padding: "0 6px" }} onClick={() => setzen(l.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6 }}>
          <input type="text" value={neu} placeholder="Neues Todo …" style={{ flex: "1 1 auto", minWidth: 0 }} onChange={(ev) => setNeu(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === "Enter" && neu.trim()) { setzen([...l, { id: "td" + Date.now(), text: neu.trim(), erledigt: false }]); setNeu(""); } }} />
          <button className="knopf" onClick={() => { if (!neu.trim()) return; setzen([...l, { id: "td" + Date.now(), text: neu.trim(), erledigt: false }]); setNeu(""); }}>+</button>
        </div>
      </div>
    </div>
  );
}
function Chips({ label, ids, optionen, setzen, leer }) {
  return (
    <div className="feld">{label}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {(ids || []).map((id) => { const o = optionen.find((x) => x.id === id); return o && (
          <span key={id} style={{ background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, padding: "2px 8px", fontSize: 12, display: "inline-flex", gap: 6, alignItems: "center" }}>
            {o.name}<button className="knopf leise" style={{ padding: "0 4px", fontSize: 11 }} onClick={() => setzen(ids.filter((x) => x !== id))}>✕</button>
          </span>
        ); })}
        <select value="" onChange={(ev) => { const v = ev.target.value; if (v && !(ids || []).includes(v)) setzen([...(ids || []), v]); }}>
          <option value="">{leer || "+ hinzufügen …"}</option>
          {optionen.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
    </div>
  );
}
const Kasten = ({ titel, extra, children, farbe }) => (
  <div className="kasten" style={{ background: C.wand, border: `1px solid ${C.linie}`, borderLeft: farbe ? `3px solid ${farbe}` : undefined, borderRadius: 4, padding: 14, display: "grid", gap: 8 }}>
    {(titel || extra) && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{titel && <h3 className="serif" style={{ margin: 0, fontSize: 16, flex: 1 }}>{titel}</h3>}{extra}</div>}
    {children}
  </div>
);
const T = ({ l, v, setzen, rows }) => (
  <div className="feld">{l}{rows ? <textarea rows={rows} value={v || ""} onChange={(ev) => setzen(ev.target.value)} /> : <input type="text" value={v ?? ""} onChange={(ev) => setzen(ev.target.value)} />}</div>
);

/* ── Geschichte: Kampagne → Arc → Sitzung → Szene ── */
function GeschichteTab({ model, upd, springe }) {
  const [schnell, setSchnell] = useState({ npc: "", quest: "", statblock: "" });
  const sprung = useContext(SprungCtx);
  useEffect(() => { if (sprung?.tab === "geschichte" && sprung.id) { const x = model.sitzungen.find((y) => y.id === sprung.id); if (x) { setArcId(x.arcId); setSitzId(x.id); } else if (model.arcs.find((y) => y.id === sprung.id)) { setArcId(sprung.id); setSitzId(null); } } }, [sprung]);
  const [arcId, setArcId] = useState(model.arcs[0]?.id || null);
  const [sitzId, setSitzId] = useState(null);
  const arc = model.arcs.find((a) => a.id === arcId) || null;
  const sitz = model.sitzungen.find((x) => x.id === sitzId) || null;
  const kf = (k, v) => upd((m) => { m.kampagne[k] = v; });
  const af = (k, v) => upd((m) => { const a = m.arcs.find((x) => x.id === arcId); if (a) a[k] = v; });
  const sf = (k, v) => upd((m) => { const x = m.sitzungen.find((y) => y.id === sitzId); if (x) x[k] = v; });
  const szf = (i, k, v) => upd((m) => { const x = m.sitzungen.find((y) => y.id === sitzId); if (x) x.szenen[i][k] = v; });
  const npcOpt = (model.npcs || []).map((n) => ({ id: n.id, name: n.name }));
  const questOpt = (model.quests || []).map((q) => ({ id: q.id, name: q.titel }));
  const sitzungenArc = model.sitzungen.filter((x) => x.arcId === arcId).sort((a, b) => a.nummer - b.nummer);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Kasten titel={null} farbe={C.gold}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <T l="Kampagne" v={model.kampagne.name} setzen={(v) => kf("name", v)} />
          <T l="Beschreibung / Prämisse" v={model.kampagne.beschreibung} setzen={(v) => kf("beschreibung", v)} />
        </div>
        <Todos liste={model.kampagne.todos} setzen={(v) => kf("todos", v)} />
      </Kasten>
      <TodoUebersicht model={model} upd={upd} springe={springe} />
      <SeedsKasten model={model} upd={upd} />

      <Kasten titel={`Arcs (${model.arcs.length})`} extra={<button className="knopf primaer" onClick={() => { const id = "a" + Date.now(); upd((m) => m.arcs.push({ id, nummer: (Math.max(0, ...m.arcs.map((a) => a.nummer)) + 1), titel: "Neuer Arc", beschreibung: "", todos: [] })); setArcId(id); setSitzId(null); }}>+ Arc</button>}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[...model.arcs].sort((a, b) => a.nummer - b.nummer).map((a) => (
            <button key={a.id} className={"knopf " + (arcId === a.id ? "primaer" : "")} onClick={() => { setArcId(a.id); setSitzId(null); }}>Arc {a.nummer} · {a.titel}</button>
          ))}
        </div>
        {arc && (
          <div style={{ display: "grid", gap: 8, borderTop: `1px solid ${C.linie}`, paddingTop: 8 }}>
            <div style={{ fontSize: 12, color: C.dim }}>{model.kampagne.name} › <strong style={{ color: C.kreide }}>Arc {arc.nummer}</strong></div>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8 }}>
              <div className="feld">Nr.<input type="number" value={arc.nummer} onChange={(ev) => af("nummer", +ev.target.value)} /></div>
              <T l="Titel" v={arc.titel} setzen={(v) => af("titel", v)} />
            </div>
            <T l="Beschreibung" v={arc.beschreibung} setzen={(v) => af("beschreibung", v)} rows={2} />
            <Todos liste={arc.todos} setzen={(v) => af("todos", v)} />
            <div><button className="knopf gefahr" style={{ fontSize: 12 }} onClick={() => { if (!bestaetigen("Arc samt Sitzungen löschen?")) return; upd((m) => { m.arcs = m.arcs.filter((x) => x.id !== arcId); m.sitzungen = m.sitzungen.filter((x) => x.arcId !== arcId); }); setArcId(null); setSitzId(null); }}>Arc löschen</button></div>
          </div>
        )}
      </Kasten>

      {arc && (
        <Kasten titel={`Sitzungen in Arc ${arc.nummer} (${sitzungenArc.length})`} extra={<button className="knopf primaer" onClick={() => { const id = "s" + Date.now(); upd((m) => m.sitzungen.push({ id, arcId, nummer: (Math.max(0, ...m.sitzungen.map((x) => x.nummer)) + 1), titel: "Neue Sitzung", datum: "", idee: "", npcs: [], loot: "", quests: [], szenen: [], recap: "", todos: [] })); setSitzId(id); }}>+ Sitzung</button>}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {sitzungenArc.map((x) => (
              <button key={x.id} className={"knopf " + (sitzId === x.id ? "primaer" : "")} onClick={() => setSitzId(sitzId === x.id ? null : x.id)}>
                #{x.nummer} · {x.titel} {x.todos?.some((t) => !t.erledigt) && <span style={{ color: sitzId === x.id ? "#241a08" : C.amber }}>•</span>}
              </button>
            ))}
          </div>
          {sitz && (
            <div style={{ display: "grid", gap: 10, borderTop: `1px solid ${C.linie}`, paddingTop: 8 }}>
              <div style={{ fontSize: 12, color: C.dim }}>{model.kampagne.name} › Arc {arc.nummer} › <strong style={{ color: C.kreide }}>Sitzung {sitz.nummer}</strong></div>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 140px 1fr", gap: 8 }}>
                <div className="feld">Nr.<input type="number" value={sitz.nummer} onChange={(ev) => sf("nummer", +ev.target.value)} /></div>
                <T l="Titel" v={sitz.titel} setzen={(v) => sf("titel", v)} />
                <div className="feld">Datum<input type="date" value={sitz.datum || ""} onChange={(ev) => sf("datum", ev.target.value)} /></div>
                <div className="feld">Arc<select value={sitz.arcId} onChange={(ev) => { sf("arcId", ev.target.value); }}>{model.arcs.map((a) => <option key={a.id} value={a.id}>Arc {a.nummer} · {a.titel}</option>)}</select></div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
                {model.aktuelleSitzungId === sitz.id ? <span style={{ color: C.teal }}>● aktuelle Sitzung — Seeds und Knoten-Historie werden hier zugeordnet</span> : <button className="knopf" style={{ fontSize: 12 }} onClick={() => upd((m) => { m.aktuelleSitzungId = sitz.id; })}>als aktuelle Sitzung markieren</button>}
              </div>
              <T l="Idee — worum geht es, was soll passieren" v={sitz.idee} setzen={(v) => sf("idee", v)} rows={3} />
              <Chips label="Geschöpfe" ids={sitz.npcs} optionen={npcOpt} setzen={(v) => sf("npcs", v)} leer="+ Geschöpf …" />
              {(sitz.npcs || []).length > 0 && <div style={{ display: "grid", gap: 4 }}>
                {sitz.npcs.map((id) => { const n = model.npcs.find((x) => x.id === id); return n && (
                  <details key={id}><summary style={{ cursor: "pointer", fontSize: 12.5 }}>{n.name}{n.subtyp && n.subtyp !== "Standard" ? <span style={{ color: C.dim }}> · {n.subtyp}</span> : null} <button className="knopf leise" style={{ fontSize: 11, padding: "0 6px" }} onClick={(ev) => { ev.preventDefault(); springe("zonen", id); }}>öffnen →</button></summary>
                    <div style={{ padding: "4px 0 4px 12px" }}><AnsichtRender model={model} art="NPC" obj={n} ansicht="Kurz" /></div></details>); })}
              </div>}
              <QuickAdd model={model} upd={upd} art="NPC" kompakt onCreated={(id) => upd((m) => { m.sitzungen.find((y) => y.id === sitzId).npcs.push(id); })} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8, background: C.bg, borderRadius: 3, padding: 8 }}>
                {[["npc", "Neues Geschöpf", "npcs"], ["quest", "Neue Quest", "quests"], ["statblock", "Neuer Statblock", "monster"]].map(([k, l, zielTab]) => (
                  <div key={k} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="text" value={schnell[k]} placeholder={l + " (Name) …"} style={{ flex: 1 }} onChange={(ev) => setSchnell({ ...schnell, [k]: ev.target.value })} />
                    <button className="knopf" style={{ fontSize: 12, whiteSpace: "nowrap" }} onClick={() => {
                      const name = schnell[k].trim(); if (!name) return;
                      let id;
                      if (k === "npc") { id = "n" + Date.now(); upd((m) => { m.npcs.push({ id, name, statblockId: null, beschreibung: "", hauptbeziehung: "", standing: "", worte: [], interaktionen: [], beziehungen: [], todos: [] }); m.sitzungen.find((y) => y.id === sitzId).npcs.push(id); }); }
                      if (k === "quest") { id = "q" + Date.now(); upd((m) => { m.quests.push({ id, titel: name, kampagneId: m.kampagne.id, status: "offen", auftraggeberId: null, fraktion: "keine", beschreibung: "", schritte: [], belohnung: "", todos: [] }); m.sitzungen.find((y) => y.id === sitzId).quests.push(id); }); }
                      if (k === "statblock") { const mon = parseStatbloecke("---\ntyp: Statblock\nname: " + name + "\ncr: 1\nrolle: Soldier\n---\n")[0]; mon.subtitel = "Medium humanoid, neutral"; id = mon.id; upd((m) => { m.monster[id] = mon; }); }
                      setSchnell({ ...schnell, [k]: "" }); springe(zielTab === "npcs" ? "zonen" : zielTab, id);
                    }}>anlegen → öffnen</button>
                  </div>
                ))}
              </div>
              <T l="Loot (Notiz)" v={sitz.loot} setzen={(v) => sf("loot", v)} rows={1} />
              <LootBox model={model} upd={upd} obj={sitz} setzen={(k, v) => sf(k, v)} />
              <Chips label="Quests dieser Sitzung" ids={sitz.quests} optionen={questOpt} setzen={(v) => sf("quests", v)} leer="+ Quest …" />
              <SitzungQuests model={model} upd={upd} sitz={sitz} />
              <div className="feld">Szenen & Encounters ({sitz.szenen.length})
                <div style={{ display: "grid", gap: 8 }}>
                  {sitz.szenen.map((sz, i) => (
                    <div key={sz.id} style={{ borderLeft: `3px solid ${sz.erledigt ? C.teal : C.linie}`, paddingLeft: 8, display: "grid", gap: 4 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "30px 1fr 1fr 60px 30px", gap: 6, alignItems: "center" }}>
                        <span style={{ color: C.dim, fontSize: 12 }}>{i + 1}.</span>
                        <input type="text" value={sz.titel} placeholder="Szene" onChange={(ev) => szf(i, "titel", ev.target.value)} />
                        <select value={sz.encounterId || ""} onChange={(ev) => szf(i, "encounterId", ev.target.value || null)}>
                          <option value="">— kein Encounter —</option>
                          {model.encounters.map((e) => <option key={e.id} value={e.id}>{e.typ}: {e.t.slice(0, 50)}</option>)}
                        </select>
                        <label style={{ fontSize: 11, display: "flex", gap: 3, alignItems: "center" }}><input type="checkbox" checked={!!sz.erledigt} onChange={(ev) => szf(i, "erledigt", ev.target.checked)} />gespielt</label>
                        <button className="knopf leise" style={{ padding: "0 6px" }} onClick={() => upd((m) => { m.sitzungen.find((y) => y.id === sitzId).szenen.splice(i, 1); })}>✕</button>
                      </div>
                      <textarea rows={2} value={sz.text} placeholder="Ablauf, Hinweise, Entscheidungen …" onChange={(ev) => szf(i, "text", ev.target.value)} />
                      {sz.encounterId && (() => { const e = model.encounters.find((x) => x.id === sz.encounterId); return e && (e.monster || []).length > 0 && <div style={{ fontSize: 11.5, color: C.amber }}>Statblocks: {e.monster.map((mid) => model.monster[mid]?.name).filter(Boolean).join(", ")}</div>; })()}
                    </div>
                  ))}
                  <div><button className="knopf" style={{ fontSize: 12 }} onClick={() => upd((m) => m.sitzungen.find((y) => y.id === sitzId).szenen.push({ id: "sz" + Date.now(), titel: "", text: "", encounterId: null, erledigt: false }))}>+ Szene</button></div>
                </div>
              </div>
              {model.seeds.filter((x) => x.sitzungId === sitz.id).length > 0 && (
                <div className="feld">Seeds dieser Sitzung
                  {model.seeds.filter((x) => x.sitzungId === sitz.id).map((x) => <div key={x.id} style={{ fontSize: 12.5 }}><span style={{ color: C.gold }}>{x.kategorie}</span> — {x.text} <span style={{ color: C.dim }}>({x.status})</span></div>)}
                </div>
              )}
              <T l="Recap / Notizen (nach der Sitzung)" v={sitz.recap} setzen={(v) => sf("recap", v)} rows={4} />
              <Todos liste={sitz.todos} setzen={(v) => sf("todos", v)} />
              <div><button className="knopf gefahr" style={{ fontSize: 12 }} onClick={() => { if (!bestaetigen("Sitzung löschen?")) return; upd((m) => { m.sitzungen = m.sitzungen.filter((x) => x.id !== sitzId); }); setSitzId(null); }}>Sitzung löschen</button></div>
            </div>
          )}
        </Kasten>
      )}
    </div>
  );
}

function SitzungQuests({ model, upd, sitz }) {
  const [filter, setFilter] = useState("verknuepft"); // verknuepft | aktiv | alle
  const liste = model.quests.filter((q) => filter === "verknuepft" ? (sitz.quests || []).includes(q.id) : filter === "aktiv" ? ["aktiv", "offen"].includes(q.status) : true);
  if (!model.quests.length) return null;
  const qf = (id, k, v) => upd((m) => { const q = m.quests.find((x) => x.id === id); if (q) q[k] = v; });
  return (
    <div className="feld">
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>Quest-Stand
        {[["verknuepft", "verknüpft"], ["aktiv", "aktiv/offen"], ["alle", "alle"]].map(([k, l]) => <button key={k} className={"knopf " + (filter === k ? "an" : "leise")} style={{ fontSize: 11, padding: "1px 8px" }} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {liste.map((q) => {
          const offen = (q.schritte || []).filter((x) => !x.erledigt);
          return (
            <div key={q.id} style={{ borderLeft: `3px solid ${q.status === "aktiv" ? C.teal : q.status === "erledigt" ? C.dim : q.status === "gescheitert" ? C.rot : C.gold}`, paddingLeft: 8, fontSize: 12.5, display: "grid", gap: 3 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <strong style={{ flex: 1 }}>{q.titel}</strong>
                <select value={q.status} style={{ fontSize: 11, padding: "1px 4px" }} onChange={(ev) => qf(q.id, "status", ev.target.value)}>{Object.keys(QUEST_STATUS).map((k) => <option key={k}>{k}</option>)}</select>
                {!(sitz.quests || []).includes(q.id) && <button className="knopf leise" style={{ fontSize: 11, padding: "1px 6px" }} onClick={() => upd((m) => { m.sitzungen.find((x) => x.id === sitz.id).quests.push(q.id); })}>verknüpfen</button>}
              </div>
              {q.auftraggeberId && <span style={{ color: C.dim }}>Auftraggeber: {model.npcs.find((n) => n.id === q.auftraggeberId)?.name}</span>}
              {(q.schritte || []).map((st, i) => (
                <label key={i} style={{ display: "flex", gap: 6, alignItems: "center", color: st.erledigt ? C.dim : C.kreide }}>
                  <input type="checkbox" checked={!!st.erledigt} style={{ width: 16, flex: "0 0 16px" }} onChange={(ev) => qf(q.id, "schritte", q.schritte.map((x, j) => (j === i ? { ...x, erledigt: ev.target.checked } : x)))} />
                  <span style={{ textDecoration: st.erledigt ? "line-through" : "none" }}>{st.text}</span>
                </label>
              ))}
              {offen.length === 0 && (q.schritte || []).length > 0 && <span style={{ color: C.teal }}>alle Schritte erledigt</span>}
            </div>
          );
        })}
        {liste.length === 0 && <span style={{ color: C.dim, fontSize: 12 }}>Keine Quests für diesen Filter.</span>}
      </div>
    </div>
  );
}

/* ── Quests ── */
const QUEST_STATUS = { offen: "offen", aktiv: "aktiv", erledigt: "erledigt", gescheitert: "gescheitert" };
function QuestTab({ model, upd, sprung }) {
  const [qid, setQid] = useState(null);
  const gfQ = useContext(FilterCtx);
  useEffect(() => { if (sprung?.tab === "quests" && sprung.id) setQid(sprung.id); }, [sprung]);
  const q = model.quests.find((x) => x.id === qid) || null;
  const qf = (k, v) => upd((m) => { const x = m.quests.find((y) => y.id === qid); if (x) x[k] = v; });
  const sitzungenMit = (id) => model.sitzungen.filter((x) => (x.quests || []).includes(id));
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Kasten titel={`Quests der Kampagne «${model.kampagne.name}» (${model.quests.length})`} extra={<button className="knopf primaer" onClick={() => { const id = "q" + Date.now(); upd((m) => m.quests.push({ id, titel: "Neue Quest", kampagneId: m.kampagne.id, status: "offen", auftraggeberId: null, fraktion: "keine", beschreibung: "", schritte: [], belohnung: "", todos: [] })); setQid(id); }}>+ Quest</button>}>
        {Object.keys(QUEST_STATUS).map((st) => {
          const liste = model.quests.filter((x) => x.status === st && passtFilter(gfQ, x, x.titel));
          if (!liste.length) return null;
          return (
            <div key={st} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ width: 90, fontSize: 12, color: st === "aktiv" ? C.teal : st === "erledigt" ? C.dim : st === "gescheitert" ? C.rot : C.kreide }}>{st}</span>
              {liste.map((x) => <button key={x.id} className={"knopf " + (qid === x.id ? "primaer" : "")} onClick={() => setQid(qid === x.id ? null : x.id)}>{x.titel}{x.schritte?.length ? <span style={{ color: qid === x.id ? "#241a08" : C.dim }}> {x.schritte.filter((s2) => s2.erledigt).length}/{x.schritte.length}</span> : null}</button>)}
            </div>
          );
        })}
      </Kasten>
      {q && (
        <Kasten titel={null} farbe={C.gold}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 120px 1fr 1fr", gap: 8 }}>
            <T l="Titel" v={q.titel} setzen={(v) => qf("titel", v)} />
            <div className="feld">Status<select value={q.status} onChange={(ev) => qf("status", ev.target.value)}>{Object.keys(QUEST_STATUS).map((k) => <option key={k}>{k}</option>)}</select></div>
            <div className="feld">Auftraggeber (Geschöpf)<select value={q.auftraggeberId || ""} onChange={(ev) => qf("auftraggeberId", ev.target.value || null)}><option value="">—</option>{model.npcs.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
            <div className="feld">Fraktion<select value={q.fraktion || "keine"} onChange={(ev) => qf("fraktion", ev.target.value)}>{frakNamen(model).map((f) => <option key={f}>{f}</option>)}</select></div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <AnsichtWechsler model={model} art="Quest" obj={q} setzen={qf} />
            <StatusWahl obj={{ status: q.status2 }} setzen={(v) => qf("status2", v)} />
            <select value={q.subtyp || "Haupt"} onChange={(ev) => qf("subtyp", ev.target.value)}>{Object.keys(model.schemata.Quest.subtypen).map((k) => <option key={k}>{k}</option>)}</select>
          </div>
          <T l="Beschreibung" v={q.beschreibung} setzen={(v) => qf("beschreibung", v)} rows={3} />
          <InfoZuArtikel model={model} upd={upd} art="Quest" id={q.id} />
          <ZusatzFelder upd={upd} model={model} art="Quest" subtyp={q.subtyp || "Haupt"} werte={q.zusatz} setzen={(z) => qf("zusatz", z)} />
          <div className="feld">Schritte / Ziele
            <div style={{ display: "grid", gap: 3 }}>
              {(q.schritte || []).map((st, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={!!st.erledigt} onChange={(ev) => qf("schritte", q.schritte.map((x, j) => (j === i ? { ...x, erledigt: ev.target.checked } : x)))} />
                  <input type="text" value={st.text} style={{ flex: 1 }} onChange={(ev) => qf("schritte", q.schritte.map((x, j) => (j === i ? { ...x, text: ev.target.value } : x)))} />
                  <button className="knopf leise" style={{ padding: "0 6px" }} onClick={() => qf("schritte", q.schritte.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <div><button className="knopf" style={{ fontSize: 12 }} onClick={() => qf("schritte", [...(q.schritte || []), { text: "", erledigt: false }])}>+ Schritt</button></div>
            </div>
          </div>
          <T l="Belohnung" v={q.belohnung} setzen={(v) => qf("belohnung", v)} />
          <div style={{ fontSize: 12, color: C.dim }}>In Sitzungen: {sitzungenMit(q.id).map((x) => `#${x.nummer} ${x.titel}`).join(", ") || "—"}</div>
          <Todos liste={q.todos} setzen={(v) => qf("todos", v)} />
          <div><button className="knopf gefahr" style={{ fontSize: 12 }} onClick={() => { if (!bestaetigen("Quest löschen?")) return; upd((m) => { m.quests = m.quests.filter((x) => x.id !== qid); m.sitzungen.forEach((x) => { x.quests = (x.quests || []).filter((y) => y !== qid); }); }); setQid(null); }}>Quest löschen</button></div>
        </Kasten>
      )}
    </div>
  );
}

/* ── NPCs & Beziehungen ── */
const ROLLEN = ["Anführer", "Mitglied", "Kontakt", "Freund", "Verbündeter", "Rivale", "Feind", "Familie", "Geliebte/r", "Untergebene/r", "Schuldner", "Gläubiger"];
function NpcTab({ model, upd, sprung }) {
  const [nid, setNid] = useState(null);
  const gfN = useContext(FilterCtx);
  useEffect(() => { if ((sprung?.tab === "npcs" || sprung?.tab === "zonen") && sprung.id && model.npcs.some((x) => x.id === sprung.id)) setNid(sprung.id); }, [sprung]);
  const [neuText, setNeuText] = useState("");
  const [neuSitz, setNeuSitz] = useState("");
  const [neuWort, setNeuWort] = useState("");
  const n = model.npcs.find((x) => x.id === nid) || null;
  // Gegenseitigkeit: NPC↔NPC-Beziehungen werden gespiegelt (gleiche paarId), Änderungen/Löschungen synchron
  const INVERS = { "Anführer": "Untergebene/r", "Untergebene/r": "Anführer", "Gläubiger": "Schuldner", "Schuldner": "Gläubiger", "Mentor": "Schüler", "Schüler": "Mentor" };
  const bezSetzen = (liste) => upd((m) => {
    const ich = m.npcs.find((y) => y.id === nid); if (!ich) return;
    const alt = ich.beziehungen || [];
    ich.beziehungen = liste;
    // gelöschte Paare beim Gegenüber entfernen
    alt.forEach((b) => { if (!liste.find((x) => x.paarId === b.paarId) && b.zielTyp === "npc" && b.zielId) { const o = m.npcs.find((y) => y.id === b.zielId); if (o) o.beziehungen = (o.beziehungen || []).filter((x) => x.paarId !== b.paarId); } });
    // bestehende/neue Paare spiegeln
    liste.forEach((b) => {
      if (b.zielTyp !== "npc" || !b.zielId) return;
      const o = m.npcs.find((y) => y.id === b.zielId); if (!o) return;
      o.beziehungen = o.beziehungen || [];
      let g = o.beziehungen.find((x) => x.paarId === b.paarId);
      const rolle = INVERS[b.rolle] || b.rolle;
      if (!g) o.beziehungen.push({ id: "bz" + Date.now() + Math.floor(Math.random() * 99), paarId: b.paarId, zielTyp: "npc", zielId: nid, rolle, text: b.text || "" });
      else { g.rolle = rolle; g.text = b.text || ""; }
    });
  });
  const nf = (k, v) => upd((m) => { const x = m.npcs.find((y) => y.id === nid); if (x) x[k] = v; });
  const bezZiel = (b) => b.zielTyp === "npc" ? model.npcs.find((x) => x.id === b.zielId)?.name : b.zielTyp === "fraktion" ? model.fraktionen.find((f) => f.id === b.zielId)?.name : "die Gruppe";
  const inSitzungen = n ? model.sitzungen.filter((x) => (x.npcs || []).includes(n.id)) : [];
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Kasten titel={<span>Geschöpfe ({model.npcs.length}) <span style={{ fontSize: 11, color: C.dim }}>● unbekannt · <span style={{ color: C.amber }}>●</span> verdeckt (Tarnname) · <span style={{ color: C.teal }}>●</span> aufgedeckt</span></span>} extra={<button className="knopf primaer" onClick={() => { const id = "n" + Date.now(); upd((m) => m.npcs.push({ id, name: "Neues Geschöpf", statblockId: null, beschreibung: "", hauptbeziehung: "", standing: "", worte: [], interaktionen: [], beziehungen: [], todos: [] })); setNid(id); }}>+ Geschöpf</button>}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[...model.npcs].filter((x) => passtFilter(gfN, x)).sort((a, b) => a.name.localeCompare(b.name)).map((x) => (
            <button key={x.id} className={"knopf " + (nid === x.id ? "primaer" : "")} onClick={() => setNid(nid === x.id ? null : x.id)}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: SICHT_FARBE[sichtStatus(model, "NPC", x.id)], marginRight: 6 }} title={sichtStatus(model, "NPC", x.id)} />{x.name}{x.hauptbeziehung && <span style={{ color: nid === x.id ? "#241a08" : C.dim }}> · {x.hauptbeziehung}</span>}
            </button>
          ))}
        </div>
      </Kasten>
      {n && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, alignItems: "start" }}>
          <Kasten titel="Person" farbe={C.teal}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <T l="Name" v={n.name} setzen={(v) => nf("name", v)} />
              <div className="feld">Statblock<select value={n.statblockId || ""} onChange={(ev) => nf("statblockId", ev.target.value || null)}><option value="">—</option>{Object.values(model.monster).sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.id} value={m.id}>{m.name} (CR {m.cr})</option>)}</select></div>
            </div>
            <AnsichtWechsler model={model} art="NPC" obj={n} setzen={nf} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <StatusWahl obj={n} setzen={(v) => nf("status", v)} />
              <label style={{ fontSize: 12, color: C.dim, display: "flex", gap: 6, alignItems: "center" }}>Geschöpfstyp<select value={n.subtyp || "Standard"} onChange={(ev) => nf("subtyp", ev.target.value)}>{Object.keys(model.schemata.NPC.subtypen).map((k) => <option key={k}>{k}</option>)}</select></label>
            </div>
            <T l="Verdeckter Name (solange die Identität unbekannt ist)" v={n.tarnname} setzen={(v) => nf("tarnname", v)} />
            <T l="Beschreibung — Aussehen, Wesen, Motiv, Stimme" v={n.beschreibung} setzen={(v) => nf("beschreibung", v)} rows={4} />
            <InfoZuArtikel model={model} upd={upd} art="NPC" id={n.id} />
            <ZusatzFelder upd={upd} model={model} art="NPC" subtyp={n.subtyp || "Standard"} werte={n.zusatz} setzen={(z) => nf("zusatz", z)} />
            {n.statblockId && model.monster[n.statblockId] && <details><summary style={{ cursor: "pointer", color: C.amber, fontSize: 12.5 }}>Statblock anzeigen</summary><div style={{ marginTop: 6 }}><Statblock m={model.monster[n.statblockId]} model={model} /></div></details>}
            <div style={{ fontSize: 12, color: C.dim }}>In Sitzungen: {inSitzungen.map((x) => `#${x.nummer} ${x.titel}`).join(", ") || "—"} · Auftraggeber von: {model.quests.filter((q) => q.auftraggeberId === n.id).map((q) => q.titel).join(", ") || "—"}</div>
            <Todos liste={n.todos} setzen={(v) => nf("todos", v)} />
            <div><button className="knopf gefahr" style={{ fontSize: 12 }} onClick={() => { if (!bestaetigen(n.name + " löschen?")) return; upd((m) => { m.npcs = m.npcs.filter((x) => x.id !== nid); m.npcs.forEach((x) => { x.beziehungen = (x.beziehungen || []).filter((b) => !(b.zielTyp === "npc" && b.zielId === nid)); }); m.sitzungen.forEach((x) => { x.npcs = (x.npcs || []).filter((y) => y !== nid); }); m.quests.forEach((q) => { if (q.auftraggeberId === nid) q.auftraggeberId = null; }); }); setNid(null); }}>NPC löschen</button></div>
          </Kasten>

          <Kasten titel="Verhältnis zur Gruppe" farbe={C.gold}>
            <T l="Hauptbeziehung (ein Wort — Verbündeter, Feind, Schuldner …)" v={n.hauptbeziehung} setzen={(v) => nf("hauptbeziehung", v)} />
            <div className="feld">Einzelne Beschreibungen (Tags — misstrauisch, dankbar, schuldet Geld …)
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                {(n.worte || []).map((w) => <span key={w} style={{ background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, padding: "1px 7px", fontSize: 11.5, display: "inline-flex", gap: 4 }}>{w}<button className="knopf leise" style={{ padding: "0 3px", fontSize: 10 }} onClick={() => nf("worte", n.worte.filter((x) => x !== w))}>✕</button></span>)}
                <input type="text" value={neuWort} placeholder="Tag + Enter" style={{ width: 150 }} onChange={(ev) => setNeuWort(ev.target.value)}
                  onKeyDown={(ev) => { if (ev.key === "Enter" && neuWort.trim()) { nf("worte", [...(n.worte || []), neuWort.trim()]); setNeuWort(""); } }} />
              </div>
            </div>
            <div className="feld">Interaktionen ({(n.interaktionen || []).length})
              <div style={{ display: "grid", gap: 4 }}>
                {[...(n.interaktionen || [])].reverse().map((it) => (
                  <div key={it.id} style={{ display: "flex", gap: 6, fontSize: 12.5, alignItems: "flex-start" }}>
                    <span style={{ color: C.dim, minWidth: 48 }}>{it.sitzungId ? "#" + (model.sitzungen.find((x) => x.id === it.sitzungId)?.nummer ?? "?") : "—"}</span>
                    <span style={{ flex: 1 }}>{it.text}</span>
                    <button className="knopf leise" style={{ padding: "0 6px" }} onClick={() => nf("interaktionen", n.interaktionen.filter((x) => x.id !== it.id))}>✕</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6 }}>
                  <select value={neuSitz} onChange={(ev) => setNeuSitz(ev.target.value)} style={{ width: 120 }}><option value="">Sitzung</option>{[...model.sitzungen].sort((a, b) => b.nummer - a.nummer).map((x) => <option key={x.id} value={x.id}>#{x.nummer}</option>)}</select>
                  <input type="text" value={neuText} placeholder="Was ist passiert, wie hat er/sie reagiert …" style={{ flex: 1 }} onChange={(ev) => setNeuText(ev.target.value)} />
                  <button className="knopf" onClick={() => { if (!neuText.trim()) return; nf("interaktionen", [...(n.interaktionen || []), { id: "i" + Date.now(), sitzungId: neuSitz || null, text: neuText.trim() }]); setNeuText(""); }}>+</button>
                </div>
              </div>
            </div>
          </Kasten>

          <Kasten titel="Beziehungen zu NPCs & Fraktionen" farbe={C.lila}>
            <div style={{ display: "grid", gap: 6 }}>
              {(n.beziehungen || []).map((b, i) => (
                <div key={b.id} style={{ display: "grid", gridTemplateColumns: "95px 1fr 130px 1fr 30px", gap: 6, alignItems: "center" }}>
                  <select value={b.zielTyp} onChange={(ev) => bezSetzen(n.beziehungen.map((x, j) => (j === i ? { ...x, zielTyp: ev.target.value, zielId: null } : x)))}><option value="npc">Geschöpf</option><option value="fraktion">Fraktion</option><option value="gruppe">Gruppe</option></select>
                  {b.zielTyp === "gruppe" ? <span style={{ color: C.dim, fontSize: 12 }}>die Gruppe</span> : (
                    <select value={b.zielId || ""} onChange={(ev) => bezSetzen(n.beziehungen.map((x, j) => (j === i ? { ...x, zielId: ev.target.value || null } : x)))}>
                      <option value="">— wählen —</option>
                      {b.zielTyp === "npc" ? model.npcs.filter((x) => x.id !== n.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>) : model.fraktionen.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  )}
                  <input type="text" list={"rollen" + n.id} value={b.rolle} placeholder="Rolle" onChange={(ev) => bezSetzen(n.beziehungen.map((x, j) => (j === i ? { ...x, rolle: ev.target.value } : x)))} />
                  <input type="text" value={b.text || ""} placeholder="Beschreibung" onChange={(ev) => bezSetzen(n.beziehungen.map((x, j) => (j === i ? { ...x, text: ev.target.value } : x)))} />
                  <button className="knopf leise" style={{ padding: "0 6px" }} onClick={() => bezSetzen(n.beziehungen.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <datalist id={"rollen" + n.id}>{ROLLEN.map((r) => <option key={r} value={r} />)}</datalist>
              <div><button className="knopf" style={{ fontSize: 12 }} onClick={() => bezSetzen([...(n.beziehungen || []), { id: "bz" + Date.now(), paarId: "p" + Date.now(), zielTyp: "fraktion", zielId: null, rolle: "Mitglied", text: "" }])}>+ Beziehung</button></div>
            </div>
            <p style={{ color: C.dim, fontSize: 11.5, margin: 0 }}>NPC↔NPC-Beziehungen werden automatisch gespiegelt (Anführer↔Untergebene/r, Gläubiger↔Schuldner, sonst gleiche Rolle) und beim Gegenüber angezeigt.</p>
            <div style={{ fontSize: 12.5, color: C.dim }}>{(n.beziehungen || []).filter((b) => b.zielId || b.zielTyp === "gruppe").map((b) => `${b.rolle} von ${bezZiel(b)}`).join(" · ")}</div>
          </Kasten>
        </div>
      )}
    </div>
  );
}


/* ── Orte-Tab ── */
function OrteTab({ model, upd, platzieren, sprung }) {
  const [oid, setOid] = useState(null);
  useEffect(() => { if (sprung?.tab === "orte" && sprung.id) setOid(sprung.id); }, [sprung]);
  const [neuTag, setNeuTag] = useState("");
  const o = oid ? model.orte[oid] : null;
  const of = (k, v) => upd((m) => { m.orte[oid][k] = v; if (k === "beschreibung") m.orte[oid].b = v; });
  const gfO = useContext(FilterCtx);
  const liste = Object.values(model.orte).filter((x) => passtFilter(gfO, x)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Kasten titel={`Orte (${liste.length}) — ${liste.filter((x) => x.platziert !== false && x.x != null).length} auf der Karte`} extra={<button className="knopf primaer" onClick={() => { const id = "o" + Date.now().toString(36); upd((m) => { m.orte[id] = { id, name: "Neuer Ort", x: null, y: null, f: "keine", sichtbar: false, b: "", beschreibung: "", distrikt: "", tags: [], platziert: false }; }); setOid(id); }}>+ Ort</button>}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {liste.map((x) => (
            <button key={x.id} className={"knopf " + (oid === x.id ? "primaer" : "")} onClick={() => setOid(oid === x.id ? null : x.id)}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: SICHT_FARBE[sichtStatus(model, "Ort", x.id)], marginRight: 6 }} />{x.name}<span style={{ color: oid === x.id ? "#241a08" : C.dim }}>{x.platziert === false || x.x == null ? " · ohne Karte" : ""}{x.f !== "keine" ? " · " + x.f : ""}</span>
            </button>
          ))}
        </div>
      </Kasten>
      {o && (
        <Kasten titel={null} farbe={o.f === "keine" ? "#b9c4bc" : frakFarbe(model, o.f)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
            <T l="Name" v={o.name} setzen={(v) => of("name", v)} />
            <div className="feld">Fraktion<select value={o.f} onChange={(ev) => of("f", ev.target.value)}>{frakNamen(model).map((f) => <option key={f}>{f}</option>)}</select></div>
            <div className="feld">Distrikt<select value={o.distrikt || ""} onChange={(ev) => of("distrikt", ev.target.value)}><option value="">—</option>{Object.keys(model.distrikte).map((d) => <option key={d}>{d}</option>)}</select></div>
            <label style={{ display: "flex", gap: 6, alignItems: "end", fontSize: 12.5, paddingBottom: 6 }}><input type="checkbox" checked={!!o.sichtbar} onChange={(ev) => of("sichtbar", ev.target.checked)} />für Spieler sichtbar</label>
          </div>
          <AnsichtWechsler model={model} art="Ort" obj={o} setzen={of} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <StatusWahl obj={o} setzen={(v) => of("status", v)} />
            <select value={o.subtyp || "Standard"} onChange={(ev) => of("subtyp", ev.target.value)}>{Object.keys(model.schemata.Ort.subtypen).map((k) => <option key={k}>{k}</option>)}</select>
          </div>
          <T l="Verdeckter Name" v={o.tarnname} setzen={(v) => of("tarnname", v)} />
          <T l="Beschreibung / Nachschlagen" v={o.beschreibung ?? o.b} setzen={(v) => of("beschreibung", v)} rows={4} />
          <InfoZuArtikel model={model} upd={upd} art="Ort" id={o.id} />
          <ZusatzFelder upd={upd} model={model} art="Ort" subtyp={o.subtyp || "Standard"} werte={o.zusatz} setzen={(z) => of("zusatz", z)} />
          <div className="feld">Tags
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
              {(o.tags || []).map((t) => <span key={t} style={{ background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, padding: "1px 7px", fontSize: 11.5, display: "inline-flex", gap: 4 }}>{t}<button className="knopf leise" style={{ padding: "0 3px", fontSize: 10 }} onClick={() => of("tags", o.tags.filter((x) => x !== t))}>✕</button></span>)}
              <input type="text" value={neuTag} placeholder="Tag + Enter" style={{ width: 140 }} onChange={(ev) => setNeuTag(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter" && neuTag.trim()) { of("tags", [...(o.tags || []), neuTag.trim()]); setNeuTag(""); } }} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.dim }}>{o.platziert !== false && o.x != null ? `Auf der Karte bei (${o.x}, ${o.y})` : "Noch nicht auf der Karte."}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="knopf primaer" onClick={() => platzieren(o.id)}>{o.platziert !== false && o.x != null ? "Auf der Karte neu platzieren" : "Auf der Karte platzieren"}</button>
            {o.platziert !== false && o.x != null && <button className="knopf" onClick={() => of("platziert", false)}>Von der Karte nehmen</button>}
            <button className="knopf gefahr" onClick={() => { if (!bestaetigen(o.name + " löschen?")) return; upd((m) => { delete m.orte[oid]; }); setOid(null); }}>Löschen</button>
          </div>
        </Kasten>
      )}
    </div>
  );
}

/* ── Regeln (Conditions & wiederverwendbare Regeln) ── */
function RegelnTab({ model, upd, sprung }) {
  const [rid, setRid] = useState(null);
  const gfR = useContext(FilterCtx);
  useEffect(() => { if (sprung?.tab === "regeln" && sprung.id) setRid(sprung.id); }, [sprung]);
  const r = model.regeln.find((x) => x.id === rid) || null;
  const rf = (k, v) => upd((m) => { const x = m.regeln.find((y) => y.id === rid); if (x) x[k] = v; });
  const verwendung = (regel) => {
    const sb = Object.values(model.monster).filter((mon) => regelnIn([mon.condImmun, mon.schwaechen, ...SEKTIONEN.flatMap(([k]) => (mon[k] || []).map((e) => e.n + " " + e.t))].join(" "), { regeln: [regel] }).length);
    const gg = Object.values(model.gegenstaende).filter((g) => regelnIn(g.beschreibung + " " + (g.waffe?.eigenschaften || []).join(" "), { regeln: [regel] }).length);
    return { sb, gg };
  };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Kasten titel={`Regeln, Conditions, Traits, Zauber … (${model.regeln.length})`} extra={<button className="knopf primaer" onClick={() => { const id = "r" + Date.now(); upd((m) => m.regeln.push({ id, name: "Neue Regel", art: "Regel", text: "", vars: {}, tags: [], status: "Idee", zusatz: {} })); setRid(id); }}>+ Regel</button>}>
        <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>Wiederverwendung ohne Markup: Taucht der Name einer Regel im Text eines Statblocks oder Gegenstands auf, wird sie dort automatisch ausklappbar angezeigt.</p>
        {Object.keys(model.schemata.Regel.subtypen).map((art) => {
          const l = model.regeln.filter((x) => x.art === art && passtFilter(gfR, x)).sort((a, b) => a.name.localeCompare(b.name));
          if (!l.length) return null;
          return (
            <div key={art} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ width: 110, fontSize: 12, color: C.dim }}>{art}</span>
              {l.map((x) => <button key={x.id} className={"knopf " + (rid === x.id ? "primaer" : "")} onClick={() => setRid(rid === x.id ? null : x.id)}>{x.name}</button>)}
            </div>
          );
        })}
      </Kasten>
      {r && (() => { const v = verwendung(r); return (
        <Kasten titel={null} farbe={C.lila}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 8 }}>
            <T l="Name" v={r.name} setzen={(v2) => rf("name", v2)} />
            <div className="feld">Typ<select value={r.art} onChange={(ev) => rf("art", ev.target.value)}>{Object.keys(model.schemata.Regel.subtypen).map((k) => <option key={k}>{k}</option>)}</select></div>
          </div>
          <AnsichtWechsler model={model} art="Regel" obj={r} setzen={rf} />
          <StatusWahl obj={r} setzen={(v2) => rf("status", v2)} />
          <InfoZuArtikel model={model} upd={upd} art="Regel" id={r.id} />
          <div className="feld">Tags<TagFeld werte={r.tags} setzen={(v2) => rf("tags", v2)} /></div>
          <T l="Text (Variablen als {AB}, {DC} …)" v={r.text} setzen={(v2) => rf("text", v2)} rows={4} />
          <ZusatzFelder upd={upd} model={model} art="Regel" subtyp={r.art} werte={r.zusatz} setzen={(z) => rf("zusatz", z)} />
          <div style={{ fontSize: 12, color: C.dim }}>Verwendet in Statblocks: {v.sb.map((x) => x.name).join(", ") || "—"} · Gegenständen: {v.gg.map((x) => x.name).join(", ") || "—"}</div>
          <div><button className="knopf gefahr" style={{ fontSize: 12 }} onClick={() => { if (!bestaetigen(r.name + " löschen?")) return; upd((m) => { m.regeln = m.regeln.filter((x) => x.id !== rid); }); setRid(null); }}>Löschen</button></div>
        </Kasten>
      ); })()}
    </div>
  );
}

/* ── Gegenstände: Typen, Waffeneigenschaften, Rezepte, Import/Export ── */
const GTYPEN_BASIS = { waffe: "Waffe", ruestung: "Rüstung", material: "Material", verbrauchsgut: "Verbrauchsgut", werkzeug: "Werkzeug", wundersam: "Wundersamer Gegenstand", sonstiges: "Sonstiges" };
let GTYPEN = { ...GTYPEN_BASIS };
const gtypenAus = (model) => { const o = {}; Object.keys((model.schemata?.Gegenstand || {}).subtypen || {}).forEach((k) => { o[k] = GTYPEN_BASIS[k] || ((model.schemata.Gegenstand.info || {})[k] || {}).label || k; }); GTYPEN = o; return o; };
const RARITAET = ["gewöhnlich", "ungewöhnlich", "selten", "sehr selten", "legendär", "artefakt"];
function parseFrontmatter(text) {
  const m = text.match(/^---[^\S\n]*\n([\s\S]*?)\n---[^\S\n]*\n?/);
  if (!m) return { meta: {}, listen: {}, body: text };
  const meta = {}, listen = {}; let key = null;
  m[1].split(/\n/).forEach((z) => {
    const li = z.match(/^\s+-\s*(.*)$/);
    if (li && key) { (listen[key] = listen[key] || []).push(li[1].trim().replace(/^"|"$/g, "")); return; }
    const kv = z.match(/^([\wäöüÄÖÜ]+):\s*(.*)$/);
    if (kv) { key = kv[1].toLowerCase(); meta[key] = kv[2].replace(/^"|"$/g, "").trim(); }
  });
  return { meta, listen, body: text.slice(m[0].length) };
}
const neuerGegenstand = (name) => ({ id: "g" + Date.now().toString(36) + Math.floor(Math.random() * 999), name: name || "Neuer Gegenstand", gtyp: "sonstiges", raritaet: "gewöhnlich", formfaktor: ["X"], stapel: "1", kupfer: "", kaufraritaet: "", bild: "", beschreibung: "", aliases: [], tags: [], waffe: { schaden: "", schadenstyp: "", reichweite: "", eigenschaften: [] }, ruestung: { rk: "", staerke: "", heimlichkeit: "" }, material: { materialtyp: "", berufe: "" }, verbrauchsgut: { wirkung: "" } });
function parseGegenstandMd(text, dateiname) {
  const { meta, listen, body } = parseFrontmatter(text);
  if ((meta.typ || "").toLowerCase() !== "gegenstand") return null;
  const g = neuerGegenstand(meta.name || (dateiname ? dateiname.replace(/\.md$/i, "") : (listen.aliases || [])[0] || "Unbenannt"));
  const gt = (meta.gegenstandstyp || "sonstiges").toLowerCase().replace("rüstung", "ruestung");
  g.gtyp = GTYPEN[gt] ? gt : "sonstiges";
  g.raritaet = meta["rarität"] || meta.raritaet || "gewöhnlich";
  g.formfaktor = (listen.formfaktor && listen.formfaktor.length) ? listen.formfaktor : (meta.formfaktor ? meta.formfaktor.split(/[,\s]+/).filter(Boolean) : ["X"]);
  g.stapel = meta["stapelgrösse"] || meta.stapelgroesse || "1"; g.kupfer = meta.kupferpreis || ""; g.kaufraritaet = meta["kaufrarität"] || meta.kaufraritaet || "";
  g.aliases = listen.aliases || (meta.aliases ? [meta.aliases] : []); g.tags = (listen.tags || []).filter((t) => !["gegenstand", "waffe", "material"].includes(t));
  g.bild = meta.bild || "";
  g.waffe = { schaden: meta.schaden || "", schadenstyp: meta.schadenstyp || "", reichweite: meta.reichweite || "", eigenschaften: listen.eigenschaften || (meta.eigenschaften ? meta.eigenschaften.split(/,\s*/).filter(Boolean) : []) };
  g.material = { materialtyp: meta.materialtyp || "", berufe: (listen.berufe || []).join(", ") || meta.berufe || "" };
  g.ruestung = { rk: meta.rk || meta.rüstungsklasse || "", staerke: meta["stärke"] || "", heimlichkeit: meta.heimlichkeit || "" };
  g.verbrauchsgut = { wirkung: meta.wirkung || "" };
  g.beschreibung = body.replace(/# Inventar[\s\S]*?```dataviewjs[\s\S]*?```/m, "").trim();
  return g;
}
function gegenstandZuMd(g) {
  const z = ["---", "typ: Gegenstand", `Gegenstandstyp: ${g.gtyp === "ruestung" ? "rüstung" : g.gtyp}`, `Rarität: ${g.raritaet}`, "tags:", "  - gegenstand", `  - ${g.gtyp === "ruestung" ? "rüstung" : g.gtyp}`, ...(g.tags || []).map((t) => "  - " + t), "Formfaktor:", ...(g.formfaktor || []).map((r) => "  - " + r), `Stapelgrösse: ${g.stapel}`, "aliases:", ...(g.aliases || []).map((a) => "  - " + a), `Kupferpreis: ${g.kupfer}`, `Kaufrarität: ${g.kaufraritaet}`];
  if (g.bild && !g.bild.startsWith("data:")) z.push(`bild: ${g.bild}`);
  if (g.gtyp === "waffe") z.push(`Schaden: ${g.waffe.schaden}`, `Schadenstyp: ${g.waffe.schadenstyp}`, `Reichweite: ${g.waffe.reichweite}`, "Eigenschaften:", ...(g.waffe.eigenschaften || []).map((e) => "  - " + e));
  if (g.gtyp === "material") z.push(`Materialtyp: ${g.material.materialtyp}`, "Berufe:", ...(g.material.berufe || "").split(/,\s*/).filter(Boolean).map((b) => "  - " + b));
  if (g.gtyp === "ruestung") z.push(`RK: ${g.ruestung.rk}`, `Stärke: ${g.ruestung.staerke}`, `Heimlichkeit: ${g.ruestung.heimlichkeit}`);
  if (g.gtyp === "verbrauchsgut") z.push(`Wirkung: ${g.verbrauchsgut.wirkung}`);
  z.push("---", "", "# Inventar", "```dataviewjs", "const lines = dv.current().formfaktor ?? [];", "const rows = lines.map(line => [...line]);", "", 'dv.el("div", "", { cls: "formfaktor-table" });', "dv.table(['**Stapelgrösse:** ' + dv.current().stapelgrösse], rows);", "", "```", "", g.beschreibung || "");
  return z.join("\n");
}
function parseRezeptMd(text, dateiname) {
  const { meta, listen, body } = parseFrontmatter(text);
  if ((meta.typ || "").toLowerCase() !== "rezept") return null;
  const r = { id: "rz" + Date.now().toString(36) + Math.floor(Math.random() * 999), name: (meta.name && meta.name !== "{{title}}") ? meta.name : (dateiname ? dateiname.replace(/\.md$/i, "") : "Neues Rezept"), beruf: (meta.beruf || "").replace(/\[\[|\]\]|\|.*$/g, ""), kategorie: meta.kategorie || "", seltenheit: meta.seltenheit || "", proben: meta.proben || "", dc: meta.dc || "", zeit: meta.zeit || "", zeit_stunden: meta.zeit_stunden || "", wert: meta.wert || "", wert_gp: meta.wert_gp || "", materialien: (listen.materialien || []).filter(Boolean).map((t) => ({ text: t, itemId: null, menge: (t.match(/[×x]\s*(\d+)/i) || [])[1] || "1" })), quelle: meta.quelle || "", beschreibung: "", ergebnisId: null };
  const b = body.match(/## Beschreibung\s*([\s\S]*?)(?:\n> \[!info\]|$)/); if (b) r.beschreibung = b[1].trim();
  return r;
}
function rezeptZuMd(r, model) {
  const matName = (mt) => mt.itemId && model.gegenstaende[mt.itemId] ? `[[${model.gegenstaende[mt.itemId].name}]]${mt.menge && mt.menge !== "1" ? " ×" + mt.menge : ""}` : mt.text;
  return ["---", "typ: rezept", `beruf: ${r.beruf}`, `kategorie: "${r.kategorie}"`, `name: "${r.name}"`, `seltenheit: ${r.seltenheit}`, `proben: ${r.proben}`, `dc: ${r.dc}`, `zeit: "${r.zeit}"`, `zeit_stunden: ${r.zeit_stunden}`, `wert: "${r.wert}"`, `wert_gp: ${r.wert_gp}`, "materialien:", ...r.materialien.map((mt) => `  - "${matName(mt)}"`), `quelle: "${r.quelle}"`, "tags:", "  - rezept", "---", "", `# ${r.name}`, "", `**Beruf:** [[Übersicht Rezepte|${r.beruf}]] · **Kategorie:** ${r.kategorie}`, "", "## Materialien", "", ...r.materialien.map((mt) => "- " + matName(mt)), "", "## Herstellung", "", "| Proben | DC | Zeit | Seltenheit | Wert |", "|---|---|---|---|---|", `| ${r.proben} | ${r.dc} | ${r.zeit} | ${r.seltenheit} | ${r.wert} |`, "", "## Beschreibung", "", r.beschreibung || "", "", "> [!info] Quelle", `> ${r.quelle}`, ""].join("\n");
}
function FormfaktorEditor({ rows, setzen }) {
  const R = 5;
  const grid = Array.from({ length: R }, (_, y) => Array.from({ length: R }, (_, x) => ((rows[y] || "")[x] || ".") !== "."));
  const toggle = (y, x) => {
    const g2 = grid.map((r) => [...r]); g2[y][x] = !g2[y][x];
    let neu = g2.map((r) => r.map((c) => (c ? "X" : ".")).join(""));
    while (neu.length && !neu[neu.length - 1].includes("X")) neu.pop();
    let maxL = Math.max(0, ...neu.map((r) => r.lastIndexOf("X") + 1)); neu = neu.map((r) => r.slice(0, maxL));
    setzen(neu.length ? neu : ["X"]);
  };
  return (
    <div style={{ display: "inline-grid", gridTemplateColumns: `repeat(${R}, 18px)`, gap: 2 }}>
      {grid.map((r, y) => r.map((c, x) => <button key={y + "_" + x} onClick={() => toggle(y, x)} style={{ width: 18, height: 18, padding: 0, border: `1px solid ${C.linie}`, background: c ? C.amber : C.bg, cursor: "pointer" }} />))}
    </div>
  );
}
function GegenstaendeTab({ model, upd, sprung }) {
  gtypenAus(model);
  const [ansicht, setAnsicht] = useState("alle"); // alle | <gtyp> | rezepte
  const [gid, setGid] = useState(null);
  const [rzid, setRzid] = useState(null);
  const [io, setIo] = useState("");
  const [neuTag, setNeuTag] = useState("");
  useEffect(() => { if (sprung?.tab === "gegenstaende" && sprung.id) { if (model.gegenstaende[sprung.id]) { setGid(sprung.id); setAnsicht("alle"); } else if (model.rezepte.find((x) => x.id === sprung.id)) { setRzid(sprung.id); setAnsicht("rezepte"); } } }, [sprung]);
  const g = gid ? model.gegenstaende[gid] : null;
  const rz = model.rezepte.find((x) => x.id === rzid) || null;
  const gf = (k, v) => upd((m) => { m.gegenstaende[gid][k] = v; });
  const gsub = (sub, k, v) => upd((m) => { m.gegenstaende[gid][sub] = { ...(m.gegenstaende[gid][sub] || {}), [k]: v }; });
  const rf = (k, v) => upd((m) => { const x = m.rezepte.find((y) => y.id === rzid); if (x) x[k] = v; });
  const gfG = useContext(FilterCtx);
  const liste = Object.values(model.gegenstaende).filter((x) => passtFilter(gfG, x) && (ansicht === "alle" || x.gtyp === ansicht)).sort((a, b) => a.name.localeCompare(b.name));
  const materialien = Object.values(model.gegenstaende).filter((x) => x.gtyp === "material").sort((a, b) => a.name.localeCompare(b.name));
  const importText = (text, dateiname) => {
    const gg = parseGegenstandMd(text, dateiname), rr = parseRezeptMd(text, dateiname);
    if (gg) { upd((m) => { const alt = Object.values(m.gegenstaende).find((x) => x.name === gg.name); if (alt) gg.id = alt.id; m.gegenstaende[gg.id] = gg; }); return "g"; }
    if (rr) { upd((m) => { rr.materialien.forEach((mt) => { const nm = mt.text.replace(/\[\[|\]\]/g, "").replace(/[×x]\s*\d+/i, "").split("|")[0].trim(); const it = Object.values(m.gegenstaende).find((x) => x.name.toLowerCase() === nm.toLowerCase()); if (it) mt.itemId = it.id; }); const i = m.rezepte.findIndex((x) => x.name === rr.name); if (i >= 0) rr.id = m.rezepte[i].id, m.rezepte[i] = rr; else m.rezepte.push(rr); }); return "r"; }
    return null;
  };
  const importTextfeld = () => {
    // mehrere Dokumente: an jedem Frontmatter-Anfang trennen
    const teile = io.split(/\n(?=---[^\S\n]*\n\s*typ:)/i).filter((t) => t.trim());
    let n = 0; teile.forEach((t) => { if (importText(t.startsWith("---") ? t : "---\n" + t)) n++; });
    hinweis(n + " Gegenstand/Rezept(e) importiert."); if (n) setIo("");
  };
  const importDateien = (files) => { let n = 0, done = 0; [...files].forEach((f) => { const rd = new FileReader(); rd.onload = () => { if (importText(rd.result, f.name)) n++; done++; if (done === files.length) hinweis(n + " von " + files.length + " Dateien importiert."); }; rd.readAsText(f); }); };
  const bildLaden = (file) => { const rd = new FileReader(); rd.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); const S = 96; const k = Math.min(S / img.width, S / img.height, 1); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); gf("bild", c.toDataURL("image/jpeg", 0.8)); }; img.src = rd.result; }; rd.readAsDataURL(file); };
  const BildKachel = ({ x, gross }) => (
    <div style={{ width: gross ? 96 : 40, height: gross ? 96 : 40, background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
      {x.bild ? <img src={x.bild} alt="" style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <span style={{ color: C.dim, fontSize: gross ? 24 : 14 }}>{(x.name || "?")[0]}</span>}
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Kasten titel="Gegenstände" extra={<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="knopf primaer" onClick={() => { const x = neuerGegenstand(); if (ansicht !== "alle" && ansicht !== "rezepte") x.gtyp = ansicht; upd((m) => { m.gegenstaende[x.id] = x; }); setGid(x.id); }}>+ Gegenstand</button>
        <button className="knopf" onClick={() => { const id = "rz" + Date.now(); upd((m) => m.rezepte.push({ id, name: "Neues Rezept", beruf: "", kategorie: "", seltenheit: "", proben: "", dc: "", zeit: "", zeit_stunden: "", wert: "", wert_gp: "", materialien: [], quelle: "", beschreibung: "", ergebnisId: null })); setAnsicht("rezepte"); setRzid(id); }}>+ Rezept</button>
      </div>}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["alle", "Alle"], ...Object.entries(GTYPEN), ["rezepte", "Rezepte"], ["loot", "Loot-Tabellen"]].map(([k, l]) => {
            const n = k === "alle" ? Object.keys(model.gegenstaende).length : k === "rezepte" ? model.rezepte.length : k === "loot" ? model.lootTabellen.length : Object.values(model.gegenstaende).filter((x) => x.gtyp === k).length;
            return <button key={k} className={"knopf " + (ansicht === k ? "an" : "")} onClick={() => setAnsicht(k)}>{l} <span style={{ color: ansicht === k ? "#0c1a16" : C.dim }}>{n}</span></button>;
          })}
        </div>
        {ansicht === "loot" && <LootTabellen model={model} upd={upd} />}
        {ansicht !== "rezepte" && ansicht !== "loot" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 6 }}>
            {liste.map((x) => (
              <div key={x.id} onClick={() => setGid(gid === x.id ? null : x.id)} style={{ display: "flex", gap: 8, alignItems: "center", padding: 6, borderRadius: 3, cursor: "pointer", background: gid === x.id ? C.wand2 : C.bg, border: `1px solid ${gid === x.id ? C.amber : C.linie}` }}>
                <BildKachel x={x} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.name}</div>
                  <div style={{ fontSize: 11, color: C.dim }}>{GTYPEN[x.gtyp]} · {x.raritaet}{x.kupfer ? " · " + x.kupfer + " KM" : ""}{x.gtyp === "waffe" && x.waffe?.schaden ? " · " + x.waffe.schaden + " " + x.waffe.schadenstyp : ""}</div>
                </div>
              </div>
            ))}
            {liste.length === 0 && <span style={{ color: C.dim, fontSize: 12.5 }}>Keine Gegenstände in dieser Ansicht.</span>}
          </div>
        )}
        {ansicht === "rezepte" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[...model.rezepte].sort((a, b) => a.name.localeCompare(b.name)).map((x) => <button key={x.id} className={"knopf " + (rzid === x.id ? "primaer" : "")} onClick={() => setRzid(rzid === x.id ? null : x.id)}>{x.name}<span style={{ color: rzid === x.id ? "#241a08" : C.dim }}>{x.beruf ? " · " + x.beruf : ""}</span></button>)}
            {model.rezepte.length === 0 && <span style={{ color: C.dim, fontSize: 12.5 }}>Noch keine Rezepte.</span>}
          </div>
        )}
      </Kasten>

      {ansicht === "waffe" && (
        <Kasten titel={`Waffeneigenschaften (${model.waffenEigenschaften.length})`} extra={<button className="knopf" onClick={() => upd((m) => m.waffenEigenschaften.push({ id: "we" + Date.now(), name: "Neue Eigenschaft", text: "" }))}>+ Eigenschaft</button>}>
          {model.waffenEigenschaften.map((w, i) => (
            <div key={w.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr 30px", gap: 6, alignItems: "center" }}>
              <input type="text" value={w.name} onChange={(ev) => upd((m) => { m.waffenEigenschaften[i].name = ev.target.value; })} />
              <input type="text" value={w.text} onChange={(ev) => upd((m) => { m.waffenEigenschaften[i].text = ev.target.value; })} />
              <button className="knopf leise" onClick={() => upd((m) => { m.waffenEigenschaften.splice(i, 1); })}>✕</button>
            </div>
          ))}
        </Kasten>
      )}

      {g && ansicht !== "rezepte" && ansicht !== "loot" && (
        <Kasten titel={null} farbe={C.amber}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: 6, justifyItems: "center" }}>
              <BildKachel x={g} gross />
              <label className="knopf" style={{ fontSize: 11, cursor: "pointer" }}>Bild wählen<input type="file" accept="image/*" style={{ display: "none" }} onChange={(ev) => ev.target.files[0] && bildLaden(ev.target.files[0])} /></label>
              <input type="text" value={g.bild && !g.bild.startsWith("data:") ? g.bild : ""} placeholder="oder Bild-URL" style={{ width: 120, fontSize: 11 }} onChange={(ev) => gf("bild", ev.target.value)} />
              {g.bild && <button className="knopf leise" style={{ fontSize: 11 }} onClick={() => gf("bild", "")}>Bild entfernen</button>}
              <div className="feld" style={{ alignItems: "center" }}>Formfaktor (Grid-Inventar)<FormfaktorEditor rows={g.formfaktor || ["X"]} setzen={(v) => gf("formfaktor", v)} /><span style={{ fontSize: 10.5 }}>{(g.formfaktor || []).join(" / ")}</span></div>
            </div>
            <div style={{ flex: 1, minWidth: 280, display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                <T l="Name" v={g.name} setzen={(v) => gf("name", v)} />
                <div className="feld">Gegenstandstyp<select value={g.gtyp} onChange={(ev) => gf("gtyp", ev.target.value)}>{Object.entries(GTYPEN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                <div className="feld">Rarität<select value={g.raritaet} onChange={(ev) => gf("raritaet", ev.target.value)}>{RARITAET.map((r) => <option key={r}>{r}</option>)}{!RARITAET.includes(g.raritaet) && <option>{g.raritaet}</option>}</select></div>
                <T l="Stapelgrösse" v={g.stapel} setzen={(v) => gf("stapel", v)} />
                <T l="Kupferpreis" v={g.kupfer} setzen={(v) => gf("kupfer", v)} />
                <T l="Kaufrarität" v={g.kaufraritaet} setzen={(v) => gf("kaufraritaet", v)} />
              </div>
              {g.gtyp === "waffe" && (
                <div style={{ display: "grid", gap: 8, borderLeft: `3px solid ${C.rot}`, paddingLeft: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                    <T l="Schaden" v={g.waffe?.schaden} setzen={(v) => gsub("waffe", "schaden", v)} />
                    <T l="Schadenstyp" v={g.waffe?.schadenstyp} setzen={(v) => gsub("waffe", "schadenstyp", v)} />
                    <T l="Reichweite" v={g.waffe?.reichweite} setzen={(v) => gsub("waffe", "reichweite", v)} />
                  </div>
                  <div className="feld">Eigenschaften
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {model.waffenEigenschaften.map((w) => { const an = (g.waffe?.eigenschaften || []).includes(w.name); return (
                        <button key={w.id} className={"knopf " + (an ? "an" : "")} style={{ fontSize: 12 }} title={w.text} onClick={() => gsub("waffe", "eigenschaften", an ? g.waffe.eigenschaften.filter((x) => x !== w.name) : [...(g.waffe?.eigenschaften || []), w.name])}>{w.name}</button>
                      ); })}
                    </div>
                  </div>
                </div>
              )}
              {g.gtyp === "ruestung" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, borderLeft: `3px solid ${C.teal}`, paddingLeft: 8 }}><T l="RK" v={g.ruestung?.rk} setzen={(v) => gsub("ruestung", "rk", v)} /><T l="Stärke-Voraussetzung" v={g.ruestung?.staerke} setzen={(v) => gsub("ruestung", "staerke", v)} /><T l="Heimlichkeit" v={g.ruestung?.heimlichkeit} setzen={(v) => gsub("ruestung", "heimlichkeit", v)} /></div>}
              {g.gtyp === "material" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, borderLeft: `3px solid ${C.gold}`, paddingLeft: 8 }}><T l="Materialtyp" v={g.material?.materialtyp} setzen={(v) => gsub("material", "materialtyp", v)} /><T l="Berufe (kommagetrennt)" v={g.material?.berufe} setzen={(v) => gsub("material", "berufe", v)} /></div>}
              {g.gtyp === "verbrauchsgut" && <div style={{ borderLeft: `3px solid ${C.lila}`, paddingLeft: 8 }}><T l="Wirkung" v={g.verbrauchsgut?.wirkung} setzen={(v) => gsub("verbrauchsgut", "wirkung", v)} rows={2} /></div>}
              <AnsichtWechsler model={model} art="Gegenstand" obj={g} setzen={gf} />
              <StatusWahl obj={g} setzen={(v) => gf("status", v)} />
              <ZusatzFelder upd={upd} model={model} art="Gegenstand" subtyp={g.gtyp} werte={g.zusatz} setzen={(z) => gf("zusatz", z)} />
              <T l="Verdeckter Name" v={g.tarnname} setzen={(v) => gf("tarnname", v)} />
              <T l="Beschreibung (Regelnamen werden automatisch erkannt)" v={g.beschreibung} setzen={(v) => gf("beschreibung", v)} rows={4} />
              <InfoZuArtikel model={model} upd={upd} art="Gegenstand" id={g.id} />
              {(() => { const rr = regelnIn(g.beschreibung + " " + (g.waffe?.eigenschaften || []).join(" "), model); return rr.length > 0 && <details><summary style={{ cursor: "pointer", color: C.amber, fontSize: 12 }}>Regeln: {rr.map((r) => r.name).join(", ")}</summary><div style={{ display: "grid", gap: 3, marginTop: 4, fontSize: 12, color: C.dim }}>{rr.map((r) => <div key={r.id}><strong style={{ color: C.kreide }}>{r.name}.</strong> {r.text}</div>)}</div></details>; })()}
              <div className="feld">Tags & Aliase
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                  {(g.tags || []).map((t) => <span key={t} style={{ background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, padding: "1px 7px", fontSize: 11.5, display: "inline-flex", gap: 4 }}>{t}<button className="knopf leise" style={{ padding: "0 3px", fontSize: 10 }} onClick={() => gf("tags", g.tags.filter((x) => x !== t))}>✕</button></span>)}
                  <input type="text" value={neuTag} placeholder="Tag + Enter" style={{ width: 130 }} onChange={(ev) => setNeuTag(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter" && neuTag.trim()) { gf("tags", [...(g.tags || []), neuTag.trim()]); setNeuTag(""); } }} />
                  <input type="text" key={g.id + "al"} defaultValue={(g.aliases || []).join(", ")} placeholder="Aliase, kommagetrennt" style={{ width: 200 }} onBlur={(ev) => gf("aliases", ev.target.value.split(",").map((a) => a.trim()).filter(Boolean))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="knopf" onClick={() => setIo(gegenstandZuMd(g))}>Markdown exportieren (ins Feld unten)</button>
                <button className="knopf gefahr" onClick={() => { if (!bestaetigen(g.name + " löschen?")) return; upd((m) => { delete m.gegenstaende[gid]; m.rezepte.forEach((r) => { r.materialien.forEach((mt) => { if (mt.itemId === gid) mt.itemId = null; }); if (r.ergebnisId === gid) r.ergebnisId = null; }); }); setGid(null); }}>Löschen</button>
              </div>
            </div>
          </div>
        </Kasten>
      )}

      {rz && ansicht === "rezepte" && (
        <Kasten titel={null} farbe={C.gold}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            <T l="Name" v={rz.name} setzen={(v) => rf("name", v)} /><T l="Beruf" v={rz.beruf} setzen={(v) => rf("beruf", v)} /><T l="Kategorie" v={rz.kategorie} setzen={(v) => rf("kategorie", v)} />
            <T l="Seltenheit" v={rz.seltenheit} setzen={(v) => rf("seltenheit", v)} /><T l="Proben" v={rz.proben} setzen={(v) => rf("proben", v)} /><T l="DC" v={rz.dc} setzen={(v) => rf("dc", v)} />
            <T l="Zeit" v={rz.zeit} setzen={(v) => rf("zeit", v)} /><T l="Zeit (Stunden)" v={rz.zeit_stunden} setzen={(v) => rf("zeit_stunden", v)} /><T l="Wert" v={rz.wert} setzen={(v) => rf("wert", v)} /><T l="Wert (GM)" v={rz.wert_gp} setzen={(v) => rf("wert_gp", v)} />
            <div className="feld">Ergebnis (Gegenstand)<select value={rz.ergebnisId || ""} onChange={(ev) => rf("ergebnisId", ev.target.value || null)}><option value="">—</option>{Object.values(model.gegenstaende).sort((a, b) => a.name.localeCompare(b.name)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          </div>
          <div className="feld">Materialien (aus Gegenständen vom Typ Material)
            <div style={{ display: "grid", gap: 4 }}>
              {rz.materialien.map((mt, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 1fr 30px", gap: 6, alignItems: "center" }}>
                  <select value={mt.itemId || ""} onChange={(ev) => rf("materialien", rz.materialien.map((x, j) => (j === i ? { ...x, itemId: ev.target.value || null, text: ev.target.value ? model.gegenstaende[ev.target.value].name : x.text } : x)))}>
                    <option value="">— frei (Text) —</option>
                    {materialien.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <input type="text" value={mt.menge || "1"} title="Menge" onChange={(ev) => rf("materialien", rz.materialien.map((x, j) => (j === i ? { ...x, menge: ev.target.value } : x)))} />
                  <input type="text" value={mt.text || ""} placeholder="Freitext / unverknüpft" onChange={(ev) => rf("materialien", rz.materialien.map((x, j) => (j === i ? { ...x, text: ev.target.value } : x)))} />
                  <button className="knopf leise" style={{ padding: "0 6px" }} onClick={() => rf("materialien", rz.materialien.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <div><button className="knopf" style={{ fontSize: 12 }} onClick={() => rf("materialien", [...rz.materialien, { itemId: null, text: "", menge: "1" }])}>+ Material</button></div>
            </div>
          </div>
          <T l="Beschreibung" v={rz.beschreibung} setzen={(v) => rf("beschreibung", v)} rows={3} /><T l="Quelle" v={rz.quelle} setzen={(v) => rf("quelle", v)} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="knopf" onClick={() => setIo(rezeptZuMd(rz, model))}>Markdown exportieren (ins Feld unten)</button>
            <button className="knopf gefahr" onClick={() => { if (!bestaetigen("Rezept löschen?")) return; upd((m) => { m.rezepte = m.rezepte.filter((x) => x.id !== rzid); }); setRzid(null); }}>Löschen</button>
          </div>
        </Kasten>
      )}

      <Kasten titel="Import / Export (.md — Gegenstände & Rezepte)" extra={<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <label className="knopf primaer" style={{ cursor: "pointer" }}>Dateien importieren<input type="file" multiple accept=".md,text/markdown" style={{ display: "none" }} onChange={(ev) => ev.target.files.length && importDateien(ev.target.files)} /></label>
        <button className="knopf" onClick={importTextfeld}>Text importieren</button>
        <button className="knopf" onClick={() => setIo([...Object.values(model.gegenstaende).map(gegenstandZuMd), ...model.rezepte.map((r) => rezeptZuMd(r, model))].join("\n\n"))}>Alle exportieren</button>
        <button className="knopf leise" onClick={() => setIo("")}>Leeren</button>
      </div>}>
        <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>Dateien: Name aus dem Dateinamen (Obsidian-Konvention). Text: mehrere Dokumente hintereinander erlaubt; ohne <code>name:</code> wird der erste Alias oder «Unbenannt» verwendet.</p>
        <textarea rows={8} value={io} onChange={(ev) => setIo(ev.target.value)} placeholder="Gegenstand- oder Rezept-Markdown (Frontmatter mit typ: Gegenstand / typ: rezept) …" style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5 }} />
      </Kasten>
    </div>
  );
}


/* ── Initiative-Tracker ── */
function monsterInKampf(m, monId, anzahl) {
  const mon = m.monster[monId]; if (!mon) return;
  if (!m.kampf) m.kampf = { runde: 1, aktivIdx: 0, teilnehmer: [], ticks: true };
  const vorhandene = m.kampf.teilnehmer.filter((t) => t.refId === mon.id).length;
  for (let i = 0; i < anzahl; i++) {
    const nr = vorhandene + i + 1;
    m.kampf.teilnehmer.push({ id: "t" + Date.now() + i + Math.floor(Math.random() * 99), name: anzahl + vorhandene > 1 ? `${mon.name} ${nr}` : mon.name, art: "monster", refId: mon.id, ini: Math.floor(Math.random() * 20) + 1 + modAus(mon.attr.DEX), hp: zahl(mon.tp), hpMax: zahl(mon.tp), temp: 0, ac: zahl(mon.acText || mon.ac), pp: mon.passive || zahl((String(mon.sinne || "").match(/passive \w+\s*(\d+)/i) || [])[1]), zustaende: [], effekte: [], notiz: "" });
  }
}
const zahl = (t) => { const m = String(t ?? "").match(/-?\d+/); return m ? +m[0] : 0; };
const modAus = (attr) => { const m = String(attr || "").match(/\(([+-]?\d+)\)/); return m ? +m[1] : 0; };
const ppAusChar = (c) => { const p = (c.passives || []).map(String).find((x) => /perception|wahrnehmung/i.test(x)); return p ? zahl(p.replace(/.*?(\d+)\s*$/, "$1")) : ""; };
function InitiativeTab({ model, upd, spieler, springe }) {
  const k = model.kampf;
  const [sbId, setSbId] = useState("");
  const [anzahl, setAnzahl] = useState(1);
  const [schaden, setSchaden] = useState({});
  const [offen, setOffen] = useState(null);
  const [effektForm, setEffektForm] = useState(null);
  const [ef, setEf] = useState({ name: "", dauer: "endeNaechster", zuege: 10, bezug: "", notiz: "" });
  const kf = (fn) => upd((m) => { fn(m.kampf); });
  const tf = (id, key, v) => kf((kk) => { const t = kk.teilnehmer.find((x) => x.id === id); if (t) t[key] = v; });
  const conditions = model.regeln.filter((r) => r.art === "Condition").map((r) => r.name);
  const sortieren = () => kf((kk) => { const aktivId = kk.teilnehmer[kk.aktivIdx]?.id; kk.teilnehmer.sort((a, b) => (+b.ini || 0) - (+a.ini || 0)); kk.aktivIdx = Math.max(0, kk.teilnehmer.findIndex((x) => x.id === aktivId)); });
  const pcHinzu = (c) => kf((kk) => kk.teilnehmer.push({ id: "t" + Date.now() + Math.floor(Math.random() * 99), name: c.name, art: "pc", refId: c.id, ini: "", hp: zahl(c.hp), hpMax: zahl(c.hp), temp: zahl(c.temp), ac: zahl(c.ac), pp: ppAusChar(c), zustaende: [], effekte: [], notiz: "" }));
  const sbHinzu = () => { if (!model.monster[sbId]) return; upd((m) => monsterInKampf(m, sbId, anzahl)); };
  const naechster = (richtung, zielIdx = null) => {
    const abgelaufen = [];
    kf((kk) => {
      if (!kk.teilnehmer.length) return;
      const verlassen = kk.teilnehmer[kk.aktivIdx]?.id;
      let i;
      if (zielIdx != null) { i = zielIdx; if (i < kk.aktivIdx) kk.runde += 1; }
      else { i = kk.aktivIdx + richtung; if (i >= kk.teilnehmer.length) { i = 0; kk.runde += 1; } if (i < 0) { i = kk.teilnehmer.length - 1; kk.runde = Math.max(1, kk.runde - 1); } }
      kk.aktivIdx = i;
      if (richtung < 0 || kk.ticks === false) return; // rückwärts oder Ticks aus: keine Effekt-Abläufe
      const betreten = kk.teilnehmer[i]?.id;
      const tick = (bezug, moment) => kk.teilnehmer.forEach((t) => {
        t.effekte = (t.effekte || []).filter((ef) => {
          if (ef.zuege == null || ef.bezug !== bezug || ef.ablaufBei !== moment) return true;
          ef.zuege -= 1;
          if (ef.zuege <= 0) { abgelaufen.push(`${ef.name} bei ${t.name}`); return false; }
          return true;
        });
      });
      tick(verlassen, "ende"); tick(betreten, "start");
    });
    if (abgelaufen.length) hinweis("Abgelaufen: " + abgelaufen.join(" · "));
  };
  const schadenAnwenden = (t, vorzeichen) => {
    const d = zahl(schaden[t.id]); if (!d) return;
    kf((kk) => { const x = kk.teilnehmer.find((y) => y.id === t.id); if (!x) return;
      if (vorzeichen < 0) { let rest = d; const ausTemp = Math.min(x.temp || 0, rest); x.temp = (x.temp || 0) - ausTemp; rest -= ausTemp; x.hp = Math.max(0, (+x.hp || 0) - rest); }
      else x.hp = Math.min(+x.hpMax || 9999, (+x.hp || 0) + d); });
    setSchaden({ ...schaden, [t.id]: "" });
  };
  const hpFarbe = (t) => { const q = t.hpMax ? t.hp / t.hpMax : 1; return q <= 0 ? C.rot : q < 0.5 ? C.amber : C.teal; };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Kasten titel={<span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>Initiative — Runde {spieler ? k.runde : <input type="number" min="1" value={k.runde} style={{ width: 60 }} onChange={(ev) => kf((kk) => { kk.runde = Math.max(1, +ev.target.value || 1); })} />}</span>} extra={<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {!spieler && <>
          <button className="knopf" onClick={() => naechster(-1)}>◀ Vorheriger</button>
          <button className="knopf primaer" onClick={() => naechster(1)}>Nächster ▶</button>
          <button className="knopf" onClick={sortieren}>Sortieren</button>
          <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={k.ticks !== false} onChange={(ev) => kf((kk) => { kk.ticks = ev.target.checked; })} />Effekt-Ticks</label>
          <button className="knopf leise" onClick={() => { if (bestaetigen("Kampf beenden und Liste leeren?")) kf((kk) => { kk.teilnehmer = []; kk.runde = 1; kk.aktivIdx = 0; }); }}>Beenden</button>
        </>}
      </div>}>
        {!spieler && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: C.bg, borderRadius: 3, padding: 8 }}>
            <span style={{ fontSize: 12, color: C.dim }}>Charaktere:</span>
            {(model.charaktere || []).map((c) => <button key={c.id} className="knopf" style={{ fontSize: 12 }} onClick={() => pcHinzu(c)} disabled={k.teilnehmer.some((t) => t.refId === c.id)}>+ {c.name}</button>)}
            <span style={{ width: 12 }} />
            <select value={sbId} onChange={(ev) => setSbId(ev.target.value)}><option value="">Statblock …</option>{Object.values(model.monster).sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.id} value={m.id}>{m.name} (CR {m.cr})</option>)}</select>
            <input type="number" min="1" max="20" value={anzahl} style={{ width: 56 }} onChange={(ev) => setAnzahl(Math.max(1, +ev.target.value || 1))} />
            <button className="knopf primaer" style={{ fontSize: 12 }} onClick={sbHinzu} disabled={!sbId}>+ hinzufügen (Ini gewürfelt)</button>
          </div>
        )}
        {k.teilnehmer.length === 0 && <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Noch niemand im Kampf.</p>}
        <div style={{ display: "grid", gap: 4 }}>
          {!spieler && k.teilnehmer.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 150px 60px 56px 56px 1fr 1fr 60px", gap: 6, fontSize: 10.5, color: C.dim, padding: "0 8px" }}>
              <span>Ini</span><span>Name</span><span>HP (aktuell / max)</span><span>Temp</span><span>AC</span><span>PP</span><span>Effekte & Conditions</span><span>Notiz</span><span />
            </div>
          )}
          {k.teilnehmer.map((t, i) => {
            const aktiv = i === k.aktivIdx;
            const mon = t.art === "monster" ? model.monster[t.refId] : null;
            if (spieler) return (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr", gap: 6, alignItems: "center", padding: "6px 8px", borderRadius: 3, background: aktiv ? C.wand2 : "transparent", border: `1px solid ${aktiv ? C.amber : "transparent"}`, fontSize: 13 }}>
                <span style={{ color: C.dim }}>{t.ini}</span><span>{aktiv ? "▶ " : ""}{t.name}{t.art === "monster" && t.hp <= 0 ? " ✝" : ""}</span><span style={{ color: C.dim, fontSize: 12 }}>{(t.effekte || []).map((ef) => ef.name).join(", ")}</span>
              </div>
            );
            return (
              <div key={t.id} style={{ borderRadius: 3, background: aktiv ? C.wand2 : "transparent", border: `1px solid ${aktiv ? C.amber : C.linie}`, padding: "6px 8px", display: "grid", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 150px 60px 56px 56px 1fr 1fr 60px", gap: 6, alignItems: "center" }}>
                  <input type="number" value={t.ini} onChange={(ev) => tf(t.id, "ini", ev.target.value)} />
                  <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>
                    <button title="Zu diesem Teilnehmer springen" onClick={() => naechster(1, i)} style={{ width: 14, height: 14, borderRadius: "50%", border: "none", background: t.art === "pc" ? C.teal : C.rot, flexShrink: 0, cursor: "pointer", outline: aktiv ? `2px solid ${C.amber}` : "none" }} />
                    <input type="text" value={t.name} onChange={(ev) => tf(t.id, "name", ev.target.value)} style={{ color: t.hp <= 0 ? C.dim : C.kreide, textDecoration: t.hp <= 0 ? "line-through" : "none" }} />
                  </div>
                  <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                    <input type="number" value={t.hp} style={{ width: 52, color: hpFarbe(t), fontWeight: 600 }} onChange={(ev) => tf(t.id, "hp", +ev.target.value)} />
                    <span style={{ color: C.dim, fontSize: 11 }}>/</span>
                    <input type="number" value={t.hpMax} style={{ width: 52 }} onChange={(ev) => tf(t.id, "hpMax", +ev.target.value)} />
                  </div>
                  <input type="number" value={t.temp || 0} onChange={(ev) => tf(t.id, "temp", +ev.target.value)} />
                  <input type="number" value={t.ac} onChange={(ev) => tf(t.id, "ac", +ev.target.value)} />
                  <input type="number" value={t.pp} onChange={(ev) => tf(t.id, "pp", ev.target.value)} />
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
                    {(t.effekte || []).map((ef) => {
                      const bez = k.teilnehmer.find((x) => x.id === ef.bezug);
                      const dauer = ef.zuege == null ? "" : ef.zuege === 1 ? (ef.ablaufBei === "start" ? "bis Zugbeginn" : "bis Zugende") : `${ef.zuege} Züge`;
                      return <span key={ef.id} title={ef.notiz || ""} style={{ background: C.bg, border: `1px solid ${C.lila}`, borderRadius: 3, padding: "0 5px", fontSize: 11, display: "inline-flex", gap: 3, alignItems: "center" }}>{ef.name}{dauer && <span style={{ color: C.dim }}> {dauer}{bez && bez.id !== t.id ? " (" + bez.name + ")" : ""}</span>}<button className="knopf leise" style={{ padding: "0 2px", fontSize: 10 }} onClick={() => tf(t.id, "effekte", t.effekte.filter((x) => x.id !== ef.id))}>✕</button></span>;
                    })}
                    <button className="knopf leise" style={{ fontSize: 11, padding: "0 5px" }} onClick={() => setEffektForm(effektForm === t.id ? null : t.id)}>+ Effekt</button>
                  </div>
                  <input type="text" value={t.notiz || ""} placeholder="…" onChange={(ev) => tf(t.id, "notiz", ev.target.value)} />
                  <button className="knopf leise" style={{ padding: "2px 6px" }} onClick={() => kf((kk) => { kk.teilnehmer = kk.teilnehmer.filter((x) => x.id !== t.id); if (kk.aktivIdx >= kk.teilnehmer.length) kk.aktivIdx = 0; })}>✕</button>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="number" placeholder="Schaden / Heilung" value={schaden[t.id] || ""} style={{ width: 130 }} onChange={(ev) => setSchaden({ ...schaden, [t.id]: ev.target.value })} onKeyDown={(ev) => { if (ev.key === "Enter") schadenAnwenden(t, -1); }} />
                  <button className="knopf" style={{ fontSize: 12, borderColor: C.rot }} onClick={() => schadenAnwenden(t, -1)}>− Schaden</button>
                  <button className="knopf" style={{ fontSize: 12, borderColor: C.teal }} onClick={() => schadenAnwenden(t, 1)}>+ Heilung</button>
                  {mon && <button className="knopf" style={{ fontSize: 12 }} onClick={() => setOffen(offen === t.id ? null : t.id)}>{offen === t.id ? "Statblock ausblenden" : "Statblock"}</button>}
                  {mon && <button className="knopf leise" style={{ fontSize: 12 }} onClick={() => springe("monster", mon.id)}>→ im Tab öffnen</button>}
                  {t.art === "pc" && <span style={{ fontSize: 11.5, color: C.dim }}>Spielercharakter</span>}
                </div>
                {effektForm === t.id && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", background: C.bg, borderRadius: 3, padding: 8 }}>
                    <input type="text" list="conditionsListe" value={ef.name} placeholder="Condition / Effekt" style={{ width: 160 }} onChange={(ev) => setEf({ ...ef, name: ev.target.value })} />
                    <datalist id="conditionsListe">{conditions.map((c) => <option key={c} value={c} />)}</datalist>
                    <select value={ef.dauer} onChange={(ev) => setEf({ ...ef, dauer: ev.target.value })}>
                      <option value="unbegrenzt">unbegrenzt</option><option value="startNaechster">bis Beginn des nächsten Zugs</option><option value="endeNaechster">bis Ende des nächsten Zugs</option><option value="zuege">Anzahl Züge</option>
                    </select>
                    {ef.dauer === "zuege" && <input type="number" min="1" value={ef.zuege} style={{ width: 60 }} onChange={(ev) => setEf({ ...ef, zuege: Math.max(1, +ev.target.value || 1) })} />}
                    {ef.dauer !== "unbegrenzt" && <select value={ef.bezug || t.id} onChange={(ev) => setEf({ ...ef, bezug: ev.target.value })} title="Wessen Zug zählt (z. B. der Zauberwirker)">{k.teilnehmer.map((x) => <option key={x.id} value={x.id}>{x.id === t.id ? "eigener Zug" : "Zug von " + x.name}</option>)}</select>}
                    <input type="text" value={ef.notiz} placeholder="Notiz (DC, Quelle …)" style={{ width: 160 }} onChange={(ev) => setEf({ ...ef, notiz: ev.target.value })} />
                    <button className="knopf primaer" style={{ fontSize: 12 }} onClick={() => { if (!ef.name.trim()) return; const neu = { id: "ef" + Date.now(), name: ef.name.trim(), ablaufBei: ef.dauer === "startNaechster" ? "start" : "ende", bezug: ef.dauer === "unbegrenzt" ? t.id : (ef.bezug || t.id), zuege: ef.dauer === "unbegrenzt" ? null : ef.dauer === "zuege" ? ef.zuege : 1, notiz: ef.notiz }; tf(t.id, "effekte", [...(t.effekte || []), neu]); setEf({ ...ef, name: "", notiz: "" }); setEffektForm(null); }}>Hinzufügen</button>
                    <button className="knopf leise" style={{ fontSize: 12 }} onClick={() => setEffektForm(null)}>Abbrechen</button>
                  </div>
                )}
                {mon && offen === t.id && <Statblock m={mon} model={model} />}
              </div>
            );
          })}
        </div>
      </Kasten>
    </div>
  );
}

/* ── Pinnwand ── */
const BOARD_REF = { npc: "NPC", quest: "Quest", monster: "Statblock", gegenstand: "Gegenstand", ort: "Ort", sitzung: "Sitzung", charakter: "Charakter", regel: "Regel" };
function refOptionen(model, typ) {
  switch (typ) {
    case "npc": return model.npcs.map((x) => ({ id: x.id, name: x.name }));
    case "quest": return model.quests.map((x) => ({ id: x.id, name: x.titel }));
    case "monster": return Object.values(model.monster).map((x) => ({ id: x.id, name: x.name }));
    case "gegenstand": return Object.values(model.gegenstaende).map((x) => ({ id: x.id, name: x.name }));
    case "ort": return Object.values(model.orte).map((x) => ({ id: x.id, name: x.name }));
    case "sitzung": return model.sitzungen.map((x) => ({ id: x.id, name: `#${x.nummer} ${x.titel}` }));
    case "charakter": return model.charaktere.map((x) => ({ id: x.id, name: x.name }));
    case "regel": return model.regeln.map((x) => ({ id: x.id, name: x.name }));
    default: return [];
  }
}
function RefInhalt({ model, typ, id }) {
  const dim = { color: C.dim, fontSize: 12 };
  if (typ === "npc") { const n = model.npcs.find((x) => x.id === id); return n ? <AnsichtRender model={model} art="NPC" obj={n} ansicht="Kurz" /> : null; }
  if (typ === "__npc_alt") { const n = model.npcs.find((x) => x.id === id); return n ? <div><div className="serif" style={{ fontSize: 15, fontWeight: 700 }}>{n.name}</div><div style={dim}>{n.hauptbeziehung}{(n.worte || []).length ? " · " + n.worte.join(", ") : ""}</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{n.beschreibung}</div></div> : null; }
  if (typ === "quest") { const q = model.quests.find((x) => x.id === id); return q ? <div><div className="serif" style={{ fontSize: 15, fontWeight: 700 }}>{q.titel} <span style={dim}>· {q.status}</span></div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{q.beschreibung}</div>{(q.schritte || []).map((st, i) => <div key={i} style={{ color: st.erledigt ? C.dim : C.kreide }}>{st.erledigt ? "☑" : "☐"} {st.text}</div>)}</div> : null; }
  if (typ === "monster") { const m = model.monster[id]; return m ? <Statblock m={m} model={model} /> : null; }
  if (typ === "gegenstand") { const g = model.gegenstaende[id]; return g ? <div style={{ display: "flex", gap: 8 }}>{g.bild && <img src={g.bild} alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />}<div><div className="serif" style={{ fontSize: 15, fontWeight: 700 }}>{g.name}</div><div style={dim}>{GTYPEN[g.gtyp]} · {g.raritaet}{g.gtyp === "waffe" && g.waffe?.schaden ? ` · ${g.waffe.schaden} ${g.waffe.schadenstyp}` : ""}</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{g.beschreibung}</div></div></div> : null; }
  if (typ === "ort") { const o = model.orte[id]; return o ? <div><div className="serif" style={{ fontSize: 15, fontWeight: 700 }}>{o.name}</div><div style={dim}>{o.f !== "keine" ? o.f : ""}{o.distrikt ? " · " + o.distrikt : ""}</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{o.beschreibung || o.b}</div></div> : null; }
  if (typ === "sitzung") { const x = model.sitzungen.find((y) => y.id === id); return x ? <div><div className="serif" style={{ fontSize: 15, fontWeight: 700 }}>#{x.nummer} {x.titel}</div><div style={dim}>{x.datum}</div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{x.idee}</div>{(x.todos || []).filter((t) => !t.erledigt).map((t) => <div key={t.id}>☐ {t.text}</div>)}</div> : null; }
  if (typ === "charakter") { const c = model.charaktere.find((x) => x.id === id); return c ? <CharakterKarte c={c} upd={() => {}} spieler={true} /> : null; }
  if (typ === "regel") { const r = model.regeln.find((x) => x.id === id); return r ? <div><strong>{r.name}</strong> <span style={dim}>({r.art})</span><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{r.text}</div></div> : null; }
  return <span style={dim}>Element nicht mehr vorhanden.</span>;
}
function BoardTab({ model, upd }) {
  const [bid, setBid] = useState(model.boards[0]?.id || null);
  const [refTyp, setRefTyp] = useState("npc");
  const [refId, setRefId] = useState("");
  const drag = useRef(null);
  const [live, setLive] = useState(null); // {id, x, y, w, h} während Drag/Resize
  const board = model.boards.find((b) => b.id === bid) || null;
  const bf = (fn) => upd((m) => { const b = m.boards.find((x) => x.id === bid); if (b) fn(b); });
  const karteFeld = (id, k, v) => bf((b) => { const c = b.karten.find((x) => x.id === id); if (c) c[k] = v; });
  const neueKarte = (extra) => bf((b) => b.karten.push({ id: "k" + Date.now(), typ: "text", x: 20 + (b.karten.length % 4) * 320, y: 20 + Math.floor(b.karten.length / 4) * 220, w: 300, h: 180, titel: "", text: "", bild: "", ...extra }));
  const start = (ev, karte, modus) => { ev.stopPropagation(); ev.preventDefault(); drag.current = { id: karte.id, modus, sx: ev.clientX, sy: ev.clientY, x: karte.x, y: karte.y, w: karte.w, h: karte.h }; };
  const bewegen = (ev) => { const d = drag.current; if (!d) return; const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy; setLive(d.modus === "move" ? { id: d.id, x: Math.max(0, d.x + dx), y: Math.max(0, d.y + dy), w: d.w, h: d.h } : { id: d.id, x: d.x, y: d.y, w: Math.max(160, d.w + dx), h: Math.max(80, d.h + dy) }); };
  const ende = () => { if (drag.current && live) { const l = live; bf((b) => { const c = b.karten.find((x) => x.id === l.id); if (c) { c.x = Math.round(l.x); c.y = Math.round(l.y); c.w = Math.round(l.w); c.h = Math.round(l.h); } }); } drag.current = null; setLive(null); };
  const bildLaden = (id, file) => { const rd = new FileReader(); rd.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); const S = 480; const k = Math.min(S / img.width, S / img.height, 1); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); karteFeld(id, "bild", c.toDataURL("image/jpeg", 0.8)); }; img.src = rd.result; }; rd.readAsDataURL(file); };
  const hoehe = board ? Math.max(800, ...board.karten.map((c) => c.y + c.h + 60)) : 800;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {model.boards.map((b) => <button key={b.id} className={"knopf " + (bid === b.id ? "an" : "")} onClick={() => setBid(b.id)}>{b.name}</button>)}
        <button className="knopf" onClick={() => { const id = "bd" + Date.now(); upd((m) => m.boards.push({ id, name: "Pinnwand " + (m.boards.length + 1), karten: [] })); setBid(id); }}>+ Pinnwand</button>
        {board && <input type="text" value={board.name} style={{ width: 180 }} onChange={(ev) => bf((b) => { b.name = ev.target.value; })} />}
        {board && model.boards.length > 1 && <button className="knopf leise" onClick={() => { if (bestaetigen("Pinnwand löschen?")) { upd((m) => { m.boards = m.boards.filter((x) => x.id !== bid); }); setBid(model.boards.find((x) => x.id !== bid)?.id || null); } }}>löschen</button>}
        <span style={{ flex: 1 }} />
        <button className="knopf" onClick={() => neueKarte({ typ: "text", titel: "Notiz" })}>+ Textabsatz</button>
        <button className="knopf" onClick={() => neueKarte({ typ: "bild", titel: "Bild", w: 320, h: 260 })}>+ Bild</button>
        <select value={refTyp} onChange={(ev) => { setRefTyp(ev.target.value); setRefId(""); }}>{Object.entries(BOARD_REF).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={refId} onChange={(ev) => setRefId(ev.target.value)}><option value="">wählen …</option>{refOptionen(model, refTyp).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <button className="knopf primaer" disabled={!refId} onClick={() => { neueKarte({ typ: "ref", refTyp, refId, titel: BOARD_REF[refTyp], w: refTyp === "monster" ? 380 : 300, h: refTyp === "monster" ? 420 : 200 }); setRefId(""); }}>+ Element</button>
      </div>
      {board && (
        <div onPointerMove={bewegen} onPointerUp={ende} onPointerLeave={ende} onPointerCancel={ende}
          style={{ position: "relative", minHeight: hoehe, background: `${C.bg} radial-gradient(${C.linie} 1px, transparent 1px) 0 0 / 24px 24px`, border: `1px solid ${C.linie}`, borderRadius: 4, overflow: "auto", touchAction: "none" }}>
          {board.karten.length === 0 && <p style={{ position: "absolute", top: 20, left: 20, color: C.dim, fontSize: 13 }}>Leer — oben Textabsatz, Bild oder ein Element aus den anderen Tabs hinzufügen. Karten am Kopf ziehen, an der Ecke rechts unten die Grösse ändern.</p>}
          {board.karten.map((c) => {
            const p = live?.id === c.id ? live : c;
            return (
              <div key={c.id} style={{ position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h, background: C.wand, border: `1px solid ${C.linie}`, borderRadius: 4, display: "flex", flexDirection: "column", boxShadow: "0 4px 14px rgba(0,0,0,.45)" }}>
                <div onPointerDown={(ev) => start(ev, c, "move")} style={{ cursor: "grab", display: "flex", gap: 6, alignItems: "center", padding: "4px 8px", borderBottom: `1px solid ${C.linie}`, background: C.wand2, borderRadius: "4px 4px 0 0", userSelect: "none" }}>
                  <input type="text" value={c.titel || ""} placeholder="Titel" onPointerDown={(ev) => ev.stopPropagation()} onChange={(ev) => karteFeld(c.id, "titel", ev.target.value)} style={{ flex: 1, background: "transparent", border: "none", fontFamily: "'Alegreya', Georgia, serif", fontSize: 14, fontWeight: 700, padding: 0 }} />
                  <span style={{ color: C.dim, fontSize: 10.5 }}>{c.typ === "ref" ? BOARD_REF[c.refTyp] : c.typ}</span>
                  <button className="knopf leise" style={{ padding: "0 5px" }} onPointerDown={(ev) => ev.stopPropagation()} onClick={() => bf((b) => { b.karten = b.karten.filter((x) => x.id !== c.id); })}>✕</button>
                </div>
                <div style={{ flex: 1, overflow: "auto", padding: 8, fontSize: 12.5 }}>
                  {c.typ === "text" && <textarea value={c.text || ""} onChange={(ev) => karteFeld(c.id, "text", ev.target.value)} style={{ width: "100%", height: "100%", border: "none", background: "transparent", resize: "none", fontSize: 13, lineHeight: 1.45 }} placeholder="Absatz …" />}
                  {c.typ === "bild" && (c.bild
                    ? <img src={c.bild} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block", margin: "0 auto" }} />
                    : <div style={{ display: "grid", gap: 6 }}><label className="knopf" style={{ cursor: "pointer", fontSize: 12, justifySelf: "start" }}>Bild wählen<input type="file" accept="image/*" style={{ display: "none" }} onChange={(ev) => ev.target.files[0] && bildLaden(c.id, ev.target.files[0])} /></label><input type="text" placeholder="oder Bild-URL" onChange={(ev) => karteFeld(c.id, "bild", ev.target.value)} /></div>)}
                  {c.typ === "ref" && <RefInhalt model={model} typ={c.refTyp} id={c.refId} />}
                </div>
                <div onPointerDown={(ev) => start(ev, c, "resize")} style={{ position: "absolute", right: 0, bottom: 0, width: 16, height: 16, cursor: "nwse-resize", borderRight: `2px solid ${C.dim}`, borderBottom: `2px solid ${C.dim}`, borderRadius: "0 0 4px 0" }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


/* ── Seeds: Ideen, Geheimnisse, Backstory-Fäden — während der Sitzung erfasst ── */
const SEED_KAT = ["Backstory", "Geheimnis", "Faden", "Idee", "Versprechen", "Konsequenz"];
const SEED_STATUS = ["offen", "gepflanzt", "aufgegangen", "verworfen"];
function QuickActions({ model, upd }) {
  const [offen, setOffen] = useState(null); // seed | todo | reise
  const [text, setText] = useState("");
  const [kat, setKat] = useState("Idee");
  const [charId, setCharId] = useState("");
  const [ziel, setZiel] = useState("sitzung");
  const aktuelle = model.sitzungen.find((x) => x.id === model.aktuelleSitzungId);
  const speichernSeed = () => { if (!text.trim()) return; upd((m) => m.seeds.push({ id: "sd" + Date.now(), ts: new Date().toISOString().slice(0, 10), sitzungId: m.aktuelleSitzungId || null, kategorie: kat, text: text.trim(), charakterId: charId || null, status: "offen", notiz: "" })); setText(""); hinweis("Seed gespeichert"); };
  const speichernTodo = () => { if (!text.trim()) return; upd((m) => { const t = { id: "td" + Date.now(), text: text.trim(), erledigt: false }; const sitz = m.sitzungen.find((x) => x.id === m.aktuelleSitzungId); if (ziel === "sitzung" && sitz) sitz.todos.push(t); else m.kampagne.todos.push(t); }); setText(""); hinweis("Todo gespeichert"); };
  const knotenBetreten = () => { upd((m) => { m.reise.knoten += 1; const r = m.kanalRegeln; if (m.reise.knoten % (r.rationAlle || 3) === 0) hinweis(`Knoten ${m.reise.knoten}: Ration & Fackel fällig!`); }); };
  const offeneTodos = [model.kampagne, ...model.sitzungen, ...model.quests, ...model.npcs].reduce((n, x) => n + (x.todos || []).filter((t) => !t.erledigt).length, 0);
  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px 8px", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11.5, color: C.dim }}>Quick:</span>
      {[["seed", "🌱 Seed"], ["todo", `☐ Todo${offeneTodos ? " (" + offeneTodos + ")" : ""}`], ["reise", `👣 Knoten ${model.reise.knoten}`]].map(([k, l]) => <button key={k} className={"knopf " + (offen === k ? "an" : "")} style={{ fontSize: 12 }} onClick={() => setOffen(offen === k ? null : k)}>{l}</button>)}
      {aktuelle && <span style={{ fontSize: 11.5, color: C.teal }}>Sitzung #{aktuelle.nummer}</span>}
      {offen === "seed" && <>
        <select value={kat} onChange={(ev) => setKat(ev.target.value)} style={{ fontSize: 12 }}>{SEED_KAT.map((k) => <option key={k}>{k}</option>)}</select>
        <select value={charId} onChange={(ev) => setCharId(ev.target.value)} style={{ fontSize: 12 }}><option value="">— Charakter —</option>{model.charaktere.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input type="text" value={text} placeholder="Was ist aufgefallen?" style={{ flex: 1, minWidth: 200 }} onChange={(ev) => setText(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") speichernSeed(); }} />
        <button className="knopf primaer" style={{ fontSize: 12 }} onClick={speichernSeed}>speichern</button>
      </>}
      {offen === "todo" && <>
        <select value={ziel} onChange={(ev) => setZiel(ev.target.value)} style={{ fontSize: 12 }}><option value="sitzung">{aktuelle ? "Sitzung #" + aktuelle.nummer : "Sitzung (keine aktuell)"}</option><option value="kampagne">Kampagne</option></select>
        <input type="text" value={text} placeholder="Todo …" style={{ flex: 1, minWidth: 200 }} onChange={(ev) => setText(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") speichernTodo(); }} />
        <button className="knopf primaer" style={{ fontSize: 12 }} onClick={speichernTodo}>speichern</button>
      </>}
      {offen === "reise" && <>
        <button className="knopf primaer" style={{ fontSize: 12 }} onClick={knotenBetreten}>+ Knoten betreten</button>
        <span style={{ fontSize: 12, color: C.dim }}>Ration & Fackel alle {model.kanalRegeln.rationAlle} Knoten — nächste bei Knoten {Math.ceil((model.reise.knoten + 1) / (model.kanalRegeln.rationAlle || 3)) * (model.kanalRegeln.rationAlle || 3)}</span>
        <button className="knopf leise" style={{ fontSize: 12 }} onClick={() => upd((m) => { m.reise.knoten = 0; })}>zurücksetzen</button>
      </>}
    </div>
  );
}
function SeedsKasten({ model, upd }) {
  const [filter, setFilter] = useState("offen");
  const liste = model.seeds.filter((x) => filter === "alle" || x.status === filter).sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  const sf = (id, k, v) => upd((m) => { const x = m.seeds.find((y) => y.id === id); if (x) x[k] = v; });
  return (
    <Kasten titel={`Seeds (${model.seeds.length})`} farbe={C.gold} extra={<select value={filter} onChange={(ev) => setFilter(ev.target.value)}><option value="alle">alle</option>{SEED_STATUS.map((st) => <option key={st}>{st}</option>)}</select>}>
      <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>Punkte, die du während der Sitzung aufschnappst — Backstory-Elemente, Geheimnisse, lose Fäden. Über die 🌱-Leiste oben jederzeit erfassen; hier pflegen: offen → gepflanzt (in eine Sitzung eingebaut) → aufgegangen (von den Spielern aufgegriffen).</p>
      <div style={{ display: "grid", gap: 6 }}>
        {liste.map((x) => (
          <div key={x.id} style={{ display: "grid", gridTemplateColumns: "80px 110px 1fr 130px 120px 30px", gap: 6, alignItems: "center", fontSize: 12.5 }}>
            <span style={{ color: C.dim }}>{x.ts}{x.sitzungId ? " #" + (model.sitzungen.find((y) => y.id === x.sitzungId)?.nummer ?? "?") : ""}</span>
            <select value={x.kategorie} onChange={(ev) => sf(x.id, "kategorie", ev.target.value)}>{SEED_KAT.map((k) => <option key={k}>{k}</option>)}{!SEED_KAT.includes(x.kategorie) && <option>{x.kategorie}</option>}</select>
            <input type="text" value={x.text} onChange={(ev) => sf(x.id, "text", ev.target.value)} />
            <select value={x.charakterId || ""} onChange={(ev) => sf(x.id, "charakterId", ev.target.value || null)}><option value="">— Charakter —</option>{model.charaktere.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select value={x.status} onChange={(ev) => sf(x.id, "status", ev.target.value)}>{SEED_STATUS.map((st) => <option key={st}>{st}</option>)}</select>
            <button className="knopf leise" style={{ padding: "0 6px" }} onClick={() => upd((m) => { m.seeds = m.seeds.filter((y) => y.id !== x.id); })}>✕</button>
          </div>
        ))}
        {liste.length === 0 && <span style={{ color: C.dim, fontSize: 12.5 }}>Keine Seeds mit diesem Status.</span>}
      </div>
    </Kasten>
  );
}


/* ── Todo-Übersicht über alle Artikel ── */
function TodoUebersicht({ model, upd, springe }) {
  const [zeigeErledigt, setZeigeErledigt] = useState(false);
  const [typ, setTyp] = useState("alle");
  const quellen = [
    ...(model.kampagne.todos || []).map((t) => ({ t, typ: "Kampagne", name: model.kampagne.name, pfad: ["kampagne"] })),
    ...model.arcs.flatMap((a) => (a.todos || []).map((t) => ({ t, typ: "Arc", name: `Arc ${a.nummer} ${a.titel}`, pfad: ["arcs", a.id] }))),
    ...model.sitzungen.flatMap((x) => (x.todos || []).map((t) => ({ t, typ: "Sitzung", name: `#${x.nummer} ${x.titel}`, pfad: ["sitzungen", x.id] }))),
    ...model.quests.flatMap((q) => (q.todos || []).map((t) => ({ t, typ: "Quest", name: q.titel, pfad: ["quests", q.id] }))),
    ...model.npcs.flatMap((n) => (n.todos || []).map((t) => ({ t, typ: "NPC", name: n.name, pfad: ["npcs", n.id] }))),
  ].filter((q) => (zeigeErledigt || !q.t.erledigt) && (typ === "alle" || q.typ === typ));
  const setzeErledigt = (q, v) => upd((m) => {
    const liste = q.pfad[0] === "kampagne" ? m.kampagne.todos : m[q.pfad[0]].find((x) => x.id === q.pfad[1])?.todos;
    const t = (liste || []).find((x) => x.id === q.t.id); if (t) t.erledigt = v;
  });
  return (
    <Kasten titel={`Todos (${quellen.length})`} extra={<div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <select value={typ} onChange={(ev) => setTyp(ev.target.value)}><option value="alle">alle Herkünfte</option>{["Kampagne", "Arc", "Sitzung", "Quest", "NPC"].map((x) => <option key={x}>{x}</option>)}</select>
      <label style={{ fontSize: 12, display: "flex", gap: 4 }}><input type="checkbox" checked={zeigeErledigt} onChange={(ev) => setZeigeErledigt(ev.target.checked)} />erledigte zeigen</label>
    </div>}>
      {quellen.length === 0 && <span style={{ color: C.dim, fontSize: 12.5 }}>Nichts offen.</span>}
      <Unfertiges model={model} />
      <div style={{ display: "grid", gap: 3 }}>
        {quellen.map((q) => (
          <div key={q.t.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
            <input type="checkbox" checked={!!q.t.erledigt} style={{ width: 16, flex: "0 0 16px" }} onChange={(ev) => setzeErledigt(q, ev.target.checked)} />
            <span style={{ flex: "1 1 auto", minWidth: 0, textDecoration: q.t.erledigt ? "line-through" : "none", color: q.t.erledigt ? C.dim : C.kreide }}>{q.t.text}</span>
            <button className="knopf leise" style={{ fontSize: 11, padding: "0 6px", whiteSpace: "nowrap" }} onClick={() => springe({ Kampagne: "geschichte", Arc: "geschichte", Sitzung: "geschichte", Quest: "quests", NPC: "zonen" }[q.typ], q.pfad[1])}>{q.typ} · {q.name} →</button>
          </div>
        ))}
      </div>
    </Kasten>
  );
}


/* ── Artikel-Adapter, Kompendium, Schema-Editor ── */
function genericMd(a) {
  const o = a.obj; const z = ["---", `typ: ${a.art}`, `subtyp: ${a.subtyp || ""}`, `status: ${a.status}`, "tags:", ...(a.tags || []).map((t) => "  - " + t)];
  Object.entries(o).forEach(([k, v]) => { if (["id", "zusatz", "tags", "status", "todos", "beschreibung", "text", "notiz", "beziehungen", "interaktionen", "historie", "abilities", "skills", "attacks", "features", "background"].includes(k)) return; if (["string", "number", "boolean"].includes(typeof v) && String(v).length < 200) z.push(`${k}: ${String(v).replace(/\n/g, " ")}`); });
  Object.entries(o.zusatz || {}).forEach(([k, v]) => z.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v).replace(/\n/g, " ")}`));
  z.push("---", "", `# ${a.name}`, "", o.beschreibung || o.text || o.idee || "", o.notiz ? "\n> [!note] SL\n> " + o.notiz.replace(/\n/g, "\n> ") : "");
  return z.join("\n");
}
function alleArtikel(model) {
  const a = [];
  const p = (art, subtyp, x, name, status, md) => a.push({ art, subtyp: subtyp || "Standard", id: x.id, name: name || x.name || "?", status: status || x.status || "Ansatz", tags: x.tags || [], obj: x, md });
  Object.values(model.monster).forEach((x) => p("Statblock", "Standard", x, x.name, x.status, () => monsterZuMd(x, model)));
  Object.values(model.gegenstaende).forEach((x) => p("Gegenstand", x.gtyp, x, x.name, x.status, () => gegenstandZuMd(x)));
  model.rezepte.forEach((x) => p("Rezept", x.beruf || "Standard", x, x.name, x.status, () => rezeptZuMd(x, model)));
  model.regeln.forEach((x) => p("Regel", x.art, x, x.name, x.status));
  model.npcs.forEach((x) => p("NPC", x.subtyp, x, x.name, x.status));
  Object.values(model.orte).forEach((x) => p("Ort", x.subtyp, x, x.name, x.status));
  model.quests.forEach((x) => p("Quest", x.subtyp, x, x.titel, x.status2));
  model.encounters.forEach((x) => p("Encounter", x.typ, x, x.t, x.status));
  model.charaktere.forEach((x) => p("Charakter", x.subtyp, x, x.name, x.status));
  model.sitzungen.forEach((x) => p("Sitzung", "Standard", x, `#${x.nummer} ${x.titel}`, x.status || "Ansatz"));
  a.forEach((x) => { if (!x.md) x.md = () => genericMd(x); });
  return a;
}
const ART_TAB = { Statblock: "monster", Gegenstand: "gegenstaende", Rezept: "gegenstaende", Regel: "regeln", NPC: "zonen", Ort: "orte", Quest: "quests", Encounter: "encounter", Charakter: "gruppe", Sitzung: "geschichte" };
function statusSetzen(m, a, v) {
  const map = { Statblock: () => m.monster[a.id], Gegenstand: () => m.gegenstaende[a.id], Rezept: () => m.rezepte.find((x) => x.id === a.id), Regel: () => m.regeln.find((x) => x.id === a.id), NPC: () => m.npcs.find((x) => x.id === a.id), Ort: () => m.orte[a.id], Quest: () => m.quests.find((x) => x.id === a.id), Encounter: () => m.encounters.find((x) => x.id === a.id), Charakter: () => m.charaktere.find((x) => x.id === a.id), Sitzung: () => m.sitzungen.find((x) => x.id === a.id) };
  const o = map[a.art]?.(); if (!o) return; if (a.art === "Quest") o.status2 = v; else o.status = v;
}
function Unfertiges({ model }) {
  const [art, setArt] = useState("alle");
  const [status, setStatus] = useState("alle");
  const liste = alleArtikel(model).filter((a) => a.status !== "Abgeschlossen" && (art === "alle" || a.art === art) && (status === "alle" || a.status === status)).sort((a, b) => a.art.localeCompare(b.art) || a.name.localeCompare(b.name));
  const arten = [...new Set(alleArtikel(model).map((a) => a.art))].sort();
  return (
    <details>
      <summary style={{ cursor: "pointer", color: C.amber, fontSize: 13 }}>Unfertige Artikel ({liste.length})</summary>
      <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
        <select value={art} onChange={(ev) => setArt(ev.target.value)}><option value="alle">alle Arten</option>{arten.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={status} onChange={(ev) => setStatus(ev.target.value)}><option value="alle">Idee & Ansatz</option><option>Idee</option><option>Ansatz</option></select>
      </div>
      <div style={{ display: "grid", gap: 2, fontSize: 12.5 }}>
        {liste.map((a) => <div key={a.art + a.id}><span style={{ color: STATUS_FARBE[a.status] }}>{a.status}</span> · <span style={{ color: C.dim }}>{a.art}/{a.subtyp}</span> · {a.name}</div>)}
      </div>
    </details>
  );
}
function KompendiumTab({ model, upd, setModel, springe }) {
  const [q, setQ] = useState("");
  const [art, setArt] = useState("alle");
  const [subtyp, setSubtyp] = useState("alle");
  const [status, setStatus] = useState("alle");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("name");
  const [sel, setSel] = useState({});
  const [io, setIo] = useState("");
  const [schemaArt, setSchemaArt] = useState("Gegenstand");
  const [neuSub, setNeuSub] = useState("");
  const [neuAnsicht, setNeuAnsicht] = useState("");
  const [umben, setUmben] = useState({});
  const gf = useContext(FilterCtx);
  const alle = alleArtikel(model).filter((a) => passtFilter(gf, a.obj, a.name));
  const arten = [...new Set(alle.map((a) => a.art))].sort();
  const subtypen = [...new Set(alle.filter((a) => art === "alle" || a.art === art).map((a) => a.subtyp))].sort();
  const liste = alle.filter((a) => (art === "alle" || a.art === art) && (subtyp === "alle" || a.subtyp === subtyp) && (status === "alle" || a.status === status) && (!tag || (a.tags || []).some((t) => t.toLowerCase().includes(tag.toLowerCase()))) && (!q || a.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "art" ? a.art.localeCompare(b.art) || a.name.localeCompare(b.name) : STATUS_LISTE.indexOf(a.status) - STATUS_LISTE.indexOf(b.status) || a.name.localeCompare(b.name));
  const gewaehlt = liste.filter((a) => sel[a.art + a.id]);
  const ziel = () => (gewaehlt.length ? gewaehlt : liste);
  const exportMd = () => setIo(ziel().map((a) => a.md()).join("\n\n"));
  const exportJson = () => setIo(JSON.stringify({ kanalgangArtikel: ziel().map((a) => ({ art: a.art, obj: a.obj })) }, null, 1));
  const importJson = () => {
    try {
      const roh = JSON.parse(io); const liste2 = roh.kanalgangArtikel; if (!Array.isArray(liste2)) throw new Error("kein Artikel-Export");
      upd((m) => liste2.forEach(({ art: a, obj }) => {
        const o = structuredClone(obj);
        const einfuegen = (arr) => { const i = arr.findIndex((x) => x.id === o.id); if (i >= 0) arr[i] = o; else arr.push(o); };
        ({ Statblock: () => { m.monster[o.id] = o; }, Gegenstand: () => { m.gegenstaende[o.id] = o; }, Ort: () => { m.orte[o.id] = o; }, Rezept: () => einfuegen(m.rezepte), Regel: () => einfuegen(m.regeln), NPC: () => einfuegen(m.npcs), Quest: () => einfuegen(m.quests), Encounter: () => einfuegen(m.encounters), Charakter: () => einfuegen(m.charaktere), Sitzung: () => einfuegen(m.sitzungen) }[a] || (() => {}))();
      }));
      hinweis(liste2.length + " Artikel importiert (gleiche IDs ersetzt).");
    } catch (err) { hinweis("Import fehlgeschlagen: " + err.message); }
  };
  const sch = model.schemata[schemaArt] || { subtypen: {} };
  const feldSet = (sub, i, k, v) => upd((m) => { m.schemata[schemaArt].subtypen[sub][i][k] = v; });
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Kasten titel={`Kompendium (${liste.length} von ${alle.length})`} extra={<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="knopf" onClick={exportMd}>{gewaehlt.length ? `${gewaehlt.length} gewählte` : "gefilterte"} als .md</button>
        <button className="knopf" onClick={exportJson}>als JSON</button>
        <button className="knopf primaer" onClick={importJson}>JSON importieren</button>
      </div>}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <input type="text" value={q} placeholder="Suche …" style={{ width: 160 }} onChange={(ev) => setQ(ev.target.value)} />
          <select value={art} onChange={(ev) => { setArt(ev.target.value); setSubtyp("alle"); }}><option value="alle">alle Arten</option>{arten.map((x) => <option key={x}>{x}</option>)}</select>
          <select value={subtyp} onChange={(ev) => setSubtyp(ev.target.value)}><option value="alle">alle Subtypen</option>{subtypen.map((x) => <option key={x}>{x}</option>)}</select>
          <select value={status} onChange={(ev) => setStatus(ev.target.value)}><option value="alle">alle Status</option>{STATUS_LISTE.map((x) => <option key={x}>{x}</option>)}</select>
          <input type="text" value={tag} placeholder="Tag" style={{ width: 110 }} onChange={(ev) => setTag(ev.target.value)} />
          <select value={sort} onChange={(ev) => setSort(ev.target.value)}><option value="name">Sortierung: Name</option><option value="art">Art</option><option value="status">Status</option></select>
          {gewaehlt.length > 0 && <>
            <span style={{ fontSize: 12, color: C.dim }}>{gewaehlt.length} gewählt →</span>
            {STATUS_LISTE.map((st) => <button key={st} className="knopf" style={{ fontSize: 11.5, borderColor: STATUS_FARBE[st] }} onClick={() => upd((m) => gewaehlt.forEach((a) => statusSetzen(m, a, st)))}>{st}</button>)}
            <button className="knopf leise" style={{ fontSize: 11.5 }} onClick={() => setSel({})}>Auswahl leeren</button>
          </>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 110px 120px 100px 1fr 70px", gap: 6, fontSize: 10.5, color: C.dim, padding: "0 6px" }}>
          <input type="checkbox" checked={liste.length > 0 && liste.every((a) => sel[a.art + a.id])} onChange={(ev) => { const n = { ...sel }; liste.forEach((a) => { n[a.art + a.id] = ev.target.checked; }); setSel(n); }} />
          <span>Name</span><span>Art</span><span>Subtyp</span><span>Status</span><span>Tags</span><span />
        </div>
        <div style={{ display: "grid", gap: 2, maxHeight: 520, overflowY: "auto" }}>
          {liste.map((a) => (
            <div key={a.art + a.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr 110px 120px 100px 1fr 70px", gap: 6, alignItems: "center", fontSize: 12.5, padding: "3px 6px", borderRadius: 3, background: sel[a.art + a.id] ? C.wand2 : "transparent" }}>
              <input type="checkbox" checked={!!sel[a.art + a.id]} onChange={(ev) => setSel({ ...sel, [a.art + a.id]: ev.target.checked })} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
              <span style={{ color: C.dim }}>{a.art}</span><span style={{ color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.subtyp}</span>
              <select value={a.status} style={{ fontSize: 11, padding: "1px 4px", color: STATUS_FARBE[a.status] }} onChange={(ev) => upd((m) => statusSetzen(m, a, ev.target.value))}>{STATUS_LISTE.map((st) => <option key={st}>{st}</option>)}</select>
              <span style={{ color: C.dim, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(a.tags || []).join(", ")}</span>
              <button className="knopf leise" style={{ fontSize: 11, padding: "1px 6px" }} onClick={() => springe(ART_TAB[a.art], a.id)}>öffnen</button>
            </div>
          ))}
        </div>
        <textarea rows={6} value={io} onChange={(ev) => setIo(ev.target.value)} placeholder="Export erscheint hier (.md zum Einfügen in Obsidian, JSON zum Re-Import) — oder Artikel-JSON zum Importieren einfügen." style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }} />
      </Kasten>

      {(
        <Kasten titel={`Ansichten — ${ART_LABEL[schemaArt] || schemaArt}`} extra={<span style={{ display: "flex", gap: 6 }}><input type="text" value={neuAnsicht} placeholder="Neue Ansicht" style={{ width: 150 }} onChange={(ev) => setNeuAnsicht(ev.target.value)} /><button className="knopf" onClick={() => { const n = neuAnsicht.trim(); if (!n) return; upd((m) => { if (!m.ansichten[schemaArt]) m.ansichten[schemaArt] = {}; m.ansichten[schemaArt][n] = []; }); setNeuAnsicht(""); }}>+ Ansicht</button></span>}>
          <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>Welche Felder eine Ansicht in welcher Reihenfolge zeigt. Quick-Add = Minimalform beim schnellen Anlegen (erzeugt immer Status Idee), Kurz = Chips/Pinnwand/Sitzung, Spieler = maximal spielersichtbare Felder (Grundlage der Informationen).</p>
          {Object.entries(model.ansichten[schemaArt] || {}).map(([an, keys]) => {
            const felder = alleFelder(model, schemaArt);
            const set = (v) => upd((m) => { m.ansichten[schemaArt][an] = v; });
            return (
              <div key={an} style={{ borderLeft: `3px solid ${C.teal}`, paddingLeft: 8, display: "grid", gap: 4 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><strong>{an}</strong>
                  <select value="" style={{ fontSize: 11 }} onChange={(ev) => { if (ev.target.value && !keys.includes(ev.target.value)) set([...keys, ev.target.value]); }}><option value="">+ Feld …</option>{felder.filter((f) => !keys.includes(f.key)).map((f) => <option key={f.key} value={f.key}>{f.label}{f.kern ? "" : " (Schema)"}</option>)}</select>
                  {!["Quick-Add", "Kurz", "Spieler"].includes(an) && <button className="knopf leise" style={{ fontSize: 11 }} onClick={() => upd((m) => { delete m.ansichten[schemaArt][an]; })}>✕ Ansicht</button>}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {keys.map((k, i) => { const f = felder.find((x) => x.key === k); return (
                    <span key={k} style={{ background: C.bg, border: `1px solid ${C.linie}`, borderRadius: 3, padding: "1px 6px", fontSize: 11.5, display: "inline-flex", gap: 4, alignItems: "center" }}>
                      {f ? f.label : k}
                      <button className="knopf leise" style={{ padding: "0 3px", fontSize: 10 }} onClick={() => { if (i > 0) { const n = [...keys]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set(n); } }}>◀</button>
                      <button className="knopf leise" style={{ padding: "0 3px", fontSize: 10 }} onClick={() => { if (i < keys.length - 1) { const n = [...keys]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set(n); } }}>▶</button>
                      <button className="knopf leise" style={{ padding: "0 3px", fontSize: 10 }} onClick={() => set(keys.filter((x) => x !== k))}>✕</button>
                    </span>); })}
                </div>
              </div>
            );
          })}
        </Kasten>
      )}
      <Kasten titel="Schemata — Arten, Subtypen, Felder" extra={<button className="knopf leise" onClick={() => springe("monster", null)}>Variablen (AB, DC …) → Tab Statblocks</button>}>
        <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>Jede Art hat Subtypen mit eigenen Feldern; die Felder erscheinen im jeweiligen Formular als Zusatzfelder. Feldtypen: Text, Absatz, Zahl, Auswahl (Optionen), Verweis/Verweise (auf eine andere Art), Tags.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.keys(model.schemata).map((a) => <button key={a} className={"knopf " + (schemaArt === a ? "an" : "")} onClick={() => setSchemaArt(a)}>{ART_LABEL[a] || a}</button>)}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="text" value={neuSub} placeholder="Neuer Subtyp" style={{ width: 200 }} onChange={(ev) => setNeuSub(ev.target.value)} />
          <button className="knopf" onClick={() => { const n = neuSub.trim(); if (!n) return; upd((m) => { if (!m.schemata[schemaArt].subtypen[n]) m.schemata[schemaArt].subtypen[n] = []; }); setNeuSub(""); }}>+ Subtyp</button>
        </div>
        {Object.entries(sch.subtypen).map(([sub, felder]) => (
          <div key={sub} style={{ borderLeft: `3px solid ${C.lila}`, paddingLeft: 8, display: "grid", gap: 4 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong>{sub}</strong><span style={{ color: C.dim, fontSize: 11.5 }}>{felder.length} Feld(er)</span>
              <input type="text" value={((model.schemata[schemaArt].info || {})[sub] || {}).beschreibung || ""} placeholder="Beschreibung des Subtyps" style={{ width: 220, fontSize: 11 }} onChange={(ev) => upd((m) => { const sch = m.schemata[schemaArt]; sch.info = sch.info || {}; sch.info[sub] = { ...(sch.info[sub] || {}), beschreibung: ev.target.value }; })} />
              <button className="knopf leise" style={{ fontSize: 11 }} onClick={() => upd((m) => m.schemata[schemaArt].subtypen[sub].push({ key: "feld" + (felder.length + 1), label: "Neues Feld", typ: "text" }))}>+ Feld</button>
              <input type="text" value={umben[sub] ?? ""} placeholder="umbenennen …" style={{ width: 130, fontSize: 11 }} onChange={(ev) => setUmben({ ...umben, [sub]: ev.target.value })} />
              <button className="knopf leise" style={{ fontSize: 11 }} onClick={() => { const neu = (umben[sub] || "").trim(); if (!neu || neu === sub) return; setUmben({ ...umben, [sub]: "" }); upd((m) => { const st = m.schemata[schemaArt].subtypen; if (st[neu]) return; st[neu] = st[sub]; delete st[sub]; const um = (o, k) => { if (o[k] === sub) o[k] = neu; }; if (schemaArt === "Gegenstand") Object.values(m.gegenstaende).forEach((g) => um(g, "gtyp")); if (schemaArt === "Regel") m.regeln.forEach((r) => um(r, "art")); if (schemaArt === "NPC") m.npcs.forEach((n) => um(n, "subtyp")); if (schemaArt === "Ort") Object.values(m.orte).forEach((o) => um(o, "subtyp")); if (schemaArt === "Quest") m.quests.forEach((q) => um(q, "subtyp")); if (schemaArt === "Charakter") m.charaktere.forEach((c) => um(c, "subtyp")); }); }}>umbenennen</button>
              <button className="knopf leise" style={{ fontSize: 11 }} onClick={() => { if (bestaetigen(`Subtyp «${sub}» löschen? Artikel fallen auf den ersten Subtyp zurück.`)) upd((m) => { const st = m.schemata[schemaArt].subtypen; delete st[sub]; const ers = Object.keys(st)[0] || "Standard"; const um = (o, k) => { if (o[k] === sub) o[k] = ers; }; if (schemaArt === "Gegenstand") Object.values(m.gegenstaende).forEach((g) => um(g, "gtyp")); if (schemaArt === "Regel") m.regeln.forEach((r) => um(r, "art")); if (schemaArt === "NPC") m.npcs.forEach((n) => um(n, "subtyp")); if (schemaArt === "Ort") Object.values(m.orte).forEach((o) => um(o, "subtyp")); if (schemaArt === "Quest") m.quests.forEach((q) => um(q, "subtyp")); if (schemaArt === "Charakter") m.charaktere.forEach((c) => um(c, "subtyp")); }); }}>✕ Subtyp</button>
            </div>
            {felder.map((f, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr 110px 120px 1fr 30px", gap: 6, fontSize: 12 }}>
                <input type="text" value={f.key} title="Schlüssel" onChange={(ev) => feldSet(sub, i, "key", ev.target.value.replace(/[^\w]/g, ""))} />
                <input type="text" value={f.label} title="Bezeichnung" onChange={(ev) => feldSet(sub, i, "label", ev.target.value)} />
                <select value={f.typ} onChange={(ev) => feldSet(sub, i, "typ", ev.target.value)}>{["text", "absatz", "zahl", "auswahl", "verweis", "verweise", "tags"].map((t) => <option key={t}>{t}</option>)}</select>
                {["verweis", "verweise"].includes(f.typ) ? <select value={f.ziel || ""} onChange={(ev) => feldSet(sub, i, "ziel", ev.target.value)}><option value="">Ziel …</option>{Object.keys(ART_KEY).map((z) => <option key={z}>{z}</option>)}</select> : <span />}
                {f.typ === "auswahl" ? <input type="text" value={(f.optionen || []).join(", ")} placeholder="Optionen, kommagetrennt" onChange={(ev) => feldSet(sub, i, "optionen", ev.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /> : <span />}
                <button className="knopf leise" onClick={() => upd((m) => { m.schemata[schemaArt].subtypen[sub].splice(i, 1); })}>✕</button>
              </div>
            ))}
          </div>
        ))}
      </Kasten>
    </div>
  );
}


/* ── Loot: Listen, Tabellen (Würfelbereiche, rekursiv) ── */
const wuerfle = (w) => { const n = parseInt(String(w).replace(/^d/i, ""), 10) || 100; return Math.floor(Math.random() * n) + 1; };
function lootAufloesen(model, tabId, tiefe = 0, kette = []) {
  const t = model.lootTabellen.find((x) => x.id === tabId); if (!t || tiefe > 6) return { ergebnisse: [], kette };
  const wurf = wuerfle(t.wuerfel);
  const e = (t.eintraege || []).find((x) => wurf >= (+x.von || 1) && wurf <= (+x.bis || 0));
  const k = [...kette, `${t.name}: ${t.wuerfel} → ${wurf}${e ? "" : " (kein Eintrag)"}`];
  if (!e) return { ergebnisse: [], kette: k };
  if (e.tabelleId) return lootAufloesen(model, e.tabelleId, tiefe + 1, k);
  return { ergebnisse: [{ id: "lt" + Date.now() + Math.floor(Math.random() * 99), itemId: e.itemId || null, text: e.itemId ? (model.gegenstaende[e.itemId]?.name || "") : (e.text || ""), menge: e.menge || "1" }], kette: k };
}
function LootBox({ model, upd, obj, setzen }) {
  const liste = obj.lootListe || [];
  const tabs = obj.lootTabellen || [];
  const items = Object.values(model.gegenstaende).sort((a, b) => a.name.localeCompare(b.name));
  const setListe = (l) => setzen("lootListe", l);
  return (
    <div className="feld">Loot ({liste.length})
      <div style={{ display: "grid", gap: 4 }}>
        {liste.map((l, i) => (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 30px", gap: 6, alignItems: "center" }}>
            <input type="text" value={l.menge || "1"} title="Menge" onChange={(ev) => setListe(liste.map((x, j) => (j === i ? { ...x, menge: ev.target.value } : x)))} />
            <select value={l.itemId || ""} onChange={(ev) => setListe(liste.map((x, j) => (j === i ? { ...x, itemId: ev.target.value || null, text: ev.target.value ? model.gegenstaende[ev.target.value].name : x.text } : x)))}><option value="">— Freitext —</option>{items.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            <input type="text" value={l.text || ""} placeholder="Freitext" onChange={(ev) => setListe(liste.map((x, j) => (j === i ? { ...x, text: ev.target.value } : x)))} />
            <button className="knopf leise" style={{ padding: "0 6px" }} onClick={() => setListe(liste.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button className="knopf" style={{ fontSize: 12 }} onClick={() => setListe([...liste, { id: "lt" + Date.now(), itemId: null, text: "", menge: "1" }])}>+ Loot</button>
          <QuickAdd model={model} upd={upd} art="Gegenstand" kompakt onCreated={(id) => setListe([...liste, { id: "lt" + Date.now(), itemId: id, text: "", menge: "1" }])} />
          <Chips label="" ids={tabs} optionen={model.lootTabellen.map((t) => ({ id: t.id, name: t.name }))} setzen={(v) => setzen("lootTabellen", v)} leer="+ Loot-Tabelle …" />
          {tabs.map((tid) => { const t = model.lootTabellen.find((x) => x.id === tid); return t && <button key={tid} className="knopf primaer" style={{ fontSize: 12 }} onClick={() => { const r = lootAufloesen(model, tid); setListe([...liste, ...r.ergebnisse]); hinweis(r.kette.join(" › ") + (r.ergebnisse.length ? " ⇒ " + r.ergebnisse.map((x) => x.menge + "× " + x.text).join(", ") : "")); }}>🎲 {t.name}</button>; })}
        </div>
      </div>
    </div>
  );
}
function LootTabellen({ model, upd }) {
  const [tid, setTid] = useState(null);
  const t = model.lootTabellen.find((x) => x.id === tid) || null;
  const tf = (k, v) => upd((m) => { const x = m.lootTabellen.find((y) => y.id === tid); if (x) x[k] = v; });
  const ef = (i, k, v) => tf("eintraege", t.eintraege.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const items = Object.values(model.gegenstaende).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {model.lootTabellen.map((x) => <button key={x.id} className={"knopf " + (tid === x.id ? "primaer" : "")} onClick={() => setTid(tid === x.id ? null : x.id)}>{x.name} <span style={{ color: tid === x.id ? "#241a08" : C.dim }}>{x.wuerfel}</span></button>)}
        <button className="knopf" onClick={() => { const id = "lt" + Date.now(); upd((m) => m.lootTabellen.push({ id, name: "Neue Loot-Tabelle", wuerfel: "d100", eintraege: [], status: "Idee", zusatz: {}, tags: [] })); setTid(id); }}>+ Loot-Tabelle</button>
      </div>
      {t && (
        <div style={{ display: "grid", gap: 8, borderLeft: `3px solid ${C.gold}`, paddingLeft: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8 }}><T l="Name" v={t.name} setzen={(v) => tf("name", v)} /><T l="Würfel" v={t.wuerfel} setzen={(v) => tf("wuerfel", v)} /></div>
          <StatusWahl obj={t} setzen={(v) => tf("status", v)} />
          <div style={{ display: "grid", gridTemplateColumns: "60px 60px 1fr 1fr 1fr 60px 30px", gap: 6, fontSize: 10.5, color: C.dim }}><span>von</span><span>bis</span><span>Gegenstand</span><span>oder Tabelle</span><span>oder Text</span><span>Menge</span><span /></div>
          {(t.eintraege || []).map((e, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 60px 1fr 1fr 1fr 60px 30px", gap: 6, alignItems: "center" }}>
              <input type="number" value={e.von} onChange={(ev) => ef(i, "von", +ev.target.value)} /><input type="number" value={e.bis} onChange={(ev) => ef(i, "bis", +ev.target.value)} />
              <select value={e.itemId || ""} onChange={(ev) => ef(i, "itemId", ev.target.value || null)}><option value="">—</option>{items.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <select value={e.tabelleId || ""} onChange={(ev) => ef(i, "tabelleId", ev.target.value || null)}><option value="">—</option>{model.lootTabellen.filter((x) => x.id !== tid).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              <input type="text" value={e.text || ""} onChange={(ev) => ef(i, "text", ev.target.value)} />
              <input type="text" value={e.menge || "1"} onChange={(ev) => ef(i, "menge", ev.target.value)} />
              <button className="knopf leise" style={{ padding: "0 6px" }} onClick={() => tf("eintraege", t.eintraege.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <button className="knopf" style={{ fontSize: 12 }} onClick={() => { const letzte = t.eintraege[t.eintraege.length - 1]; const von = letzte ? (+letzte.bis || 0) + 1 : 1; tf("eintraege", [...t.eintraege, { von, bis: von, itemId: null, tabelleId: null, text: "", menge: "1" }]); }}>+ Eintrag</button>
            <button className="knopf" style={{ fontSize: 12 }} onClick={() => { const r = lootAufloesen(model, tid); hinweis(r.kette.join(" › ") + (r.ergebnisse.length ? " ⇒ " + r.ergebnisse.map((x) => x.menge + "× " + x.text).join(", ") : "")); }}>🎲 Probewurf</button>
            <button className="knopf gefahr" style={{ fontSize: 12 }} onClick={() => { if (!bestaetigen("Loot-Tabelle löschen?")) return; upd((m) => { m.lootTabellen = m.lootTabellen.filter((x) => x.id !== tid); }); setTid(null); }}>Löschen</button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ── Wissen & Informationen ── */
const INFO_ART = { text: "Freitext", artikel: "Artikel-Felder", abwehr: "Abwehr-Eintrag", knoten: "Kanalknoten", ort: "Ort auf der Karte" };
const artikelName = (m, art, id) => ({ NPC: () => m.npcs.find((x) => x.id === id)?.name, Ort: () => m.orte[id]?.name, Gegenstand: () => m.gegenstaende[id]?.name, Quest: () => m.quests.find((x) => x.id === id)?.titel, Regel: () => m.regeln.find((x) => x.id === id)?.name, Fraktion: () => m.fraktionen.find((x) => x.id === id)?.name, Statblock: () => m.monster[id]?.name }[art] || (() => ""))();
function neueInfo(m, extra) { const o = { id: "in" + Date.now() + Math.floor(Math.random() * 999), titel: "", art: "text", text: "", artikelArt: null, artikelId: null, felder: [], typId: null, abwehrIdx: null, nodeId: null, ortId: null, wissenId: null, gruppe: false, charaktere: [], sitzungId: m.aktuelleSitzungId || null, ts: new Date().toISOString().slice(0, 10), status: "Ansatz", tags: [], ...extra }; m.informationen.push(o); return o.id; }
function InfoZuArtikel({ model, upd, art, id }) {
  const liste = model.informationen.filter((x) => x.art === "artikel" && x.artikelArt === art && x.artikelId === id);
  const felder = (model.ansichten[art] || {}).Spieler || [];
  const alle = alleFelder(model, art);
  return (
    <details>
      <summary style={{ cursor: "pointer", color: C.gold, fontSize: 12.5 }}>Informationen zu diesem Artikel ({liste.length}) — was die Gruppe davon kennt</summary>
      <div style={{ display: "grid", gap: 4, marginTop: 4, fontSize: 12 }}>
        {liste.map((x) => <div key={x.id}><span style={{ color: infoBekannt(model, x) ? C.teal : C.dim }}>{infoBekannt(model, x) ? "✔" : "–"}</span> {x.titel} <span style={{ color: C.dim }}>[{(x.felder || []).map((k) => alle.find((f) => f.key === k)?.label || k).join(", ") || "alle Spieler-Felder"}]</span></div>)}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="knopf" style={{ fontSize: 11.5 }} onClick={() => upd((m) => neueInfo(m, { titel: "Identität: " + artikelName(m, art, id), art: "artikel", artikelArt: art, artikelId: id, felder: ["name", "titel"].filter((k) => alle.some((f) => f.key === k)) }))}>+ Identität (Name)</button>
          <button className="knopf" style={{ fontSize: 11.5 }} onClick={() => upd((m) => neueInfo(m, { titel: "Übersicht: " + artikelName(m, art, id), art: "artikel", artikelArt: art, artikelId: id, felder: felder }))}>+ Übersicht (Spieler-Ansicht)</button>
          <span style={{ fontSize: 11, color: C.dim }}>Feldauswahl und Zuweisung im Tab «Wissen».</span>
        </div>
      </div>
    </details>
  );
}
function WissenTab({ model, upd, springe }) {
  const [wid, setWid] = useState(null);
  const [iid, setIid] = useState(null);
  const [filterChar, setFilterChar] = useState("");
  const [filterArt, setFilterArt] = useState("");
  katLabelAus(model);
  const w = model.wissen.find((x) => x.id === wid) || null;
  const info = model.informationen.find((x) => x.id === iid) || null;
  const wf = (k, v) => upd((m) => { const x = m.wissen.find((y) => y.id === wid); if (x) x[k] = v; });
  const inf = (k, v) => upd((m) => { const x = m.informationen.find((y) => y.id === iid); if (x) x[k] = v; });
  const infos = model.informationen.filter((x) => (!filterChar || infoBekannt(model, x, filterChar)) && (!filterArt || x.artikelArt === filterArt || x.art === filterArt));
  const alle = info?.artikelArt ? alleFelder(model, info.artikelArt) : [];
  const spielerFelder = info?.artikelArt ? ((model.ansichten[info.artikelArt] || {}).Spieler || []) : [];
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Kasten titel={`Wissen (${model.wissen.length}) — lernbare Bündel`} farbe={C.gold} extra={<button className="knopf primaer" onClick={() => { const id = "w" + Date.now(); upd((m) => m.wissen.push({ id, name: "Neues Wissen", beschreibung: "", lernen: "", status: "Idee", tags: [] })); setWid(id); }}>+ Wissen</button>}>
        <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>Ein Wissen ist ein Skill (Geschichte, Monsterkunde, Sprache …): Wer es lernt, kennt alle darin gebündelten Informationen. Einzelne Kampagnen-Fakten werden direkt als Information verteilt.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{model.wissen.map((x) => <button key={x.id} className={"knopf " + (wid === x.id ? "primaer" : "")} onClick={() => setWid(wid === x.id ? null : x.id)}>{x.name} <span style={{ color: wid === x.id ? "#241a08" : C.dim }}>{model.informationen.filter((i) => i.wissenId === x.id).length}</span></button>)}</div>
        {w && (
          <div style={{ display: "grid", gap: 8, borderLeft: `3px solid ${C.gold}`, paddingLeft: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><T l="Name" v={w.name} setzen={(v) => wf("name", v)} /><T l="Lernweg (Probe, Lehrer, Buch …)" v={w.lernen} setzen={(v) => wf("lernen", v)} /></div>
            <T l="Beschreibung" v={w.beschreibung} setzen={(v) => wf("beschreibung", v)} rows={2} />
            <StatusWahl obj={w} setzen={(v) => wf("status", v)} />
            <div className="feld">Wer hat es gelernt
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{model.charaktere.map((c) => { const hat = (c.wissen || []).includes(w.id); return <button key={c.id} className={"knopf " + (hat ? "an" : "")} style={{ fontSize: 12 }} onClick={() => upd((m) => { const ch = m.charaktere.find((x) => x.id === c.id); ch.wissen = hat ? ch.wissen.filter((x) => x !== w.id) : [...(ch.wissen || []), w.id]; })}>{c.name}</button>; })}</div>
            </div>
            <div style={{ fontSize: 12.5 }}><span style={{ color: C.dim }}>Enthält:</span> {model.informationen.filter((i) => i.wissenId === w.id).map((i) => i.titel).join(" · ") || "—"}</div>
            <div><button className="knopf gefahr" style={{ fontSize: 12 }} onClick={() => { if (!bestaetigen("Wissen löschen? Informationen bleiben, verlieren nur die Zuordnung.")) return; upd((m) => { m.wissen = m.wissen.filter((x) => x.id !== wid); m.informationen.forEach((i) => { if (i.wissenId === wid) i.wissenId = null; }); m.charaktere.forEach((c) => { c.wissen = (c.wissen || []).filter((x) => x !== wid); }); }); setWid(null); }}>Löschen</button></div>
          </div>
        )}
      </Kasten>

      <Kasten titel={`Informationen (${infos.length} von ${model.informationen.length})`} farbe={C.teal} extra={<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select value={filterChar} onChange={(ev) => setFilterChar(ev.target.value)}><option value="">alle / Gruppe</option>{model.charaktere.map((c) => <option key={c.id} value={c.id}>bekannt für {c.name}</option>)}</select>
        <select value={filterArt} onChange={(ev) => setFilterArt(ev.target.value)}><option value="">alle Arten</option>{Object.entries(INFO_ART).map(([k, l]) => <option key={k} value={k}>{l}</option>)}{Object.keys(ART_KEY).map((a) => <option key={a} value={a}>Artikel: {ART_LABEL[a] || a}</option>)}</select>
        <button className="knopf primaer" onClick={() => { let id; upd((m) => { id = neueInfo(m, { titel: "Neue Information" }); }); setIid(id); }}>+ Information</button>
      </div>}>
        <div style={{ display: "grid", gap: 3, maxHeight: 300, overflowY: "auto" }}>
          {infos.map((x) => (
            <div key={x.id} onClick={() => setIid(x.id)} style={{ display: "grid", gridTemplateColumns: "20px 1fr 120px 1fr 80px", gap: 6, alignItems: "center", fontSize: 12.5, padding: "3px 6px", borderRadius: 3, cursor: "pointer", background: iid === x.id ? C.wand2 : "transparent" }}>
              <span style={{ color: infoBekannt(model, x) ? C.teal : C.dim }}>{infoBekannt(model, x) ? "✔" : "–"}</span>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.titel || "(ohne Titel)"}</span>
              <span style={{ color: C.dim }}>{INFO_ART[x.art]}</span>
              <span style={{ color: C.dim, fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.wissenId ? "Wissen: " + (model.wissen.find((ww) => ww.id === x.wissenId)?.name || "?") : x.gruppe ? "Gruppe" : (x.charaktere || []).map((cid) => model.charaktere.find((c) => c.id === cid)?.name).filter(Boolean).join(", ") || "niemand"}</span>
              <span style={{ color: C.dim, fontSize: 11 }}>{x.ts}</span>
            </div>
          ))}
          {infos.length === 0 && <span style={{ color: C.dim, fontSize: 12.5 }}>Keine Informationen für diesen Filter.</span>}
        </div>
        {info && (
          <div style={{ display: "grid", gap: 8, borderLeft: `3px solid ${C.teal}`, paddingLeft: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
              <T l="Titel" v={info.titel} setzen={(v) => inf("titel", v)} />
              <div className="feld">Art<select value={info.art} onChange={(ev) => inf("art", ev.target.value)}>{Object.entries(INFO_ART).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            </div>
            {info.art === "artikel" && (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                  <div className="feld">Artikel-Art<select value={info.artikelArt || ""} onChange={(ev) => { inf("artikelArt", ev.target.value || null); inf("artikelId", null); inf("felder", []); }}><option value="">—</option>{["NPC", "Ort", "Gegenstand", "Quest", "Regel", "Fraktion", "Statblock"].map((a) => <option key={a} value={a}>{ART_LABEL[a] || a}</option>)}</select></div>
                  <div className="feld">Artikel<select value={info.artikelId || ""} onChange={(ev) => inf("artikelId", ev.target.value || null)}><option value="">—</option>{info.artikelArt === "Fraktion" ? model.fraktionen.map((f) => <option key={f.id} value={f.id}>{f.name}</option>) : refOptionen(model, ART_KEY[info.artikelArt] || "npc").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
                </div>
                {info.artikelArt && info.artikelArt !== "Fraktion" && (
                  <div className="feld">Freigeschaltete Felder (leer = alle Felder der Spieler-Ansicht)
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {alle.filter((f) => spielerFelder.includes(f.key) || (info.felder || []).includes(f.key)).map((f) => { const an = (info.felder || []).includes(f.key); return <button key={f.key} className={"knopf " + (an ? "an" : "")} style={{ fontSize: 11.5 }} onClick={() => inf("felder", an ? info.felder.filter((k) => k !== f.key) : [...(info.felder || []), f.key])}>{f.label}</button>; })}
                      {!spielerFelder.length && <span style={{ fontSize: 11.5, color: C.dim }}>Spieler-Ansicht dieser Art im Kompendium definieren.</span>}
                    </div>
                  </div>
                )}
                {info.artikelArt === "Fraktion" && <span style={{ fontSize: 11.5, color: C.dim }}>Fraktionen: Felder Name/Typ/Hierarchie/Mitglieder — Feinsteuerung folgt mit dem Fraktions-Schema.</span>}
              </div>
            )}
            {info.art === "abwehr" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                <div className="feld">Typ/Ancestry<select value={info.typId || ""} onChange={(ev) => { inf("typId", ev.target.value || null); inf("abwehrIdx", null); }}><option value="">—</option>{model.typen.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                <div className="feld">Eintrag<select value={info.abwehrIdx ?? ""} onChange={(ev) => inf("abwehrIdx", ev.target.value === "" ? null : +ev.target.value)}><option value="">—</option>{(model.typen.find((t) => t.id === info.typId)?.abwehr || []).map((a, i) => <option key={i} value={i}>{KAT_LABEL[a.kat] || a.kat}: {a.text}</option>)}</select></div>
              </div>
            )}
            {info.art === "knoten" && <div className="feld">Kanalknoten<select value={info.nodeId || ""} onChange={(ev) => inf("nodeId", ev.target.value || null)}><option value="">—</option>{Object.values(model.nodes).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>}
            {info.art === "ort" && <div className="feld">Ort<select value={info.ortId || ""} onChange={(ev) => inf("ortId", ev.target.value || null)}><option value="">—</option>{Object.values(model.orte).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
            <T l="Inhalt / Wortlaut (was die Spieler erfahren)" v={info.text} setzen={(v) => inf("text", v)} rows={3} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div className="feld">Gehört zu Wissen<select value={info.wissenId || ""} onChange={(ev) => inf("wissenId", ev.target.value || null)}><option value="">— direkt zugewiesen —</option>{model.wissen.map((ww) => <option key={ww.id} value={ww.id}>{ww.name}</option>)}</select></div>
              <div className="feld">Sitzung<select value={info.sitzungId || ""} onChange={(ev) => inf("sitzungId", ev.target.value || null)}><option value="">—</option>{[...model.sitzungen].sort((a, b) => b.nummer - a.nummer).map((x) => <option key={x.id} value={x.id}>#{x.nummer} {x.titel}</option>)}</select></div>
            </div>
            <div className="feld">Bekannt bei
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className={"knopf " + (info.gruppe ? "an" : "")} style={{ fontSize: 12 }} onClick={() => inf("gruppe", !info.gruppe)}>★ ganze Gruppe</button>
                {model.charaktere.map((c) => { const hat = (info.charaktere || []).includes(c.id); return <button key={c.id} className={"knopf " + (hat ? "an" : "")} style={{ fontSize: 12 }} onClick={() => inf("charaktere", hat ? info.charaktere.filter((x) => x !== c.id) : [...(info.charaktere || []), c.id])}>{c.name}</button>; })}
                {info.wissenId && <span style={{ fontSize: 11.5, color: C.dim }}>+ alle, die «{model.wissen.find((ww) => ww.id === info.wissenId)?.name}» gelernt haben</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <StatusWahl obj={info} setzen={(v) => inf("status", v)} />
              {info.artikelArt && info.artikelId && info.artikelArt !== "Fraktion" && <button className="knopf leise" style={{ fontSize: 12 }} onClick={() => springe(ART_TAB[info.artikelArt], info.artikelId)}>Artikel öffnen →</button>}
              <button className="knopf gefahr" style={{ fontSize: 12 }} onClick={() => { if (!bestaetigen("Information löschen?")) return; upd((m) => { m.informationen = m.informationen.filter((x) => x.id !== iid); }); setIid(null); }}>Löschen</button>
            </div>
          </div>
        )}
      </Kasten>
    </div>
  );
}


/* ── Karten & Ebenen: Welt → Region → Stadt ── */
function KartenVerwaltung({ model, upd, verorten, zeigen }) {
  const kf = (id, k, v) => upd((m) => { const x = m.karten.find((y) => y.id === id); if (x) x[k] = v; });
  const bildLaden = (id, file) => { const rd = new FileReader(); rd.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); const S = 1600; const k = Math.min(S / img.width, 1); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); upd((m) => { const x = m.karten.find((y) => y.id === id); if (x) { x.bild = c.toDataURL("image/jpeg", 0.8); x.w = 1000; x.h = Math.round(1000 * img.height / img.width); } }); }; img.src = rd.result; }; rd.readAsDataURL(file); };
  const ordnung = { welt: 0, region: 1, stadt: 2 };
  return (
    <Kasten titel={`Karten & Ebenen (${model.karten.length})`} extra={<button className="knopf" onClick={() => upd((m) => m.karten.push({ id: "k" + Date.now(), name: "Neue Karte", ebene: "region", elternId: m.karten.find((k) => k.ebene === "welt")?.id || null, bild: "", w: 1000, h: 700, x: null, y: null }))}>+ Karte</button>}>
      <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>Welt → Kontinent/Region → Stadt. Jede Karte trägt eigene Orte, Zonen und Marker; Unterkarten erscheinen als ▣-Marker auf der Elternkarte (Klick = eintauchen). Wasserfeste nutzt die eingebettete Stadtkarte; andere Karten brauchen ein Bild (Datei oder URL; im Self-Host besser als Datei).</p>
      {[...model.karten].sort((a, b) => ordnung[a.ebene] - ordnung[b.ebene] || a.name.localeCompare(b.name)).map((k) => (
        <div key={k.id} style={{ display: "grid", gridTemplateColumns: "1fr 100px 150px 1fr auto", gap: 6, alignItems: "center", fontSize: 12.5 }}>
          <input type="text" value={k.name} onChange={(ev) => kf(k.id, "name", ev.target.value)} />
          <select value={k.ebene} onChange={(ev) => kf(k.id, "ebene", ev.target.value)}><option value="welt">Welt</option><option value="region">Region</option><option value="stadt">Stadt</option></select>
          <select value={k.elternId || ""} onChange={(ev) => kf(k.id, "elternId", ev.target.value || null)}><option value="">— keine Elternkarte —</option>{model.karten.filter((x) => x.id !== k.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {k.id !== "wasserfeste" && <><label className="knopf" style={{ fontSize: 11, cursor: "pointer" }}>{k.bild ? "Bild ersetzen" : "Bild wählen"}<input type="file" accept="image/*" style={{ display: "none" }} onChange={(ev) => ev.target.files[0] && bildLaden(k.id, ev.target.files[0])} /></label>
              <input type="text" placeholder="oder URL" value={k.bild && !k.bild.startsWith("data:") ? k.bild : ""} style={{ width: 120, fontSize: 11 }} onChange={(ev) => kf(k.id, "bild", ev.target.value)} /></>}
            <span style={{ color: C.dim, fontSize: 11 }}>{k.x != null ? "verortet" : "nicht auf der Elternkarte"}</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="knopf" style={{ fontSize: 11 }} onClick={() => zeigen(k.id)}>anzeigen</button>
            {k.elternId && <button className="knopf" style={{ fontSize: 11 }} onClick={() => { zeigen(k.elternId); verorten(k.id); }}>auf Elternkarte setzen</button>}
            {k.id !== "wasserfeste" && <button className="knopf leise" style={{ fontSize: 11 }} onClick={() => { if (bestaetigen("Karte «" + k.name + "» löschen?")) upd((m) => { m.karten = m.karten.filter((x) => x.id !== k.id); m.karten.forEach((x) => { if (x.elternId === k.id) x.elternId = null; }); if (m.aktiveKarteId === k.id) m.aktiveKarteId = "wasserfeste"; }); }}>✕</button>}
          </div>
        </div>
      ))}
    </Kasten>
  );
}
