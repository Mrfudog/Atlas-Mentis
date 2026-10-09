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
REQ-Nummern stehen in `VTT/Requirements.md`, ihr Stand in
`VTT/Umsetzung.md` (erzeugt).

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
  rechnet gleich (A2).
- **Zwei Fragen, und die grobe kommt zuerst.** Die **Sichtbarkeit**
  (`articleVisible`) sagt, ob ein Artikel überhaupt an jemanden geht; das
  **Wissen** (`redactEntity`) sagt, welche Felder darin. Beides zu einer
  Frage zu machen hiesse, einen Artikel dadurch zu verbergen, dass man alle
  seine Felder wegnimmt — und er stünde trotzdem in der Liste, mit Namen und
  Bereich.
  Gelesen werden drei Felder, und die Reihenfolge ist die Regel:
  `hiddenFrom` schlägt `revealedTo` schlägt `audience`. **`public` ist die
  Vorgabe und heisst: jeder darf es sehen** — wer etwas verbergen will, sagt
  es, und nicht umgekehrt. Die Stufen von aussen nach innen: `public` jedes
  Konto, `campaign` jedes Konto mit einer Rolle am Tisch, `players` die
  Spielenden (`player`, `co-gm`, `gm`), `gm` die Leitung (`gm`, `co-gm`).
  Die beiden Listen nennen **Träger** (`Creature | Party | Faction`),
  dieselben drei wie `knownBy`, und ein Träger zählt einen Schritt weit auch
  als seine Gruppe und seine Fraktion. **Die Gruppe ist das Figurengefüge
  einer Runde** (`Party`, `partyOf` → `Campaign`, `memberOfParty`); eine
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
  einem Artikel wandert beim Export mit (REQ-199). Die Sammlung `members`
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
  **Offen:** ohne Ebenenkante gehört ein Artikel niemandem besonders (65 von
  75 heute) — das stimmt bei *einer* Kampagne und nicht mehr bei zweien.
  Ebenso offen: `mayWrite` kennt die Leitung noch nicht, und die laufende
  Kampagne ist eine globale Einstellung.
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
  `overrides`, `variantOf`). Für einen Tag durfte ein Statblock vielen
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
  der Regel, auf die er zeigt.
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
  sichtbaren Artikel mit. **Die Zeile hält, die Art schlägt vor:** ein
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
- **In einer Ansicht wird nach Gruppe gewählt, nicht Feld für Feld.**
  `full` zeigt alles — was dort fehlt, zeichnet ein anderer Block derselben
  Seite (der Bogen), und das ist eine Sache der Anordnung und keine Wahl je
  Art. Für `overview` und `quick` schaltet ein Klick eine ganze Gruppe
  (`except: ['Vitals']`, ein Typname). Eine ausgeschriebene Feldliste wäre
  am Tag des nächsten Feldes unvollständig, und niemand merkte es.
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
- **Beim Bearbeiten steht jedes Feld als Eingabe da**, auch die aus
  `Identity` (Aliasse, Deckname) — ein Feld, das man nur über die Einfuhr
  füllen kann, ist keines. Der Name bleibt draussen: er ist die
  Überschrift, und zwei Eingaben für ihn wären zwei Stellen, die
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
schreibt [docs/Anforderungen.md](docs/Anforderungen.md) neu **und** dieselbe
Übersicht als Notiz in den Vault — die Spalte *Status* im Register des
Vaults folgt ihr. Wer einen Stand anders sieht, ändert die Zuordnung im
Skript, nicht die Datei.

`pnpm --filter @nw/registry catalogue` schreibt
[docs/Artikeltypen.md](docs/Artikeltypen.md) neu — je Artikelart, was sie
verlangt, was sie erlaubt, welche Kanten sie trägt und wie sie gezeichnet
wird — und den Abschnitt „Das Register heute" in
[docs/Datenmodell.md](docs/Datenmodell.md) zwischen den Marken
`register:anfang` und `register:ende`. Beides wird **erzeugt und nicht von
Hand geändert**: eine Übersicht, die jemand abtippt, stimmt am Tag ihrer
Entstehung und danach nie wieder.

`pnpm test` läuft in zwei Projekten: `node` für Modell, Register und Server,
`web` mit jsdom und Angulars aufgesetzter Prüfumgebung. Eine gemeinsame
Aufsetzdatei wäre der Weg, auf dem ein Node-Test plötzlich von einem
Browser-Stub abhängt.

Zum Entwickeln: `pnpm dev:server` und `pnpm dev:web` nebeneinander; die
Oberfläche schickt `/api` über `apps/web/proxy.conf.json` an den Server.
Das erste Konto legt `pnpm --filter @nw/server user add <name> --admin` an
(`is_admin` ist die Verwaltungsrolle der Installation, nicht die Leitung
einer Kampagne — die setzt `user role <name> <kampagne> gm`).

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

**Die Dokumentation läuft mit, immer.** Eine Modelländerung ohne
nachgezogenes [docs/Datenmodell.md](docs/Datenmodell.md),
[docs/Begriffe.md](docs/Begriffe.md) und „How it works" ist nicht fertig.
Anforderungen, Entscheidungen und Todos werden festgehalten, wo sie
hingehören (unten); was nichts mehr sagt, wird gelöscht — im Zweifel
fragen, und vorher abschätzen, ob jemand es noch braucht.

**Ein Kommentar im Code nennt die Anforderung**, die er umsetzt (`REQ-174`)
oder die Entscheidung (`D8`, `A7`), wenn es eine gibt — dann führt der Weg
vom Code zur Begründung ohne Suchen.

**Wo was festgehalten wird:**

| Was | Wo |
|---|---|
| Anforderungen (REQ-Nummern, Prio, Stand) | der Vault in diesem Repo, `VTT/Requirements.md` — mit Obsidian-Mitteln: `[[Verweise]]`, Auszüge `![[…]]`, Bases für Übersichten |
| was davon hier steht | [docs/Anforderungen.md](docs/Anforderungen.md), erzeugt von `anforderungen.mjs` |
| Entscheidungen zum Modell | [docs/Durchgang.md](docs/Durchgang.md) (Abgleich, mit Entscheidungsspalte), [docs/Begriffe.md](docs/Begriffe.md) (das Warum) |
| offene Arbeit | [docs/Roadmap.md](docs/Roadmap.md) „Als Nächstes"; Issues für das, was gerade gebaut wird |
| Konzepte | [docs/Datenmodell.md](docs/Datenmodell.md) — **mit Grafiken** (Mermaid), wo ein Bild mehr sagt als eine Liste |

Siehe [CONTRIBUTING.md](CONTRIBUTING.md).

Ein Push auf `preprod` rollt nach `dev.atlas.…` aus, einer auf `main` nach
der Produktion — sobald die Repo-Variable `DEPLOY_ENABLED` auf `true` steht
und die Umgebungen `dev` und `prod` ihre Secrets haben; beide auf Hetzner, aus einem Abbild, das **nur CI baut**,
nachdem Tests und der Durchstich gegen eine frische Postgres
(`apps/server/scripts/durchstich.mjs`) grün sind. Wer eine Migration
schreibt, lässt den Durchstich lokal laufen: die übrigen Tests sehen keine
Datenbank. Einrichtung, Sichern und Zurück: [docs/Betrieb.md](docs/Betrieb.md).
