---
tags: [vtt, requirements, registry]
status: derived
updated: 2026-10-15
---

# Requirements Registry

> [!info] Erzeugt aus den Notizen
> Quelle sind die Story-Notizen in `VTT/Stories/`, die Features in `VTT/Features/`, die Epics in `VTT/Epics/`.
> `pnpm --filter @nw/registry anforderungen -- --umsetzung VTT/Umsetzung.md` schreibt diese Seite neu — von Hand geändert wird die Notiz, nicht die Seite.

Alle Anforderungen als **User Stories** (T-154, E-048 a): je Story eine Notiz `REQ-nnn`, je Story ein **Feature** (eine Funktion, eine Artikelart oder eine Ansicht), je Feature ein **Epic** (ein Funktionsbereich, siehe [[Areas]]). **Nummern sind unveränderlich**: fortlaufend, nie neu vergeben, ohne Bedeutung. Was wegfällt, bleibt mit `dropped` stehen und nennt, was es ersetzt (`ersetztDurch`) oder warum nicht.

**Vorrang (D42, 7.10.2026):** was der Tisch von Nebelwacht braucht, vor dem, was ein beliebiger Tisch brauchen könnte; die Spalte *Prio* bleibt, der Vorrang gilt bei gleicher Prio. Einschneidende Änderungen entscheidet die Verwaltung.

**Ein neuer Wunsch** wird zuerst eine Story oder ändert eine bestehende (bzw. setzt sie auf `dropped`); Aufgaben im Projektbrett hängen an Stories. Ablauf: [CONTRIBUTING.md](../CONTRIBUTING.md#anforderungen-als-user-stories).

## Skalen
- **Rolle** Spieler · Spielleitung · Mitleitung · Zuschauer · Verwaltung
- **Prio** 1 Gerüst · 2 erster Einsatz am Tisch · 3 volle v1.0 · 4 Ausbau · 5 Ideenparkplatz
- **Aufwand** Fibonacci-Punkte: 1 ≈ ein Abend · 2 · 3 ≈ zwei Abendwochen · 5 · 8 ≈ ein Monat+ · 13 = vorher teilen
- **Status** idea · defined · planned · in progress · done · dropped — folgt dem **Stand** (steht → done, teils → in progress, ersetzt/verworfen → dropped)
- **Stand** steht · teils · offen · ersetzt · verworfen — ein Urteil über das Repo, mit Anmerkung in `standNotiz`
- **Phase** prep · play · both — **Wert** enables · efficiency — **Vorbereitung** none · low · high — **v1** full · minimal · stub · later ([[Scope v1]])

## Übersicht

| Prio | Stories | Punkte | Stand |
|---|---|---|---|
| 1 | 43 | 136 | 31 steht · 7 teils · 1 offen · 2 ersetzt · 2 verworfen |
| 2 | 95 | 326 | 62 steht · 17 teils · 8 offen · 5 ersetzt · 3 verworfen |
| 3 | 115 | 331 | 61 steht · 22 teils · 31 offen · 1 ersetzt |
| 4 | 44 | 195 | 13 steht · 2 teils · 26 offen · 2 ersetzt · 1 verworfen |
| 5 | 19 | 154 | 1 steht · 18 offen |
| **Zusammen** | **316** | **1142** | 168 steht · 48 teils · 84 offen · 10 ersetzt · 6 verworfen |

## Register

| ID | Story | Rolle | Feature | Prio | Aufwand | Status | Stand |
|---|---|---|---|---|---|---|---|
| [[REQ-001]] | Artikel aus Arten, Feldern und Kanten | Spielleitung | [[F-001 Artikelmodell\|Artikelmodell]] | 1 | 5 | done | steht |
| [[REQ-002]] | Nachfolgerkette | – | [[F-001 Artikelmodell\|Artikelmodell]] | 1 | 2 | dropped | ersetzt |
| [[REQ-003]] | Änderungsverlauf je Artikel | Spielleitung | [[F-009 Verlauf & gleichzeitiges Schreiben\|Verlauf & gleichzeitiges Schreiben]] | 1 | 3 | in progress | teils |
| [[REQ-004]] | Ebenen als Pakete von Inhalt | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 1 | 3 | done | steht |
| [[REQ-005]] | Zugehörigkeit eines Artikels zu einer Ebene | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 1 | 3 | done | steht |
| [[REQ-006]] | Stapel: was in der Kampagne gilt | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 1 | 5 | in progress | teils |
| [[REQ-007]] | Stapel für Fortgeschrittene | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 3 | 5 | defined | offen |
| [[REQ-008]] | Varianten einer Sache | Spielleitung | [[F-005 Fassungen & Varianten\|Fassungen & Varianten]] | 1 | 2 | in progress | teils |
| [[REQ-009]] | Überschreiben in der eigenen Ebene | Spielleitung | [[F-005 Fassungen & Varianten\|Fassungen & Varianten]] | 2 | 3 | done | steht |
| [[REQ-010]] | Feldgruppen nur, wo sie gebraucht werden | Spielleitung | [[F-001 Artikelmodell\|Artikelmodell]] | 1 | 3 | done | steht |
| [[REQ-011]] | Inhaltsblock als eigenes Grundelement | – | [[F-001 Artikelmodell\|Artikelmodell]] | 1 | 5 | dropped | ersetzt |
| [[REQ-012]] | Textfelder für jede Art von Text | Spielleitung | [[F-003 Feldformen & Aufzählungen\|Feldformen & Aufzählungen]] | 2 | 2 | done | steht |
| [[REQ-013]] | Verweise nach Nummer, getippt nach Name | Spielleitung | [[F-007 Verweise & Platzhalter\|Verweise & Platzhalter]] | 1 | 5 | in progress | teils |
| [[REQ-014]] | Rückbezüge sehen | Spielleitung | [[F-007 Verweise & Platzhalter\|Verweise & Platzhalter]] | 3 | 2 | done | steht |
| [[REQ-015]] | Graph der Artikel | Spielleitung | [[F-008 Kanten verstehen\|Kanten verstehen]] | 4 | 5 | defined | offen |
| [[REQ-016]] | Übersetzungsschicht für Begriffe | – | [[F-001 Artikelmodell\|Artikelmodell]] | 1 | 3 | dropped | verworfen |
| [[REQ-017]] | Begriffe je Regelsystem auswerten | Spielleitung | [[F-046 Regelauswertung\|Regelauswertung]] | 4 | 5 | defined | offen |
| [[REQ-018]] | Wirkungen von Regeln beschreiben | Spielleitung | [[F-046 Regelauswertung\|Regelauswertung]] | 1 | 2 | defined | offen |
| [[REQ-019]] | Rohform jedes Imports aufbewahren | – | [[F-001 Artikelmodell\|Artikelmodell]] | 1 | 2 | dropped | verworfen |
| [[REQ-020]] | Quelle eines Artikels | Spielleitung | [[F-062 Asset-Ablage\|Asset-Ablage]] | 1 | 2 | done | steht |
| [[REQ-021]] | Dateien als Assets | Spielleitung | [[F-062 Asset-Ablage\|Asset-Ablage]] | 1 | 3 | done | steht |
| [[REQ-022]] | Vorschaubilder und Kacheln | Spieler | [[F-062 Asset-Ablage\|Asset-Ablage]] | 3 | 5 | defined | offen |
| [[REQ-023]] | Status idea/planned/used/discarded | – | [[F-003 Feldformen & Aufzählungen\|Feldformen & Aufzählungen]] | 2 | 1 | dropped | ersetzt |
| [[REQ-024]] | Weltdatum | Spielleitung | [[F-038 Kalender & Zeitleisten\|Kalender & Zeitleisten]] | 1 | 2 | done | steht |
| [[REQ-025]] | Kalender der Welt | Spielleitung | [[F-038 Kalender & Zeitleisten\|Kalender & Zeitleisten]] | 3 | 5 | defined | offen |
| [[REQ-026]] | Ansichten festlegen | Spielleitung | [[F-006 Ansichten & Anordnung\|Ansichten & Anordnung]] | 1 | 3 | done | steht |
| [[REQ-027]] | Arten ohne Code anlegen | Spielleitung | [[F-002 Register\|Register]] | 4 | 13 | done | steht |
| [[REQ-028]] | Volltextsuche | Spieler | [[F-068 Suche\|Suche]] | 3 | 3 | in progress | teils |
| [[REQ-029]] | Ausfuhr und Einfuhr | Verwaltung | [[F-065 Druck & Ausfuhr\|Druck & Ausfuhr]] | 3 | 3 | done | steht |
| [[REQ-030]] | Ruf als gewichtete Marken | – | [[F-039 Beziehungen & Ruf\|Beziehungen & Ruf]] | 2 | 1 | dropped | ersetzt |
| [[REQ-031]] | Anmelden mit Passwort | Spieler | [[F-010 Anmeldung & Konten\|Anmeldung & Konten]] | 1 | 2 | done | steht |
| [[REQ-032]] | Anmeldung über Nextcloud/OIDC | – | [[F-010 Anmeldung & Konten\|Anmeldung & Konten]] | 4 | 5 | dropped | verworfen |
| [[REQ-033]] | Konten | Verwaltung | [[F-010 Anmeldung & Konten\|Anmeldung & Konten]] | 1 | 2 | done | steht |
| [[REQ-034]] | Einladen per Link | Spielleitung | [[F-010 Anmeldung & Konten\|Anmeldung & Konten]] | 2 | 2 | done | steht |
| [[REQ-035]] | Rolle je Kampagne | Verwaltung | [[F-011 Rollen je Kampagne\|Rollen je Kampagne]] | 1 | 3 | done | steht |
| [[REQ-036]] | Leitung, Spieler und Verwaltung | Verwaltung | [[F-011 Rollen je Kampagne\|Rollen je Kampagne]] | 1 | 1 | done | steht |
| [[REQ-037]] | Mitleitung und Zuschauer | Spielleitung | [[F-011 Rollen je Kampagne\|Rollen je Kampagne]] | 3 | 2 | done | steht |
| [[REQ-038]] | Wer einen Artikel sieht | Spielleitung | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 1 | 2 | done | steht |
| [[REQ-039]] | Sichtbarkeit mit Rollenlisten und Freigabemarken | – | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 3 | 8 | dropped | ersetzt |
| [[REQ-040]] | Wissen zuteilen | Spielleitung | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 2 | 3 | done | steht |
| [[REQ-041]] | Wer was schreiben darf | Spielleitung | [[F-013 Schreibrechte & Freigabe\|Schreibrechte & Freigabe]] | 2 | 3 | in progress | teils |
| [[REQ-042]] | Schreibrecht je Feldgruppe | Spielleitung | [[F-013 Schreibrechte & Freigabe\|Schreibrechte & Freigabe]] | 4 | 5 | defined | offen |
| [[REQ-043]] | Einstellungen der Kampagne | Spielleitung | [[F-029 Kampagne\|Kampagne]] | 2 | 2 | done | steht |
| [[REQ-044]] | Herkunft am Artikel sehen | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 2 | 5 | done | steht |
| [[REQ-045]] | Ebenen-Aktionen am Artikel | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 3 | 8 | defined | offen |
| [[REQ-046]] | Kreatur und Statblock getrennt | Spielleitung | [[F-020 Kreatur\|Kreatur]] | 1 | 3 | done | steht |
| [[REQ-047]] | Import von 5e.tools, Improved Initiative und Obsidian als Einstieg | – | [[F-073 5e.tools-Import\|5e.tools-Import]] | 2 | 5 | dropped | verworfen |
| [[REQ-048]] | Kreatur schnell bearbeiten | Spielleitung | [[F-022 Schnellanlage\|Schnellanlage]] | 2 | 3 | done | steht |
| [[REQ-049]] | Kreatur schnell anlegen | Spielleitung | [[F-022 Schnellanlage\|Schnellanlage]] | 2 | 2 | done | steht |
| [[REQ-050]] | Kreatur auf einen Blick | Spielleitung | [[F-020 Kreatur\|Kreatur]] | 2 | 3 | done | steht |
| [[REQ-051]] | Schnelle Änderungen am Bogen | Spieler | [[F-023 Charakterbogen\|Charakterbogen]] | 2 | 3 | done | steht |
| [[REQ-052]] | Statblock lesen wie im Buch | Spielleitung | [[F-021 Statblock\|Statblock]] | 3 | 3 | done | steht |
| [[REQ-053]] | Statblock aus Regeln zusammensetzen | Spielleitung | [[F-021 Statblock\|Statblock]] | 2 | 5 | done | steht |
| [[REQ-054]] | Kampfrolle am Statblock | Spielleitung | [[F-021 Statblock\|Statblock]] | 2 | 1 | done | steht |
| [[REQ-055]] | Merkmale beim Tippen wiederverwenden | Spielleitung | [[F-021 Statblock\|Statblock]] | 3 | 3 | defined | offen |
| [[REQ-056]] | Kreaturen-Baukasten | Spielleitung | [[F-024 Charaktermanager\|Charaktermanager]] | 4 | 13 | defined | offen |
| [[REQ-057]] | Punktekauf für Attribute | Spieler | [[F-024 Charaktermanager\|Charaktermanager]] | 4 | 2 | defined | offen |
| [[REQ-058]] | Monster skalieren | Spielleitung | [[F-021 Statblock\|Statblock]] | 5 | 5 | idea | offen |
| [[REQ-059]] | Wissen über Arten von Kreaturen | Spielleitung | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 3 | 3 | done | steht |
| [[REQ-060]] | Begleiter und Beschwörungen | Spieler | [[F-020 Kreatur\|Kreatur]] | 3 | 2 | in progress | teils |
| [[REQ-061]] | Beziehungen zwischen Figuren | Spielleitung | [[F-039 Beziehungen & Ruf\|Beziehungen & Ruf]] | 2 | 2 | done | steht |
| [[REQ-062]] | Statblöcke anderer Regelsysteme | Spielleitung | [[F-021 Statblock\|Statblock]] | 5 | 8 | idea | offen |
| [[REQ-063]] | Charakterbogen: Allgemein | Spieler | [[F-023 Charakterbogen\|Charakterbogen]] | 2 | 5 | done | steht |
| [[REQ-064]] | Inventar als Liste | Spieler | [[F-026 Inventar\|Inventar]] | 2 | 3 | done | steht |
| [[REQ-065]] | Inventar als Raster | Spieler | [[F-026 Inventar\|Inventar]] | 4 | 8 | done | steht |
| [[REQ-066]] | Charakterbogen: Kampf | Spieler | [[F-023 Charakterbogen\|Charakterbogen]] | 3 | 5 | done | steht |
| [[REQ-067]] | Charakterbogen: Zauber | Spieler | [[F-023 Charakterbogen\|Charakterbogen]] | 3 | 5 | defined | offen |
| [[REQ-068]] | Charakterbogen: Freispiel | Spieler | [[F-023 Charakterbogen\|Charakterbogen]] | 4 | 3 | defined | offen |
| [[REQ-069]] | Am Telefon spielen | Spieler | [[F-025 Spieleransicht & Telefon\|Spieleransicht & Telefon]] | 1 | 3 | in progress | teils |
| [[REQ-070]] | Würfeln | Spieler | [[F-053 Würfel\|Würfel]] | 2 | 2 | done | steht |
| [[REQ-071]] | Würfe für alle | Spieler | [[F-053 Würfel\|Würfel]] | 4 | 3 | done | steht |
| [[REQ-072]] | Eigene Notizen | Spieler | [[F-027 Eigene Inhalte der Spielenden\|Eigene Inhalte der Spielenden]] | 2 | 2 | defined | offen |
| [[REQ-073]] | Eigene Anordnung des Bogens je Nutzer | – | [[F-023 Charakterbogen\|Charakterbogen]] | 4 | 5 | dropped | ersetzt |
| [[REQ-074]] | Schnellzugriffe | Spieler | [[F-025 Spieleransicht & Telefon\|Spieleransicht & Telefon]] | 3 | 1 | in progress | teils |
| [[REQ-075]] | Die Kampagne als Wurzel | Spielleitung | [[F-029 Kampagne\|Kampagne]] | 1 | 3 | done | steht |
| [[REQ-076]] | Geschichte gliedern | Spielleitung | [[F-030 Bereich Story\|Bereich Story]] | 1 | 3 | done | steht |
| [[REQ-077]] | Sitzungen mit Geplantem und Geschehenem | Spielleitung | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 2 | 3 | done | steht |
| [[REQ-078]] | Vorbereitungsseite | Spielleitung | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 2 | 5 | done | steht |
| [[REQ-079]] | Schnelle Aktionen in der Sitzung | Spielleitung | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 2 | 3 | in progress | teils |
| [[REQ-080]] | Vorlesetexte nach der Sitzung freigeben | Spielleitung | [[F-030 Bereich Story\|Bereich Story]] | 3 | 2 | defined | offen |
| [[REQ-081]] | Ruf, der sich ausbreitet | – | [[F-039 Beziehungen & Ruf\|Beziehungen & Ruf]] | 4 | 8 | dropped | ersetzt |
| [[REQ-082]] | Quests mit Aufgaben und Lohn | Spielleitung | [[F-030 Bereich Story\|Bereich Story]] | 3 | 3 | done | steht |
| [[REQ-083]] | Eigene Quests und Ziele | Spieler | [[F-027 Eigene Inhalte der Spielenden\|Eigene Inhalte der Spielenden]] | 3 | 1 | defined | offen |
| [[REQ-084]] | Ideen und Unfertiges | Spielleitung | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 3 | 3 | done | steht |
| [[REQ-085]] | Begegnungen | Spielleitung | [[F-032 Begegnungen\|Begegnungen]] | 2 | 3 | done | steht |
| [[REQ-086]] | Gruppenübersicht | Spielleitung | [[F-034 Party\|Party]] | 3 | 3 | in progress | teils |
| [[REQ-087]] | Kalendermodul | Spielleitung | [[F-038 Kalender & Zeitleisten\|Kalender & Zeitleisten]] | 5 | 13 | idea | offen |
| [[REQ-088]] | Massenänderungen an Wissen und Rechten | Spielleitung | [[F-016 Werkbank\|Werkbank]] | 3 | 3 | in progress | teils |
| [[REQ-089]] | Regeln als Artikel | Spielleitung | [[F-042 Bereich Rules & Kompendium\|Bereich Rules & Kompendium]] | 1 | 2 | done | steht |
| [[REQ-090]] | Regeln aus Obsidian und 5e.tools einlesen | – | [[F-073 5e.tools-Import\|5e.tools-Import]] | 2 | 3 | dropped | verworfen |
| [[REQ-091]] | Regeln durchsuchen | Spieler | [[F-042 Bereich Rules & Kompendium\|Bereich Rules & Kompendium]] | 2 | 5 | done | steht |
| [[REQ-092]] | Zauber als Artikel | Spieler | [[F-045 Zauber\|Zauber]] | 2 | 3 | defined | offen |
| [[REQ-093]] | Regeln auswerten | Spielleitung | [[F-046 Regelauswertung\|Regelauswertung]] | 5 | 13 | idea | offen |
| [[REQ-094]] | Regeln an Artikel hängen | Spielleitung | [[F-042 Bereich Rules & Kompendium\|Bereich Rules & Kompendium]] | 2 | 3 | done | steht |
| [[REQ-095]] | Gewährtes anwenden | Spieler | [[F-046 Regelauswertung\|Regelauswertung]] | 4 | 8 | defined | offen |
| [[REQ-096]] | Einschränkungen prüfen | Spielleitung | [[F-046 Regelauswertung\|Regelauswertung]] | 5 | 8 | idea | offen |
| [[REQ-097]] | Zauberlisten | Spieler | [[F-045 Zauber\|Zauber]] | 3 | 2 | defined | offen |
| [[REQ-098]] | Regel in Sekunden | Spieler | [[F-042 Bereich Rules & Kompendium\|Bereich Rules & Kompendium]] | 2 | 2 | done | steht |
| [[REQ-099]] | Regeln anheften | Spieler | [[F-042 Bereich Rules & Kompendium\|Bereich Rules & Kompendium]] | 3 | 1 | done | steht |
| [[REQ-100]] | Welt als Ebene | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 1 | 2 | in progress | teils |
| [[REQ-101]] | Lore-Artikel | Spielleitung | [[F-037 Bereich World\|Bereich World]] | 2 | 3 | done | steht |
| [[REQ-102]] | Artikel je Stapel und Wissen zeichnen | Spieler | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 2 | 5 | in progress | teils |
| [[REQ-103]] | Orte mit Hierarchie | Spielleitung | [[F-037 Bereich World\|Bereich World]] | 2 | 2 | done | steht |
| [[REQ-104]] | Fraktionen | Spielleitung | [[F-037 Bereich World\|Bereich World]] | 2 | 2 | done | steht |
| [[REQ-105]] | NSC-Verzeichnis | Spielleitung | [[F-020 Kreatur\|Kreatur]] | 3 | 2 | done | steht |
| [[REQ-106]] | Ereignisse und Zeitleisten | Spielleitung | [[F-038 Kalender & Zeitleisten\|Kalender & Zeitleisten]] | 3 | 3 | done | steht |
| [[REQ-107]] | Gottheiten und Pantheons | Spielleitung | [[F-037 Bereich World\|Bereich World]] | 4 | 1 | defined | offen |
| [[REQ-108]] | Lore der Kampagne abweichen lassen | Spielleitung | [[F-005 Fassungen & Varianten\|Fassungen & Varianten]] | 3 | 3 | done | steht |
| [[REQ-109]] | Lore-Texte von Spielenden | Spieler | [[F-027 Eigene Inhalte der Spielenden\|Eigene Inhalte der Spielenden]] | 3 | 3 | in progress | teils |
| [[REQ-110]] | Illustrierte Bibliothek | Spieler | [[F-037 Bereich World\|Bereich World]] | 5 | 8 | idea | offen |
| [[REQ-111]] | Boards | Spielleitung | [[F-067 Boards\|Boards]] | 2 | 8 | done | steht |
| [[REQ-112]] | Widget mit mehreren offenen Artikeln | – | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 2 | 3 | dropped | ersetzt |
| [[REQ-113]] | Notiz-Widget | Spielleitung | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 2 | 2 | defined | offen |
| [[REQ-114]] | Schnellanlage auf dem Schirm | Spielleitung | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 2 | 3 | in progress | teils |
| [[REQ-115]] | Initiative | Spielleitung | [[F-051 Initiative\|Initiative]] | 2 | 5 | done | steht |
| [[REQ-116]] | Was gerade läuft, steht an der Sitzung | Spielleitung | [[F-052 Sitzungszustand & Live-Kanal\|Sitzungszustand & Live-Kanal]] | 2 | 8 | done | steht |
| [[REQ-117]] | Wer am Sitzungszustand schreibt | Spielleitung | [[F-052 Sitzungszustand & Live-Kanal\|Sitzungszustand & Live-Kanal]] | 3 | 3 | done | steht |
| [[REQ-118]] | Begegnung starten | Spielleitung | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 3 | 5 | done | steht |
| [[REQ-119]] | Boards der Spielenden | Spieler | [[F-067 Boards\|Boards]] | 3 | 3 | defined | offen |
| [[REQ-120]] | Spielprotokoll | Spielleitung | [[F-052 Sitzungszustand & Live-Kanal\|Sitzungszustand & Live-Kanal]] | 3 | 3 | in progress | teils |
| [[REQ-121]] | Statistik | Spieler | [[F-052 Sitzungszustand & Live-Kanal\|Sitzungszustand & Live-Kanal]] | 4 | 3 | defined | offen |
| [[REQ-122]] | Gruppe als Widget | Spielleitung | [[F-034 Party\|Party]] | 3 | 2 | done | steht |
| [[REQ-123]] | Timer | Spielleitung | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 3 | 1 | defined | offen |
| [[REQ-124]] | Auftragsbrett als Widget | Spieler | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 3 | 2 | done | steht |
| [[REQ-125]] | Zufallstabellen | Spielleitung | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 3 | 5 | done | steht |
| [[REQ-126]] | Musik einbinden | Spielleitung | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 4 | 2 | in progress | teils |
| [[REQ-127]] | Eigene Klangtafel | Spielleitung | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 5 | 13 | idea | offen |
| [[REQ-128]] | Kampf aus Sicht der Spielenden | Spieler | [[F-051 Initiative\|Initiative]] | 3 | 3 | in progress | teils |
| [[REQ-129]] | Fragen an einen Assistenten | Spielleitung | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 5 | 8 | idea | offen |
| [[REQ-130]] | Karte mit Gitter und Massstab | Spielleitung | [[F-055 Karte & Kartenebenen\|Karte & Kartenebenen]] | 3 | 2 | done | steht |
| [[REQ-131]] | Unterkarten zum Hineinzoomen | Spielleitung | [[F-055 Karte & Kartenebenen\|Karte & Kartenebenen]] | 3 | 8 | done | steht |
| [[REQ-132]] | Kartenebene festhalten | Spielleitung | [[F-055 Karte & Kartenebenen\|Karte & Kartenebenen]] | 3 | 1 | defined | offen |
| [[REQ-133]] | Marker, die zu Artikeln führen | Spielleitung | [[F-056 Tokens & Marker\|Tokens & Marker]] | 3 | 3 | done | steht |
| [[REQ-134]] | Kulisse auf der Karte | Spielleitung | [[F-056 Tokens & Marker\|Tokens & Marker]] | 4 | 3 | done | steht |
| [[REQ-135]] | Tokens im Spiel | Spielleitung | [[F-056 Tokens & Marker\|Tokens & Marker]] | 3 | 5 | in progress | teils |
| [[REQ-136]] | Gruppe und Quests auf der Karte | Spieler | [[F-056 Tokens & Marker\|Tokens & Marker]] | 3 | 2 | done | steht |
| [[REQ-137]] | Hervorhebungen nach Abfrage | Spielleitung | [[F-059 Gebiete & Overlays\|Gebiete & Overlays]] | 4 | 5 | in progress | teils |
| [[REQ-138]] | Grosse Karten in Kacheln | Spieler | [[F-055 Karte & Kartenebenen\|Karte & Kartenebenen]] | 4 | 5 | done | steht |
| [[REQ-139]] | Nebel | Spielleitung | [[F-057 Nebel, Licht & Sicht\|Nebel, Licht & Sicht]] | 4 | 8 | done | steht |
| [[REQ-140]] | Licht und Sicht mit Wänden | Spielleitung | [[F-057 Nebel, Licht & Sicht\|Nebel, Licht & Sicht]] | 5 | 13 | done | steht |
| [[REQ-141]] | Effekte auf der Karte | Spielleitung | [[F-061 Karteneditor\|Karteneditor]] | 5 | 8 | idea | offen |
| [[REQ-142]] | Auf Karten zeichnen | Spielleitung | [[F-061 Karteneditor\|Karteneditor]] | 5 | 8 | idea | offen |
| [[REQ-143]] | Karteneditor | Spielleitung | [[F-061 Karteneditor\|Karteneditor]] | 5 | 13 | idea | offen |
| [[REQ-144]] | Initiative auf der Karte | Spieler | [[F-051 Initiative\|Initiative]] | 4 | 2 | done | steht |
| [[REQ-145]] | Ablage in der Seite | Spielleitung | [[F-062 Asset-Ablage\|Asset-Ablage]] | 1 | 3 | in progress | teils |
| [[REQ-146]] | Grosse Dateien auf dem NAS | Verwaltung | [[F-062 Asset-Ablage\|Asset-Ablage]] | 2 | 5 | defined | offen |
| [[REQ-147]] | Bilder hochladen | Spielleitung | [[F-063 Bildverwaltung\|Bildverwaltung]] | 2 | 2 | in progress | teils |
| [[REQ-148]] | Bilder von aussen | Spielleitung | [[F-062 Asset-Ablage\|Asset-Ablage]] | 3 | 1 | done | steht |
| [[REQ-149]] | PDF mit Seitensprung | Spieler | [[F-066 PDF & OCR\|PDF & OCR]] | 4 | 5 | defined | offen |
| [[REQ-150]] | Audio ablegen | Spielleitung | [[F-062 Asset-Ablage\|Asset-Ablage]] | 5 | 2 | idea | offen |
| [[REQ-151]] | 3D-Dateien | Spielleitung | [[F-062 Asset-Ablage\|Asset-Ablage]] | 5 | 8 | idea | offen |
| [[REQ-152]] | Texte aus PDF erkennen | Spielleitung | [[F-066 PDF & OCR\|PDF & OCR]] | 5 | 13 | idea | offen |
| [[REQ-153]] | Deutsche Oberfläche | – | [[F-072 Design & Stilkonzept\|Design & Stilkonzept]] | 2 | 2 | dropped | ersetzt |
| [[REQ-154]] | Ausrollen nach dev und prod | Verwaltung | [[F-017 Ausrollen & Sicherung\|Ausrollen & Sicherung]] | 1 | 3 | done | steht |
| [[REQ-155]] | Sicherungen | Verwaltung | [[F-017 Ausrollen & Sicherung\|Ausrollen & Sicherung]] | 2 | 2 | done | steht |
| [[REQ-156]] | Sichtbarkeit vererben | – | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 2 | 2 | dropped | verworfen |
| [[REQ-157]] | Frei anordnen auf dem Board | Spielleitung | [[F-067 Boards\|Boards]] | 2 | 8 | done | steht |
| [[REQ-158]] | Ansicht je Platzierung | Spielleitung | [[F-067 Boards\|Boards]] | 2 | 3 | done | steht |
| [[REQ-159]] | Anker und Bereiche auf dem Board | Spielleitung | [[F-067 Boards\|Boards]] | 3 | 3 | done | steht |
| [[REQ-160]] | Zwischen Ankern springen | Spielleitung | [[F-067 Boards\|Boards]] | 3 | 2 | in progress | teils |
| [[REQ-161]] | Regeln für die Darstellung | Spielleitung | [[F-067 Boards\|Boards]] | 2 | 5 | done | steht |
| [[REQ-162]] | Semantischer Zoom | Spielleitung | [[F-067 Boards\|Boards]] | 4 | 5 | defined | offen |
| [[REQ-163]] | Bezeichner ohne Bedeutung | Spielleitung | [[F-001 Artikelmodell\|Artikelmodell]] | 1 | 1 | done | steht |
| [[REQ-164]] | Darstellungsstufen als eigenes System | – | [[F-006 Ansichten & Anordnung\|Ansichten & Anordnung]] | 2 | 3 | dropped | ersetzt |
| [[REQ-165]] | Bilder, Formen und Werkzeuge auf dem Board | Spielleitung | [[F-067 Boards\|Boards]] | 2 | 3 | done | steht |
| [[REQ-166]] | Auf dem Board anlegen | Spielleitung | [[F-067 Boards\|Boards]] | 2 | 2 | in progress | teils |
| [[REQ-167]] | Drucken | Spielleitung | [[F-065 Druck & Ausfuhr\|Druck & Ausfuhr]] | 3 | 5 | defined | offen |
| [[REQ-168]] | Point-Crawl | Spielleitung | [[F-060 Reisen & Erkundung\|Reisen & Erkundung]] | 3 | 5 | done | steht |
| [[REQ-169]] | Erkundungsstand | Spieler | [[F-060 Reisen & Erkundung\|Reisen & Erkundung]] | 3 | 3 | done | steht |
| [[REQ-170]] | Vorräte auf Reisen | Spielleitung | [[F-060 Reisen & Erkundung\|Reisen & Erkundung]] | 4 | 2 | done | steht |
| [[REQ-171]] | Aktionen je Knoten | Spieler | [[F-060 Reisen & Erkundung\|Reisen & Erkundung]] | 4 | 3 | done | steht |
| [[REQ-172]] | Begegnungstabellen je Gebiet | Spielleitung | [[F-032 Begegnungen\|Begegnungen]] | 3 | 3 | done | steht |
| [[REQ-173]] | Weltzustand zwischen Sitzungen | Spielleitung | [[F-032 Begegnungen\|Begegnungen]] | 4 | 3 | idea | offen |
| [[REQ-174]] | Regeltexte mit Platzhaltern | Spielleitung | [[F-007 Verweise & Platzhalter\|Verweise & Platzhalter]] | 2 | 3 | done | steht |
| [[REQ-175]] | Regelbegriffe im Text erkennen | Spieler | [[F-007 Verweise & Platzhalter\|Verweise & Platzhalter]] | 3 | 2 | done | steht |
| [[REQ-176]] | Ähnliches vor dem Anlegen vorschlagen | Spielleitung | [[F-007 Verweise & Platzhalter\|Verweise & Platzhalter]] | 3 | 3 | in progress | teils |
| [[REQ-177]] | Einzelne Felder freigeben | Spielleitung | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 2 | 3 | done | steht |
| [[REQ-178]] | Decknamen | Spielleitung | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 3 | 1 | done | steht |
| [[REQ-179]] | Zeigen, dass es mehr gibt | Spieler | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 4 | 1 | done | steht |
| [[REQ-180]] | Gepflanzte Fäden | Spielleitung | [[F-030 Bereich Story\|Bereich Story]] | 3 | 3 | idea | offen |
| [[REQ-181]] | Freie Felder an einem einzelnen Artikel | Spielleitung | [[F-001 Artikelmodell\|Artikelmodell]] | 2 | 3 | done | steht |
| [[REQ-182]] | Kanten lesen sich von beiden Enden | Spielleitung | [[F-001 Artikelmodell\|Artikelmodell]] | 2 | 1 | done | steht |
| [[REQ-183]] | Gruppeninventar | Spieler | [[F-026 Inventar\|Inventar]] | 3 | 2 | done | steht |
| [[REQ-184]] | Handwerk mit Rezepten | Spieler | [[F-047 Handwerk\|Handwerk]] | 4 | 5 | done | steht |
| [[REQ-185]] | Andere Währungen und Tausch | Spielleitung | [[F-040 Läden & Wirtschaft\|Läden & Wirtschaft]] | 5 | 2 | idea | offen |
| [[REQ-186]] | Verschachtelte Tabellen | Spielleitung | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 3 | 2 | done | steht |
| [[REQ-187]] | Tischanzeige | Spielleitung | [[F-050 Spielleiter-Schirm\|Spielleiter-Schirm]] | 3 | 2 | idea | offen |
| [[REQ-188]] | Übersicht über alles Unfertige | Spielleitung | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 3 | 2 | done | steht |
| [[REQ-189]] | Gesammelte Todos | Spielleitung | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 3 | 2 | done | steht |
| [[REQ-190]] | Schnellerfassung im Spiel | Spielleitung | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 3 | 2 | done | steht |
| [[REQ-191]] | Nichts still überschreiben | Spielleitung | [[F-009 Verlauf & gleichzeitiges Schreiben\|Verlauf & gleichzeitiges Schreiben]] | 1 | 2 | done | steht |
| [[REQ-192]] | Gleichzeitig bearbeiten ohne Verlust | Spielleitung | [[F-009 Verlauf & gleichzeitiges Schreiben\|Verlauf & gleichzeitiges Schreiben]] | 2 | 3 | done | steht |
| [[REQ-193]] | Gebiete auf der Karte | Spielleitung | [[F-059 Gebiete & Overlays\|Gebiete & Overlays]] | 4 | 3 | done | steht |
| [[REQ-194]] | Untere Leiste am Telefon wählen | Spieler | [[F-025 Spieleransicht & Telefon\|Spieleransicht & Telefon]] | 4 | 1 | idea | offen |
| [[REQ-195]] | Statblock nach Obsidian ausführen | Spielleitung | [[F-065 Druck & Ausfuhr\|Druck & Ausfuhr]] | 4 | 2 | idea | offen |
| [[REQ-196]] | Sitzung aufnehmen | Spielleitung | [[F-036 Sitzungsmitschnitt\|Sitzungsmitschnitt]] | 4 | 5 | idea | offen |
| [[REQ-197]] | Transkript und Recap-Entwurf | Spielleitung | [[F-036 Sitzungsmitschnitt\|Sitzungsmitschnitt]] | 4 | 8 | idea | offen |
| [[REQ-198]] | Sprecher im Transkript | Spielleitung | [[F-036 Sitzungsmitschnitt\|Sitzungsmitschnitt]] | 5 | 5 | idea | offen |
| [[REQ-199]] | Produktionsdaten nach dev spiegeln | Verwaltung | [[F-017 Ausrollen & Sicherung\|Ausrollen & Sicherung]] | 3 | 3 | done | steht |
| [[REQ-200]] | Chat mit der Leitung und unter Spielenden | Spieler | [[F-028 Chat\|Chat]] | 3 | 5 | idea | offen |
| [[REQ-201]] | Aus dem Chat wird Inhalt | Spielleitung | [[F-028 Chat\|Chat]] | 3 | 3 | idea | offen |
| [[REQ-202]] | Chats bleiben privat | Spieler | [[F-028 Chat\|Chat]] | 2 | 2 | idea | offen |
| [[REQ-203]] | Wissen nach Rang in einer Fraktion | Spielleitung | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 2 | 2 | done | steht |
| [[REQ-204]] | Spielleiter-Schirm | Spielleitung | [[F-050 Spielleiter-Schirm\|Spielleiter-Schirm]] | 3 | 5 | idea | offen |
| [[REQ-205]] | Ein Board je Geschichtsartikel | Spielleitung | [[F-050 Spielleiter-Schirm\|Spielleiter-Schirm]] | 3 | 3 | in progress | teils |
| [[REQ-206]] | Bewegungsrechner | Spielleitung | [[F-058 Bewegung & Zonen\|Bewegung & Zonen]] | 3 | 3 | done | steht |
| [[REQ-207]] | Pfad mit Wegpunkten | Spieler | [[F-058 Bewegung & Zonen\|Bewegung & Zonen]] | 3 | 2 | done | steht |
| [[REQ-208]] | Zonen mit eigenen Regeln | Spielleitung | [[F-058 Bewegung & Zonen\|Bewegung & Zonen]] | 3 | 5 | in progress | teils |
| [[REQ-209]] | Aufdecken von Hand oder entlang des Pfads | Spielleitung | [[F-057 Nebel, Licht & Sicht\|Nebel, Licht & Sicht]] | 3 | 3 | done | steht |
| [[REQ-210]] | Karte und Initiative im Vollbild | Spielleitung | [[F-058 Bewegung & Zonen\|Bewegung & Zonen]] | 3 | 3 | in progress | teils |
| [[REQ-211]] | Initiative wie Improved Initiative | Spielleitung | [[F-051 Initiative\|Initiative]] | 2 | 3 | done | steht |
| [[REQ-212]] | Zustände und Notizen mit Dauer | Spielleitung | [[F-051 Initiative\|Initiative]] | 2 | 2 | done | steht |
| [[REQ-213]] | Initiative der Spielenden | Spieler | [[F-051 Initiative\|Initiative]] | 3 | 2 | done | steht |
| [[REQ-214]] | Ausrüstungsfigur | Spieler | [[F-026 Inventar\|Inventar]] | 4 | 2 | done | steht |
| [[REQ-215]] | Tragraster aus Grösse und Stärke | Spieler | [[F-026 Inventar\|Inventar]] | 3 | 2 | done | steht |
| [[REQ-216]] | Behälter in Behältern | Spieler | [[F-026 Inventar\|Inventar]] | 3 | 2 | done | steht |
| [[REQ-217]] | Ziehen am Bogen | Spieler | [[F-026 Inventar\|Inventar]] | 3 | 2 | done | steht |
| [[REQ-218]] | Blaupausen lernen | Spieler | [[F-047 Handwerk\|Handwerk]] | 3 | 2 | done | steht |
| [[REQ-219]] | Material beim Start binden | Spieler | [[F-047 Handwerk\|Handwerk]] | 3 | 2 | done | steht |
| [[REQ-220]] | Zeitleisten der Weltgeschichte | Spielleitung | [[F-038 Kalender & Zeitleisten\|Kalender & Zeitleisten]] | 3 | 3 | done | steht |
| [[REQ-221]] | Begegnungen bauen | Spielleitung | [[F-032 Begegnungen\|Begegnungen]] | 3 | 3 | idea | offen |
| [[REQ-222]] | Stufenaufstieg mit Wahlen | Spieler | [[F-024 Charaktermanager\|Charaktermanager]] | 4 | 5 | idea | offen |
| [[REQ-223]] | Rahmen für Regelsysteme wie Taverne | Spielleitung | [[F-048 Regelsysteme & Module\|Regelsysteme & Module]] | 4 | 5 | idea | offen |
| [[REQ-224]] | Kreaturen nach Grösse auf der Karte | Spielleitung | [[F-056 Tokens & Marker\|Tokens & Marker]] | 3 | 3 | done | steht |
| [[REQ-225]] | Fallenlassen und Verstauen | Spieler | [[F-026 Inventar\|Inventar]] | 3 | 1 | done | steht |
| [[REQ-226]] | Gegner erscheinen in Runde 1 erst in ihrem Zug | Spieler | [[F-051 Initiative\|Initiative]] | 3 | 1 | done | steht |
| [[REQ-227]] | Masse im Fliesstext umrechnen | Spieler | [[F-049 Masse & Einheiten\|Masse & Einheiten]] | 3 | 2 | idea | offen |
| [[REQ-228]] | Verlorene Einladung neu ausgeben | Spielleitung | [[F-010 Anmeldung & Konten\|Anmeldung & Konten]] | 4 | 1 | idea | offen |
| [[REQ-229]] | Konten in der Seite verwalten | Verwaltung | [[F-010 Anmeldung & Konten\|Anmeldung & Konten]] | 3 | 2 | idea | offen |
| [[REQ-230]] | Register in der Seite bearbeiten | Spielleitung | [[F-002 Register\|Register]] | 2 | 5 | done | steht |
| [[REQ-231]] | Klassen wie im Buch | Spieler | [[F-044 Klassen\|Klassen]] | 3 | 3 | done | steht |
| [[REQ-232]] | Listen rechnet der Server | Spieler | [[F-019 Leistung & Laden\|Leistung & Laden]] | 2 | 5 | done | steht |
| [[REQ-233]] | 5e.tools über eine Pipeline laden | Verwaltung | [[F-073 5e.tools-Import\|5e.tools-Import]] | 3 | 3 | done | steht |
| [[REQ-234]] | API-Tokens für Werkzeuge | Verwaltung | [[F-015 API-Tokens & Werkzeugzugang\|API-Tokens & Werkzeugzugang]] | 3 | 2 | done | steht |
| [[REQ-235]] | Werkbank: Prüfungen und Massenänderungen | Spielleitung | [[F-016 Werkbank\|Werkbank]] | 3 | 5 | done | steht |
| [[REQ-236]] | Kampagne mit Dialog anlegen | Spielleitung | [[F-029 Kampagne\|Kampagne]] | 2 | 3 | defined | offen |
| [[REQ-237]] | Spielende legen Artikel an, die Leitung gibt frei | Spieler | [[F-013 Schreibrechte & Freigabe\|Schreibrechte & Freigabe]] | 2 | 5 | done | steht |
| [[REQ-238]] | Figur aus den Artikeln erstellen | Spieler | [[F-024 Charaktermanager\|Charaktermanager]] | 1 | 13 | done | steht |
| [[REQ-239]] | Jedes Buch eine Ebene | Spielleitung | [[F-073 5e.tools-Import\|5e.tools-Import]] | 2 | 3 | done | steht |
| [[REQ-240]] | Abenteuer als eigene Ebene | Spielleitung | [[F-033 Abenteuer übernehmen\|Abenteuer übernehmen]] | 2 | 13 | done | steht |
| [[REQ-241]] | Die Sicht eines Spielers einnehmen | Spielleitung | [[F-014 Sicht eines Spielers\|Sicht eines Spielers]] | 1 | 5 | done | steht |
| [[REQ-242]] | Felder der eigenen Figur sperren | Spielleitung | [[F-013 Schreibrechte & Freigabe\|Schreibrechte & Freigabe]] | 3 | 5 | defined | offen |
| [[REQ-243]] | Alle Inhalte als abschaltbare Ebenen | Spielleitung | [[F-073 5e.tools-Import\|5e.tools-Import]] | 2 | 8 | done | steht |
| [[REQ-244]] | Ebenen gruppieren | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 2 | 3 | done | steht |
| [[REQ-245]] | Ebenen beschreiben sich selbst | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 2 | 2 | done | steht |
| [[REQ-246]] | Navigation ohne Einfrieren | Spieler | [[F-019 Leistung & Laden\|Leistung & Laden]] | 1 | 5 | done | steht |
| [[REQ-247]] | Bücher lesen | Spieler | [[F-043 Bücher & Leseansicht\|Bücher & Leseansicht]] | 2 | 8 | done | steht |
| [[REQ-248]] | Kurzansicht überall | Spieler | [[F-070 Navigation & Kurzansicht\|Navigation & Kurzansicht]] | 2 | 5 | done | steht |
| [[REQ-249]] | Ebenen nach Herausgeber | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 2 | 3 | in progress | teils |
| [[REQ-250]] | Startausrüstung je Kampagne | Spielleitung | [[F-024 Charaktermanager\|Charaktermanager]] | 2 | 5 | done | steht |
| [[REQ-251]] | Sprachen der Kampagne | Spielleitung | [[F-024 Charaktermanager\|Charaktermanager]] | 1 | 2 | done | steht |
| [[REQ-252]] | Abenteuer modular übernehmen | Spielleitung | [[F-033 Abenteuer übernehmen\|Abenteuer übernehmen]] | 2 | 5 | done | steht |
| [[REQ-253]] | Ebenen und Artikel kopieren | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 3 | 5 | defined | offen |
| [[REQ-254]] | Namensgenerator | Spielleitung | [[F-041 Namensgenerator\|Namensgenerator]] | 4 | 3 | defined | offen |
| [[REQ-255]] | Ebenen teilweise aufschalten | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 2 | 3 | done | steht |
| [[REQ-256]] | Ansichten ohne Code definieren | Spielleitung | [[F-006 Ansichten & Anordnung\|Ansichten & Anordnung]] | 1 | 8 | done | steht |
| [[REQ-257]] | Kanten verständlich | Spielleitung | [[F-008 Kanten verstehen\|Kanten verstehen]] | 2 | 5 | done | steht |
| [[REQ-258]] | Verweisfeld nennt, welche Artikel es annimmt | Spielleitung | [[F-003 Feldformen & Aufzählungen\|Feldformen & Aufzählungen]] | 2 | 2 | in progress | teils |
| [[REQ-259]] | Vorgabewerte für Felder | Spielleitung | [[F-003 Feldformen & Aufzählungen\|Feldformen & Aufzählungen]] | 3 | 1 | done | steht |
| [[REQ-260]] | Ausgehende Kanten im Register sehen | Spielleitung | [[F-002 Register\|Register]] | 3 | 1 | done | steht |
| [[REQ-261]] | Sorte einer Art als freies Feld mit Vorschlägen | Spielleitung | [[F-003 Feldformen & Aufzählungen\|Feldformen & Aufzählungen]] | 2 | 1 | done | steht |
| [[REQ-262]] | Flache Typenlisten | Spielleitung | [[F-002 Register\|Register]] | 3 | 1 | done | steht |
| [[REQ-263]] | Was eine Einstellung im Register auslöst | Spielleitung | [[F-002 Register\|Register]] | 3 | 1 | done | steht |
| [[REQ-264]] | Vergleichsebenen der Kampagne | Spielleitung | [[F-005 Fassungen & Varianten\|Fassungen & Varianten]] | 2 | 3 | in progress | teils |
| [[REQ-265]] | Register zeigt einen Typ auf einer Fläche | Spielleitung | [[F-002 Register\|Register]] | 2 | 3 | done | steht |
| [[REQ-266]] | Demo-Zugang | Verwaltung | [[F-010 Anmeldung & Konten\|Anmeldung & Konten]] | 5 | 3 | defined | offen |
| [[REQ-267]] | Eigenes Netz-VPS mit VPN | Verwaltung | [[F-017 Ausrollen & Sicherung\|Ausrollen & Sicherung]] | 5 | 3 | defined | offen |
| [[REQ-268]] | Dev-Token aus der Werkbank erzeugen | Verwaltung | [[F-015 API-Tokens & Werkzeugzugang\|API-Tokens & Werkzeugzugang]] | 3 | 1 | in progress | teils |
| [[REQ-269]] | Ankündigen, wann produktiv gearbeitet werden kann | Verwaltung | [[F-017 Ausrollen & Sicherung\|Ausrollen & Sicherung]] | 2 | 1 | in progress | teils |
| [[REQ-270]] | Artikel von dev nach prod übernehmen | Spielleitung | [[F-018 Übernahme dev - prod\|Übernahme dev ↔ prod]] | 2 | 5 | in progress | teils |
| [[REQ-271]] | Konflikte bei der Übernahme nebeneinander lösen | Spielleitung | [[F-018 Übernahme dev - prod\|Übernahme dev ↔ prod]] | 3 | 5 | defined | offen |
| [[REQ-272]] | Statblock als Instanz einer Vorlage | Spielleitung | [[F-021 Statblock\|Statblock]] | 1 | 3 | done | steht |
| [[REQ-273]] | Eigene Verfahren für Attributswerte | Spielleitung | [[F-024 Charaktermanager\|Charaktermanager]] | 2 | 2 | done | steht |
| [[REQ-274]] | Charakter- und Kampagnenmanager jederzeit aufrufen | Spieler | [[F-024 Charaktermanager\|Charaktermanager]] | 3 | 5 | defined | offen |
| [[REQ-275]] | Erhaltene Gegenstände als Instanz | Spieler | [[F-026 Inventar\|Inventar]] | 2 | 3 | in progress | teils |
| [[REQ-276]] | Unverstaute Gegenstände gelten als liegengelassen | Spielleitung | [[F-026 Inventar\|Inventar]] | 4 | 2 | defined | offen |
| [[REQ-277]] | Gegenstände mit Form spiegeln | Spieler | [[F-026 Inventar\|Inventar]] | 4 | 1 | defined | offen |
| [[REQ-278]] | Bereiche als eigene Seiten | Spielleitung | [[F-029 Kampagne\|Kampagne]] | 1 | 2 | done | steht |
| [[REQ-279]] | Kampagnenwerte pflegen und in Texten nutzen | Spielleitung | [[F-029 Kampagne\|Kampagne]] | 2 | 2 | in progress | teils |
| [[REQ-280]] | Umschalter Vorbereitung und Spiel | Spielleitung | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 4 | 2 | defined | offen |
| [[REQ-281]] | Eine Party je Kampagne | Spielleitung | [[F-034 Party\|Party]] | 1 | 2 | done | steht |
| [[REQ-282]] | Sitzungsansicht für das Spiel | Spielleitung | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 2 | 3 | defined | offen |
| [[REQ-283]] | Kampagnen-Ladebildschirm | Spieler | [[F-035 Ladebildschirm-Board\|Ladebildschirm-Board]] | 3 | 3 | defined | offen |
| [[REQ-284]] | Läden mit Waren und Preisen | Spielleitung | [[F-040 Läden & Wirtschaft\|Läden & Wirtschaft]] | 2 | 3 | done | steht |
| [[REQ-285]] | Fraktionspreise | Spielleitung | [[F-040 Läden & Wirtschaft\|Läden & Wirtschaft]] | 3 | 2 | in progress | teils |
| [[REQ-286]] | Artikel nachts auf Vollständigkeit prüfen | Spielleitung | [[F-076 Artikelprüfung & Nachtarbeit\|Artikelprüfung & Nachtarbeit]] | 3 | 3 | done | steht |
| [[REQ-287]] | Regelsysteme als Behälter mit Optionen | Spielleitung | [[F-048 Regelsysteme & Module\|Regelsysteme & Module]] | 2 | 8 | defined | offen |
| [[REQ-288]] | Preise für jeden Gegenstand | Spielleitung | [[F-077 KI-Inhalte\|KI-Inhalte]] | 3 | 3 | in progress | teils |
| [[REQ-289]] | Homebrew-Regeln erfassen | Spielleitung | [[F-048 Regelsysteme & Module\|Regelsysteme & Module]] | 3 | 3 | defined | offen |
| [[REQ-290]] | Wechselwirkungen von Regeln auswerten | Spielleitung | [[F-046 Regelauswertung\|Regelauswertung]] | 4 | 8 | defined | offen |
| [[REQ-291]] | Leseansicht auf dem Board | Spielleitung | [[F-067 Boards\|Boards]] | 3 | 3 | defined | offen |
| [[REQ-292]] | Neuen Artikel aus einer Auswahl anlegen | Spielleitung | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 2 | 2 | in progress | teils |
| [[REQ-293]] | Ladeanzeige für Kartenbilder | Spielleitung | [[F-055 Karte & Kartenebenen\|Karte & Kartenebenen]] | 3 | 1 | done | steht |
| [[REQ-294]] | Token ohne Bild zeigt den Anfangsbuchstaben | Spielleitung | [[F-056 Tokens & Marker\|Tokens & Marker]] | 3 | 1 | in progress | teils |
| [[REQ-295]] | Bild ersetzen als Fassung oder neue Quelle | Spielleitung | [[F-063 Bildverwaltung\|Bildverwaltung]] | 3 | 2 | defined | offen |
| [[REQ-296]] | Bildklassen | Spielleitung | [[F-063 Bildverwaltung\|Bildverwaltung]] | 3 | 2 | in progress | teils |
| [[REQ-297]] | Bilder aus 5e.tools einlesen und verknüpfen | Spielleitung | [[F-063 Bildverwaltung\|Bildverwaltung]] | 3 | 5 | defined | offen |
| [[REQ-298]] | Bilder bearbeiten und Tokens zusammenstellen | Spielleitung | [[F-064 Token-Werkstatt\|Token-Werkstatt]] | 4 | 8 | defined | offen |
| [[REQ-299]] | Optionale Felder verdeckt | Spielleitung | [[F-071 Bearbeiten in der Ansicht\|Bearbeiten in der Ansicht]] | 3 | 2 | in progress | teils |
| [[REQ-300]] | Gestaltung wie die Bücher | Spielleitung | [[F-072 Design & Stilkonzept\|Design & Stilkonzept]] | 3 | 3 | in progress | teils |
| [[REQ-301]] | Stilkonzept in der Verwaltung anpassen | Verwaltung | [[F-072 Design & Stilkonzept\|Design & Stilkonzept]] | 4 | 3 | defined | offen |
| [[REQ-302]] | Der Filter gehört der Seite | Spielleitung | [[F-069 Filter & Filtergruppen\|Filter & Filtergruppen]] | 3 | 1 | done | steht |
| [[REQ-303]] | Filtergruppen je Seite | Spielleitung | [[F-069 Filter & Filtergruppen\|Filter & Filtergruppen]] | 2 | 3 | done | steht |
| [[REQ-304]] | Übergreifende Suche beim Tippen | Spieler | [[F-068 Suche\|Suche]] | 1 | 3 | done | steht |
| [[REQ-305]] | Kampagne und Ebene immer sichtbar | Spielleitung | [[F-070 Navigation & Kurzansicht\|Navigation & Kurzansicht]] | 2 | 2 | done | steht |
| [[REQ-306]] | Lesbarkeit im Feinschliff | Spieler | [[F-072 Design & Stilkonzept\|Design & Stilkonzept]] | 3 | 2 | done | steht |
| [[REQ-307]] | Löschen mit Rückfrage in der Seite | Spielleitung | [[F-071 Bearbeiten in der Ansicht\|Bearbeiten in der Ansicht]] | 3 | 1 | done | steht |
| [[REQ-308]] | Obsidian-Vault einlesen | Spielleitung | [[F-075 Obsidian-Vault\|Obsidian-Vault]] | 3 | 5 | defined | offen |
| [[REQ-309]] | Claude darf auf dev ergänzen, mit Protokoll | Spielleitung | [[F-076 Artikelprüfung & Nachtarbeit\|Artikelprüfung & Nachtarbeit]] | 3 | 1 | done | steht |
| [[REQ-310]] | Fassungen am Feld zeigen | Spielleitung | [[F-005 Fassungen & Varianten\|Fassungen & Varianten]] | 2 | 3 | done | steht |
| [[REQ-311]] | Spieleransicht mit der eigenen Figur im Fokus | Spieler | [[F-025 Spieleransicht & Telefon\|Spieleransicht & Telefon]] | 2 | 5 | in progress | teils |
| [[REQ-312]] | Eigenes Token bewegen | Spieler | [[F-058 Bewegung & Zonen\|Bewegung & Zonen]] | 2 | 3 | in progress | teils |
| [[REQ-313]] | Zustände als Artikel | Spielleitung | [[F-042 Bereich Rules & Kompendium\|Bereich Rules & Kompendium]] | 2 | 3 | in progress | teils |
| [[REQ-314]] | Regelwerk eines Drittverlags laden | Spielleitung | [[F-074 Regelwerke anderer Verlage\|Regelwerke anderer Verlage]] | 3 | 5 | in progress | teils |
| [[REQ-315]] | Globale Kopfleiste | Spieler | [[F-070 Navigation & Kurzansicht\|Navigation & Kurzansicht]] | 1 | 2 | done | steht |
| [[REQ-316]] | Eigene Ebene je Spieler als Vorgabe | Spieler | [[F-013 Schreibrechte & Freigabe\|Schreibrechte & Freigabe]] | 1 | 3 | done | steht |

## Verlauf
- **0.9** (2026-10-14): Umstellung auf User Stories (T-154): 12 Epics, Features, je Story eine Notiz; REQ-236 … REQ-257 aus dem Projektbrett nachgetragen, REQ-258 ff. aus der Ernte aller Gespräche. Die Tabelle wird seither erzeugt.
- **0.1 … 0.8** (2026-08-28 … 2026-10-13): eine von Hand gepflegte Tabelle — im Git-Verlauf dieser Datei.
