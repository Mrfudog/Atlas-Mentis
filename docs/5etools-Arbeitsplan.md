# 5e.tools übernehmen — Arbeitsplan

↑ [Inhalte](Themen/Inhalte.md) · [Einstieg](README.md) · Plan: P1–P7 sind gebaut; offen ist, was das Projektbrett nennt.

Stand 2026-10-08, überarbeitet nach Mikes Rückmeldung am selben Tag. Baut auf [5etools-Abgleich.md](5etools-Abgleich.md) auf:
dort steht, *was* fehlt; hier steht, *in welcher Reihenfolge* es gebaut
wird, mit welchem Modell, und wie man dabei nicht das ganze Kontingent
verbraucht.

---

## 1. Entschieden (D47, 2026-10-08)

| # | Frage | Entscheidung |
|---|---|---|
| E1 | Umfang | **Alles**, was auf 2014 aufbaut — nicht nur das SRD. Die Seite ist **nicht öffentlich**: jede Route ausser Anmeldung verlangt ein Konto, Konten gibt es nur auf Einladung. Eine spätere Demo zeigt nur SRD-Inhalt; dafür trägt jeder Artikel die Lizenzflagge (`Source.srd`) |
| E2 | Ausgabe | ~~**2014 als Basis.**~~ **Abgelöst am 13.10.2026 (T-087, REQ-243):** alles kommt herein — 2014, 2024 (`XPHB`, `XMM`, `XDMG` und die Bücher seit September 2024) und Unearthed Arcana —, jede Quelle in ihre Ebene mit dem Regelstand an `Layer.version`, keine neue aufgeschaltet. Was vorher hereinkam, heisst der **Grundstand** und bleibt Zeichen für Zeichen, wie es war; die 2024-Fassung einer Sache ist eine Variante der von 2014 (E-021 d). `--only-2014` nimmt nur den Grundstand
| E3 | Sprache | **Alles englisch, wie im Original** — Namen, Text, Aufzählungswerte und ihre Beschriftungen. Übersetzt wird danach von Mike, Begriff für Begriff (Paket P8). Der Importer übernimmt keine fremde Übersetzung |
| E4 | Vehikel, Bastionen, Decks | ~~später~~ **Herein seit T-087**, jede mit der kleinsten Art, die passt: Fahrzeug als `Statblock`, Aufrüstung, Bastionsraum und Karte als `Rule` (`upgrade`, `facility`, `card`), Deck als `Table` (`deck`), Waffenmeisterschaft als `ItemProperty` (Datenmodell R11). Kochrezepte und Häkelmuster bleiben weg, mit ihren Büchern |
| E5 | Bilder | nicht im ersten Durchgang |
| E6 | Reihenfolge | Regeln, Zustände, Zauber, Gegenstände, Monster zuerst; Klassen und Abstammungen mit dem Bogen |
| E7 | Laden | **Einmal**, kein laufender Abgleich. Danach gehören die Artikel uns und werden direkt bearbeitet |

Was daraus folgt, gegenüber dem Abgleich:

- ~~**Eine Systemebene statt einer je Buch.**~~ Überholt am 13.10.2026
  (E-017, T-081): **je Buch eine Ebene** (`kind: book`), die Systemebene
  „D&D 5e (2014)" hält nur, was kein Buch nennt. Die Sorge war ein Stapel
  aus hundert Ebenen, den niemand umschaltet; die Kampagnenseite zeigt die
  Bücher darum getrennt vom Stapel, gruppiert, mit Häkchen und ohne
  Reihenfolge. Welche Seite, sagt weiter `Source.publication` mit `page`.
- **Buchtext für die Leseansicht** (T-091, REQ-247; T-108, E-028,
  E-029): der Text jedes Buchs (`book/`) kommt herein — auch eines
  Regelbuchs — als `Chapter` je Kapitel, darin Teil-Artikel in der
  Reihenfolge von `partOf.rank` (`arten/buch.ts`, `teile.ts`). Was schon
  ein Artikel ist (ein eingebetteter Zauber, ein Monster, eine Tabelle, ein
  Abschnitt mit dem Namen eines Artikels aus demselben Buch), wird ein
  `Embed` darauf und nicht verdoppelt. Bilder bleiben weg (E5).
- **Kein `overrides` aus `reprintedAs`**, weil 2024 nicht hereinkommt.
  Innerhalb von 2014 sagt `reprintedAs` aber, welche **Fassung gilt**
  (unten, Doppel).
- **Keine stabile Id-Zuordnung über Läufe hinweg.** Der Importer darf
  während der Entwicklung beliebig oft gegen den Prüfbestand laufen; in
  den echten Bestand geht er einmal.
- **Der volle Bestand geht an den Server, nicht in den Prototyp.** Rund
  10 000 Artikel sind für die Artefakt-Ablage des Prototyps zu viel —
  geprüft ist das nicht, aber der Prototyp hält jeden Artikel im
  Speicher und zeichnet Listen ohne Seitenweise. Der Prototyp bekommt
  einen Ausschnitt (Abschnitt 5, P6).

### 1.1 Wie gross „alles" ist

Gemessen an `5etools-src` (Stand 2026-09-23), ohne Bilder und Begleittext:

| | Einträge |
|---|---:|
| alle Arten | 15 559 |
| davon 2024-Kernbücher | 3 182 |
| davon Bücher auf 2024-Regeln (seit 2024-09) | 1 078 |
| davon Unearthed Arcana | 118 |
| **2014-Basis** | **11 181** |
| davon später (E4: Karten, Decks, Vehikel) oder kein Artikel (Buch-Metadaten, Schablonen) | ~1 050 |
| **wird Artikel** | **~10 100** |

Die grössten Posten: 3 809 Monster, 1 649 Gegenstände, 1 307
Klassen- und Unterklassenmerkmale, 525 Zauber, 494 Gottheiten.

### 1.2 Übersetzen kommt danach

Der Importer schreibt nur Englisch. Die Übersetzung ist ein eigener
Schritt (P8): ein Skript schreibt eine Liste aller Namen und
Aufzählungswerte als Tabelle (englisch, Art, Anzahl Verwendungen), Mike
trägt die deutschen Begriffe ein, und ein zweites Skript benennt die
Artikel um und legt den englischen Namen als Alias ab. Das kostet kaum
Tokens, weil kein Modell übersetzt; was offen ist, gehen wir zusammen
durch, die meistgebrauchten Begriffe zuerst.

---

## 2. Regeltypen

Stand nach Mikes Rückmeldung vom 2026-10-08. Ersetzt den ersten
Vorschlag (Zustand mit `levels` und `implies`).

### 2.1 Die Messlatte

> **Eine Regelart wird ein eigener Typ, wenn ein Verweisfeld oder eine
> Kante sie *als Art* verlangt, oder wenn sie eigene Felder trägt.
> Sonst bleibt sie ein Wort in `Rule.kind`.**

Heute ist ein Zustand eine `Rule` mit `kind: condition`, und
`Vitals.conditions` zeigt auf `Rule` mit einem Filter. Nach unserer
eigenen Regel („Die Art hält, der Filter schlägt vor") ist das nur ein
Vorschlag der Maske; die Prüfung nähme auch „Waffenangriff" als Zustand
einer Kreatur an. Was man einer Kreatur zuweisen will, braucht eine Art.

### 2.2 Die Familie

```mermaid
flowchart TB
  R[Rule<br/>Regeltext, Quelle]
  R --> C[Condition<br/>Zustand]
  C --> D[Disease<br/>Krankheit]
  R --> AT[ActionType<br/>Aktionsart]
  R --> A[Action<br/>Aktion]
  R --> F[Feature<br/>Merkmal]
  R --> IP[ItemProperty<br/>Gegenstandseigenschaft]
  R --> S[Spell<br/>Zauber]
  R --> FT[Feat · Skill<br/>gibt es schon]
  A -. actionType .-> AT
  C -. stageOf .-> C
  R -. affects .-> R
```

| Typ | Was er ist | Eigene Felder und Kanten | Warum ein Typ |
|---|---|---|---|
| **`Condition`** | Zustand: Blinded, Prone, Concentration, Exhaustion 3 | `kind` (`condition` · `status`); `stage` (Zahl); Kante **`stageOf`** auf den Grundzustand; `recovery` (`none` · `shortRest` · `longRest` · `longRestStep` · `save` · `special`) | `Vitals.conditions` und `participates.conditions` verlangen ihn |
| **`Disease`** erbt `Condition` | je Krankheit ein Artikel: Sewer Plague, Sight Rot | `save` (Attribut), `dc`, `incubation`, `transmission`; `kind` frei (mundane, magical …). Stadien wie bei Erschöpfung über `stageOf`, Spielarten über `variantOf` | eine Krankheit *hat* man, also ist sie zuweisbar wie ein Zustand, und sie trägt eigene Felder |
| **`ActionType`** | Aktionsart: Action, Bonus Action, Reaction, Free Object Interaction, Movement, Legendary Action, Lair Action | `per` (`turn` · `round`), `count` (wie oft) | vier Stellen verlangen ihn: `Action.actionType`, die Wirkzeit eines Zaubers, Einschränkungen durch Zustände (`affects`), später die Zonen im Inventar (heute Zeile `DrawTime`) |
| **`Action`** | Aktion: Dodge, Dash, Help, und jede Aktion eines Statblocks (Bite, Multiattack, Fire Breath) | **`actionType`** (Verweis, Pflicht); `recharge`, `uses`; für Angriffe `attack` (melee/ranged, weapon/spell), `toHit`, `reach`, `range`, `damage`, `damageType` | hat eigene Felder, und die Initiative kann damit rechnen statt Text zu lesen |
| **`Feature`** | Merkmal, also alles Dauerhafte: Klassenmerkmal, Volksmerkmal, Monstermerkmal (Nimble Escape), Regionaleffekt | `featureType`; wer es gewährt und ab welcher Stufe, sagt seit P4 die Kante `grants` vom Gebenden (D50; hier stand `level` und `featureOf`) | `grants` verlangt es; Monster-, Volks- und Klassenmerkmale sind dieselbe Sache an verschiedenen Trägern |
| **`ItemProperty`** | Finesse, Versatile, Heavy; Waffenmeisterschaft gibt es erst 2024 | `abbreviation` | `hasProperty` (Gegenstand → Eigenschaft) verlangt es |
| **`Spell`** | Zauber | Abgleich M2; die Wirkzeit nennt bei Aktion, Bonusaktion und Reaktion den `ActionType` | Kante `casts`, zwanzig eigene Felder |
| `Feat`, `Skill` | gibt es schon | — | `Rule.kind` hatte die Wörter `feat` und `skill` zusätzlich: das war doppelt und fällt weg |

`Rule.kind` behält nur noch die Wörter für Regeln ohne Träger:
`rule` (Variantregeln), `travel`, `sense`, `reward`, `boon`, `option`.
Es wird eine Aufzählungszeile `RuleKind` und ist **nicht mehr Pflicht**,
denn ein Zauber braucht kein zweites Wort für das, was sein Typ sagt.
Die Statblock-Teile `action`, `bonus`, `reaction`, `legendary`, `lair`
sind jetzt `Action` mit der passenden Aktionsart, `trait` ist `Feature`.

### 2.3 Erschöpfung als sechs Zustände

**Geht, und wird nicht schwieriger, wenn die Stufen untereinander
verbunden sind.** Der Grundzustand „Exhaustion" trägt die allgemeine
Regel (Stufen sind kumulativ, eine lange Rast mit Essen und Trinken
senkt um eins, `recovery: longRestStep`). Darunter sechs Artikel
„Exhaustion 1" bis „Exhaustion 6", jeder mit `stage` und `stageOf` auf
den Grundzustand und mit seinem eigenen Text.

| | Eine Zahl (heute `Vitals.exhaustion`) | Sechs Zustände |
|---|---|---|
| Stufe senken nach langer Rast | Zahl minus eins | den Zustand durch die Stufe darunter **ersetzen**: gleicher `stageOf`, `stage − 1`; bei Stufe 1 entfernen |
| Stufe erhöhen | Zahl plus eins | ersetzen durch `stage + 1` |
| Was gilt bei Stufe 3 | im Text nachlesen | Stufen 1 bis 3 gelten, weil der Grundzustand „kumulativ" sagt; die Liste der Wirkungen ist gerechnet, nicht gespeichert (D8) |
| Andere Regeln können eine Stufe nennen | nein | ja: „Exhaustion 3" `affects` Angriffe mit Nachteil |
| Neue Regel nötig | — | **höchstens eine Stufe je Grundzustand** in der Zustandsliste; die Prüfung hält das |

Der Preis ist diese eine Prüfregel und ein Ersetzen statt Zählen. Dafür
fällt `Vitals.exhaustion` weg: die Stufe steht in der Zustandsliste, und
zwei Stellen für dieselbe Zahl laufen auseinander. Dasselbe Muster trägt
die Stadien einer Krankheit und später Wahnsinn (kurz, lang, unbefristet).

Wer die Rast auslöst, ist eine eigene Frage: heute niemand, die Stufe
wird von Hand umgestellt. Ein Knopf „lange Rast" an der Gruppe, der
jedes `recovery: longRestStep` eine Stufe senkt, ist ein späteres Stück
Bedienung und keine Modellfrage.

### 2.4 Wirkungen zwischen Regeln

Gelähmt *ist* nicht kampfunfähig; gelähmt **bewirkt** kampfunfähig, und
kampfunfähig **verbietet** Aktionen und Reaktionen. Das sind Kanten, kein
Feld am Zustand:

| Kante | von → nach | `props.effect` | Beispiel |
|---|---|---|---|
| **`affects`** | Rule → Rule | `imposes` (bewirkt), `prevents` (verbietet), `limits` (schränkt ein), `advantage`, `disadvantage`, `triggers` (löst aus); dazu `on` (worauf: attack, save, check, Attribut) und `note` | Paralyzed `imposes` Incapacitated · Incapacitated `prevents` Action, Reaction · Exhaustion 3 `disadvantage` on attack · Unconscious `triggers` Prone |

Gespeichert wird vorwärts, die Gegenfrage („was verbietet mir
Reaktionen?") ist eine Abfrage. **Ausgewertet wird vorerst nichts**: die
Kanten sind Daten, die der Bogen anzeigt („Weil gelähmt: kampfunfähig").
Eine Regelmaschine, die daraus Vor- und Nachteile rechnet, ist ein
eigenes Vorhaben.

Der Importer legt diese Kanten **nicht** an. Dass ein Zustand im Text
einen anderen nennt, heisst nicht, dass er ihn bewirkt („can't be
frightened" nennt verängstigt auch). Die 15 Zustände und die
Erschöpfungsstufen bekommen ihre Wirkungen von Hand, mit Mike; das sind
rund dreissig Kanten.

### 2.5 Einmal übernehmen, als unsere Artikel

Jeder 5e.tools-Eintrag wird ein Artikel **unseres** Typs mit gefüllten
Feldern und liegt danach in unserer Datenbank. Nichts zeigt zurück auf
5e.tools: keine URL, kein Nachladen, kein Abgleich. Welches Buch und
welche Seite, steht in `Source` als Text. Was im Text auf einen anderen
Eintrag zeigt (`{@spell fireball}`), wird ein Verweis auf **unseren**
importierten Artikel — das ist die einzige Verknüpfung, und sie bleibt
innerhalb des Bestands.

Das Monster selbst wird dabei zerlegt: der Statblock ist ein Artikel,
seine Aktionen und Merkmale sind eigene `Action`- und `Feature`-Artikel
über `composedOf`. Gleichlautende Merkmale über Monster hinweg legt der
Importer **einmal** an (Pack Tactics, Magic Resistance), mit `{VAR}` für
das, was sich unterscheidet. Das ist der Grund, warum die Aktionen Typen
sind und nicht Text am Statblock.

Das ist D48 (vorgeschlagen) und Paket P2; `Action` mit Angriffsfeldern
kommt mit dem Statblock in P4.

---

## 3. Wo die Tokens hingehen — und wo nicht

Die wichtigste Zahl zuerst: **Das Übernehmen selbst kostet keine Tokens.**
Der Importer ist ein Skript; ob es 10 oder 10 000 Einträge liest, ist
für das Kontingent gleich. Tokens kostet nur das **Schreiben** des
Codes: die Modelländerungen und der Importer. Also lohnt sich alles,
was diese Sitzungen kurz hält.

| Hebel | Warum |
|---|---|
| **Eine neue Sitzung je Paket**, mit dem Auftrag aus Abschnitt 5 | Jede Antwort liest den ganzen bisherigen Verlauf mit. Eine lange Sitzung wird mit jedem Schritt teurer; diese hier ist es längst |
| **Der Auftrag nennt die Dateien** | Suchen ist der teuerste Teil einer Sitzung. Die Aufträge unten sagen, wo was liegt |
| **Keine Daten in den Kontext** | `5etools-src/data` ist 112 MB. Ein Skript zählt und fasst zusammen; gelesen werden fünf Beispieleinträge, nicht fünf Dateien |
| **Den Prototyp nie ganz lesen** | `nebelwacht-artikel.html` hat 674 KB, rund 170 000 Tokens. Gezielt mit `grep` und Ausschnitt |
| **Keine Migration für den heutigen Bestand** | Er wird ersetzt. Jedes Umzugsskript für 96 Artikel, die danach gelöscht werden, ist verbranntes Kontingent. Nur der Prüfbestand muss die Tests bestehen |
| **Ein PR je Paket, nicht je Änderung** | Weniger Runden aus Warten, CI lesen, Doku nachziehen. Die Commits darin bleiben klein |
| **Keine Unteragenten, kein Workflow** | Jeder startet ohne Kontext und liest selbst nach |
| **Keine Übersetzung durch das Modell** | 3,7 Mio. Tokens Text. In Claude Code wäre das ein Mehrfaches des ganzen Plans; Mike übersetzt selbst (E3) |
| `CLAUDE.md` ist 39 KB (~10 000 Tokens) und steht in **jeder** Antwort jeder Sitzung | Dank Zwischenspeicher günstig, aber nicht gratis. Kürzen wäre ein eigener Schritt — nicht jetzt |

### 3.1 Spielt das Modell eine Rolle?

**Für das Ergebnis der Übernahme nicht.** Der Importer ist
deterministisch; die Namen kommen aus Tabellen. Das Modell entscheidet
nur, wie gut und wie schnell der *Code* entsteht.

**Für das Kontingent sehr.** Die Preise je Million Tokens (Anthropic-API,
Stand 2026-10) sind ein guter Massstab dafür, wie schnell ein Modell das
Kontingent eines Abos verbraucht — die genaue Gewichtung im Abo
veröffentlicht Anthropic nicht, die Reihenfolge stimmt aber:

| Modell | Eingabe | Ausgabe | gegenüber Sonnet |
|---|---:|---:|---:|
| Claude Fable 5.1 | $10 | $50 | 5× |
| Claude Opus 5.5 | $4 | $20 | 2× |
| Claude Sonnet 5.5 | $2 | $10 | 1× |
| Claude Haiku 5.5 | $0.10 | $0.50 | 0.05× |

**Empfehlung:**

- **Sonnet 5.5** für alles Mechanische: Registerzeilen, Aufzählungen,
  Doku, Katalog, Tests nachziehen, die Zuordnung je 5e.tools-Art im
  Importer, den Probelauf. Das ist mehr als die Hälfte der Arbeit.
- **Opus 5.5** für die drei Stellen, an denen Fehler teuer sind: der
  Textbaum nach Markdown samt Inline-Marken (P5-Kern), `_copy`
  auflösen, und die Modellteile in `packages/model` (Verweise auf Id,
  `enumRef` auf eine Artikelart, gerechnete Zauber-SG). Effort `high`.
- **Fable 5.1** nur, wenn eine Opus-Sitzung zweimal am selben Fehler
  hängen bleibt.
- **Haiku 5.5** nicht für Code.
- Effort: `medium` für Sonnet-Pakete, `high` nur für den Importer-Kern.

Wie viel ein Paket wirklich kostet, zeigt `/usage` nach der ersten
Sitzung; danach lässt sich der Rest schätzen.

---

## 4. Die Pakete

```mermaid
flowchart LR
  P1[P1 Fundament<br/>Markdown, Id-Verweise, Würfel<br/>Opus] --> P3
  P2[P2 Regeltypen<br/>Condition, Feature, Hazard …<br/>Sonnet] --> P3
  P3[P3 Zauber + Gegenstände<br/>Opus/Sonnet] --> P4
  P4[P4 Statblock + Charakterbau<br/>Opus] --> P5
  P5[P5 Importer<br/>Opus Kern, Sonnet Rest] --> P6
  H[Hetzner<br/>Wochenende] --> P6
  P6[P6 Probelauf, Löschen, Laden<br/>Sonnet] --> P7[P7 Nebelwacht neu<br/>du, im UI]
  P6 --> P8[P8 Übersetzen<br/>du, mit Sonnet]
```

| Paket | Inhalt (Abgleich §3) | Modell | Sitzungen |
|---|---|---|---:|
| **P1 Fundament** | M10 Markdown in langen Feldern (#61), M11 Verweise auf Id, M12 Würfel im Text | Opus | 1–2 |
| **P2 Regeltypen** | Abschnitt 2 oben: `Condition` mit Stufen, `Disease`, `ActionType`, `Action` (ohne Angriffsfelder), `Feature`, `ItemProperty`, Kante `affects`, `RuleKind`; `Vitals.exhaustion` fällt weg. Dazu M7 `Hazard`, `Deity`, `Faction.goal`, M8 `Table` mit Spalten, M9 Systemebene und `Source.srd` | Sonnet | 1–2 |
| **P3 Zauber und Gegenstände** | M2 `Spell` + `casts` + Zauberwirken am Statblock, M4 `Item` wächst | Opus für M2, Sonnet für M4 | 2 |
| **P4 Statblock und Charakterbau** | M5 Statblock, `Action` mit Angriffsfeldern, M3 `Class`/`Subclass`/`Ancestry`/`Background`, M6 Übungen aus Artikeln (`enumRef` auf eine Art) | Opus | 2 |
| **P5 Importer** | `packages/import-5etools`, Bericht; `pnpm --filter @nw/server import <datei>` als Befehl statt Route (M13 schlanker); Lücke beim leeren Server schliessen (unten) | Opus Kern, Sonnet Zuordnungen | 2–3 |
| **P6 Laden** | Probelauf auf `dev`, Sicherung, Liste, Bestand ersetzen, Prüfbestand neu (M14), Ausschnitt in den Prototyp | Sonnet | 1 |
| **P7 Nebelwacht neu** | Welt, Kampagne, Gruppe, Figuren, Orte, Hausregeln — über der Systemebene | du, im UI; oder eine Sonnet-Sitzung aus der Sicherung | — |
| **P8 Übersetzen** | Begriffsliste ausgeben, Mike füllt sie, Skript benennt um (§1.2); die Wirkungen der Zustände von Hand (§2.4) | Sonnet, mit dir | 1 |

P1 und P2 hängen nicht voneinander ab und dürfen in beliebiger
Reihenfolge laufen. P6 braucht den Server, also nach dem Wochenende.

**Eine Lücke, die P5 schliesst:** Solange es noch **kein** Konto gibt,
lässt der Server Lesezugriffe ohne Anmeldung durch („frischer Server:
lesen ja, schreiben nie", `apps/server/src/app.ts`). Mit leerem Bestand
ist das harmlos; mit 10 000 geladenen Artikeln nicht mehr. Der
Ladebefehl verweigert darum, solange kein Verwaltungskonto existiert,
und die Ausnahme gilt nur noch, solange auch der Bestand leer ist.

---

## 5. Die Aufträge

Je Paket ein Auftrag zum Einfügen in eine **neue** Sitzung. Sie sind
bewusst knapp: CLAUDE.md lädt die Regeln von selbst, die Dokumente hier
liefern den Inhalt.

### P1 — Fundament (Opus 5.5, Effort high)

```text
Paket P1 aus docs/5etools-Arbeitsplan.md: M10, M11, M12 aus docs/5etools-Abgleich.md §3.
- M10: Lange Textfelder (format: 'long') rendern Markdown — Listen, Tabellen, Überschriften, Hervorhebung. Kein HTML aus dem Text, kein eval. Ort: packages/model/src/inline.ts (Segmente), Darstellung in apps/web und im Prototyp (grep nach dem Rendern von format 'long', nicht die Datei ganz lesen).
- M11: [[id|Anzeige]] löst über Identity.id auf; [[Name]] bleibt als Eingabe erlaubt und wird beim Speichern zur Id, wenn eindeutig.
- M12: {{1d6+2}} ist ein Würfelausdruck im Text, klickbar wie die Würfel im Prototyp (REQ-070); {VAR} bleibt, wie es ist.
Tests in packages/model. Doku: Datenmodell.md, Begriffe.md, „How it works". Ein PR nach preprod, selbst mergen.
```

**Stand 2026-10-09: steht.** `parseMarkdown` (`markdown.ts`), `rollDice`
(`dice.ts`), `idLinks` und `linkCandidates`; gezeichnet in `apps/web`
(`nw-text`) und im Prototyp (`para`). Regel und Tabelle in
[Datenmodell.md](Datenmodell.md) §4.4. Offen: der Server schreibt
`[[Name]]` nicht selbst um — das tun die beiden Masken; der Importer
(P5, Schritt 15) schreibt die Nummer ohnehin direkt.

### P2 — Regeltypen (Sonnet 5.5, Effort medium)

```text
Paket P2 aus docs/5etools-Arbeitsplan.md: Abschnitt 2 ganz (Condition mit stage/stageOf/recovery, Disease, ActionType, Action ohne Angriffsfelder, Feature, ItemProperty, Kante affects, RuleKind als Zeile und nicht mehr Pflicht, Vitals.exhaustion fällt weg, höchstens eine Stufe je Grundzustand in der Zustandsliste) und M7, M8, M9 aus docs/5etools-Abgleich.md §3 (M9 in der Fassung des Arbeitsplans: eine Systemebene, Source.srd).
Register in packages/registry/src (interfaces.ts, fieldgroups.ts, relations.ts, enums.ts), Prüfregel in packages/model, dann emit-seed und catalogue. Für einen Typ: node packages/registry/scripts/typ.mjs <Typ>.
Den heutigen Bestand NICHT migrieren — er wird ersetzt. Nur prototype/test/dbdump so anpassen, dass pnpm test grün ist.
Doku: Datenmodell.md, Begriffe.md, „How it works", Decision Log D48 auf decided. Ein PR nach preprod, selbst mergen.
```

### P3 — Zauber und Gegenstände (Opus 5.5 für M2, danach Sonnet für M4)

```text
Paket P3 aus docs/5etools-Arbeitsplan.md: M2 (Spell, casts, Zauberwirken am Statblock; SG und Angriffsbonus gerechnet, D8) und M4 (Item wächst) aus docs/5etools-Abgleich.md §3.
Feldliste aus §2.2 und §2.4 dort. Vorlage für die 5e.tools-Form: ein Eintrag „Fireball" und „Wand of Magic Missiles" — nur diese zwei lesen, nicht die Dateien.
Bestand nicht migrieren. Doku wie in CLAUDE.md. Ein PR nach preprod, selbst mergen.
```

**Stand 2026-10-09: steht.** `Spell` unter `Rule`, Kante `casts`
(Statblock, PlayerCharacter, Item → Spell), Zauberwirken am Statblock mit
gerechnetem SG und Angriffsbonus (`modOf`, und eine Rechnung fragt nach der
eigenen Karte den Artikel), `Vitals.slotsUsed`; `Item`, `Weapon`, `Armor`
mit den Feldern aus M4, `carries` und `instanceOf` am Gegenstand. Regeln Z1–Z6
und G1–G3 in [Datenmodell.md](Datenmodell.md) §5.6, Entscheidung D49.
Offen: der Stand der Ladungen am Stück, die Unterklasse an `casts` (P4),
der Bogen zeigt das Zauberwirken noch als Feldtabelle.

### P4 — Statblock und Charakterbau (Opus 5.5, Effort high)

```text
Paket P4 aus docs/5etools-Arbeitsplan.md: M5, M3, M6 aus docs/5etools-Abgleich.md §3.
M6 ist eine Modelländerung in packages/model: enumRef darf eine Artikelart nennen (die Namen sichtbarer Artikel dieser Art), enumOptions() und der Prototyp (enumWerte) lesen beides. Danach fallen die Aufzählungszeilen Skill, Language, Tool, WeaponTraining, ArmorTraining, KnowledgeField und die Einstellung skills weg.
PlayerCharacter.level wird gerechnet (Summe der hasClass-Stufen).
Bestand nicht migrieren. Doku wie in CLAUDE.md. Ein PR nach preprod, selbst mergen.
```

**Stand 2026-10-09: steht.** M5: Statblock mit `languageNote`,
`conditionImmunities`, `legendaryActions`, `bonuses`, `token`, Kante
`equips`; nimmt `Proficiencies` (von der Kreatur herüber), `Lore`, `Image`.
`Action` mit `attack`, `toHit`, `reach`, `range`, `damage`, `damageType`.
M3: `Class`, `Subclass`, `Ancestry`, `Background` unter `Rule`, Kanten
`subclassOf`, `subraceOf`, `hasClass` (`level`, `subclass`), `hasAncestry`,
`hasBackground`, `grants` (mit `level`; das ist `featureOf` aus §2.2,
vorwärts), `PlayerCharacter.level` gerechnet über `sum(hasClass.level)`.
M6: `enumRef` nennt Arten und `Typ.feld`, `Language` ist eine Art, die
sechs Zeilen und `skills` sind weg. Zeilen `Size` und `DamageType`.
Entscheidung D50, Regeln S1–S3, C1–C4, Ü1–Ü3 in
[Datenmodell.md](Datenmodell.md) §5.7. Offen: der Bogen in `apps/web`
zeichnet Klasse und Stufe noch nicht; die Wahl aus `ProficiencyChoice`
trifft niemand für die Figur (seit T-079: `Choices.choices` am Artikel,
die Antwort als Kante `chose`; die Maske dafür ist T-080); eine umbenannte Fertigkeit nimmt die
gespeicherten Übungen nicht mit.

### P5 — Importer (Opus 5.5 für den Kern, danach Sonnet)

```text
Paket P5 aus docs/5etools-Arbeitsplan.md: Importer nach docs/5etools-Abgleich.md §4.2, mit den Entscheidungen aus Arbeitsplan §1 (2014-Basis, eine Systemebene, alles englisch, einmaliges Laden) und §2.5 (Statblock zerlegt in Action und Feature, gleichlautende Merkmale einmal).
Neues Paket packages/import-5etools, TypeScript, ohne Framework. Eingabe: Pfad zu einem Checkout von 5etools-src/data (ausserhalb des Repos). Ausgabe: Ausfuhrdatei (registry + entities) und ein Bericht (je Art: Anzahl, unübernommene Schlüssel mit Zähler, Verweise ins Leere). Die Wirkungskanten affects legt der Importer nicht an.
Kern zuerst (Opus): entries-Baum → Markdown, Inline-Marken → [[id|…]] / {{…}}, _copy auflösen. Die Zuordnung je Art danach (Sonnet).
Nie ganze Datendateien lesen; ein Skript fasst zusammen.
Dazu: Befehl pnpm --filter @nw/server import <datei> [--replace] (durch validateEntity; verweigert ohne Verwaltungskonto), und die Leseausnahme des leeren Servers nur bei leerem Bestand.
Ein PR nach preprod, selbst mergen.
```

**Stand 2026-10-09: steht.** `packages/import-5etools` (Kern:
`text.ts` Textbaum → Markdown und Inline-Marken → `[[id|…]]`/`{{…}}`,
`copy.ts` `_copy`/`_mod`; Zuordnungen je Art unter `src/arten/`), Bericht
[5etools-Bericht.md](5etools-Bericht.md). Ein Lauf gegen 5etools-src vom
2026-10-08: **27 838 Artikel**, alle geprüft — davon 9 130 Aktionen und
8 204 Merkmale, die die Statblöcke zerlegen (§2.5; 1 893 davon stehen an
mehr als einem Statblock, 5 705 Doppel nicht angelegt), und 2 159
Tabellen. Am Server `pnpm --filter @nw/server run import <datei>
[--replace]` (verweigert ohne Verwaltungskonto), die Leseausnahme gilt
nur noch bei leerem Bestand. Betrieb: [Betrieb.md › 5e.tools
laden](Betrieb.md#5etools-laden).
Abweichend vom Abgleich: keine `ids.json` (§1: keine stabile Zuordnung
über Läufe), keine Ebene je Buch, `overrides` entfällt (kein 2024).
Offen: die Klassenlisten der Zauber (keine Kante von `Class` zu `Spell`),
Behälter (`containerCapacity` → `carries` ein Inventar),
`entry`-Kanten aus Tabellenzeilen; Schatztabellen, „This Is Your Life",
die Spielarten in `_versions` (ohne die der Unterarten) und die genannten
+N-Gegenstände kamen mit T-084 (Datenmodell R12); die Ablage speichert
`enums` nicht (Prüfung am Server ohne Aufzählungszeilen); `listEntities`
am Server lädt Artikel einzeln — bei 28 000 vor P6 ansehen; der
Prüfaufbau des Prototyps (`pruefe.mjs`) erwartet den alten Bestand (M14).

**Doppel (Entscheidung 12.10.2026, `src/doppel.ts`).** Drei Sorten, die
der erste Lauf stehen liess:

| Doppel | Warum | Was gilt |
|---|---|---|
| **Gleiches Merkmal an mehreren Klassen** — Ability Score Improvement zwölfmal | Klassenmerkmale wurden nur innerhalb einer Klasse vereint; nach dem Ersetzen der Stufen ist der Text bei allen gleich | **Ein Artikel**, jede Klasse zeigt mit `grants` und ihren Stufen darauf (D50). Gleiche Art, gleicher Name, gleiche Karten ausser Nummer und Fundstelle |
| **Monster-Merkmal, das den Namen nicht trifft** — Pack Tactics am Giant Rat sagt „the rat", Amphibious am Black Dragon Wyrmling „the dragon", an Venomfang „Venomfang" | `{CREATURE}` wurde nur für „the" + vollen Namen, erstes oder letztes Wort eingesetzt | **`{CREATURE}` trägt den Artikel** (W1): erkannt wird „the" + die längste Wortfolge aus Name (auch in der Klammer), `shortName` oder **Kreaturtyp** samt Marken — klein, gross nur, wie der Name es schreibt; Füllwörter am Ende weg, ein Genitiv beendet sie. Bei benannten Kreaturen (`isNamedCreature`, `shortName`) dazu jede Folge grossgeschriebener Namensteile ohne Artikel („Gar", „Wei Feng"). Verweise und Würfel bleiben unberührt; offene Vorlagenwerte (`<$short_name$>`, `<$dc__con$>` aus `_templates`) werden vorher eingesetzt. **Ein Name je Text**, der längste, und die Kante trägt genau ihn — gelesen wird jeder Text wie im Buch |
| **Fassungen aus mehreren Büchern** — MPMM druckt Volo und Mordenkainen neu, Common steht in sechs Settingbüchern | eine Fassung je Buch | Es gilt der **Nachdruck** (aus `reprintedAs`), sonst das **Kernbuch** (PHB, DMG, MM), sonst das **neuste** Buch. Die anderen bleiben als **Variante** (`variantOf`) mit dem Buch im Namen — „Kobold Inventor (VGM)" ist wählbar, `[[Kobold Inventor]]` eindeutig |

Warum Variante und nicht Instanz (nur die Abweichung speichern): beide
Fassungen sind Buchtext und ändern sich nicht, also gewinnt die Instanz
nichts — und eine Hausregel an der geltenden Fassung soll die alte nicht
still mitändern. Eine Instanz ist für das Stück am Tisch da, das von
seiner Vorlage abweicht.

Ein Lauf danach: **26 404 Artikel** (−1 434): 6 816 Monster-Doppel nicht
angelegt (vorher 5 705), 323 Merkmale über Klassen vereint, 635 Fassungen
als Variante (301 Statblöcke, 171 Gottheiten, 49 Abstammungen, 44
Sprachen …).

**`{CREATURE}` mit Artikel (W1, 13.10.2026).** Gemessen am vollen
Bestand: Merkmale und Aktionen von Monstern 10 379 → 7 871 (alle Teile
an Statblöcken 11 807 → 9 105), Amphibious 62 → 5, Multiattack 1 620 →
1 198, Magic Resistance 211 → 18. Jeder Teil liest mit der Bindung an
seiner Kante wörtlich wie vorher (geprüft über alle 21 031 Kanten); die
205, die anders lesen, hatten `<$short_name$>` oder `<$dc__con$>` offen
stehen. Was gleich heisst und verschieden bleibt, ist wirklich
verschieden („air or water", „the monkey's allies").

**Angriffe, einer für alle (Entscheidung 12.10.2026, D51,
`src/arten/angriff.ts`).** Der Angriffssatz eines Statblocks wird in
Felder zerlegt; je Name, Sorte, Schadensart (und Aufladung) gibt es
**einen** Angriff, dessen Vorgaben der häufigste Fall sind. Jede Kante
`composedOf` trägt nur, was ihr Statblock anders macht, dazu die
Buchzahl, wo die Rechnung etwas anderes ergäbe, und den Satz nur dieses
Statblocks. Ein Lauf: 5 685 Verwendungen auf 1 093 Angriffe, die
Buchzahl steht beim Treffer 394-mal und beim Schaden 505-mal an der
Kante — **jeder** der 5 685 Angriffe rechnet am Statblock genau die
Zahl des Buchs (nachgerechnet gegen den Lauf davor). 311 Angriffe sind
anders gebaut (kein Würfel, zwei Schadensarten, Shillelagh) und bleiben
Text. Monstermerkmale zeigen auf ihr Volksmerkmal (279), wenn ein Träger
zu dem Volk gehört. Insgesamt **24 157 Artikel**.

**Der Ausschnitt** (`--sample`, `PROBE` in `lauf.ts`) ist der Prüfbestand
und das, was ins Artefakt geht: jede Art, die Grenzfälle (Legendär mit
Hort, Schwarm, benannte Figur, Zustand mit Stufen, Fassung und Variante,
Buchtext ausserhalb des SRD) und durchgängige Beispiele (der Zauberer von
der Klasse bis zu Fireball, der Goblin vom Statblock bis zur Sprache).
459 Artikel; ein Name, der nichts trifft, lässt den Lauf fehlschlagen.

### P6 — Laden (Sonnet 5.5, Effort medium)

```text
Paket P6 aus docs/5etools-Arbeitsplan.md, Ablauf nach docs/5etools-Abgleich.md §4.3 und §4.4.
Zuerst auf dev: Probelauf mit den Stichproben aus §4.3, Bericht prüfen. Dann Sicherung (Ausfuhr + pg_dump), Bestandsliste, Laden mit --replace. Prüfbestand prototype/test/dbdump aus einem Ausschnitt neu erzeugen; denselben Ausschnitt in den Prototyp.
Prod erst, wenn ich dev angeschaut habe.
```

---

## 6. Später: der Regeltext auf Deutsch

Nicht Teil dieses Plans. P8 übersetzt Namen und Begriffe; der Regeltext
bleibt englisch, bis Mike anders entscheidet. Wenn es so weit ist, ist
die Begriffsliste aus P8 das Glossar, damit „frightened" überall gleich
heisst.

---

## 7. Was nur du tun kannst

- **Hetzner am Wochenende** nach [Betrieb.md](Betrieb.md); P6 wartet
  darauf.
- **Je Paket eine neue Sitzung** mit dem Auftrag oben; das Modell vorher
  mit `/model` setzen.
- Release-PR [atlas-mentis#1](https://github.com/Mrfudog/atlas-mentis/pull/1)
  mergen, wenn prod mitziehen soll.
