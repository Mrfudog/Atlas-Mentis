# Atlas Mentis — Hinweise für Claude

Kampagnenplattform, gebaut für „Aus Nebel wacht“. **Die Plattform heisst
Atlas Mentis, die Kampagne heisst Nebelwacht** — das Repository und die
Paketnamen (`@nw/*`) tragen noch den alten Namen; sichtbar heisst es überall
Atlas Mentis. Schweizer Rechtschreibung (**ss statt ß**) in allem
Deutschen.

**Sprache:** Code, Bezeichner, Registerzeilen und sichtbare Texte auf Englisch.
Kommentare und Commit-Nachrichten auf Deutsch. Die Oberfläche war bis
2026-09-19 deutsch; die Umstellung ist in `prototype/migration/rename-map.json`
festgehalten und auf Daten wie Code angewandt.

Zwei Ausnahmen, die bewusst deutsch bleiben: **Vault-Schlüssel**, die der
Importer *liest* (`Gegenstandstyp`, `Rarität`, `rüstungsklasse`, `grösse`,
`kreatur` …) — sie stehen so in den Notizen, und sie zu übersetzen hiesse, die
Notizen nicht mehr zu erkennen. Und **Aufzählungswerte**, die Kampagneninhalt
sind (`gewöhnlich`, `Gebäude`, `freundlich`): das sind Daten, keine Namen.

## Das Modell in fünf Sätzen

Eine Entität ist ein **Peg**: eine undurchsichtige ID und sonst nichts. Eine
**Artikelart** ist eine Registerzeile: sie trägt ihre **Felder** selbst und
erbt über `extends` von beliebig vielen Obertypen; was mehrere Arten teilen,
ist ein Obertyp und keine Komponente. Gespeichert wird **eine Karte je Art**,
benannt nach der Art, die ihre Felder erklärt — das hält `hp` an der Kreatur
von `hp` am Statblock auseinander, ohne dass eins von beiden umbenannt werden
muss. Verbindungen sind typisierte, gerichtete **Kanten**, die eigene
Eigenschaften tragen dürfen, nur in einer Richtung gespeichert werden und deren
Gegenrichtung immer eine Abfrage ist. Zugehörigkeit wird über `Typed`
behauptet und von der Validierung geprüft; Pflicht steht je Feld. Alles davon
sind Zeilen — eine neue Artikelart anzulegen heisst einfügen, nicht migrieren.

Vollständig in [`Mrfudog/atlas-mentis`](https://github.com/Mrfudog/atlas-mentis):
`Backbone Concept.md` erklärt die Mechanismen, `Schemas.md` hat die Schemata und
die Entscheidungen D0–D17, `Requirements.md` die REQ-Nummern.

## Wo was liegt

- `packages/model` — Typen, Validierung, `calc.ts` (abgeleitete Werte),
  `views.ts` (Feldauswahl je Darstellungsstufe), `inline.ts` (`[[Verweise]]`,
  `{VAR}`), `entity.ts` (Registerzugriff, Rückbezüge). **Kein Framework-Import.**
  Was hier liegt, gilt für Server und Oberfläche gleichermassen.
- `packages/registry` — die Startzeilen, und zwar **die einzige Quelle
  dafür**. `pnpm --filter @nw/registry emit-seed` schreibt sie als JSON in
  den Prüfaufbau des Prototyps; von Hand nachgezogen wird nichts mehr. Zeilen,
  die es nur dort gibt, bleiben stehen und werden aufgezählt — eine neue
  Artikelart im Prototyp anzulegen ist der Sinn der Sache und kein Fehler.
- `apps/server` — Fastify. Routen sprechen mit `Repository`, nie mit Postgres;
  deshalb sind sie ohne Datenbank testbar (`InMemoryRepository`).
- `apps/web` — Angular. Anmeldung, Artikelliste und Artikelansicht stehen;
  gezeichnet wird aus dem Register über `packages/model`, nicht aus einer
  Vorlage je Artikelart. **Zurückgehalten wird am Server** (`redactEntity`) —
  was hier ankommt, darf angezeigt werden, und eine zweite Prüfung in der
  Maske lüde nur dazu ein, die erste wegzulassen.
- `legacy/` — die alte React-App. Nicht weiterentwickeln; sie läuft, bis die
  neue Karte und Initiative kann.

## Regeln, die hier gelten

- **Abgeleitete Werte werden beim Lesen berechnet, nie gespeichert** (D8). Eine
  Eigenschaft mit `derived` bekommt keine Eingabe und keine Spalte.
- **Das Rechenwerk ist kein `eval`.** Registerzeilen sind Daten, die jemand
  bearbeiten kann. `evalArith` ist ein Shunting-Yard-Auswerter; bei Unsinn gibt
  es `null`, nicht eine irreführende 0.
- **`{VAR}` wird nie in den gespeicherten Text eingesetzt.** Die Vorlage bleibt
  die Vorlage; die Bindung liegt an der Kante. Genau das ging in der alten App
  verloren, und der Verlust war endgültig.
- **Kanten nur vorwärts speichern.** Ein gespiegeltes Gegenstück verwaist.
- **Schreiben geht durch `validateEntity`**, auch wenn es umständlich scheint.
- **Drei Ansichten, und der Ort wählt sie.** `overview` steht in einem
  Verweis oder einer Listenzeile, `quick` auf einer Karte, `full` auf der
  Artikelseite. Einen Wähler gibt es nicht — ein Verweis ist ein Verweis,
  und wer das jedes Mal sagen muss, sagt es irgendwann falsch; nur die
  Kachel auf dem Board wählt, weil dort die Grösse eine Frage an die Kachel
  ist. **Es gibt keine Spieleransicht:** zurückgehalten wird am Server
  (`redactEntity`), und wer weniger sehen darf, sieht dieselbe Ansicht mit
  weniger darin.
- **Die Anordnung wohnt am Typ** (`InterfaceDef.views`), nicht an der
  Ansicht: eine Kreatur zeigt ihren Bogen, ein Rezept seine Werkbank, ohne
  dass jemand etwas auswählt. Untertypen erben sie (`layoutFor` läuft die
  `extends`-Kette hoch); sagt keiner etwas, gilt die Grundanordnung der
  Ansicht. Eine Stufe für genau einen Typ wäre ein Sonderfall mit einem
  Dropdown davor.
- **Ein Textblock ist ein Feld.** Es gab einmal `blocks: [{blockType, body,
  anchor}]` neben den Karten, mit einer eigenen Liste erlaubter Blockarten je
  Artikelart — also eine zweite Frage, die jede Art zweimal beantworten
  musste. Jetzt ist die Blockart das Feld: `secret` ist ein Feld mit `many`
  und `format: 'long'`, und seine Einträge tragen die Id, an der die
  Wissensfreigabe hängt (`Secrets.secret#id`). Die Id kommt aus dem Text, denn
  eine durchgezählte hält nur, solange die Reihenfolge hält. Ein Prosafeld
  steht **nicht** in der Feldtabelle — es gehört dem Element `prose`.
- **Wie die Dinge heissen, steht in [docs/Begriffe.md](docs/Begriffe.md):**
  Typ, Bestandteil, Feld, Artikel, Ansicht, Block, Kante, Einheit — acht
  Wörter, mehr nicht. Wer zwei Namen für eine Sache hat, hat bald zwei Sachen; im
  Prototyp steht dasselbe unter Registry › How it works, aus dem laufenden
  Register gezogen.
- **Sechs Seiten, vier davon Bereiche.** Register und Kompendium sind
  Seiten; `world`, `history`, `rules` und `play` sind Bereiche. Wohin eine
  Artikelart gehört, steht als `area` an ihrem Typ und wird wie alles andere
  geerbt. Im Code steht keine Liste davon — sonst bräuchte eine neue
  Artikelart eine Codeänderung, um auffindbar zu sein.
- **Play ist ein Schirm und keine Liste.** Karte, Initiative und Boards sind
  das, worauf man während der Sitzung schaut; sie über die Artikelliste zu
  erreichen hiesse, mitten im Kampf suchen zu gehen. **Was gerade läuft,
  steht an der Sitzung** (`SessionState.activeMap`, `activeEncounter`,
  `activeScene`) und nicht am Schirm — eine zweite Stelle dafür wäre die, an
  der der Beamer etwas anderes zeigt als der Laptop. Gezeichnet wird mit
  denselben Layout-Elementen wie die Artikelseite.
- **Eine Beziehung ist eine Kante mit Marken** und keine gerechnete Zahl
  (siehe [docs/Beziehungen.md](docs/Beziehungen.md)). Die Marken sind Worte
  und keine Aufzählung im Register: was jemand vom anderen hält, ist
  Kampagneninhalt. Die Kante steht beim Urteilenden, und die Gegenrichtung
  ist eine eigene Kante, die etwas anderes sagen darf.
- **Ein Ding, nicht zwei.** Es gab einmal Komponenten *und* Schnittstellen;
  38 von 43 Komponenten hatten genau einen Nutzer, und 13 von 18
  `requires`-Einträgen verlangten eine Karte ohne ein einziges Pflichtfeld.
  Was jetzt gilt: die Art trägt ihre Felder, geteilte Felder wohnen in einem
  Obertyp, und `requires`/`allows` gibt es nicht mehr (D27). Eine Feldgruppe,
  die eine **Ansicht als Ganzes nennen muss** (`except: ['Vitals']`), bleibt
  eine eigene Art — sonst stünde dort eine Aufzählung, die am Tag des
  nächsten Feldes falsch ist.
- **Das Register steht einmal.** Wer eine Zeile ändert, ändert sie in
  `packages/registry` und lässt `emit-seed` laufen. Zweimal dasselbe von Hand
  zu pflegen hält genau so lange, wie jemand daran denkt — und als es hier
  zuletzt auseinanderlief, standen deutsche Variablen im Paket und englische
  im Prototyp, und gemerkt hat es niemand, weil beide für sich stimmten.
- **Masse werden beim Lesen umgerechnet, nie gespeichert** (D8). Der Vault
  ist imperial, weil die Regeln es sind; wie gerechnet wird, steht als
  Registerzeile in `packages/registry/src/units.ts` und nicht im Code. Was
  gezeigt wird, sagt die Einstellung `units`; eine Artikelart darf es
  überschreiben und vererbt es wie `area`.
- **Nicht auf `0.0.0.0` binden** — ausserhalb eines Containers. Im Container
  ist `HOST=0.0.0.0` richtig, weil dort die Containergrenze das ist, was
  zählt; auf einer Maschine ist es der Reverse Proxy. Seit 2026-09-20 hat der
  Server ausserdem einen Zugang (ein Passwort je Nutzer, siehe
  [docs/Zugang.md](docs/Zugang.md)) — das ist ein Grund mehr für die enge
  Bindung und keiner weniger.

## Bauen und prüfen

```bash
pnpm install
pnpm --filter @nw/model build && pnpm --filter @nw/registry build   # zuerst
pnpm test && pnpm lint
pnpm --filter @nw/registry emit-seed   # nach jeder Registeränderung
```

`emit-seed` **behält** Zeilen, die es nur im Prototyp gibt — wer dort eine
Artikelart anlegt, soll sie behalten. Eine Zeile zu **entfernen** ist deshalb
ausdrücklich: `emit-seed --prune views` wirft die zusätzlichen Zeilen dieses
Teils weg und zählt sie dabei auf. Ein ganzer Teil ist oft zu grob — dann
nimmt der Schalter einzelne Zeilen: `--prune components:DeedInfo,interfaces:Deed`.
Ein Name, der nichts trifft, wird gesagt und lässt den Lauf fehlschlagen;
ein stiller Tippfehler sähe aus wie eine erledigte Löschung.

`pnpm --filter @nw/registry catalogue` schreibt
[docs/Artikeltypen.md](docs/Artikeltypen.md) neu — je Artikelart, was sie
verlangt, was sie erlaubt, welche Kanten sie trägt und wie sie gezeichnet
wird. Die Datei wird **erzeugt und nicht von Hand geändert**: eine
Übersicht, die jemand abtippt, stimmt am Tag ihrer Entstehung und danach
nie wieder.

`pnpm test` läuft in zwei Projekten: `node` für Modell, Register und Server,
`web` mit jsdom und Angulars aufgesetzter Prüfumgebung. Eine gemeinsame
Aufsetzdatei wäre der Weg, auf dem ein Node-Test plötzlich von einem
Browser-Stub abhängt.

Zum Entwickeln: `pnpm dev:server` und `pnpm dev:web` nebeneinander; die
Oberfläche schickt `/api` über `apps/web/proxy.conf.json` an den Server.
Das erste Konto legt `pnpm --filter @nw/server user add <name> --gm` an.

Die Reihenfolge ist notwendig: die übrigen Pakete übersetzen gegen die von
`model` erzeugten `.d.ts`, nicht gegen dessen Quelltext. In `tsconfig.json` der
abhängigen Pakete gehört **kein** `paths`-Eintrag auf `../model/src` — das zieht
Quelltext über Paketgrenzen und bricht `rootDir`.

Vitest bildet `@nw/model` und `@nw/registry` auf den Quelltext ab (siehe
`vitest.config.ts`), damit Tests ohne vorherigen Build laufen.

## Arbeitsweise

Zweige `feature/*` → Pull Request nach `preprod` → `main` nur vorspulen.
Anforderungen leben im Vault, Issues bilden ab, was gerade gebaut wird. Siehe
[CONTRIBUTING.md](CONTRIBUTING.md).
