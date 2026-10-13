# Web-Arbeitsplan: die Oberfläche in `apps/web` nachziehen

**Seit D59 (13.10.) wird nur noch die Seite weiterentwickelt; der Prototyp
ist die Vorlage für den Port.** Aufgaben und Prioritäten stehen auf dem
Projektbrett (W1–W9 und die Port-Aufgaben „Prototyp → Web: …"); dieser Plan
beschreibt die Pakete, die gerade laufen.

Stand 2026-10-13. Auf dev stehen die 24 157 Artikel aus 5e.tools, und die
neue Oberfläche (Kopfleiste, Kompendium, Artikel im Buchstil, Pergament)
läuft. Was die Leitung danach gesehen und verlangt hat, steht hier als
Pakete W1–W7. Jedes Paket ist ein Zweig `feature/<anliegen>` von `preprod`
und ein Pull Request nach `preprod`, selbst gemergt, sobald CI (`check`,
`postgres`) grün ist (CLAUDE.md › Arbeitsweise).

## Vorbild

Die Tafeln des Design-Canvas liegen unter [`docs/design/`](design/) — je
Tafel eine `*.dc.html` mit Inline-Styles, `canvas.json` nennt die Titel.
**Gültig ist der Pergament-Stil** von `Compendium.dc.html` und
`Article.dc.html` (Alegreya, Rot `#8C1C13`, Gold `#C8822E`); er steht als
Marken in `apps/web/src/styles.scss`. Andere Tafeln in anderem Stil
(`Main`, `NavB`, `Mobile`) waren Runde 1 und sind verworfen — von ihnen
gilt der Aufbau, nicht die Farbe. Bausteine fragen nur die Marken, nie eine
Farbe.

Entschieden (12.10. und 13.10.):
- Navigation in der Kopfleiste; Kompendium und Bereiche filtern in der
  Seitenleiste.
- Spielende: die Figur im Fokus, Navigation ähnlich D&D Beyond
  (`Player.dc.html`, `PlayerPhone.dc.html`).
- **Story** statt History: was nur die Kampagne betrifft. Die
  Weltgeschichte steht unter **World** (übernimmt die Hauptsitzung).
- Statblöcke **wie im Buch**: Werte nebeneinander, nicht jedes Feld in
  einer eigenen Zeile — auch am Telefon.

## Regeln für jedes Paket

- `CLAUDE.md` gilt ganz (Englisch im Code, Deutsch in Kommentaren und
  Commits, ss statt ß, REQ/D-Nummern im Kommentar, Doku im selben Commit).
- **Nicht anfassen**: `VTT/Requirements.md`, `VTT/Decision Log.md` — die
  pflegt die Hauptsitzung. Neue Anforderungen und Entscheidungen stehen in
  der PR-Beschreibung unter „Für den Vault".
- Mit echten Daten prüfen: 5e.tools-Daten in einen **eigenen Ordner im
  Scratchpad** holen (`docs/Betrieb.md` › 5e.tools), Datei erzeugen
  (`node packages/import-5etools/dist/cli.js …`), in ein lokales Postgres
  einlesen (`apps/server/dist/import.js`), Oberfläche mit Playwright
  anschauen (Desktop 1360 px und Telefon 390 px). **5e.tools-Daten nie
  committen.**
- Vor dem PR `preprod` hereinmergen; Konflikte in `app.routes.ts`,
  `app.ts` (Kopfleiste) und `styles.scss` sind erwartbar — beide Seiten
  behalten.
- Der Bestand ist gross: was je Anfrage über alle Artikel läuft, läuft am
  Server über den Zwischenspeicher (`PgRepository.listEntities`), in der
  Oberfläche über die Kurzfassung (`Bestand.entities()`, `summaryOf`).
  Ganze Artikel holt nur, wer einen öffnet (`Bestand.oeffnen`).

## Pakete

### W1 — Importer: Doppel, kaputte Tabellen, Abstammungen
`packages/import-5etools`, `packages/model/src/inline.ts`.
- **Doppel.** „Amphibious" steht 64-mal da, „Multiattack" 1 620-mal. Der
  Importer setzt den Monsternamen nur als `The {CREATURE}` ein und nur für
  „the + Name/erstes/letztes Wort". Neu: **`{CREATURE}` trägt den Artikel**
  („the dragon", „Venomfang"); der Text heisst „{CREATURE} can breathe air
  and water." Erkannt wird „the" + jede Wortfolge aus Name **oder
  Kreaturtyp** (`creatureType`, z. B. „the dragon" am Black Dragon
  Wyrmling, „the guard drake") und bei benannten Kreaturen der Name und
  seine grossgeschriebenen Teile („Gar" an Gar Shatterkeel, „Serissa").
  Das Modell schreibt einen eingesetzten Wert am **Satzanfang gross**
  (`parseInline`), damit „{CREATURE} can …" mit „the dragon" richtig liest.
  Simulation: 10 510 → ~9 100 Merkmale/Aktionen, Amphibious 64 → ~27.
  Die Konvention in `docs/Datenmodell.md` und „How it works" nachziehen.
- **`[object Object]`**: Tabellen (z. B. „1,000 gp Gemstones") und
  Abstammungen (Attributswerte/ASI, Text, Lore) schreiben Objekte als Text.
  Alle Stellen finden (Suche im erzeugten Bestand nach `[object Object]`),
  richtig ausschreiben; prüfen, dass `[[…]]`-Verweise in Tabellenzellen und
  Listen auflösen.
- Bericht (`docs/5etools-Bericht.md`) neu erzeugen. Nach dem Mergen liest
  die Pipeline dev von selbst neu ein (W8: Änderung an
  `packages/import-5etools`, Ersetzen je Ebene).

### W2 — Artikel wie im Buch: Statblock, Zauber, Telefon
`apps/web/src/app/artikel/` (neue Bausteine daneben).
- Statblock wie `Article.dc.html` und das MM: Kopf (Name, Grösse/Typ/
  Gesinnung kursiv), rote Linie, AC/HP/Speed, **sechs Attribute in einer
  Reihe** mit Modifikator, Saves/Skills/Resistenzen/Senses/Languages/
  Challenge als Zeilen, dann Merkmale, Actions, Bonus Actions, Reactions,
  Legendary — aus den `composedOf`-Kanten, mit `{CREATURE}` aus der Kante
  (`vars`) gebunden und den Angriffszahlen aus dem Modell (`attack.ts`).
  Würfel klickbar wie im Text. Gerechnetes (`calc.ts`) wird beim Lesen
  gerechnet.
- Andere Arten lesen sich ebenfalls wie im Buch: Zauber („Casting Time,
  Range, Components, Duration" als Kopfzeilen), Gegenstände (Art, Seltenheit,
  Einstimmung kursiv unter dem Namen). Masse nach der Einstellung `units`
  umrechnen (`packages/model/src/units.ts`), „Range 150" ohne Einheit gibt es
  nicht mehr.
- Telefon (390 px): Attribute in 3×2, nichts läuft über den Rand.
- Wie eine Art gezeichnet wird, steht am Typ (`InterfaceDef.views`,
  `layoutFor`) — kein Sonderfall je Artname im Code, wo das Register es sagen
  kann.

### W3 — Verwaltung: Mitglieder, Rollen, Einladungen
`apps/server` (Routen), `apps/web/src/app/verwaltung/`.
- Seite nach `Members.dc.html`: Kampagne, Mitglieder mit Rolle
  (`gm`, `co-gm`, `player`, `spectator`), welche Figuren ein Konto führt,
  Einladungen anlegen/widerrufen (Routen `/api/invites` gibt es).
- Server-Routen für Mitglieder und Rollen (`campaign_member`,
  `app_user_actor`) — heute nur über die CLI (`user role`). Rechte: die
  Verwaltung der Installation (`is_admin`) und die Leitung der Kampagne
  ändern; ein Mitleiter sieht und ändert nicht (CLAUDE.md).
- Eintrag in der Kopfleiste nur für wen die Seite etwas zeigt.

### W4 — Boards
`apps/web/src/app/boards/`.
- Nach `Board.dc.html` und `Play.dc.html`: Board-Artikel öffnen, Karten
  frei platziert (Leinwand, REQ-157/158/165/166), eine Karte zeigt einen
  Artikel in der Ansicht `quick` oder `overview` (der Ort wählt; auf der
  Kachel wählt die Grösse). Ein Board je Geschichtsartikel (REQ-205).
- Was der Prototyp dazu kann, ist die Vorlage
  (`prototype/nebelwacht-artikel.html`, Boards); Platzierungen stehen als
  Kanten (`placed`/Board-Felder — im Register nachsehen).
- Eintrag „Boards" in der Kopfleiste.

### W5 — Register: Typen anlegen und anpassen
`apps/web/src/app/register/`.
- Nach `Registry.dc.html` und dem Register des Prototyps: Typenliste
  (flach, alphabetisch — `typeList()`), ein Typ auf einer Fläche (eigene
  Felder offen, geerbte zugeklappt, × nur am direkt genommenen), Feld
  anlegen/ändern/löschen (nur wo erklärt), `extends`, `area`, `titles`,
  Ansichten. Geschrieben wird über `PUT /api/registry/:part`, geprüft wie
  dort.
- Die Regeln aus CLAUDE.md zum Register (eine Seite ein Scroll, was nicht
  gilt steht nicht da, Kanten von hier, was eine Einstellung auslöst …)
  gelten hier genauso.
- Erreichbar aus dem Kompendium („New type", „Edit type" bei gewählter Art)
  und für die Leitung in der Kopfleiste.

### W6 — Klassen wie in 5e.tools
`apps/web/src/app/klassen/` (Importer nur, wo Daten fehlen — mit W1
absprechen über die PR-Beschreibung).
- Eine Klasse: Klassentabelle (Stufe, Übungsbonus, Merkmale, Spalten aus
  `classTableGroups` — der Importer legt „X Table" als `Table` an), die
  Merkmale je Stufe ausgeschrieben, **optionale/Varianten-Merkmale**
  (`optional`-Marke, `isClassFeatureVariant`) zuschaltbar.
- Unterklassen: filtern (Quelle, Name) und **vergleichen** (zwei oder mehr
  nebeneinander, Merkmale je Stufe in einer Zeile).
- Daten: `Class`, `Subclass`, `Feature`, Kanten `grants` mit
  `props.level`, `subclassOf`.

### W7 — Kompendium: Spalten, Filter, Vorschau, Teile
`apps/web/src/app/artikel/kompendium.*`, `packages/model/src/summary.ts`,
Server-Route der Kurzfassung.
- Spalten und Filter **je Art** wie in `Compendium.dc.html`: bei Zaubern
  Grad und Schule, bei Statblöcken HG und Typ, bei Gegenständen Seltenheit.
  Welche Felder eine Zeile zeigt, sagt die Art — vorgeschlagen: die Felder
  ihrer `overview`-Ansicht (`layoutFor`), die Kurzfassung trägt sie mit.
  Gefiltert wird nach Feldern mit `enum`/`enumRef`/Spanne.
- Vorschau rechts (`quick`) beim Anklicken einer Zeile, wie in
  `Main.dc.html`; „Open" führt zum Artikel.
- **Teile von Statblöcken**: ein Merkmal oder eine Aktion, die nur ein
  Statblock nutzt („Multiattack" des Goblin Boss), ist ein Teil davon und
  steht standardmässig nicht in der Liste (Schalter „Show statblock parts");
  geteilte („Pack Tactics") stehen da, mit der Zahl der Nutzer. Dafür trägt
  die Kurzfassung, wie viele Artikel über eine Abschnittskante
  (`RelationDef.section`) auf diesen zeigen — am Server gerechnet.
- „New article" (Anlegen-Dialog) und „Edit type" (→ W5).

### W8 — Einlesen als Pipeline, Ersetzen je Ebene
`apps/server/src/import.ts`, `deploy/import.sh`,
`.github/workflows/import-5etools.yml`, `ci.yml`.
- `--replace` löschte alles, was nicht in der Datei steht — mit eigenen
  Kampagnenartikeln auf dem Server wären sie beim nächsten Lauf weg.
  `--replace-layer` löscht nur, was die Ebene der Datei bringt und in ihr
  fehlt, zählt es, löst Instanzen gelöschter Vorlagen und zählt Kanten aus
  bleibenden Artikeln auf, die ins Leere zeigen; `--dry-run` sagt es nur.
- Die Pipeline klont 5e.tools zur Laufzeit, erzeugt die Datei und liest sie
  auf dem Server ein: von Hand (dev/prod), für dev von selbst nach einem
  Ausrollen, das den Importer ändert. Anleitung:
  [Betrieb › 5e.tools laden](Betrieb.md#5etools-laden).
