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

### A6 · Ansicht „Wissen"
Felder gruppiert, und daneben was wer weiss: die Angaben zum Artikel getrennt
nach dem, was offen liegt und dem, was noch nicht. Direkt dort änderbar.
*Siehe offene Frage 4.*

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

## Offene Entscheidungen

1. **Wo endet der Prototyp?** Mein Vorschlag: nach Etappe B. Board, Karten und
   Initiative im echten Stapel. Einverstanden, oder willst du davon etwas
   früher sehen?
2. **Welches SSO** läuft vor dem Reverse Proxy? Blockiert C2 seit Anfang.
3. **Bearbeiten in der Ansicht (A7):** Klick auf ein Feld macht genau dieses
   Feld änderbar — oder ein Schalter „Bearbeiten" macht den ganzen Artikel
   änderbar und einer speichert?
4. **Ansicht „Wissen" (A6):** geht es um Gruppierung der Felder, oder um
   Wissensstände (was die Gruppe weiss, was ein Charakter weiss, was noch
   verborgen ist)? Ich lese es als beides und baue die Gruppierung zuerst.
5. **Massenbearbeitung (A9):** welche Vorgänge? Tags setzen und entfernen,
   Stand ändern, Schnittstelle wechseln, ein Feld auf denselben Wert setzen,
   löschen. Fehlt etwas, ist etwas davon zu viel?
6. **Session als Behälter oder als Artikel mit Kanten?** Ich schlage Kanten vor
   (`partOf`), wie überall sonst — ein Behälterkonstrukt wäre das erste
   Element, das nicht dem Rückgrat folgt.
