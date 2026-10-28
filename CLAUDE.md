# Atlas Mentis — Hinweise für Claude

Die Seite für „Aus Nebel wacht“ und die Runden, die daraus werden. **Die
Plattform heisst Atlas Mentis, die Kampagne heisst Nebelwacht**; die
Paketnamen (`@nw/*`) tragen die Kampagne, sichtbar heisst es überall Atlas
Mentis. Schweizer Rechtschreibung (**ss statt ß**) in allem Deutschen.

**Die Richtung (7.10.2026):** kein generisches VTT, sondern die Seite für
eine Leitung und ihre Gruppen. Was der Tisch von Nebelwacht braucht, hat
Vorrang vor dem, was ein beliebiger Tisch brauchen könnte — die
Anforderungen aus der Ernte (REQ-168 ff.) vor den generischen aus dem
Konzept. **Einschneidende Änderungen entscheidet die Verwaltung**, nicht
Claude: ein Umbau, der Daten verliert, die Arbeitsweise ändert oder eine
Art wegnimmt, wird vorgeschlagen und abgewartet.

**Ein Repo.** Code und Vault liegen seit dem 7.10.2026 zusammen: `VTT/`
und `Ideen/` sind der Obsidian-Vault, `.obsidian/` seine Einstellungen
(`userIgnoreFilters` hält die Code-Ordner aus dem Index). Der Vault wird
auch vom Telefon aus direkt auf `main` geschrieben — darum merged jeder
Zweig von `preprod` vor einem Pull Request nach `main` erst `main` herein,
und `preprod` wird nicht auf `main` vorgespult, sondern gemerged.

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
behauptet und von der Validierung geprüft; Pflicht steht je Feld, und was
in einem Feld stehen darf, prüft sie mit — eine Aufzählung hält, eine
Spanne hält. Alles davon
sind Zeilen — eine neue Artikelart anzulegen heisst einfügen, nicht migrieren.

Das ursprüngliche Konzept liegt in `VTT/` (`Backbone Concept.md`,
`Schemas.md` mit D0–D17, `Data Definitions.md`) und ist **überholt** —
was gilt, steht in [docs/Datenmodell.md](docs/Datenmodell.md). Die
Anforderungen sind **User Stories** (T-154): je Story eine Notiz
`VTT/Stories/REQ-nnn.md` (Nummer unveränderlich), jede an einem **Feature**
(`VTT/Features/F-nnn …`), jedes Feature an einem **Epic** (`VTT/Epics/EP-nn …`);
`VTT/Requirements.md` und `VTT/Umsetzung.md` sind daraus erzeugt.

## Wo was liegt

Als Bild — Container, Frameworks, Repo, Server und Oberfläche:
[docs/Architektur.md](docs/Architektur.md).

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
  deshalb sind sie ohne Datenbank testbar (`InMemoryRepository`). Der
  **Live-Kanal** (`live.ts`, `GET /api/live`, T-116) liegt als Hülle um das
  Repository und siebt je Empfänger mit derselben Rechnung wie jede Route
  (`sieveFuer`) — er ist kein Umweg an der Sichtbarkeit vorbei; im Web
  hört man über `Live` (`onArtikel`, `onSitzung`), ohne den Transport zu
  kennen.
- `apps/web` — Angular, im Pergament des Design-Canvas. Anmeldung, die
  Kopfleiste mit den Bereichen, Kompendium und Bereiche (Filter in der
  Seitenleiste, Spalten aus der `overview` der Art oder gewählt —
  „Columns“, je Konto, Adresse und Vorgabe der Kampagne, T-343 —, Vorschau `quick`;
  **gerechnet am Server**, `GET /api/list`), „New article" und der
  Artikel im Buchstil (geholt beim Öffnen, Ansicht `full`, mit den Namen
  seiner Kantenziele und Verweise in `refs`) stehen, dazu die Boards
  (`boards/`: je Geschichtsartikel eines, Karten als `placed`-Kanten),
  die Klassen (`klassen/`), das Register (`/registry`: Typen, Kanten,
  Listen und Ansichten anlegen und ändern — Verwaltung und Leitung der laufenden
  Kampagne; gezählt wird vorher über `/api/registry/usage`), die
  **Werkbank** für Leitung und Verwaltung (`werkbank/`: Prüfungen aus
  `checks.ts`, Massenänderungen aus `bulk.ts` mit Vorschau und
  Rückgängig, W9), die **Karte** (`karten/`: Element `map` und
  Play › Map unter `/play`, Blätter, Gitter, Messen, Marker mit
  Kurzansicht, Unterkarten zum Hineinzoomen, Gruppen-Token; Logik in
  `packages/model/src/map.ts`, Zurückhalten mit `redactMap`, T-115; darunter
  **Karten im Spiel** als Instanz mit Freigabe und „Played", T-289,
  `apps/server/src/spielinstanz.ts`; darunter
  der **Zugplan** als Prototyp, `karten/zugplaner.ts`, Routen in
  `apps/server/src/zugplan.ts`, Logik in `packages/model/src/zugplan.ts`:
  Aktionsleiste, Zugfolge, Bestätigen durch die Leitung, T-198), das
  **Inventar** (`artikel/inventar.ts`, an Figur, Gruppe und Behälter:
  Raster mit Drehen und Zonen, Gewicht oder Slots nach `Campaign.inventory`,
  Münzen, Verschieben zwischen Figur, Gruppe und Behälter; Logik in
  `packages/model/src/inventory.ts`, T-127), die **Werkbank am Rezept**
  (`artikel/werkstatt.ts`, Routen in `apps/server/src/handwerk.ts`: ein
  Fertigungsauftrag ist eine Instanz des Rezepts, das Material bleibt
  reserviert im Inventar von Figur und Gruppe, die Regeln stehen an der
  Kampagne; T-128; gewählt wird es erst beim Start, auch aus einer
  Materialgruppe oder als Ersatz nach einer Regel der Kampagne,
  `packages/model/src/substitutes.ts`, T-197; dasselbe Element `crafting` ist am **Beruf** (`Trade`)
  die Handwerksübersicht und an Werkzeug und Figur „Can craft",
  `artikel/handwerksuebersicht.ts`, T-196), die **Leseansicht** (`lesen/`: eine
  Ebene als Buch mit aufklappbarem Inhaltsverzeichnis, Suche und
  Lesestand je Konto, T-091; auch vor dem Aufschalten, eine Gruppe als
  Regal, T-167; seit T-191 das Element `reader` auf der Seite der Ebene,
  `/read/:layer` leitet dorthin — ebenso Klassen und Herkünfte:
  `classOverview`, `originOverview` statt `/classes/:id` …), der **Druck** (`/artikel/:id/print`: eine Ansicht auf einem
  Blatt A4, T-110), die **Suche** (`suche/`, Kopfleiste, Strg+K und `/`:
  Treffer beim Tippen aus `GET /api/search`, nach Nähe, Filter nach Art,
  Ebene, Herausgeber und Bereich, das „+" zeigt die Kurzansicht `quick`;
  T-138, T-346), unter der Marke die **laufende Kampagne** mit der Zahl ihrer
  Ebenen und dem Popup zum Einstellen (`verwaltung/stapel-knopf.ts`,
  `kern/stapel.ts`: Ebenen, Gruppen, Vergleich auch einer ganzen Gruppe,
  Wechsel der Kampagne für die Verwaltung; T-143; gespeicherte
  Ebenenauswahlen, T-186), **What's new** (`neues/`,
  `/whats-new`: Einträge aus `apps/web/src/whats-new.json`, gesehen je
  Konto in `/api/me/prefs`, Punkt in der Kopfleiste; T-157), die **Hilfe je Seite**
  (`hilfe/`, das „?“ der Kopfleiste: Texte aus `apps/web/src/help.json` je
  Route und die What's-new-Einträge mit Link auf die Seite; jede Route hat
  einen Text oder steht unter `without`, T-205) und das Konto mit seinen API-Tokens (`konto/`), dazu der
  **Ansichtseditor** (`ansichten/`: Zeichner `baum.ts`, Designer, Liste,
  Ansichtswahl am Artikel; Logik in `packages/model/src/viewScope.ts`,
  T-268, seit T-276 der einzige Editor für Ansichten), dazu die
  **Kapitel** einer Seite (`muster/kapitel.ts`, T-277: Artikel-, Charakter-
  und Typseite; am Telefon Reiter mit `?k=`, am Desktop gerahmte Bereiche,
  breit links, schmal rechts, Admin und Log darunter; **Admin** an jeder
  Artikelart mit Ebene, Sichtbarkeit samt geltender Stufe `refs.audience`,
  Wissen, Fassungen); die
  Oberfläche hält **keinen Bestand** (W7). Licht und Dunkelsicht mit
  `packages/model/src/lighting.ts` (T-216);
  gezeichnet wird aus dem Register über `packages/model`, nicht aus einer
  Vorlage je Artikelart. **Zurückgehalten wird am Server** (`redactEntity`) —
  was hier ankommt, darf angezeigt werden, und eine zweite Prüfung in der
  Maske lüde nur dazu ein, die erste wegzulassen.
- **Handbuch und Glossar** (T-242, T-225): `/handbook` (`apps/web/src/app/handbuch/`,
  Kapitel in `kern/handbuch.ts`, eigener Text in `apps/web/src/handbook.json`,
  erzeugt aus `help.json`, `RULE_OPTIONS` und `GET /api/glossary`). Ein
  Begriff ist ein Artikel `GlossaryTerm` mit Kante `explains`; die Wörter
  der App stehen in `packages/registry/src/glossar.ts`. Erkannt im Text
  (`spotTerms`, `packages/model/src/glossary.ts`), Strg/⌘+Klick öffnet die
  Glossarleiste (`glossar/leiste.ts`, `kern/glossar.ts`), Nennungen fragt
  `GET /api/glossary/:id/uses` (gesiebt, `apps/server/src/glossar.ts`).
- `packages/import-5etools` — der Importer für 5e.tools (P5): liest einen
  Checkout von `5etools-src/data`, schreibt eine Ausfuhrdatei und den
  Bericht [docs/5etools-Bericht.md](docs/5etools-Bericht.md). Kein
  Framework; läuft nicht im Server, sondern in der Pipeline
  `import-5etools.yml`, nur von Hand. **Einmal einlesen, danach nur
  ergänzen** (`import.js --only-new`, D71): angelegt wird nur, was es noch
  nicht gibt; die Ebene „D&D 5e (2014)" neu laden (`--replace-layer`) geht
  nur ausdrücklich und nimmt eigene Änderungen an ihren Artikeln mit.
  **Seit T-087 kommt jeder Regelstand herein** (2024, UA, dazu Fahrzeuge,
  Decks, Bastionen): jede Quelle in ihre Ebene, keine neue aufgeschaltet,
  und der Grundstand (was vorher hereinkam) behält Ids, Nummern und Namen —
  der Lauf rechnet ihn erst allein, für seine Nummern. **Bilder** kommen
  nicht in die Ausfuhrdatei: der Lauf schreibt mit `--images` einen
  Bildplan (`bilder.ts`), und `scripts/bilder-5etools.mjs` lädt nach ihm
  aus einem Checkout von `5etools-img` hoch und verknüpft über eine
  Massenänderung (T-144). Laden:
  [docs/Betrieb.md › 5e.tools laden](docs/Betrieb.md#5etools-laden).
- `scripts/regelwerk.mjs` — der Einleser für Regelwerke anderer Verlage
  (T-122, zuerst Kibbles’ Compendium): liest ein Paket **ausserhalb** des
  Repos und schreibt Ebene, Artikel und Kanten über die API nach dev. Der
  Inhalt eines solchen Buchs kommt nie ins Repository, auch nicht in
  Tests oder Commits. Laden: [docs/Betrieb.md › Ein Regelwerk eines
  Drittverlags laden](docs/Betrieb.md#ein-regelwerk-eines-drittverlags-laden).
- `legacy/` — die alte React-App. Nicht weiterentwickeln; sie läuft, bis die
  neue Karte und Initiative kann.
- `prototype/` — **eingefroren seit 13.10.2026 (D59).** Genutzt wird nur noch
  die Seite (`apps/web` mit `apps/server`). Der Prototyp bleibt als Vorlage:
  was er kann, wird in die Seite übernommen, mit seinen Erkenntnissen
  (Regeln oben, Entscheidungen im Decision Log), aber er bekommt keine neuen
  Funktionen mehr. Welche Anforderung im Prototyp steht und in der Seite noch
  nicht, zeigt das Projektbrett (Spalten „Prototyp" und „Web"). `emit-seed` schreibt sein Register weiter, solange
  seine Prüfungen laufen.

Was es **nicht** mehr gibt: `packages/import` und der Importer im Prototyp (der für 5e.tools ist neu geschrieben, oben). Die Obsidian-Importer für
Gegenstände und Statblocks sind weg (2026-09-20); der Prototyp hat seinen
Mit ihnen fiel der Bestandteil `Imported` weg — er trug den Wortlaut, wie er
aus dem Vault kam, und füllt ihn jetzt niemand mehr. Wenn die Importer
wiederkommen, werden sie neu geschrieben.

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
- **Eine Kante darf sich an einem Ende wie ein Feld lesen**
  (`RelationDef.asField: 'from' | 'to'` — welches Ende). Die Zahlen einer
  Kreatur stehen am Statblock, und der ist ein eigener Artikel:
  austauschbar, wiederverwendbar, mit eigenem Namen. Für die Kreatur ist er
  trotzdem kein Verweis auf etwas Fremdes, sondern der Teil von ihr, der
  woanders wohnt. Also zeigt das Register seine Felder an ihr mit (als
  Gruppe, gestrichelt, Marke `linked · belongsTo`), und das Layout-Element
  `linked` zeichnet seine Felder **auf ihrer Seite** — mit seinen eigenen
  Eingaben, die in seinen Artikel schreiben. Gespeichert bleibt eine Kante
  in einer Richtung; das andere Ende findet sie über die Rückfrage
  (`linkedTypes` / `verlinkteTypen`).
  **Das Mass:** ohne das andere wäre dieser Artikel unvollständig, und
  **an seinem Ende liest es sich als eines** — jede Kante mit `asField` ist
  `one`, an welchem Ende sie auch liegt. Was dreissig Wachen gemeinsam
  haben, steht an einer Vorlage, aus der jede ihre Instanz liest (unten,
  Statblock). Ein Rezept, das einen Gegenstand liefert, und eine
  Begegnung auf einer Karte sind Verweise auf Dinge, die für sich stehen —
  die bleiben Kanten. Heute tragen `belongsTo` (Statblock an der Kreatur)
  und `carries` (Inventar an Kreatur und Gruppe) die Angabe.
- **Schreiben geht durch `validateEntity`**, auch wenn es umständlich scheint.
- **Die nullte Frage: steht der Artikel im Stapel?** `inPlay` in
  `packages/model/src/stack.ts` (E2): was keine aufgeschaltete Ebene der
  laufenden Kampagne bringt, eine spezifischere herausnimmt oder eine
  Fassung aus einer aufgeschalteten Ebene überschreibt, ist nicht da — für
  jeden, auch die Verwaltung. Der Server siebt damit zuerst, der Prototyp
  rechnet gleich (A2). **Eine Gruppe ist eine Ebene, die Ebenen enthält**
  (`kind: 'group'`, Mitglieder über `partOf`, E-022 b): aufgeschaltet bringt
  sie alle Mitglieder, und die ausdrückliche Kante schlägt die Gruppe —
  `activates` mit `mode: 'off'` nimmt ein Buch heraus (`resolvedStack`).
  Gruppen ordnen nach Kategorie oder, mit `groupBy: 'publisher'`, nach
  Herausgeber (T-094) — für den Stapel gleich. **Der Herausgeber einer
  Ebene wird gerechnet** (`publisherOf`): ihre Herausgeber-Gruppe, sonst
  Homebrew, wenn sie hier angelegt wurde, und „Unknown", wenn sie
  eingelesen ist (T-109); ein Feld dafür gibt es nicht — die Ebenenseite
  zeigt den Grund und hängt die `partOf`-Kante um.
  **Was nicht aufgeschaltet ist, steht nicht da** (T-207, `shownLayers`):
  eine Ebene ausserhalb des Stapels — und der Vergleichsebenen, wer sie
  sieht — erscheint weder als Artikel noch als Fassung, Filteroption,
  Kürzel oder Zählung; gesiebt wird im Listenindex am Server, nicht je
  Seite. Ein- und ausgeschaltet wird nur an der Kampagne (Kampagnenseite,
  Popup der Kopfleiste); Bibliothek und Werkbank (`allLayers=1`) sehen alle.
- **Zwei Fragen, und die grobe kommt zuerst.** Die **Sichtbarkeit**
  (`articleVisible`) sagt, ob ein Artikel überhaupt an jemanden geht; das
  **Wissen** (`redactEntity`) sagt, welche Felder darin. Beides zu einer
  Frage zu machen hiesse, einen Artikel dadurch zu verbergen, dass man alle
  seine Felder wegnimmt — und er stünde trotzdem in der Liste, mit Namen und
  Bereich.
  Gelesen werden drei Felder, und die Reihenfolge ist die Regel:
  `hiddenFrom` schlägt `revealedTo` schlägt `audience`. **`public` ist die
  Vorgabe und heisst: jeder darf es sehen** — wer etwas verbergen will, sagt
  es, und nicht umgekehrt. **Sagt der Artikel keine Stufe, sagt es seine
  Gruppe** (T-252, E-098): die Regel der laufenden Kampagne
  (`VisibilityRules.visibilityRules`, je Gruppe ein Schlüssel der
  Transformationen wie `layer:dnd|type:Spell`, die genaueste zuerst, auch
  zeigen/verbergen je Träger), sonst die Vorgabe der Ebene
  (`Layer.defaultAudience`, die engste), sonst `public`. Gelesen wird beim
  Lesen (`Viewer.campaignRules`, vom Server mitgegeben), nichts wandert in
  die Artikel; ein ausdrücklich gesetztes `audience`, auch `public`, ist
  ein eigenes Feld und schlägt jede Regel. Gesetzt wird auf der
  Kampagnenseite unter Visibility. Die Stufen von aussen nach innen: `public` jedes
  Konto, `campaign` jedes Konto mit einer Rolle am Tisch, `players` die
  Spielenden (`player`, `co-gm`, `gm`), `gm` die Leitung (`gm`, `co-gm`).
  Die beiden Listen nennen **Träger** (`Creature | Party | Faction`),
  dieselben drei wie `knownBy`, und ein Träger zählt einen Schritt weit auch
  als seine Gruppe und seine Fraktion. **Die Gruppe ist das Figurengefüge
  einer Runde** (`Party`, `partyOf` → `Campaign`, `memberOfParty`); **jede
  Kampagne bekommt eine** (beim Anlegen, ältere: Migration 039), und eine
  Figur, die ein `player` zugeteilt bekommt, kommt hinein (T-100, E-007).
  In „Revealed to"/„Hidden from" bietet die Maske auch **Spieler** an und
  schreibt ihre Figuren — nie das Konto. Eine
  andere Konstellation gibt es nicht — `Group`, der Träger von Konten (ein
  Konto führte sie wie eine Figur), ist weg (A8): zwei Sorten Träger waren
  zwei Wahrheiten. „Die Spieler dieser Kampagne“
  sind eine Rolle am Konto, kein Träger. **Eine Fraktion weiss nichts, ihre
  Mitglieder wissen:** `Faction.ranks` ist die Leiter, `memberOf.props.rank`
  die Sprosse, und eine Zuteilung `knownBy` an die Fraktion darf einen
  Mindestrang nennen (`props.rank`) — was der Zirkel weiss, weiss der Novize
  noch nicht (A7, REQ-203).
  **Vererbt wird nichts:** ein Haus zu kennen heisst nicht, jedes Zimmer
  darin zu kennen, und eine Vererbung ohne Tiefe gibt irgendwann einen
  ganzen Zweig frei. Das Feld `inherit` gab es und war nie ausgewertet — es
  ist bewusst weggelassen und kommt bei Bedarf mit einer Tiefe wieder.
- **Die Rolle am Tisch steht am Konto, je Kampagne** — in keinem Artikel.
  Am Server `campaign_member (campaign, user, role)` mit `gm`, `co-gm`,
  `player`, `spectator`; welche Figuren ein Konto führt, steht daneben in
  `app_user_actor`; im Prototyp die Sammlung `members`. Es gab dafür eine
  `Access`-Karte an der Figur (und für einen Tag an der Kampagne): der
  Server las sie nie, `userIds` war in keinem Artikel gefüllt, eine Figur
  sagt nicht, in welcher Runde ihr Konto was ist, und eine Konto-Id in
  einem Artikel wandert beim Export mit (REQ-199). **Wer einen Artikel
  angelegt hat, steht ebenso am Server** (`app_user_article`, D72):
  Spielende der laufenden Kampagne legen an, schreiben, was sie angelegt
  haben, und sehen es in jedem Stand. Die Sammlung `members`
  steht darum **nicht** in der Ausfuhr. Gepflegt wird auf der
  Kampagnenseite (Element `members`): von der Verwaltung und der Leitung
  dieser Kampagne; ein Mitleiter sieht die Liste und ändert sie nicht —
  das trennt `gm` und `co-gm`, sehen tun beide dasselbe.
  `app_user.is_admin` ist etwas anderes: die Verwaltung der
  **Installation**, die alles sieht.
- **Eine Leitung je Kampagne, und die Ebene sagt wessen.** Gefragt wird die
  Rolle in **der** Kampagne, der der Artikel gehört — wer in der einen Runde
  leitet und in der anderen mitspielt, ist dort Spieler. Wem ein Artikel
  gehört, steht in keinem Feld: **eine Ebene, die genau eine Kampagne
  aufschaltet, gehört ihr; eine, die mehrere aufschalten, ist gemeinsam**
  (`campaignsOf`), und dann zählt die stärkste Rolle irgendwo. Also sieht
  `audience: 'gm'` in der Kampagnenebene nur deren Leitung, in einer
  geteilten Ebene jede — ein Grundregelwerk, das drei Runden aufschalten,
  gehört keiner davon.
  `Layer.kind` kennt zwar ein Wort `campaign`, bleibt aber **Beschreibung**:
  ein Feld, das gleichzeitig Regel ist, leckt beim ersten Tippfehler.
  Seit Migration 152 hat jeder Artikel eine Ebene (E-182); was keine
  andere hatte, liegt in „Unassigned“ und gehört so niemandem besonders,
  bis es verschoben ist.
  Ebenso offen: die laufende Kampagne ist eine globale Einstellung.
  **Eine Spielerebene gehört der Kampagne, die sie aufschaltet**, wie die
  Kampagnenebene (T-164): genau eine, also sieht deren Leitung darin, was
  sie dort sähe — die Ebene sagt Herkunft und Schreibrecht, die
  Sichtbarkeit sagt weiter der Artikel.
- **Geschrieben wird je Ebene** (T-098, E-001). Ein Konto schreibt, was
  **ganz** in Ebenen liegt, in denen es schreibt (`inWritableLayers` —
  liegt ein Artikel auch im geteilten Regelwerk, nicht): die es besitzt
  oder zugeteilt bekam (`app_user_layer`, **neben dem Konto**, nicht an
  der Ebene — REQ-199), und als `gm` oder `co-gm` die **Ebene seiner
  Kampagne** (`campaignLayer`, aus der Rolle, ohne Zeile). **Eine eigene
  Ebene legt jedes Konto an** (`POST /api/layers`) und besitzt sie; sie
  wirkt, sobald die Leitung sie aufschaltet, und **wird nie zur Ebene der
  Kampagne** (`campaignLayer` überspringt, was einem Konto gehört). Jede
  Kampagne hat ihre Ebene (beim Anlegen; ältere: Migration 035). **Fremdes
  ändert man als Fassung:** „Edit" an einem Artikel, den man nicht
  schreibt — auch einem ohne Ebene, der bleibt bei der Verwaltung —, legt
  ihn mit `adaptedVersion` in eine eigene Ebene, die im Spiel ist
  (`zielEbenen`, `POST /api/entities/:id/adapt`). `ready` bleibt bei `gm`;
  was einer ändert, der es nicht setzen darf, fällt zurück (D74). Dazu
  schreibt `gm` weiter, was Spielende angelegt haben (D72).
  **Jede Spielerin hat ihre Spielerebene** (T-164, `spielerebene.ts`): je
  Konto und Kampagne mit Rolle `player` eine, angelegt mit der Rolle
  (ältere: Migration 069), besessen vom Konto, **wessen sie ist, steht in
  `app_user_layer.campaign_id`** (`Layer.kind: 'player'` ist Beschreibung).
  Sie ist die **Vorgabe zum Schreiben** (`vorgabeEbene`, eine Funktion für
  Anlegen, Konto-Seite und `GET /api/layers/default`), steht dicht **unter**
  der Kampagnenebene, `gm`/`co-gm` schreiben sie mit, und **Fassungen
  fremder Artikel kommen nicht hinein** (`anpassZiele`). Geht die Rolle,
  bleibt die Ebene unbeschrieben stehen, bis die Leitung sie übernimmt
  (`POST /api/layers/:layer/takeover`: Inhalt in die Kampagnenebene, leere
  Ebene weg).
  **Die Schreibebene wählt jedes Konto selbst** (T-161, `schreibebene.ts`):
  im Popup der Kopfleiste unter seinen **Schreibzielen** (`schreibZiele`,
  T-418: die Zielebenen und jede Ebene ausserhalb des Stapels, in der es
  schreibt — die Verwaltung jede ausser Gruppen und fremden
  Spielerebenen; die ausserhalb als `inPlay: false`, „not in play"),
  gespeichert am Server je Konto und Kampagne (`writeLayer`, nur über
  `PUT /api/layers/write`), beim Lesen gegen die Schreibziele geprüft —
  fällt das Recht weg, gilt die Vorgabe (`grundEbene`) mit Hinweis.
  Dieselbe Liste gilt beim Anlegen mit genannter Ebene und beim
  Verschieben am Artikel; Fassungen und Übernahme bleiben bei
  `zielEbenen`, denn eine Fassung ausserhalb des Stapels gälte nirgends. Anlegen nimmt sie, eine genannte Ebene geht
  vor; Fassungen und Übernahme nehmen nur eine *gewählte*. Die Verwaltung
  legt ohne Wahl in die Ebene der laufenden Kampagne an, ohne Kampagne in
  die **Parkplatz-Ebene „Unassigned“** (`UNASSIGNED_LAYER`, E-182, E-186):
  **jeder Artikel hat eine Ebene** (ausser Ebenen selbst), und wer die
  letzte wegnimmt, wird abgewiesen — die Verwaltung legt ihn stattdessen
  dorthin. „Unassigned“ ist eine gewöhnliche Ebene, von Hand aufschaltbar;
  die Werkbank führt ihren Inhalt (`unassigned`). Eine **Kampagne liegt in
  ihrer eigenen Ebene** (E-183), und der Stapel nimmt Kampagnen aus.
  **Gewählt schlägt gerechnet** (T-176): auch Account › Layers wählt
  („Make default", `PUT /api/layers/:layer/default`, die Verwaltung auch für
  ein anderes Konto) — dieselbe Einstellung. **Eine Ebene leeren**
  (`POST /api/layers/:layer/empty`, Besitzer und Verwaltung) ist eine
  Massenänderung `delete`: Teile gehen mit, Kanten darauf gehen weg, Undo
  wie jede.
- **Vier Ansichten, und der Ort wählt sie.** `overview` steht in einem
  Verweis oder einer Listenzeile, `quick` auf einer Karte, im Popup und
  unter dem „+" eines Suchtreffers (T-346: `search` ging darin auf, wer es
  noch nennt, bekommt `quick`, `RETIRED_PLACES`), `full` auf der
  Artikelseite, `print` auf dem Blatt hinter „Print" (T-110). **In `quick`
  steht das Relevanteste oben und das Bild zuletzt** — der Kartenrahmen
  schneidet es unten ab, statt es zu verkleinern. **Eigene
  Ansichten** legt man im Register an (Registry › Views, E-030 b; die
  erste ist der Handzettel `handout`); gewählt
  werden sie nur, wo ohnehin gewählt wird — die Kachel und der Druck. Die
  vier, nach denen ein Ort fragt (`PLACE_VIEWS`), lassen sich umbauen, nicht
  löschen. **Die Kurzansicht** (`quick`) steht auch als Popup an
  jedem genannten Artikel (`nwQuick`, `nw-kurzpopup`, T-093): ein Klick
  zeigt die Karte, „Open article" führt hin. Einen Wähler gibt es nicht —
  ein Verweis ist ein Verweis, und wer das jedes Mal sagen muss, sagt es
  irgendwann falsch; nur die
  Kachel auf dem Board wählt, weil dort die Grösse eine Frage an die Kachel
  ist. **Es gibt keine Spieleransicht:** zurückgehalten wird am Server
  (`redactEntity`), und wer weniger sehen darf, sieht dieselbe Ansicht mit
  weniger darin.
  **Der Ort wählt die Gruppe, die Geltung die Ansicht darin** (T-268,
  E-103): eine Ansicht darf eine Gruppe (`group`, ein Ort oder ein eigenes
  Wort wie `shop`) und eine Geltung (`applies`: Typen, Bedingungen auf
  Felder und Kanten — auch eingehende —, oder genau ein Artikel) tragen.
  `viewsFor` rechnet die geltenden, genaueste zuerst (Artikel › Bedingung ›
  Typ › global); wo eine gebraucht wird, gilt die genaueste, wo gewählt
  wird (Kachel, Leiste „Views" am Artikel), stehen alle.
  **Eine Zeile mit `adjust` ist eine Schicht** (UI *overlay*, T-425,
  E-168, E-173): sie legt sich über die Ansicht ihrer Gruppe, statt sie zu
  ersetzen — allgemein vor Typ vor Bedingung vor Artikel, gleich genau nach
  `priority` —, und die Elemente stehen nach Position (`pos`; ohne Angabe
  still 10, 20 … der Grundlage). Fassen zwei Schichten dasselbe an, gilt
  die genauere; der Designer zeigt ⚠, die Werkbank `viewConflicts`. Eine
  Schicht steht nicht zur Wahl (`isContribution`); der Designer speichert
  sie als Unterschied (`contributionFrom`, nie `order`).
  **Die Leiste des Designers** (T-425, E-171): oben einfügen nach Gruppe
  (`LEISTE`) und suchen, Rückgängig/Wiederholen über den Entwurf
  (`history.ts`, ein Muster), Kopieren/Einfügen über die Ablage
  (`kern/ablage.ts`), am gewählten Element die schwebende Leiste.
  **Eine Collection ist auch ein Artikel** (T-425, E-174, Art unter
  `Rule`): Mitglieder nach Regel (`Collection.types`/`tags`/`fields`, über
  `GET /api/list`) und von Hand (`inCollection`, `exclude` nimmt aus); das
  Element `collection` mit Quelle `members` zeigt sie. `MaterialGroup`
  ist ein Untertyp.
  **Farben sind Design-Tokens** (T-425, E-170, `Registry.tokens`,
  `token_def`): Rolle, Wert hell und dunkel; ein Element nennt je Stelle
  (`head`, `surface`, `frame`, `text`) ein Token (`style`), die Ansicht je
  Elementart eine Vorgabe (`styles`), `pickView` mischt sie ein. Kontrast
  prüft die Werkbank (`tokenContrast`), gepflegt wird unter Registry ›
  Tokens. Nie ein Farbcode am Element.
  **Ein Editor** (T-276): der Designer (`ansichten/designer.ts`) bearbeitet
  jede Ansicht — Registry › Views, „Design" an der Typseite (mit
  vorgewähltem Typ), „Design this view" im Full edit des Artikels. Beim
  Speichern sagt er, wohin: die Ansicht selbst (jeder Artikel), jeder
  Artikel eines Typs — **vorgewählt der Typ, von dem man kommt**, und
  angepasst, wo es geht, sonst eigene Anordnung, ohne Häkchen (T-318) —,
  nur dieser Artikel, oder eine neue Ansicht mit Bedingung. Was in einer
  Ansicht je Typ und gestaltet gilt, steht unter ihr in Registry › Views
  und im Designer („In this view"). Die Typseite zeigt nur noch, welche Ansichten
  gelten und woher — kein zweiter Editor.
- **Die Anordnung wohnt am Typ** (`InterfaceDef.views`), nicht an der
  Ansicht: eine Kreatur zeigt ihren Bogen, ein Rezept seine Werkbank, ohne
  dass jemand etwas auswählt. Untertypen erben sie (`layoutFor` läuft die
  `extends`-Kette hoch); sagt keiner etwas, gilt die Grundanordnung der
  Ansicht. Eine Stufe für genau einen Typ wäre ein Sonderfall mit einem
  Dropdown davor. **Zwei Formen** (T-110): eine eigene Liste ersetzt, eine
  **Anpassung** (`{ adjust: { drop, hide, add, extra, order } }`) nimmt, was
  darüber gilt, und sagt nur die Abweichung — sie bleibt richtig, wenn die
  Ansicht sich ändert, und ist darum der Normalfall. Gezeigt wird die
  Schnittmenge aus Ansicht und Artikel; leere Felder (`empty`) und
  Ungenanntes am Ende (`rest`) sagt die Ansicht. Zugeteilt wird einmal
  (`anordnen`), für Artikelseite, Druck und Registervorschau. Der Designer
  rechnet die Anpassung aus dem Baum zurück (`adjustFrom`): was sie nicht
  sagen kann (ein Element anders eingestellt oder verschoben), speichert er
  nur als eigene Anordnung.
  **Eine gestaltete Ansicht trägt ihre Anordnung selbst** (T-268): einen
  Baum aus Elementen (`children` an `section`, `columns`, `carousel`,
  `collapsible`), deren Werte auch über Kanten kommen (`path`,
  `shopkeeper › Shop › sells › Item`). Sie ist die Ausnahme für das, was
  keine Art ist (ein Wirt ist eine Kreatur mit Laden); was für alle einer
  Art gilt, bleibt an der Art. Reiter (`tabs`) stehen im Baum des
  Designers als Knoten `tab` (`tabsAsTree`/`treeAsTabs`) und werden wieder
  als `tabs` gespeichert.
  **Was an einem Artikel hängt, steht in der Ansicht seiner Art**
  (Element `collection`, T-425, E-142, E-172): die Session zeigt ihre
  Szenen und Begegnungen als Kacheln, jede die Kurzansicht ihrer Art
  (`nw-vorschau` eingebettet) — das Element wählt die Ansicht
  (`view`, `viewByType`), nicht die Kante; eine Collection in einer Kachel
  zeichnet nichts (eine Stufe). Kacheln, Liste oder Tabelle (die frühere
  „Table from edges", Migration 146); Quelle ein Pfad oder ein Filter wie
  im Kompendium (`collectionQuery`). Was ohne Rang an einer Geschichte
  hängt, zeigt `st-contains` an `Story` — die feste Liste „Contains" ist
  weg —, ein Ort seine Unterorte und Bewohner. **„Linked article" mit
  Kante** (`path`) zeigt ein Ziel in einer gewählten Ansicht; ohne bleibt
  es die bearbeitbare `asField`-Seite. Ein Element gleicher Id in
  `adjust.extra` stellt das geerbte an Ort und Stelle um (die Szene zeigt
  „Contains" als Liste); die Kurzansicht eines Boards ist eine Skizze
  (`boardSketch`). Konzept und Entscheide E-139, E-142,
  E-168–E-183: [docs/vorschlaege/Verknuepfte-Ansichten.md](docs/vorschlaege/Verknuepfte-Ansichten.md).
- **Ein Typ darf ein geerbtes Feld umbenennen** (`InterfaceDef.titles`,
  `Typ.feld` → Beschriftung, die `extends`-Kette hoch geerbt wie `area`).
  `Time.until` heisst an einem Auftrag „Deadline" und an einem Ereignis
  „Until". Es ist **keine zweite Feldliste**: der Bestandteil bleibt einer,
  und ein Feld, das morgen dazukommt, bringt seinen eigenen Namen mit.
- **Der Bezeichner ist eine Nummer** (`Identity.id`, `npc-0042`):
  ausgegeben beim Anlegen, `readOnly`, danach unverändert. Er hiess einmal
  `key` und war ein Slug des Namens — also dieselbe Sache zweimal, die beim
  Umbenennen entweder mitwandern musste oder log. Gezählt wird, was dasteht
  (`nextId`); ein gespeicherter Zähler wäre die zweite Stelle, die nach dem
  ersten Import falsch steht.
- **Wissen ist eine Information oder ein Bündel davon.** `Information` nennt
  die Felder *eines* Artikels, `Knowledge` bündelt Informationen über
  `includes`, und beide gehen über dieselbe `knownBy`-Kante an Creature,
  Party oder Faction. Ein Bündel in einem Bündel zählt nicht — ein
  Schritt weit, sonst reicht eine Freigabe weiter, als jemand gemeint hat.
- **Die Zahlen einer Kreatur wohnen am Statblock**, auch die eines
  Spielercharakters; `belongsTo` sagt, welcher. `Vitals` bleibt bei der
  Figur: das ist, was sich während der Sitzung ändert. Damit heisst `hp` am
  Statblock das Maximum und an der Figur der Stand.
  Der Statblock trägt seine Felder **selbst** (`ac`, `hp`, `speed`, `cr`,
  `prof`, `senses`, `resistances`, `bonuses` …) und nimmt `Abilities` und
  `Proficiencies` dazu — die sechs
  Werte samt ihren gerechneten Nachbarn, denn `mod(dex)` löst gegen
  dieselbe Karte auf. `StatblockInfo` gibt es nicht mehr: dreissig Felder
  unter einem Sammelnamen sind keine Auskunft. Der Bogen liest beide Karten
  als eine (`sbCard`), weil `sb.ac` und `modOf(sb,"dex")` nebeneinander
  gebraucht werden; geschrieben wird in die Karte, der das Feld gehört.
  **Ohne Statblock keine Zahlen:** der Bogen zeichnet nichts, bis einer
  anhängt; an seiner Stelle stehen „anlegen" (mit dem Namen der Kreatur)
  und „aus einer Vorlage", und der Anlegedialog fragt danach (neu, aus
  einer Vorlage, später). Kreaturen ohne Statblock stehen auf der
  Vorbereitungsseite — eine Prüfung, die das Anlegen verbietet, gibt es
  nicht, denn eine NSC-Idee hat noch keine Zahlen. „Hängt einer an"
  (`statblockOf`) und „trägt er Zahlen" (`statsOf`) sind zwei Fragen.
  **Vorlage und Instanz:** „aus einer Vorlage" hängt nicht die Vorlage an,
  sondern eine **Instanz** — einen eigenen Statblock mit `instanceOf` auf
  die Vorlage, der **nur speichert, was abweicht**, und beim Lesen die
  Vorlage darunterlegt (`resolveInstance`, Feld für Feld; Kanten nach
  Art). Zwei Wachen aus einer Vorlage werden so verschieden, und eine
  Korrektur an der Vorlage erreicht jede, die das Feld nicht selbst
  gesetzt hat. **Gleich wie die Vorlage heisst: folgt der Vorlage** —
  `persist` im Prototyp und `thinInstance` am Server werfen beim Speichern
  weg, was gleich steht; ↺ am Feld tut dasselbe. Instanzen stehen in
  keiner Liste und sind kein Verweisziel; geht die Vorlage, bekommen sie
  vorher, was sie lasen (`detachInstance`), geht die Kreatur, geht ihre
  Instanz mit. Nicht vererbt werden `Identity`, `Visibility` und die
  Kanten, die zur Vorlage als Artikel gehören (`inLayer`, `belongsTo`,
  `overrides`, `variantOf`), und das Inventar eines Stücks (`carries`).
  **Eine Karte oder Begegnung im Spiel ist eine Instanz** (T-289, E-039,
  E-041, `packages/model/src/playinstance.ts`): „Take into play" bzw.
  „Start encounter" an einer Vorlage legt sie an (`newPlayInstance`, je
  Sitzung eine), Tokens, Nebel (`Map.reveal`) und Kampfstand stehen an ihr,
  die Sitzung zeigt auf sie. Für Spielende ist eine Karteninstanz **nicht
  vorhanden, bis die Leitung sie freigibt** (`Map.released`, `heldBackMap`
  in `articleVisible`). **Abweichung von „Instanzen stehen in keiner
  Liste":** sie steht unter „Played" an ihrer Vorlage (`playedOf`) und
  sonst nirgends — ein gespielter Stand ist einer, zu dem man zurück will,
  und gesucht wird er an der Karte.
  **Ein Gegenstand im Inventar ist ein Stück** (T-150): gekauft, erbeutet,
  gefertigt oder gegeben entsteht er als Instanz (`newInstance`,
  `stueckWerkstatt`), ein loser Stapel derselben Vorlage wächst stattdessen
  (`receivePiece`), und Material zählt nach dem Grundartikel
  (`baseArticle`). Für einen Tag durfte ein Statblock vielen
  gehören („shared by 30") — dann war jede Änderung an einer Wache eine an
  allen.
- **Ein Textblock ist ein Feld.** Es gab einmal `blocks: [{blockType, body,
  anchor}]` neben den Karten, mit einer eigenen Liste erlaubter Blockarten je
  Artikelart — also eine zweite Frage, die jede Art zweimal beantworten
  musste. Jetzt ist die Blockart das Feld: `secret` ist ein Feld mit `many`
  und `format: 'long'`, und seine Einträge tragen die Id, an der die
  Wissensfreigabe hängt (`Secrets.secret#id`). Die Id kommt aus dem Text, denn
  eine durchgezählte hält nur, solange die Reihenfolge hält. Ein Prosafeld
  steht **nicht** in der Feldtabelle — es gehört dem Element `prose`.
  **Ausnahme Buchtext** (T-108, E-028, E-029): ein Buch und ein Abenteuer
  bestehen aus Kapiteln (`Chapter`), ein Kapitel aus **Teil-Artikeln** —
  `Heading`, `Paragraph`, `ReadAloudText`, `Embed` (ein Verweis auf einen
  Artikel, der für sich steht) und Szenen —, in der Reihenfolge von
  `partOf.props.rank`. Der Grund: einen Vorlesetext oder einen Absatz holt
  man **einzeln** in die eigene Geschichte, und was man einzeln holt, ist
  ein Artikel. Teile stehen in keiner Liste und sind kein Verweisziel nach
  Namen (`isBookPart`). Ein Kapitel eines offiziellen Abenteuers ist
  zweimal da und seine Teile einmal: `Chapter` zum Lesen, `Arc` zum
  Spielen (`chapterOf`), beide über denselben Szenen. Ein Teil wird
  **geholt** (Fassung, `take`) oder **verwendet** (`take {use: true}`: ein
  `Embed` aufs Original); die Artikelseite zeichnet Teile mit dem Element
  `parts`.
- **Ein langer Text ist Markdown, und nichts darin wird HTML** (M10).
  `parseMarkdown` liest die Blöcke, `parseInline` jede Zeile darin — ein
  Zerleger für Inline-Text, nicht zwei. Gezeichnet wird mit Elementen und
  Textknoten (`nw-text`, im Prototyp `para`), nie mit `innerHTML`.
  **Ein Verweis nennt die Nummer** (`[[npc-0042|Volo]]`, M11): `[[Name]]`
  darf getippt werden und wird beim Speichern zur Nummer, wenn genau ein
  Artikel so heisst (`idLinks`); ein mehrdeutiger bleibt stehen und sagt
  es — der erste Treffer wäre bei zwei Goblins der falsche. **Ein Würfel
  ist `{{1d6+2}}`** (M12), `{{+4}}` ein W20 mit Bonus; einfache Klammern
  bleiben den Platzhaltern, eckige den Verweisen.
- **Ein Untertyp ohne eigene Felder ist ein Wort und keine Zeile.** `NPC`,
  `Companion` und `Retainer` waren drei Artikelarten, die zusammen kein
  einziges eigenes Feld trugen; eine Kreatur ist jetzt selbst eine Art, und
  `Creature.kind` sagt, was für eine — npc, companion, retainer, pet,
  summon. Das Feld ist **frei** und keine Aufzählung: die Maske schlägt vor,
  was an anderen Kreaturen schon dasteht (`suggest: true` am Feld), und
  eine neue Sorte ist ein Eintrag. **Vorgeschlagen wird nur, wo das Feld
  es sagt**, und nur aus sichtbaren Artikeln — es galt einmal für jedes
  freie Textfeld, und der Deckname bot die Decknamen anderer Artikel an. Braucht eine Sorte eigene Felder, wird sie eine Zeile, die von
  `Creature` erbt — bis dahin stehen ihre Sonderregeln am Statblock und an
  der Regel, auf die er zeigt. So ging es dem **Arc**: bis 14.10. ein Wort
  an `Story.kind` (A5), seit E-026 eine Art mit Stufen, Hook und Ausgang —
  und ein **Kapitel eines Abenteuers ist ein Arc**. Eine Karte steht immer
  an einer Szene (liegt sie im Kapiteltext, bekommt sie eine eigene), und
  ein Kapitel oder eine Szene lässt sich **mit allem darunter in die eigene
  Geschichte holen** (`take`, E12): Fassungen in der Kampagnenebene, an die
  Kampagne oder einen ihrer Arcs gehängt. „Übernehmen" (`adopt`, E7) ist
  etwas anderes.
- **Eine Aufzählung, die zwei Felder brauchen, ist eine Registerzeile**
  (`REG.enums`), und das Feld nennt sie mit `enumRef`. Die sechs
  Attributkürzel standen wörtlich an `SkillInfo.ability` und an
  `RecipeInfo.ability`; wer eine Liste nachzog, zog die andere nicht nach.
  Gelesen wird **immer** über `enumOptions()` (Paket) bzw. `enumWerte()`
  (Prototyp) und nie `p.enum` direkt. Eine Liste mit genau einem Nutzer
  bleibt am Feld — eine Zeile dafür wäre der Umweg ohne den Gewinn.
  **Mehrere Zeilen darf ein Feld nennen** (`enumRef: ['Skill', 'Language', …]`),
  und dann gelten sie zusammen: `Proficiencies.proficient` zieht aus sechs
  Quellen, weil ein Feld je Sorte dieselbe Frage sechsmal stellte und die
  siebte Sorte ein siebtes Feld gebraucht hätte. Woher ein Wert kommt, sagt
  die Quelle, in der er steht (`enumSource`) — der Bogen gruppiert danach.
  Getrennt gebraucht: `enumGroups()` / `enumGruppen()`.
  Mit `type: 'array'` hält dasselbe Feld **mehrere** Werte aus diesen
  Listen; die Maske zeigt dann Häkchen, nach Quelle gruppiert.
  **Ein Name darf eine Artikelart sein** (M6, D50): dann sind die Werte die
  Namen ihrer sichtbaren Artikel (Untertypen ja, Instanzen nein; `enumWhere`
  engt ein), und `Typ.feld` nennt die Liste eines Feldes
  (`Weapon.category`). Wer eine Art nennt, gibt `enumOptions()` die
  sichtbaren Artikel mit. **Frei mit Vorschlag** (T-423): mit `suggest`
  schlägt auch eine Zeile nur vor — `Encounter.kind`, `Place.kind`
  (`PlaceKind`); die Maske holt Liste und Werte in Gebrauch über
  `GET /api/suggest`. Werte, die ein Ablauf liest, halten weiter.
  **Die Zeile hält, die Art schlägt vor:** ein
  Feld, das eine Art nennt, prüft `validateEntity` nicht gegen die Liste
  (`enumHolds`) — ein Name ist der heutige Stand.
- **Eine Zahl mit Grenzen ist eine Spanne** (`min`, `max`), keine
  Aufzählung von zwanzig Wörtern. Die Schwierigkeit war fünf Wörter an der
  Begegnung und freier Text an der Szene; sie ist jetzt eine Stufe von 1
  bis 20 im Typ `Difficulty`, und beide nehmen ihn dazu.
- **Übungen stehen in einem Feld, nicht in sechs, und am Statblock.**
  `Proficiencies.proficient` (und `expertise`) ziehen aus den Artikeln von
  `Skill`, `Language`, `Item` (nur Werkzeuge) und `Weapon` und aus den
  Listen von `Weapon.category` und `Armor.armorType`; `saves` zieht aus
  `Ability`. Welche Fertigkeiten es gibt, sagen die `Skill`-Artikel,
  **worauf jede rechnet**, ihr `ability` — die Zeilen `Skill`, `Tool`,
  `Language`, `WeaponTraining`, `ArmorTraining`, `KnowledgeField` und die
  Einstellung `skills` sind seit P4 weg (M6). `Proficiencies` nimmt der
  Statblock, nicht die Kreatur (M5): die Übungen gehören zu den Zahlen.
- **Klasse, Abstammung, Hintergrund sind Kanten von der Figur** (M3):
  `hasClass` je Klasse mit `props.level` und `props.subclass`,
  `hasAncestry`, `hasBackground`. **Die Stufe wird gerechnet**
  (`sum(hasClass.level)`, eine Rechnung über die eigenen Kanten), nicht
  eingetippt. Was eine Klasse gewährt, ist `grants` mit der Stufe **an der
  Kante** — „Ability Score Improvement" ist ein Artikel und sieben Kanten,
  darum gibt es `Feature.level` nicht (D50).
- **`Status` ist der Vorbereitungsstand und sonst nichts:** `idea`,
  `prepared`, `ready` (Aufzählungszeile `State`). Gelesen wird die Zeile
  (`statusWerte()`), nicht ein Gedächtnis: „Unfinished" zählte nach der
  Umstellung noch `planned` und bot `used` an. Was im Spiel geschah,
  gehört nicht hierher — `used` und `discarded` waren Ereignisse, die ein
  Feld für immer festhielt. Wie weit eine Sache am Tisch ist, sagt das Feld
  der Art: `Quest.progress`, `Encounter.phase`, `Explored.state`. Drei
  Felder hiessen einmal alle `state` und meinten Verschiedenes.
  **Seit D72 ist er auch die grobe Sichtbarkeit für Spielende**
  (`articleVisible`, `isReady`): wer nicht `gm`/`co-gm` der Kampagne des
  Artikels ist, sieht nur `ready` — ausser Eigenem (angelegt oder
  schreibbar, `Viewer.own`). **Ohne Status-Karte zählt ein Artikel als
  fertig**; seit Migration 152 trägt jeder einen Stand (E-179: was keinen
  hatte, steht auf `ready`), neu angelegt `idea`, und wer ihn leert, wird
  abgewiesen. `ready` setzen nur die Verwaltung und `gm`; der Server prüft
  es, die Maske bietet es Spielenden nicht an. Kein eigenes Feld „zur
  Abnahme" (E-011) — das wäre ein zweiter Stand.
  **Pflicht je Stand** (T-425, REQ-441, E-177, E-178): `requiredFor:
  prepared | ready` an Feld oder Kantenart, je Art überschreibbar
  (`InterfaceDef.requiredFor`, `none` hebt auf); geprüft beim Heben des
  Stands (`stateRefusal`, 422 `state_gaps` mit Satz, was fehlt), wer den
  Stand hat, behält ihn (Werkbank `readyWithGaps`), der Rückfall nach D74
  geht auf den höchsten erreichbaren Stand (`reachableState`).
  **Die eigene Figur ist ausgenommen** (D74, E-014 d): Spielercharakter
  samt Statblock und Inventar verwaltet der Spieler ganz, setzt auch
  `ready`, und die Mitspielenden sehen sie in jedem Stand
  (`Viewer.ungated`). **Ändert eine Spielerin anderes Fertiges, fällt es
  auf `prepared`**, und für alle ausser ihr und der Leitung gilt der
  letzte fertige Stand weiter — eine Kopie am Server (`entity_ready`),
  keine zweite Karte im Artikel; `ready` durch `gm` lässt den neuen
  gelten.
- **Eine Seite, ein Scroll.** Der Registerkörper hatte sein eigenes
  Fenster (`overflow-y:auto; max-height:72vh`) — die Feldliste scrollte im
  Kasten, während die Seite stillstand, und wer unten etwas aufklappte,
  fand die Kopfzeile nicht mehr. Aufklappbar ist alles weiter, nur eben in
  der Seite.
- **Was nicht gilt, steht nicht da.** Ansicht und Artikelliste stehen nur
  an einer **anlegbaren** Art. An einem geteilten Typ standen dort eine
  Überschrift und ein Absatz, die nur erklärten, warum darunter nichts
  kommt — eine Überschrift zu viel.
- **Die Kanten, die von einer Art ausgehen, stehen in der Feldliste mit.**
  Eine Kante ist kein Feld: sie steht nicht in der Karte, sie zeigt auf
  einen anderen Artikel, und die Gegenrichtung ist eine Abfrage. Wer aber
  im Register wissen will, was an einer Art dransteht, liest sonst eine
  Feldliste und hält sie für alles. Also eine gepunktete Gruppe „Edges from
  here", zugeklappt wie die geerbten; die mit `asField` stehen schon als
  verlinkte Gruppe, und die mit `from: ['*']` treffen jede Art und werden
  nur gezählt.
- **Was eine Einstellung auslöst, steht dabei.** Unter `Display`,
  `Derived from` und `belongs to field` steht eine Zeile, die sagt, was
  passiert: `signed` druckt +3, `measure` rechnet um, eine Rechnung löst
  gegen die **Nachbarfelder derselben Karte** auf und erst dann gegen die
  übrigen Karten des Artikels (der Zauber-SG am Statblock liest `int` aus
  `Abilities`, D49), und `of` heisst, dass
  der gerechnete Wert in der Zelle des Nachbarn reitet (**DEX 16 (+3)**).
  Wer nicht weiss, was eine Angabe tut, lässt sie leer — dann ist sie kein
  Werkzeug, sondern ein Rätsel.
- **Das Register zeigt einen Typ auf einer Fläche: seine eigenen Felder
  offen, die geerbten Typen zugeklappt.** Je geerbter Typ eine Kopfzeile —
  Name, ob er hier dazugenommen wurde oder über einen anderen hereinkam,
  wie viele Felder er bringt, und ein × nur am **direkt** dazugenommenen
  (seine Felder gehen mit). Aufgeklappt stehen **seine** Felder, mit
  derselben Konfiguration wie an ihm selbst: geändert wird damit der Typ,
  dem sie gehören, und das gilt für jede Art, die ihn nimmt — darum sagt es
  die Kopfzeile. **Gelöscht** wird ein Feld nur dort, wo es erklärt ist.
  Siebzehn geerbte Typen flach ausgeschrieben sind achtundvierzig Zeilen,
  und die eigenen sechs gehen darin unter.
- **Auf- und Zuklappen zeichnet nicht neu**: die Zeilen stehen schon im
  Baum und werden gezeigt (`UI.regOpen` hält den Stand über ein späteres
  Zeichnen). Und `render()` **merkt sich den Scrollstand** jedes Kastens
  mit eigenem Scroll (`.main`, `.rail`, `.aside`, `.regbody`, `.fbox`) und
  setzt ihn zurück — wer unten in einer Liste etwas aufklappt, sucht sonst
  die Stelle, an der er gerade war.
- **Alle Typenlisten sind flach** (`typeList()`, alphabetisch nach
  Beschriftung): die Auswahl im Register, die Leiste, der Filter im
  Kompendium. Sie waren Bäume aus `extends`, und weil `extends` ein Array
  ist, musste ein Baum eine Herkunft wählen und die andere verschweigen —
  eine Art, die von zweien erbt, hing unter einer davon und unter der
  anderen nicht. In der Leiste stehen nur Arten **mit Bereich**: nach
  `Tags` zu filtern hiesse, nach „hat Marken" zu filtern.
- **In einer Ansicht wird zuerst nach Gruppe gewählt.** `full` zeigt
  alles — was dort fehlt, zeichnet ein anderer Block derselben Seite (der
  Bogen), und das ist eine Sache der Anordnung und keine Wahl je Art. Ein
  ganzer Typ (`Spell`, `except: ['Vitals']`) nimmt das Feld von morgen mit;
  eine ausgeschriebene Feldliste wäre an dem Tag unvollständig, und niemand
  merkte es. Ein einzelnes Feld (`Typ.feld`, „Add field" im Register) ist
  richtig, wo genau dieses gemeint ist — die Spalten einer Listenzeile, der
  Grad auf der Karte — und bleibt dann genau das; die Maske sagt es dazu.
- **Was gilt, steht in [docs/Datenmodell.md](docs/Datenmodell.md).** Die
  Regeln (A, T, F, K, E, V), die Feldformen, die Kantenfamilien, und unter
  „Das Register heute" die erzeugte Übersicht aller Arten und Kanten
  (`catalogue` schreibt sie mit). Was gefordert war und was davon steht:
  [docs/Anforderungen.md](docs/Anforderungen.md). Wo das Register vom
  Konzept abweicht: der Abgleich in [docs/Durchgang.md](docs/Durchgang.md).
  Was 5e.tools kennt und wir noch nicht, und wie es hereinkommt:
  [docs/5etools-Abgleich.md](docs/5etools-Abgleich.md); in welcher
  Reihenfolge: [docs/5etools-Arbeitsplan.md](docs/5etools-Arbeitsplan.md).
- **Bei jeder Modelländerung wandert die Erklärung mit.**
  [docs/Datenmodell.md](docs/Datenmodell.md) (die Regel),
  [docs/Begriffe.md](docs/Begriffe.md) (das Warum) *und* die Seite „How it
  works" im Register, mitsamt dem durchgerechneten Beispiel am Ende — alles
  gehört in denselben Commit wie die Zeile, die sich geändert hat. Eine
  Erklärung, die man später nachzieht, erklärt in der Zwischenzeit etwas,
  das es nicht mehr gibt.
- **Bei jeder Änderung wandern Handbuch und Glossar mit** (T-242, T-225).
  Das Handbuch (`/handbook`) ist die eine Stelle, an der die Seite sich
  erklärt; das Glossar ist sein letztes Kapitel. In denselben Commit wie
  die Änderung gehören: der Hilfetext der Seite (`apps/web/src/help.json`,
  er ist das Kapitel „Pages" und das „?"), das `does` einer neuen
  Regeloption oder Variante, ein Eintrag in `APP_TERMS`
  (`packages/registry/src/glossar.ts`) für **jede neue anlegbare Art und
  jedes neue Wort der App**, und Text in `apps/web/src/handbook.json`, wo
  sich ein Ablauf ändert. **Die Tests sagen, was fehlt**
  (`packages/registry/test/glossar.test.ts`, `apps/web/test/hilfe.test.ts`,
  `apps/web/test/glossar.test.ts`) — sie nennen die Art, das Wort, die
  Route oder die Option. Erzeugt wird, was erzeugt werden kann; abgetippt
  wird nichts. **Spielbegriffe** (Zustände, Eigenschaften, Aktionsarten)
  sind keine Wörter der App: sie kommen als `GlossaryTerm`-Artikel in die
  Ebene ihres Regelwerks, über die API und mit Protokoll — nie ins Repo.
- **Wie die Dinge heissen, steht in [docs/Begriffe.md](docs/Begriffe.md):**
  Typ, Bestandteil, Feld, Bezeichner, Artikel, Ansicht, Block, Kante,
  Einheit — neun Wörter, mehr nicht. Wer zwei Namen für eine Sache hat, hat bald zwei Sachen; im
  Prototyp steht dasselbe unter Registry › How it works, aus dem laufenden
  Register gezogen.
- **Sechs Seiten, vier davon Bereiche.** Register und Kompendium sind
  Seiten; `world`, `story`, `rules` und `play` sind Bereiche (`story`
  ist nur die Kampagne — die Weltgeschichte, `World` und `Event`, steht
  unter `world`; bis 13.10. hiess `story` `history` und hielt beides). Wohin eine
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
  **Eine Zeile zu ändern heisst auch, sie nachzuziehen** (T-123): der
  Seed schreibt Arten nur in eine leere Datenbank, also erreicht eine
  Änderung dev und prod nur über eine Migration. Der Lauf
  `apps/server/scripts/register-abgleich.mjs` im CI spielt eine
  Installation auf dem Stand von `register-stand.json` nach und schlägt
  fehl, wenn sie danach anders steht als `packages/registry`; eine
  bewusste Abweichung kommt mit Grund in seine `AUSNAHMEN`. Was eine
  laufende Datenbank heute anders hat, zeigt die Werkbank
  (`registryDrift`).
- **Masse werden beim Lesen umgerechnet, nie gespeichert** (D8). Der Vault
  ist imperial, weil die Regeln es sind; wie gerechnet wird, steht als
  Registerzeile in `packages/registry/src/units.ts` und nicht im Code. Was
  gezeigt wird, sagt die Einstellung `units`; eine Artikelart darf es
  überschreiben und vererbt es wie `area`.
  **Ein Mass ohne Einheit ist keines**: gerechnet wird aus der
  gespeicherten Einheit, also verlangt die Prüfung `unit` an jedem Feld mit
  `format: 'measure'` — ohne sie rechnet nichts, und das sieht aus wie eine
  Zahl, die schon stimmt. An einem Text ist `unit` das **Ausgangsmass** für
  Zahlen, die selbst keine nennen, und es greift nur, wenn im ganzen Text
  kein Buchstabe steht: „40" und „30/120" sind Fuss, „7 zorp" bleibt sieben
  Zorp. In „climb 20" könnte „climb" eine Einheit sein, die diese Kampagne
  kennt und der Code nicht.
- **Ein Verweisfeld nennt seinen Zieltyp** (`PropertySchema.target`). Ein
  Feld mit `format: 'link'` hält eine Artikel-Id; ohne Zielangabe die von
  irgendeinem, und „Scene in play" nahm eine Rüstung. `target.interfaces`
  gilt wie `RelationDef.from`/`to` die `extends`-Kette hoch — eine
  Spielerfigur *ist* eine Kreatur —, und `validateEntity` lehnt anderes ab
  (`link_wrong_type`), sobald der Aufrufer `knownTypes` mitgibt.
  **Die Art hält, der Filter schlägt vor:** `target.tags` und
  `target.where` lesen den heutigen Zustand des Ziels, also engen sie nur
  die Maske ein — eine Regel daraus machte einen längst gespeicherten
  Verweis rückwirkend falsch, sobald jemand eine Marke entfernt.
- **Ein Feld sagt, ob es immer bearbeitet wird** (`alwaysEdit`), und zwar
  **am Feld und nur dort**. Der Stand der Trefferpunkte wird mitten im Zug
  gesetzt, und erst „Bearbeiten" zu sagen sind drei Klicks für eine Zahl.
  Am Typ stand es einmal auch — das war ein Schalter für zwanzig Felder auf
  einmal: an `Vitals` sind die Trefferpunkte ein Stand, die Zustandsliste
  aber ein Satz Häkchen und die Trefferwürfel Punkte, die der Bogen ohnehin
  anklickbar zeichnet. Wer jedes Feld einzeln benennt, benennt auch die
  Ausnahme. Heute: `Vitals.hp`/`hpTemp`/`exhaustion` und die Reisezähler
  `Party.day`/`watch`/`sinceRation`/`sinceLight`. Ein gerechnetes oder
  ausgegebenes Feld bleibt ohne Eingabe, und wer nicht schreiben darf,
  sieht weiter den Wert.
- **Beim Bearbeiten ist jedes Feld erreichbar; gezeigt werden Pflicht-
  und befüllte Felder, die übrigen über „+ Add field“** (T-195), auch
  die aus `Identity` (Aliasse, Deckname) — ein Feld, das man nur über die
  Einfuhr füllen kann, ist keines. Vierzig leere Eingaben verstecken die
  fünf, um die es geht. Die Auswahl gruppiert nach Bestandteil, sucht und
  zeigt je Feld seine **Beschreibung** (`PropertySchema.description`,
  sonst was es hält). Auch leer stehen da: `alwaysEdit` und **`prominent`**
  (heute `Description.description` und `Status.status`); ein Wert gleich
  der Vorgabe (`default`) zählt nicht als befüllt. Ein Feld, das man in der Maske
  leert, bleibt bis zum Schliessen stehen. Der Name bleibt draussen: er
  ist die Überschrift, und zwei Eingaben für ihn wären zwei Stellen, die
  auseinanderlaufen.
- **Eine Form wird gemalt, nicht getippt** (`format: 'grid'`). `##.,##.`
  als Text sagt der Eingabe nicht, was dabei herauskommt, und beim
  Abzählen verrutscht eine Spalte, ohne dass es jemandem auffällt. Ein
  Zeichen je Feld, `.` ist frei; dasselbe Format trägt die Kachelform
  eines Gegenstands (`Item.rows`) und die Form eines Behälters
  (`Inventory.grid`).
- **Ein Behälter hat seine eigene Form und seine eigenen Zonen.** Das
  Raster war eine Kampagneneinstellung — zehn mal sechs für jeden
  Rucksack; ein Köcher ist aber kein Rechteck. `Inventory.grid` sperrt
  Felder, `Inventory.zones` (`{"x,y": "action"}`, Werte aus der Zeile
  `DrawTime`) sagt je Feld, **was es kostet**, etwas von dort zu holen.
  Die Zone eines Stücks ist die **langsamste**, die es bedeckt: man muss
  das Ganze herausbekommen, nicht nur eine Ecke. Sagt der Behälter nichts,
  gilt weiter das Rechteck aus den Einstellungen. Der Zonenname steht als
  Wort in der Karte und nicht als Nummer — eine Nummer wäre beim
  Umsortieren der Zeile still die falsche Zone.
- **Die Drehung eines Stücks steht an der Kante** (`holds.props.rot`), nicht
  am Gegenstand: derselbe Bogen liegt quer oder längs, und dieselbe Fackel
  soll nicht in jedem Beutel gleich liegen. Vom Raster nehmen und aus dem
  Behälter nehmen sind **zwei** Dinge, und beide braucht man.
- **Der Filter gehört der Seite.** `goPage` leert Typ, Marke und Status nur
  beim Wechsel auf eine **andere** Seite; von einem Artikel auf seine Liste
  zurückzugehen behält ihn. Ihn auch dort zu leeren hiesse, ihn jedes Mal
  neu zu setzen.
  **Filtergruppen** (T-137) sind gespeicherte Filter einer Seite, als
  Unterreiter (`?view=<id>`) und in der Kopfleiste (▾) erreichbar; die der
  Kampagne pflegt die Leitung, eigene jedes Konto (`list_filter`, nicht im
  Artikel). **Die Vorgabe einer Seite ist eine Gruppe mit `default`** —
  „World ohne Items" ist ein Eintrag, keine Liste im Code. Ein Reiter ist
  eine eigene Seite: er fängt mit Suche und Facetten seiner Gruppe an,
  danach gehört der Filter wieder ihm.
  **Die Ebenen gehören nicht der Seite** (T-186): World, Story, Rules und
  Compendium haben keinen eigenen Ebenenfilter — sie folgen dem Stand der
  laufenden Kampagne (Kopfleiste), und „Change layers“ führt dorthin. Eine
  Filtergruppe trägt darum kein `layer`/`nolayer` mehr (Migration 080 legt
  alte Angaben nach `list_filter_ebenen_alt`). **Ebenenauswahlen speichert
  das Popup** („Saved selections“, `ebenensets.ts`, `/api/me/layer-sets`):
  je Konto, wahlweise nur für eine Kampagne, in der Einstellung
  `layerSets`; Laden schreibt den Stapel über `PUT /api/campaigns/:c/layers`
  und darf darum nur, wer dort schaltet. Zwei Ebenenfilter — einer je
  Seite, einer global — waren zwei Antworten auf dieselbe Frage.
- **Das Diagramm zeichnet sich selbst.** Auf „How it works" steht ein
  Kasten je Artikelart und eine Linie je Kantenart (gestrichelt: die
  Vererbung), angeordnet nach Bereich — aus dem laufenden Register
  gezogen. Einen Kasten bekommt, was man anlegen kann, und was eine Kante
  nennt; die geteilten Typen ohne Kante sind Felder und keine Beziehungen
  und kommen erst auf Schalter dazu. Gezeigt wird eine Art auf einmal:
  einundvierzig Kantenarten gleichzeitig sind ein Knäuel, in dem keine
  einzelne mehr lesbar ist.
- **Nicht auf `0.0.0.0` binden** — ausserhalb eines Containers. Im Container
  ist `HOST=0.0.0.0` richtig, weil dort die Containergrenze das ist, was
  zählt; auf einer Maschine ist es der Reverse Proxy. Seit 2026-09-20 hat der
  Server ausserdem einen Zugang (ein Passwort je Nutzer, siehe
  [docs/Zugang.md](docs/Zugang.md)) — das ist ein Grund mehr für die enge
  Bindung und keiner weniger.

## Grundanforderungen an jede Änderung

Von der Leitung festgelegt (21.10.2026), für jedes Coding-Projekt und jede
Sitzung. Eine Änderung ist erst fertig, wenn alle fünf Punkte stehen; wo einer
nicht passt (z. B. reine Doku), sagt der Pull Request, warum.

1. **Drei Teststufen, im selben Pull Request.**
   - **Unit:** reine Funktionen in `model`/`registry`, jeder Zweig und die
     Grenzfälle (leer, null, Einheit fehlt, Umrechnung).
   - **Integration:** die Route über `app.inject` gegen `InMemoryRepository`,
     samt Siebung (Leitung und Spielerin). Wer die Datenbank anfasst, prüft
     zusätzlich mit dem Durchstich gegen Postgres, und zwar auch **mit
     Bestand**: Eine Migration läuft einmal gegen einen Stand mit den Altdaten,
     die sie umstellt. Am 21.10. fiel dev aus, weil eine Migration nur gegen
     eine leere Datenbank geprüft war (PR #318).
   - **E2E:** Playwright gegen den gebauten Server und die gebaute Oberfläche,
     als Datei unter `apps/web/e2e/`, die in der CI läuft (T-356). Geprüft
     wird der Ablauf so, wie die Leitung oder eine Spielerin ihn macht, bei
     1360 px und 390 px. Wo der Server siebt, laufen beide Rollen.
   - Einen Fehler gibt es zuerst als fehlschlagenden Test, dann die Behebung.
2. **Nach dem Merge auf dev nachsehen.** Das Ausrollen ist grün, und
   `/api/health` antwortet mit 200. Ist es rot, wird es sofort behoben (oder
   zurückgenommen), bevor etwas Neues kommt.
3. **Im Vault dokumentieren.** Jede Funktion steht an ihrer Feature-Notiz
   (`VTT/Features/F-nnn …`) und Story (`VTT/Stories/`), mit nachgeführtem
   Stand. Sobald mehr als drei Teile zusammenspielen, kommt ein **Diagramm**
   dazu, ob Ablauf, Zustände oder Datenfluss: Mermaid in der Notiz bis etwa
   zehn Knoten, grösser als Excalidraw mit SVG ([docs/README.md ›
   Bilder](docs/README.md#bilder)). Entscheidungen kommen ins Decision Log.
   Kampagneninhalt gehört nie dorthin, das Repo ist öffentlich.
4. **Hilfestellungen anlegen.** Jede sichtbare Funktion bekommt:
   - den Hilfetext ihrer Seite (`help.json`);
   - einen Handbuch-Abschnitt, bei einem Ablauf Schritt für Schritt unter
     *Workflows*;
   - einen Glossareintrag für jeden neuen Begriff;
   - die Beschreibung am Feld bzw. den Tooltip;
   - einen Eintrag in What's new.

   Eine Fehlermeldung sagt, was zu tun ist, nicht nur, was schiefging.
5. **Keine stillen Grenzanhebungen.** Wer eine Grenze anheben müsste (Grösse
   des Startpakets, Timeout, Limit), legt stattdessen eine Aufgabe im Bereich
   Performance an und nennt sie im Pull Request. Der Prüflauf nach jedem
   Release (T-322) vergleicht mit der Grundlinie.

Die PR-Vorlage fragt jeden Punkt ab, und die Aufträge an die Sitzungen nennen
ihn.

## Bauen und prüfen

```bash
pnpm install
pnpm --filter @nw/model build && pnpm --filter @nw/registry build   # zuerst
pnpm test && pnpm lint
pnpm --filter @nw/registry emit-seed   # nach jeder Registeränderung
DATABASE_URL=postgres://… pnpm e2e     # Abläufe im Browser, nach dem Bau von server und web
```

**E2E** (T-356): Playwright-Specs unter `apps/web/e2e/` gegen den gebauten
Server mit der gebauten Oberfläche und eine **eigene** Postgres (nie dev,
nie prod — der Aufbau legt Konten und eine Testkampagne an), als Leitung
und Spielerin, `desktop` 1360 und `phone` 390 px; im CI der Job `e2e`. In
den Sitzungen mit `E2E_CHROMIUM=/opt/pw-browsers/chromium`. Ein neuer Spec
nimmt `test` aus `e2e/hilfen.ts` (Fixtures `leitung`, `spielerin`, `api`,
`eindeutig`), Integrationstests ihren Tisch aus
`apps/server/test/hilfen/tisch.ts` — [CONTRIBUTING.md ›
E2E-Prüfungen](CONTRIBUTING.md#e2e-prüfungen).

`emit-seed` **behält** Zeilen, die es nur im Prototyp gibt — wer dort eine
Artikelart anlegt, soll sie behalten. Eine Zeile zu **entfernen** ist deshalb
ausdrücklich: `emit-seed --prune views` wirft die zusätzlichen Zeilen dieses
Teils weg und zählt sie dabei auf. Ein ganzer Teil ist oft zu grob — dann
nimmt der Schalter einzelne Zeilen: `--prune components:DeedInfo,interfaces:Deed`.
Ein Name, der nichts trifft, wird gesagt und lässt den Lauf fehlschlagen;
ein stiller Tippfehler sähe aus wie eine erledigte Löschung.

**Das Register allein weiterreichen:**
`node prototype/migration/register-datei.mjs` schreibt
`prototype/nebelwacht-registry.json` — die Zeilen ohne den Bestand. Eine
Datei mit `registry` und **ohne** `entities` nimmt die Einfuhr als
Registerlieferung: die Zeilen kommen, die Artikel bleiben, auch mit „und
lösche, was nicht in der Datei steht". Das Register wandert häufiger als
der Bestand, und es aus- und wieder einzulesen ist ein Umweg, auf dem man
einen Artikel verlieren kann. (Eine **leere** Liste `entities: []` ist
etwas anderes: eine Sicherung ohne Artikel, also „alles weg".)

Ändert eine Zeile ihren **Namen** oder fällt sie weg, wandert der Bestand
mit: je Änderung ein Skript in `prototype/migration/`, wie
`kreatur-und-uebungen.mjs` (`node … <verzeichnis>` für den Prüfbestand,
`node … <ausfuhr.json>` für eine Sicherung aus dem laufenden Prototyp —
dabei wird auch das Register durch das aktuelle ersetzt). Was dabei
niemand mehr trägt, wird **aufgezählt**: ein stiller Verlust sieht später
aus wie ein leeres Feld.

`node packages/registry/scripts/typ.mjs <Typ> [bestand]` schreibt **einen**
Typ vollständig aus: eigene Felder, geerbte je erklärendem Typ, die Kanten,
die ihn **nennen** (die mit `*` gelten für jede Art und sagen über ihn
nichts), und wer ihn mitnimmt. Mit einem Bestand — einem Verzeichnis wie
`prototype/test/dbdump/entities` oder einer Ausfuhrdatei — steht je Feld
dabei, in wie vielen Artikeln etwas darin steht. Das ist die Frage, die der
Katalog nicht beantwortet und die man beim Streichen braucht: ein Feld, das
nirgends steht, hielt jemand einmal für richtig und füllt niemand.
`… --liste` zählt die Arten nach Bereich auf.

`pnpm --filter @nw/registry anforderungen -- --umsetzung VTT/Umsetzung.md`
liest die Story-, Feature- und Epic-Notizen und schreibt daraus
[docs/Anforderungen.md](docs/Anforderungen.md), `VTT/Requirements.md`,
`VTT/Requirements by Epic.md`, `VTT/Areas.md` (die Epics), `VTT/Umsetzung.md`
und die Listen in den Epic- und Feature-Notizen (zwischen
`stories:anfang` und `stories:ende`). Der Stand einer Story steht **in ihrer
Notiz** (`stand`, `standNotiz`); wer ihn anders sieht, ändert die Notiz.
Bricht etwas (Story ohne Feature, Verweis ins Leere), schreibt der Lauf
nichts und schlägt fehl — `packages/registry/test/anforderungen.test.ts`
prüft dasselbe in `pnpm test`.

`pnpm --filter @nw/registry catalogue` schreibt
[docs/Artikeltypen.md](docs/Artikeltypen.md) neu — je Artikelart, was sie
verlangt, was sie erlaubt, welche Kanten sie trägt und wie sie gezeichnet
wird — und den Abschnitt „Das Register heute" in
[docs/Datenmodell.md](docs/Datenmodell.md) zwischen den Marken
`register:anfang` und `register:ende`. Beides wird **erzeugt und nicht von
Hand geändert**: eine Übersicht, die jemand abtippt, stimmt am Tag ihrer
Entstehung und danach nie wieder.

**Eine Registeränderung braucht eine Migration**, die sie auf bestehenden
Datenbanken nachzieht — `node apps/server/scripts/register-abgleich.mjs`
(mit `DATABASE_URL` auf eine Postgres, nach dem Serverbau) sagt, ob sie
reicht, und läuft im CI mit (T-123).

**Eine Migration, die entfernt, nennt ihre Prüfabfrage** im Kopf
(`-- verlust: select count(*) from …`) und wird im Durchstich mit einem
Probeartikel geprüft: ohne Freigabe bricht der Start ab, mit
`ATLAS_ALLOW_DATA_LOSS=<migration>` läuft er und zählt den Verlust. Der
Seed zählt selbst (`registryUsage`). Kein Schritt beim Start löscht still
(T-076, [docs/Betrieb.md › Was Daten löschen kann](docs/Betrieb.md#was-daten-löschen-kann)).

`pnpm test` läuft in zwei Projekten: `node` für Modell, Register und Server,
`web` mit jsdom und Angulars aufgesetzter Prüfumgebung. Eine gemeinsame
Aufsetzdatei wäre der Weg, auf dem ein Node-Test plötzlich von einem
Browser-Stub abhängt.

Zum Entwickeln: `pnpm dev:server` und `pnpm dev:web` nebeneinander; die
Oberfläche schickt `/api` über `apps/web/proxy.conf.json` an den Server.
Das erste Konto legt `pnpm --filter @nw/server user add <name> --admin` an
(`is_admin` ist die Verwaltungsrolle der Installation, nicht die Leitung
einer Kampagne — die setzt `user role <name> <kampagne> gm` oder die Seite
`/campaign`, siehe [docs/Zugang.md](docs/Zugang.md)).

Die Reihenfolge ist notwendig: die übrigen Pakete übersetzen gegen die von
`model` erzeugten `.d.ts`, nicht gegen dessen Quelltext. In `tsconfig.json` der
abhängigen Pakete gehört **kein** `paths`-Eintrag auf `../model/src` — das zieht
Quelltext über Paketgrenzen und bricht `rootDir`.

Vitest bildet `@nw/model` und `@nw/registry` auf den Quelltext ab (siehe
`vitest.config.ts`), damit Tests ohne vorherigen Build laufen.

## Arbeitsweise

**Je Anliegen ein Zweig `feature/<anliegen>`**, abgezweigt von `preprod`.
Nicht alles auf einem Sitzungszweig sammeln. Ist das Anliegen fertig
(Tests, Lint, Durchstich bei Migrationen, Doku nachgezogen): Pull Request
nach `preprod` **und selbst mergen**; den Zweig danach löschen (der
GitHub-Proxy dieser Sitzungen darf keine Zweige löschen — dafür steht in
den Repo-Einstellungen „Automatically delete head branches"). Ein Pull Request nach `main` wird
geöffnet, wenn ein Feature ganz steht oder eine Version reif ist — den
merged die Verwaltung, nicht Claude. Commits klein und je eine Sache;
Nachricht deutsch, sagt **warum**.

**What's new läuft mit** (T-157): jeder Pull Request mit einer
sichtbaren Änderung ergänzt `apps/web/src/whats-new.json` — oben, ein,
zwei Sätze auf Englisch, was man jetzt tun kann, mit Link an die Stelle.
Nur Funktionen beschreiben, nie Kampagnen- oder Fremdinhalte (das Repo
ist öffentlich). Form und Felder: [CONTRIBUTING.md › What's new
ergänzen](CONTRIBUTING.md#whats-new-ergänzen). Die PR-Vorlage fragt
danach.

**Die Dokumentation läuft mit, immer.** Eine Modelländerung ohne
nachgezogenes [docs/Datenmodell.md](docs/Datenmodell.md),
[docs/Begriffe.md](docs/Begriffe.md) und „How it works" ist nicht fertig.
Anforderungen, Entscheidungen und Todos werden festgehalten, wo sie
hingehören (unten); was nichts mehr sagt, wird gelöscht — im Zweifel
fragen, und vorher abschätzen, ob jemand es noch braucht.

**Jeder neue Wunsch ist zuerst eine Story** (T-154): er legt eine Story
an oder ändert eine bestehende — und was wegfällt, wird nicht gelöscht,
sondern `dropped` mit `ersetztDurch`. Aufgaben im Projektbrett hängen an
Stories. Ablauf: [CONTRIBUTING.md › Anforderungen als User
Stories](CONTRIBUTING.md#anforderungen-als-user-stories).

**Ein Kommentar im Code nennt die Anforderung**, die er umsetzt (`REQ-174`)
oder die Entscheidung (`D8`, `A7`), wenn es eine gibt — dann führt der Weg
vom Code zur Begründung ohne Suchen.

**Wo was festgehalten wird:**

| Was | Wo |
|---|---|
| Anforderungen (Stories, Features, Epics; Prio, Stand) | der Vault in diesem Repo: je Story eine Notiz in `VTT/Stories/`, Features in `VTT/Features/`, Epics in `VTT/Epics/` — mit Obsidian-Mitteln: `[[Verweise]]`, Bases (`VTT/Stories.base`) für Übersichten |
| was davon hier steht | [docs/Anforderungen.md](docs/Anforderungen.md), erzeugt von `anforderungen.mjs` |
| Entscheidungen zum Modell | [docs/Durchgang.md](docs/Durchgang.md) (Abgleich, mit Entscheidungsspalte), [docs/Begriffe.md](docs/Begriffe.md) (das Warum) |
| offene Arbeit | das Projektbrett (Aufgaben `T-nnn` an Stories, offene Entscheidungen `E-nnn`); Issues für das, was gerade gebaut wird. [docs/Roadmap.md](docs/Roadmap.md) ist der Fahrplan vom 19.9. und Herkunft |
| Konzepte | [docs/Datenmodell.md](docs/Datenmodell.md) — **mit Bildern**, wo ein Bild mehr sagt als eine Liste: grosse (Übersichten, Modell, Abläufe mit vielen Knoten) als Excalidraw-Zeichnung in `docs/Bilder/` mit SVG daneben, Mermaid nur für kleine Abläufe bis etwa zehn Knoten ([docs/README.md › Bilder](docs/README.md#bilder)) |
| der Weg durch die Dokumentation | [docs/README.md](docs/README.md) (Einstieg und Bestandsaufnahme) → `docs/Themen/` (je Thema eine Übersicht) → Detailseiten; eine neue Seite unter `docs/` kommt in die Bestandsaufnahme |

Siehe [CONTRIBUTING.md](CONTRIBUTING.md).

Ein Push auf `preprod` rollt nach `dev.atlas.…` aus, einer auf `main` nach
der Produktion — sobald die Repo-Variable `DEPLOY_ENABLED` auf `true` steht
und die Umgebungen `dev` und `prod` ihre Secrets haben; beide auf Hetzner, aus einem Abbild, das **nur CI baut**,
nachdem Tests und der Durchstich gegen eine frische Postgres
(`apps/server/scripts/durchstich.mjs`) grün sind. Wer eine Migration
schreibt, lässt den Durchstich lokal laufen: die übrigen Tests sehen keine
Datenbank. Einrichtung, Sichern und Zurück: [docs/Betrieb.md](docs/Betrieb.md).
