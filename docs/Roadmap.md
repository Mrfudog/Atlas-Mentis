# Nebelwacht — Fahrplan

Stand 2026-09-19. Sammelt alles, was seit dem Artikel-Prototyp angefragt wurde,
und ordnet es. Offene Entscheidungen stehen am Schluss.

---

## Die eine Weiche, die alles andere sortiert

Der Prototyp ist ein Artefakt: eine HTML-Datei, knapp 1600 Zeilen Vanilla-JS,
gegen einen einfachen Dokumentspeicher. Er existiert, um **eine** Frage zu
beantworten: trägt das Rückgrat aus Peg, Komponenten und Kanten, wenn man
wirklich damit arbeitet? Bisher lautet die Antwort ja — Schnittstellen,
Vererbung, Subtypen und der Pool halten.

Von dem, was jetzt ansteht, gehört aber nicht alles dorthin:

| Gehört in den Prototyp | Gehört in den echten Stapel |
|---|---|
| Artikelmodell, Felder, Ansichten | Board, Karten |
| Register und seine Masken | Initiative-Tracker |
| Verweise, Vorschläge, Breadcrumbs | Spiel- & Vorbereitungsmodus |
| Geschichts- und Spielerartikel | Spielerzugänge, Live-Sitzung |
| Massenbearbeitung | Alles, was gleichzeitig mehrere Leute sehen |

Der Grund ist nicht Aufwand, sondern Wegwerfarbeit. Ein Initiative-Tracker
braucht Zustand, der mehrere Geräte gleichzeitig sehen — das ist genau das,
wofür Postgres, Fastify und Angular vorgesehen sind. In einer HTML-Datei
gebaut, wäre er zweimal gebaut.

Die Geschichts- und Spielerartikel (Kampagne, Arc, Kapitel, Session, Szene,
Quest, Charakter, Party, Companion, Retainer, Inventar) gehören dagegen noch in
den Prototyp — und zwar als **Probe aufs Exempel**: Wenn das Rückgrat stimmt,
sind sie Registerzeilen und kein Code. Stimmt es nicht, merken wir es dort für
ein paar Stunden statt später für ein paar Wochen.

---

## Etappe A — das Artikelwerk fertig machen (Prototyp)

Alles hier ist Artikelmodell. Der Prototyp ist dafür das schnellste Werkzeug,
das wir haben.

### A1 · Englisch durchgehend
Technische Namen und sichtbare Texte. `Gegenstand` → `Item`, `Ruestung` →
`Armor`, `Formfaktor` → `Footprint`, `teilVon` → `partOf`, Feldschlüssel
innerhalb der Komponenten (`groesse` → `size`, `rk` → `ac`). Verweise in allen
Artikeln werden mitgeschrieben. `Marken` heisst `Tags`.
Die Umbenennungskarte liegt unter `prototype/migration/rename-map.json`.
*Betrifft auch `packages/registry`, `packages/import` und deren Tests, sowie
`CLAUDE.md` — die Regel „Oberfläche deutsch" wird damit hinfällig.*

### A2 · Felddefinitionen
- Feldschlüssel **umbenennen**, mit Migration der Werte in allen Artikeln
- neue Basistypen: **color** (Fraktionsfarbe), **enum** mit selbst gepflegten
  Werten, **link** (Verweis auf einen Artikel)
- **Zielbeschränkung** für link-Felder: nach Schnittstelle samt Subtypen, nach
  Tag, nach Feldwert. Eine kleine Abfrage, kein Freitext.
- **Vorschläge beim Tippen** in link-Feldern, gefiltert über dieselbe Abfrage

### A3 · Alle Registerreiter nach demselben Schema
Was die Schnittstellen bekommen haben, bekommen Komponenten,
Verknüpfungsarten, Ansichten und Variablen auch: eine Maske mit Feldern statt
eines JSON-Textfelds. Das JSON bleibt als Notausgang.

### A4 · Ansichten als Werkzeugkasten
Eine Ansicht wird eine **geordnete Liste von Elementen** statt einer Sammlung
von Schaltern: Zwischentitel, Absatz, Tabelle mit einstellbarer Spaltenzahl,
Feldgruppe, Bild, Bezüge, Bausteine. Anlegen, anordnen, entfernen.
Die vorhandenen Ansichten werden umgewandelt.

### A5 · Ansichten pro Typ
`Item: Voll` zeigt andere Felder als `Statblock: Voll`. Die Ansicht definiert
das Layout, der Typ füllt es. Ohne eigene Festlegung erbt ein Subtyp die
Ansicht seines Obertyps — dieselbe Vererbung wie bei Komponenten.

### A6 · Ansicht „Wissen" — **steht**
Felder gruppiert, und daneben was wer weiss. Die Einheit dazwischen ist die
**Information**: ein eigener Artikel, der Felder und Blöcke bündelt und über
`knownBy` an Figuren, Gruppen und Wissensstände geht. Was keine Information
nennt, liegt offen und steht zuoberst. Seitenpanel in der Artikelansicht.
Ausführlich in [Wissen.md](Wissen.md).

### A7 · Bearbeiten in der Ansicht
Artikel werden **in der Ansicht** geändert, nicht in einem Formular. Das
Formular bleibt für das Anlegen aus einem anderen Artikel heraus, mit
„Schnell erfassen" als Grundeinstellung und wählbarer Ansicht.

### A8 · Breadcrumbs
Jeder Absprung hinterlässt eine Spur, jeder Schritt ist anklickbar.

### A9 · Massenbearbeitung
Mehrere Artikel wählen, dann gemeinsam ändern oder löschen. *Siehe offene
Frage 5.*

---

## Etappe B — Inhalte als Registerzeilen (Prototyp)

Die Probe: keine Codeänderung, nur Zeilen.

### B1 · Geschichtsartikel
Kampagne › Arc › Kapitel › Session › Szene/Encounter, dazu Quests.
Die Hierarchie ist eine Kante (`partOf`), kein neues Konstrukt.

### B2 · Spielerartikel
Charakter, Party, Companion, Retainer, Inventar. Das Inventar ist ein
Behälter — Party-Besitz getrennt von Charakterbesitz.

### B3 · Globale Variablen
Gruppenstufe, Gruppen-Aufenthaltsort und weitere. Sie stehen schon als
Kampagnenregister im Modell (`{VAR}`-Auflösung, dritte Stufe); hier bekommen
sie eine Oberfläche und werden in Ansichten benutzbar.

---

## Etappe C — der echte Stapel

Erst wenn A und B stehen und das Register sich bewährt hat.

### C1 · Angular + Fastify + Postgres
Das Register, das der Prototyp erzeugt hat, wird die Startbelegung. Die drei
Tabellen stehen (`apps/server/migrations/001_backbone.sql`), das Modellpaket
ist rahmenfrei und wird geteilt.

### C2 · Ausspielung
Hetzner, GHCR, zwei Instanzen aus `main` und `preprod`, Reverse Proxy.
Produktionsdaten regelmässig nach preprod spiegeln — **ohne** Spielerzugänge
und Sitzungsaufnahmen. *Blockiert durch offene Frage 2.*

### C3 · Spieltisch
Board, Karten, Initiative-Tracker, Spiel- und Vorbereitungsmodus,
Spielerzugänge über Einladungslinks je Charakter.

### C4 · Nachzügler
Ortsimporter als TypeScript (der Prototyp kann es, `packages/import` noch
nicht). Register des Prototyps und `packages/registry` zusammenführen — sie
laufen derzeit von Hand nebeneinander her.

---

## Wie ich arbeiten sollte

Zur Frage nach Koordinator und Rollen-Agenten.

**Was bisher gebremst hat, war nicht Denkleistung.** Die vier echten Fehler
dieser Sitzung — doppelte `id`, eingefrorene Snapshots, verschluckte
Platzhalter, verworfenes `confirm()` — hatten alle dieselbe Ursache: der
Prüfaufbau war grosszügiger als die Laufzeit. Ein Architektur-Agent hätte
keinen davon gefunden. Ein Prüfaufbau, der die Laufzeit ernst nimmt, hat alle
vier gefunden, sobald er sie nachbildete.

Ein Team aus Architekt, Entwickler und Sicherheit würde diese Art Fehler nicht
verhindern, aber Aufwand erzeugen: Unteragenten teilen meinen Verlauf nicht,
jeder braucht eine Einweisung. Das lohnt sich, wenn eine Aufgabe **abtrennbar
und prüfbar** ist — und nicht, wenn sie den Gesprächsverlauf braucht.

**Was sich lohnt:**

1. **Gegenlesen.** Ein Agent ohne mein Gedächtnis, der nur den Diff sieht,
   findet, was ich nicht finde, weil ich weiss, was ich gemeint habe.
2. **Nebenläufige, abgegrenzte Arbeit.** Ortsimporter nach TypeScript, während
   ich am Werkzeugkasten baue. Zwei Dateien, keine Überschneidung.
3. **Mechanisches in Serie.** Umbenennungen über drei Pakete, Testanpassungen,
   Dokumentationsdurchgänge.

**Zur Modellwahl.** Der Koordinator auf Fable und die Arbeiter auf Opus wäre
genau verkehrt herum. Die Preise je Million Token:

| Modell | Eingabe | Ausgabe |
|---|---|---|
| Fable 5.1 | $10 | $50 |
| Opus 5 | $5 | $25 |
| Sonnet 5 | $2 | $10 |
| Haiku 4.5 | $1 | $5 |

Der Koordinator liest in dieser Anordnung den gesamten Verlauf immer wieder
mit — das ist die teuerste Stelle, und dort das doppelt so teure Modell zu
setzen, zahlt am meisten für am wenigsten. Meine Empfehlung:

- **Koordinator: Opus 5.** Er hält den Zusammenhang und entscheidet; das kann er.
- **Gegenleser und Entwurfsarbeit: Opus 5.** Dort zählt Urteil.
- **Mechanisches: Sonnet 5.** Umbenennungen, Tests, Dokumentation.
- **Fable 5.1 gezielt für einzelne harte Stücke** — das Layout-Modell der
  Ansichten, das Postgres-Schema, die Zugriffsschichten. Nicht als Dauerzustand.

Vorschlag für den Anfang: **kein festes Team**, sondern ein Gegenleser vor
jedem PR und Nebenläufigkeit, wo Aufgaben sich wirklich nicht berühren. Wenn
sich zeigt, dass eine Rolle wiederkehrt, wird sie ein Agent mit eigener
Beschreibung unter `.claude/agents/`.

---

## Entschieden (2026-09-19)

1. **Der Prototyp bleibt Artefakt, so lange es geht.** Damit verschiebt sich
   der Schnitt aus dem Abschnitt oben: Board, Karten und Initiative werden
   erst dann im echten Stapel gebaut, wenn das Artefakt sie nicht mehr trägt —
   nicht vorsorglich. Was sie an Grenzen stossen lässt, ist absehbar
   (gleichzeitige Zuschauer, Live-Zustand, Bildmengen); bis dahin gilt:
   weiterbauen, wo es schneller geht.
2. **Zugang: ein Passwort je Nutzer**, so einfach wie möglich. Kein SSO.
   Festgelegt wird es, wenn die Basis des Prototyps steht.
   *Offen bleibt dabei:* Passwörter gehören gehasht abgelegt (Argon2id) und
   nie ins öffentliche Repo; die Anwendung hat heute gar keine
   Authentifizierung und bindet auf `127.0.0.1`.
3. **Bearbeiten: Klick aufs Feld**, plus ein Schalter, der die Bearbeitung
   aller Felder auf einmal einschaltet.
4. **Wissen: selbst festlegen, über ein Seitenpanel in der Artikelansicht.**
   Dort wird bestimmt, welche Felder zu welcher Information gehören, und
   diese Informationen werden dann Charakteren oder Wissensständen
   zugeteilt. Die Information ist damit eine eigene Einheit zwischen Feld
   und Empfänger — kein Feldattribut.
5. **Massenbearbeitung** wie vorgeschlagen: Tags setzen und entfernen, Stand
   ändern, Schnittstelle wechseln, ein Feld auf denselben Wert, löschen.
6. **Session als Artikel mit Kanten**, dem Rückgrat entsprechend — kein
   eigenes Behälterkonstrukt.

---

## Etappe D — der Spieltisch (Prototyp) — **steht**

Nach Entscheidung 1 im Artefakt gebaut, nicht im echten Stapel. Ausführlich
in [Spieltisch.md](Spieltisch.md).

- **D1 · Assets, Quellen, Weltdaten, Einstellungen** — REQ-020, 021, 024,
  043, 145, 147, 148. Ein Asset ist ein Artikel; Verbraucher fragen nie,
  welche Art Verweis ein Bild trägt. Sechster Registerteil für die
  Kampagneneinstellungen.
- **D2 · Karten** — REQ-130 bis 136. Tokens sind Kanten mit Koordinaten in
  Anteilen; Unterkarten über `insideMap`; Quadrat- und Hexgitter.
- **D3 · Charakterbogen** — REQ-051, 063, 066. `Vitals` getrennt von
  `StatblockInfo`; alles ein Tipp, kein Formular.
- **D4 · Inventar** — REQ-064, 065. Griffabstand, Körperslots und
  Kachelraster über denselben Daten; die Formangaben lagen schon im
  Register.
- **D5 · Handwerk** — REQ-184. Ein Rezept, das jemand kennt, ist eine
  Information — das Wissensmodell aus A6 trägt auch hier.
- **D6 · Boards** — REQ-111, 157 bis 166. Jede Platzierung wird mit
  denselben Elementen gezeichnet wie die Artikelseite; die
  Darstellungsauflösung hat drei Stufen.
- **D7 · Begegnung, Initiative, Würfel** — REQ-070, 085, 115, 144. Eine
  Kante je Teilnehmer; Zustände mit Dauer; der Zeiger auf der Karte.
- **D8 · Aufträge und Zeitleiste** — REQ-082, 083, 106. Aufgaben zum
  Abhaken, ein Brett nach Stand gruppiert, Ereignisse nach Weltdatum.
- **D9 · Ebenen und Stapelauflösung** — REQ-004 bis 009, 044. Was gilt, ist
  eine Abfrage; Überschreiben und Herausnehmen statt Löschen. Siehe
  [Ebenen.md](Ebenen.md).
- **D10 · Nebel, Licht, Gebiete** — REQ-138, 139, 140, 193. Aufgedecktes ist
  ein Feld, Beleuchtetes eine Rechnung, Gebiet eine Kante; der Schatten wird
  gerechnet, nicht gemalt.
- **D11 · Ruf und Beziehungen** — REQ-030, 081. Eine Tat war ein Artikel mit
  zwei Kanten, und eine Tat, von der niemand wusste, änderte nichts.
  **Von D20 abgelöst.**
- **D12 · Handwerk, das läuft** — REQ-184 zu Ende. Ein Gang steht an einer
  Kante, und am letzten Tag wird wirklich gewürfelt. Das Material ging
  anfangs am Anfang hinein; **seit D21 wird es angehängt, während der Gang
  läuft.**
- **D13 · Blockanker und Kampagnenwerte** — B3. Ein Anker aus dem Inhalt
  statt aus einer Id; Gruppenstufe und Aufenthaltsort gerechnet statt
  eingetippt.
- **D14 · Ein Register, eine Quelle** — C4. `emit-seed` erzeugt die
  Registerzeilen des Prototyps aus `packages/registry`; dazu acht Prüfungen
  der Bezugstreue, weil eine einzige Quelle nur so viel wert ist, wie sie
  geprüft ist.
- **D15 · Zugang am Server** — REQ-031, 032, 035, 036. Ein Passwort je
  Nutzer (Argon2id), Sitzungen beim Server, und gelesen wird gesiebt. Siehe
  [Zugang.md](Zugang.md).
- **D16 · Die Oberfläche fängt an** — `apps/web`. Anmeldung, Wache,
  Artikelliste und Artikelansicht; gezeichnet aus dem Register über
  `packages/model`, nicht aus einer Vorlage je Artikelart.
- **D17 · Bearbeiten** — `apps/web`. Die Eingabeart kommt aus dem Register;
  geschrieben wird der ganze Artikel, und der Server sagt, wer darf. Kanten
  werden nur vorwärts bearbeitet — die Gegenrichtung ist eine Abfrage und
  hat kein Feld.
- **D18 · Vier Bereiche, drei Stufen** — Story, World, Game und Play stehen
  an der Schnittstelle (`area`) und nicht in einer Liste neben dem Register.
  Die einundzwanzig Darstellungsstufen sind drei: `quick`, `full`, `player`.
  Was für eine Artikelart eigen ist, steht in `byInterface` und nicht in
  einer eigenen Stufe — eine Kreatur zeigt ihren Bogen, ohne dass jemand
  etwas auswählt.
- **D19 · Karten: Blätter, Sperren, Rahmen** — REQ-130 bis 140. Ein
  Hintergrundbild je Zeichenebene; Wände, Türen, Fenster und Abgründe mit
  je eigener Wirkung auf Blick und Schritt; der Rahmen einer Unterkarte wird
  aufgezogen statt in die Mitte gelegt. Siehe [Karten.md](Karten.md).
- **D20 · Beziehung statt Ruf** — REQ-030, 081. Die Taten, ihre beiden
  Kanten und die gerechnete Leiter sind weg; geblieben ist eine Kante mit
  Marken und einer Zeile. Es war richtig gebaut und trotzdem zu viel: am
  Tisch fragt niemand nach einer Zahl. Siehe
  [Beziehungen.md](Beziehungen.md).
- **D21 · Material während des Gangs** — REQ-184. Anfangen braucht nur das
  Werkzeug; das Material wird angehängt, während gearbeitet wird, und der
  letzte Tag bleibt zu, bis alles drin ist. Vorher konnte anfangen nur, wer
  schon alles hatte — am Tisch ist es andersherum.
- **D22 · Der Spieltisch** — REQ-116, 117, 130, 144. Der Bereich Play führt
  an den Tisch und nicht in eine Liste: Initiative oben, darunter Karte oder
  Boards. Was läuft, kommt aus `SessionState` und wird hier nur gezeigt —
  und gezeichnet wird mit denselben Elementen wie die Artikelseite, damit
  es keinen zweiten Kartenzeichner „für den Tisch" gibt.

---

## Als Nächstes

A, B und D stehen. Was bleibt, in der Reihenfolge, in der es sich lohnt:

1. **Der Zugang** (Entscheidung 2, REQ-031 bis 038): ein Passwort je Nutzer.
   Erst damit wird aus `visibleFields` eine Spieleransicht statt einer
   geprüften Funktion — und erst damit haben Wissen, Rezeptgeheimnisse und
   das Questbrett einen Empfänger, der nicht die Spielleitung ist.
2. **Sitzungszustände und Echtzeit** (REQ-116, 117). Runde und Zug liegen
   heute an der Begegnung. Die Artefakt-Fähigkeit `room` liefert genau den
   Kanal, den das braucht — mehrere Geräte, die dieselbe Initiative sehen.
3. **Globale Variablen** (B3): Gruppenstufe und Gruppen-Aufenthaltsort haben
   im Register eine Zeile, aber noch keine Maske und keine Verwendung in den
   Ansichten.
4. **Die Bereiche in der Oberfläche.** Anmelden, suchen, lesen, bearbeiten
   und Kanten ändern geht seit 2026-09-20. Als Nächstes die Bereiche, die der
   Prototyp schon kann — Karte, Bogen, Inventar, Boards, Handwerk —, in
   derselben Reihenfolge, in der sie dort entstanden sind.
5. **Der Ortsimporter als TypeScript** (C4, Rest). Das Register steht seit
   2026-09-20 nur noch einmal: `pnpm --filter @nw/registry emit-seed`
   erzeugt die Zeilen des Prototyps aus `packages/registry`.
