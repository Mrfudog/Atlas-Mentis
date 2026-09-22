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
behauptet und von der Validierung geprüft; Pflicht steht je Feld, und was
in einem Feld stehen darf, prüft sie mit — eine Aufzählung hält, eine
Spanne hält. Alles davon
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

Was es **nicht** mehr gibt: `packages/import` und der Importer im Prototyp. Die Obsidian-Importer für
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
  Party, Faction oder Group. Ein Bündel in einem Bündel zählt nicht — ein
  Schritt weit, sonst reicht eine Freigabe weiter, als jemand gemeint hat.
- **Die Zahlen einer Kreatur wohnen am Statblock**, auch die eines
  Spielercharakters; `belongsTo` sagt, welcher. `Vitals` bleibt bei der
  Figur: das ist, was sich während der Sitzung ändert. Damit heisst `hp` am
  Statblock das Maximum und an der Figur der Stand.
  Der Statblock trägt seine Felder **selbst** (`ac`, `hp`, `speed`, `cr`,
  `prof`, `senses`, `resistances` …) und nimmt `Abilities` dazu — die sechs
  Werte samt ihren gerechneten Nachbarn, denn `mod(dex)` löst gegen
  dieselbe Karte auf. `StatblockInfo` gibt es nicht mehr: dreissig Felder
  unter einem Sammelnamen sind keine Auskunft. Der Bogen liest beide Karten
  als eine (`sbCard`), weil `sb.ac` und `modOf(sb,"dex")` nebeneinander
  gebraucht werden; geschrieben wird in die Karte, der das Feld gehört.
- **Ein Textblock ist ein Feld.** Es gab einmal `blocks: [{blockType, body,
  anchor}]` neben den Karten, mit einer eigenen Liste erlaubter Blockarten je
  Artikelart — also eine zweite Frage, die jede Art zweimal beantworten
  musste. Jetzt ist die Blockart das Feld: `secret` ist ein Feld mit `many`
  und `format: 'long'`, und seine Einträge tragen die Id, an der die
  Wissensfreigabe hängt (`Secrets.secret#id`). Die Id kommt aus dem Text, denn
  eine durchgezählte hält nur, solange die Reihenfolge hält. Ein Prosafeld
  steht **nicht** in der Feldtabelle — es gehört dem Element `prose`.
- **Ein Untertyp ohne eigene Felder ist ein Wort und keine Zeile.** `NPC`,
  `Companion` und `Retainer` waren drei Artikelarten, die zusammen kein
  einziges eigenes Feld trugen; eine Kreatur ist jetzt selbst eine Art, und
  `Creature.kind` sagt, was für eine — npc, companion, retainer, pet,
  summon. Das Feld ist **frei** und keine Aufzählung: die Maske schlägt vor,
  was an anderen Kreaturen schon dasteht, und eine neue Sorte ist ein
  Eintrag. Braucht eine Sorte eigene Felder, wird sie eine Zeile, die von
  `Creature` erbt — bis dahin stehen ihre Sonderregeln am Statblock und an
  der Regel, auf die er zeigt.
- **Eine Aufzählung, die zwei Felder brauchen, ist eine Registerzeile**
  (`REG.enums`), und das Feld nennt sie mit `enumRef`. Die sechs
  Attributkürzel standen wörtlich an `SkillInfo.ability` und an
  `RecipeInfo.ability`; wer eine Liste nachzog, zog die andere nicht nach.
  Gelesen wird **immer** über `enumOptions()` (Paket) bzw. `enumWerte()`
  (Prototyp) und nie `p.enum` direkt. Eine Liste mit genau einem Nutzer
  bleibt am Feld — eine Zeile dafür wäre der Umweg ohne den Gewinn.
  **Mehrere Zeilen darf ein Feld nennen** (`enumRef: ['Skill', 'Tool', …]`),
  und dann gelten sie zusammen: `Proficiencies.proficient` zieht aus sechs
  Listen, weil ein Feld je Sorte dieselbe Frage sechsmal stellte und die
  siebte Sorte ein siebtes Feld gebraucht hätte. Woher ein Wert kommt, sagt
  die Liste, in der er steht (`enumSource` / `enumQuelle`) — der Bogen
  gruppiert danach, und das Handwerk liest die Werkzeugübungen so heraus.
  Getrennt gebraucht: `enumGroups()` / `enumGruppen()`.
  Mit `type: 'array'` hält dasselbe Feld **mehrere** Werte aus diesen
  Listen; die Maske zeigt dann Häkchen, nach Zeile gruppiert.
- **Eine Zahl mit Grenzen ist eine Spanne** (`min`, `max`), keine
  Aufzählung von zwanzig Wörtern. Die Schwierigkeit war fünf Wörter an der
  Begegnung und freier Text an der Szene; sie ist jetzt eine Stufe von 1
  bis 20 im Typ `Difficulty`, und beide nehmen ihn dazu.
- **Übungen stehen in einem Feld, nicht in sechs.**
  `Proficiencies.proficient` (und `expertise`) ziehen aus `Skill`, `Tool`,
  `Language`, `WeaponTraining`, `ArmorTraining` und `KnowledgeField`;
  `saves` zieht aus `Ability`. Welche Fertigkeiten es gibt, sagt die Zeile
  `Skill`; **worauf jede rechnet**, sagt die Einstellung `skills`
  (`stealth:dex`) — zwei Stellen, aber nicht zweimal dasselbe, denn eine
  Liste von Wörtern kann keine Zuordnung tragen. Wird eine Fertigkeit
  einmal ein Artikel, fallen beide weg.
- **`Status` ist der Vorbereitungsstand und sonst nichts:** `idea`,
  `prepared`, `ready` (Aufzählungszeile `State`). Was im Spiel geschah,
  gehört nicht hierher — `used` und `discarded` waren Ereignisse, die ein
  Feld für immer festhielt. Wie weit eine Sache am Tisch ist, sagt das Feld
  der Art: `Quest.progress`, `Encounter.phase`, `Explored.state`. Drei
  Felder hiessen einmal alle `state` und meinten Verschiedenes.
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
- **In einer Ansicht wird nach Gruppe gewählt, nicht Feld für Feld.**
  `full` zeigt alles — was dort fehlt, zeichnet ein anderer Block derselben
  Seite (der Bogen), und das ist eine Sache der Anordnung und keine Wahl je
  Art. Für `overview` und `quick` schaltet ein Klick eine ganze Gruppe
  (`except: ['Vitals']`, ein Typname). Eine ausgeschriebene Feldliste wäre
  am Tag des nächsten Feldes unvollständig, und niemand merkte es.
- **Bei jeder Modelländerung wandert die Erklärung mit.**
  [docs/Begriffe.md](docs/Begriffe.md) *und* die Seite „How it works" im
  Register, mitsamt dem durchgerechneten Beispiel am Ende — beides gehört
  in denselben Commit wie die Zeile, die sich geändert hat. Eine Erklärung,
  die man später nachzieht, erklärt in der Zwischenzeit etwas, das es nicht
  mehr gibt.
- **Wie die Dinge heissen, steht in [docs/Begriffe.md](docs/Begriffe.md):**
  Typ, Bestandteil, Feld, Bezeichner, Artikel, Ansicht, Block, Kante,
  Einheit — neun Wörter, mehr nicht. Wer zwei Namen für eine Sache hat, hat bald zwei Sachen; im
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
