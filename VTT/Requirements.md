---
tags: [vtt, requirements, registry]
status: derived
updated: 2026-10-14
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
| 1 | 42 | 133 | 30 steht · 7 teils · 1 offen · 2 ersetzt · 2 verworfen |
| 2 | 95 | 326 | 61 steht · 17 teils · 9 offen · 5 ersetzt · 3 verworfen |
| 3 | 115 | 331 | 61 steht · 22 teils · 31 offen · 1 ersetzt |
| 4 | 44 | 195 | 13 steht · 2 teils · 26 offen · 2 ersetzt · 1 verworfen |
| 5 | 19 | 154 | 1 steht · 18 offen |
| **Zusammen** | **315** | **1139** | 166 steht · 48 teils · 85 offen · 10 ersetzt · 6 verworfen |

177 Stories tragen noch den alten Wortlaut und sind als Story zu formulieren.

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
| [[REQ-017]] | Term engine bindings: system-specific semantic evaluation of rule terms | – | [[F-046 Regelauswertung\|Regelauswertung]] | 4 | 5 | defined | offen |
| [[REQ-018]] | Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types | – | [[F-046 Regelauswertung\|Regelauswertung]] | 1 | 2 | defined | offen |
| [[REQ-019]] | Rohform jedes Imports aufbewahren | – | [[F-001 Artikelmodell\|Artikelmodell]] | 1 | 2 | dropped | verworfen |
| [[REQ-020]] | SourceRef provenance: publication, page, optional file + page anchor | – | [[F-062 Asset-Ablage\|Asset-Ablage]] | 1 | 2 | done | steht |
| [[REQ-021]] | Asset entity contract: backend app/nas/external, consumers resolve URLs via asset service | – | [[F-062 Asset-Ablage\|Asset-Ablage]] | 1 | 3 | done | steht |
| [[REQ-022]] | Derived asset variants: thumbnails, map tiles, PDF page renders, stored app-side | – | [[F-062 Asset-Ablage\|Asset-Ablage]] | 3 | 5 | defined | offen |
| [[REQ-023]] | Status idea/planned/used/discarded | – | [[F-003 Feldformen & Aufzählungen\|Feldformen & Aufzählungen]] | 2 | 1 | dropped | ersetzt |
| [[REQ-024]] | WorldDate property type: canonical sortable value + display string + CalendarSystem reference | – | [[F-038 Kalender & Zeitleisten\|Kalender & Zeitleisten]] | 1 | 2 | done | steht |
| [[REQ-025]] | CalendarSystem definition: months, eras, moons, configurable per world/system | – | [[F-038 Kalender & Zeitleisten\|Kalender & Zeitleisten]] | 3 | 5 | defined | offen |
| [[REQ-026]] | Ansichten festlegen | Spielleitung | [[F-006 Ansichten & Anordnung\|Ansichten & Anordnung]] | 1 | 3 | done | steht |
| [[REQ-027]] | Arten ohne Code anlegen | Spielleitung | [[F-002 Register\|Register]] | 4 | 13 | done | steht |
| [[REQ-028]] | Full-text search across content | – | [[F-068 Suche\|Suche]] | 3 | 3 | in progress | teils |
| [[REQ-029]] | Serializable schema / export (future file or git backing) | – | [[F-065 Druck & Ausfuhr\|Druck & Ausfuhr]] | 3 | 3 | done | steht |
| [[REQ-030]] | Reputation hooks: weighted tags on relations, propagation rule slot reserved | – | [[F-039 Beziehungen & Ruf\|Beziehungen & Ruf]] | 2 | 1 | dropped | ersetzt |
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
| [[REQ-043]] | Campaign configuration store: key-value, each area interprets its keys | – | [[F-029 Kampagne\|Kampagne]] | 2 | 2 | done | steht |
| [[REQ-044]] | Herkunft am Artikel sehen | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 2 | 5 | done | steht |
| [[REQ-045]] | Ebenen-Aktionen am Artikel | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 3 | 8 | defined | offen |
| [[REQ-046]] | Creature / Statblock split with PC and NPC specializations | – | [[F-020 Kreatur\|Kreatur]] | 1 | 3 | done | steht |
| [[REQ-047]] | Import-first entry: 5e.tools JSON, Improved Initiative JSON, markdown paste from Obsidian | – | [[F-073 5e.tools-Import\|5e.tools-Import]] | 2 | 5 | dropped | verworfen |
| [[REQ-048]] | Minimal edit form for core creature fields | – | [[F-022 Schnellanlage\|Schnellanlage]] | 2 | 3 | done | steht |
| [[REQ-049]] | Quick add: name-only NPC or statblock-only mob in one field | – | [[F-022 Schnellanlage\|Schnellanlage]] | 2 | 2 | done | steht |
| [[REQ-050]] | Simple creature viewer: social / description / combat sections | – | [[F-020 Kreatur\|Kreatur]] | 2 | 3 | done | steht |
| [[REQ-051]] | Quick changes: HP, temp HP, conditions, rest, inspiration | – | [[F-023 Charakterbogen\|Charakterbogen]] | 2 | 3 | done | steht |
| [[REQ-052]] | Detailed statblock viewer | – | [[F-021 Statblock\|Statblock]] | 3 | 3 | done | steht |
| [[REQ-053]] | Statblock as composition of RuleElement references (traits, feats, actions) | – | [[F-021 Statblock\|Statblock]] | 2 | 5 | done | steht |
| [[REQ-054]] | Fightingtype field (MCDM roles) on statblock | – | [[F-021 Statblock\|Statblock]] | 2 | 1 | done | steht |
| [[REQ-055]] | Inline trait reuse & variant creation while typing | – | [[F-021 Statblock\|Statblock]] | 3 | 3 | defined | offen |
| [[REQ-056]] | Creature builder with suggestions (origin + fightingtype filter, grants applied via effects) | – | [[F-024 Charaktermanager\|Charaktermanager]] | 4 | 13 | defined | offen |
| [[REQ-057]] | Point-buy ability setting | – | [[F-024 Charaktermanager\|Charaktermanager]] | 4 | 2 | defined | offen |
| [[REQ-058]] | Monster scaling | – | [[F-021 Statblock\|Statblock]] | 5 | 5 | idea | offen |
| [[REQ-059]] | Wissen über Arten von Kreaturen | Spielleitung | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 3 | 3 | done | steht |
| [[REQ-060]] | Companions / summons as regular creatures via companionOf + overrides | – | [[F-020 Kreatur\|Kreatur]] | 3 | 2 | in progress | teils |
| [[REQ-061]] | Creature relations (creature ↔ creature / faction) with relation type | – | [[F-039 Beziehungen & Ruf\|Beziehungen & Ruf]] | 2 | 2 | done | steht |
| [[REQ-062]] | Multi-system statblock extension point (system reference on composition) | – | [[F-021 Statblock\|Statblock]] | 5 | 8 | idea | offen |
| [[REQ-063]] | Character sheet: General tab (HP, temp, hit dice, death saves, AC, conditions, resources, rest) | – | [[F-023 Charakterbogen\|Charakterbogen]] | 2 | 5 | done | steht |
| [[REQ-064]] | Inventory as list: coins / attuned / worn / carried / stored / deeds | – | [[F-026 Inventar\|Inventar]] | 2 | 3 | done | steht |
| [[REQ-065]] | Tile-based visual inventory (alternative view over same data) | – | [[F-026 Inventar\|Inventar]] | 4 | 8 | done | steht |
| [[REQ-066]] | Character sheet: Combat tab (initiative, actions, companions) | – | [[F-023 Charakterbogen\|Charakterbogen]] | 3 | 5 | done | steht |
| [[REQ-067]] | Character sheet: Spellcasting tab (slots/points, concentration, active spells, list) | – | [[F-023 Charakterbogen\|Charakterbogen]] | 3 | 5 | defined | offen |
| [[REQ-068]] | Character sheet: Freeplay tab | – | [[F-023 Charakterbogen\|Charakterbogen]] | 4 | 3 | defined | offen |
| [[REQ-069]] | Phone-first responsive layout for all player-facing views | – | [[F-025 Spieleransicht & Telefon\|Spieleransicht & Telefon]] | 1 | 3 | in progress | teils |
| [[REQ-070]] | Local dice roller (selector, modifiers, results) | – | [[F-053 Würfel\|Würfel]] | 2 | 2 | done | steht |
| [[REQ-071]] | Shared rolls & roll log per session | – | [[F-053 Würfel\|Würfel]] | 4 | 3 | done | steht |
| [[REQ-072]] | Player notes as owned documents | – | [[F-027 Eigene Inhalte der Spielenden\|Eigene Inhalte der Spielenden]] | 2 | 2 | defined | offen |
| [[REQ-073]] | Custom / reorderable sheet layout | – | [[F-023 Charakterbogen\|Charakterbogen]] | 4 | 5 | dropped | ersetzt |
| [[REQ-074]] | Quicklinks: campaign, quests, party, session | – | [[F-025 Spieleransicht & Telefon\|Spieleransicht & Telefon]] | 3 | 1 | in progress | teils |
| [[REQ-075]] | Campaign as root NarrativeContainer with attached CampaignSettings, WorldDate, KnowledgeState | – | [[F-029 Kampagne\|Kampagne]] | 1 | 3 | done | steht |
| [[REQ-076]] | NarrativeContainer hierarchy with DM-definable container types (Arc, Session, Scene, Kapitel…) | – | [[F-030 Bereich Story\|Bereich Story]] | 1 | 3 | done | steht |
| [[REQ-077]] | Session documents with planned vs occurred encounters and reports | – | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 2 | 3 | done | steht |
| [[REQ-078]] | Session prep cockpit: container view aggregating scenes, quests, storylines, encounters, notes | – | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 2 | 5 | done | steht |
| [[REQ-079]] | DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap | – | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 2 | 3 | in progress | teils |
| [[REQ-080]] | Readaloud blocks unlocking for players after session (time/event-based grant) | – | [[F-030 Bereich Story\|Bereich Story]] | 3 | 2 | defined | offen |
| [[REQ-081]] | Reputation & relationship system: interaction tags propagate NPC → faction → city with renown thresholds and status | – | [[F-039 Beziehungen & Ruf\|Beziehungen & Ruf]] | 4 | 8 | dropped | ersetzt |
| [[REQ-082]] | Quests with tasks, rewards, restrictions; player-facing quest board with gated GM parts | – | [[F-030 Bereich Story\|Bereich Story]] | 3 | 3 | done | steht |
| [[REQ-083]] | Player-created quests and personal goals | – | [[F-027 Eigene Inhalte der Spielenden\|Eigene Inhalte der Spielenden]] | 3 | 1 | defined | offen |
| [[REQ-084]] | Ideas inbox per campaign/player and clean vs planning view toggle | – | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 3 | 3 | done | steht |
| [[REQ-085]] | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | – | [[F-032 Begegnungen\|Begegnungen]] | 2 | 3 | done | steht |
| [[REQ-086]] | Party view: passive perception, feats, inventory overview | – | [[F-034 Party\|Party]] | 3 | 3 | in progress | teils |
| [[REQ-087]] | Calendar module: months, moons, holidays, time-of-day widget with triggers, lore coupling | – | [[F-038 Kalender & Zeitleisten\|Kalender & Zeitleisten]] | 5 | 13 | idea | offen |
| [[REQ-088]] | Massenänderungen an Wissen und Rechten | Spielleitung | [[F-016 Werkbank\|Werkbank]] | 3 | 3 | in progress | teils |
| [[REQ-089]] | RuleElement reference objects: structured text, tags, optional effects/constraints, rawContent | – | [[F-042 Bereich Rules & Kompendium\|Bereich Rules & Kompendium]] | 1 | 2 | done | steht |
| [[REQ-090]] | Rule import from Obsidian markdown and 5e.tools data | – | [[F-073 5e.tools-Import\|5e.tools-Import]] | 2 | 3 | dropped | verworfen |
| [[REQ-091]] | Rules browser: filtered, grouped, searchable, with layer origin in scope sidebar | – | [[F-042 Bereich Rules & Kompendium\|Bereich Rules & Kompendium]] | 2 | 5 | done | steht |
| [[REQ-092]] | Spell entities with layer-scoped attached rule sets (5e 2014 / 2024 / homebrew) | – | [[F-045 Zauber\|Zauber]] | 2 | 3 | defined | offen |
| [[REQ-093]] | Rule engine per system evaluating rules against entity data (constraints, terms) | – | [[F-046 Regelauswertung\|Regelauswertung]] | 5 | 13 | idea | offen |
| [[REQ-094]] | Entity ↔ rule attachment as layer-scoped relation | – | [[F-042 Bereich Rules & Kompendium\|Bereich Rules & Kompendium]] | 2 | 3 | done | steht |
| [[REQ-095]] | Effects interpreter for grants (first consumer: creature builder) | – | [[F-046 Regelauswertung\|Regelauswertung]] | 4 | 8 | defined | offen |
| [[REQ-096]] | Constraint interpreter (first consumer: settlement / building validation) | – | [[F-046 Regelauswertung\|Regelauswertung]] | 5 | 8 | idea | offen |
| [[REQ-097]] | Spell lists as relations (class ↔ spell) | – | [[F-045 Zauber\|Zauber]] | 3 | 2 | defined | offen |
| [[REQ-098]] | Sub-5-second rule lookup during play | – | [[F-042 Bereich Rules & Kompendium\|Bereich Rules & Kompendium]] | 2 | 2 | done | steht |
| [[REQ-099]] | Pinnable rules: bookmark object (user + context + rule) | – | [[F-042 Bereich Rules & Kompendium\|Bereich Rules & Kompendium]] | 3 | 1 | done | steht |
| [[REQ-100]] | Welt als Ebene | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 1 | 2 | in progress | teils |
| [[REQ-101]] | Lore articles: categories, composed of ContentBlocks | – | [[F-037 Bereich World\|Bereich World]] | 2 | 3 | done | steht |
| [[REQ-102]] | Artikel je Stapel und Wissen zeichnen | Spieler | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 2 | 5 | in progress | teils |
| [[REQ-103]] | Locations: hierarchy via parent, type, biome | – | [[F-037 Bereich World\|Bereich World]] | 2 | 2 | done | steht |
| [[REQ-104]] | Factions: type/subtype taxonomy, relations | – | [[F-037 Bereich World\|Bereich World]] | 2 | 2 | done | steht |
| [[REQ-105]] | NPC directory as filtered view over creatures with relations | – | [[F-020 Kreatur\|Kreatur]] | 3 | 2 | done | steht |
| [[REQ-106]] | Events & timelines sorted by WorldDate | – | [[F-038 Kalender & Zeitleisten\|Kalender & Zeitleisten]] | 3 | 3 | done | steht |
| [[REQ-107]] | Pantheons / deities as article subtype | – | [[F-037 Bereich World\|Bereich World]] | 4 | 1 | defined | offen |
| [[REQ-108]] | Lore der Kampagne abweichen lassen | Spielleitung | [[F-005 Fassungen & Varianten\|Fassungen & Varianten]] | 3 | 3 | done | steht |
| [[REQ-109]] | Player-authored ContentBlocks with per-view block-type whitelist | – | [[F-027 Eigene Inhalte der Spielenden\|Eigene Inhalte der Spielenden]] | 3 | 3 | in progress | teils |
| [[REQ-110]] | Bibliothek von Tan'Jit: illustrated navigation presentation layer over articles | – | [[F-037 Bereich World\|Bereich World]] | 5 | 8 | idea | offen |
| [[REQ-111]] | Boards: user-owned configurable views with tabs/pages and widgets; DM and player boards share the mechanism | – | [[F-067 Boards\|Boards]] | 2 | 8 | done | steht |
| [[REQ-112]] | Widget: reference box holding multiple open articles with inner tabs | – | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 2 | 3 | dropped | ersetzt |
| [[REQ-113]] | Widget: notes | – | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 2 | 2 | defined | offen |
| [[REQ-114]] | Widget: quick-create (creates entries in the campaign layer inline) | – | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 2 | 3 | in progress | teils |
| [[REQ-115]] | Widget: initiative tracker — session-aware, conditions with durations, damage attributed to current actor by default | – | [[F-051 Initiative\|Initiative]] | 2 | 5 | done | steht |
| [[REQ-116]] | Session state objects (initiative, now-playing, active scene, party note) + realtime channel per session | – | [[F-052 Sitzungszustand & Live-Kanal\|Sitzungszustand & Live-Kanal]] | 2 | 8 | done | steht |
| [[REQ-117]] | Stewardship: write permission on a state object per user, GM override configurable | – | [[F-052 Sitzungszustand & Live-Kanal\|Sitzungszustand & Live-Kanal]] | 3 | 3 | done | steht |
| [[REQ-118]] | Widget: encounter runner — instantiate participants, roll random entries, raw statblocks trackable | – | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 3 | 5 | done | steht |
| [[REQ-119]] | Player boards | – | [[F-067 Boards\|Boards]] | 3 | 3 | defined | offen |
| [[REQ-120]] | Play log: persist state events (actor, target, delta) | – | [[F-052 Sitzungszustand & Live-Kanal\|Sitzungszustand & Live-Kanal]] | 3 | 3 | in progress | teils |
| [[REQ-121]] | Statistics widget: kills, damage per character, monsters faced, records | – | [[F-052 Sitzungszustand & Live-Kanal\|Sitzungszustand & Live-Kanal]] | 4 | 3 | defined | offen |
| [[REQ-122]] | Widget: party overview | – | [[F-034 Party\|Party]] | 3 | 2 | done | steht |
| [[REQ-123]] | Widget: timers | – | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 3 | 1 | defined | offen |
| [[REQ-124]] | Widget: quest board | – | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 3 | 2 | done | steht |
| [[REQ-125]] | Widget: random tables & generators (names, shops, loot, cities) | – | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 3 | 5 | done | steht |
| [[REQ-126]] | Widget: sound — embed/link external tool, native now-playing state only | – | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 4 | 2 | in progress | teils |
| [[REQ-127]] | Native soundboard / music engine | – | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 5 | 13 | idea | offen |
| [[REQ-128]] | Combat player view: own initiative, conditions, health comments | – | [[F-051 Initiative\|Initiative]] | 3 | 3 | in progress | teils |
| [[REQ-129]] | Chatbot: rules Q&A, facts, quick edit | – | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 5 | 8 | idea | offen |
| [[REQ-130]] | Map entity: image asset, scale, grid config (size, offset, square/hex), link to Location | – | [[F-055 Karte & Kartenebenen\|Karte & Kartenebenen]] | 3 | 2 | done | steht |
| [[REQ-131]] | Nested maps: parent + anchor region, zoom-through transitions world → region → city → district → battlemap | – | [[F-055 Karte & Kartenebenen\|Karte & Kartenebenen]] | 3 | 8 | done | steht |
| [[REQ-132]] | Level lock: pin current map level while zooming | – | [[F-055 Karte & Kartenebenen\|Karte & Kartenebenen]] | 3 | 1 | defined | offen |
| [[REQ-133]] | Static tokens: reference markers linked to entities (pin opens article) | – | [[F-056 Tokens & Marker\|Tokens & Marker]] | 3 | 3 | done | steht |
| [[REQ-134]] | Static tokens: scenery / props as part of prepared map state | – | [[F-056 Tokens & Marker\|Tokens & Marker]] | 4 | 3 | done | steht |
| [[REQ-135]] | Play tokens: session- or campaign-scoped state objects (combat positions, temporary changes) | – | [[F-056 Tokens & Marker\|Tokens & Marker]] | 3 | 5 | in progress | teils |
| [[REQ-136]] | Party and quest markers on region maps (campaign-scoped play tokens) | – | [[F-056 Tokens & Marker\|Tokens & Marker]] | 3 | 2 | done | steht |
| [[REQ-137]] | Overlays: query-driven highlights (faction locations, biomes, routes) | – | [[F-059 Gebiete & Overlays\|Gebiete & Overlays]] | 4 | 5 | in progress | teils |
| [[REQ-138]] | Map tiling for smooth zoom (derived asset) | – | [[F-055 Karte & Kartenebenen\|Karte & Kartenebenen]] | 4 | 5 | done | steht |
| [[REQ-139]] | Fog of war | – | [[F-057 Nebel, Licht & Sicht\|Nebel, Licht & Sicht]] | 4 | 8 | done | steht |
| [[REQ-140]] | Light & line of sight with walls | – | [[F-057 Nebel, Licht & Sicht\|Nebel, Licht & Sicht]] | 5 | 13 | done | steht |
| [[REQ-141]] | Map effects & animations (conditions, weather) | – | [[F-061 Karteneditor\|Karteneditor]] | 5 | 8 | idea | offen |
| [[REQ-142]] | Drawing, stamps, brushes, layers on maps | – | [[F-061 Karteneditor\|Karteneditor]] | 5 | 8 | idea | offen |
| [[REQ-143]] | Map editor / full map creation | – | [[F-061 Karteneditor\|Karteneditor]] | 5 | 13 | idea | offen |
| [[REQ-144]] | Initiative indicator on battlemap (current / next) | – | [[F-051 Initiative\|Initiative]] | 4 | 2 | done | steht |
| [[REQ-145]] | Asset service implementation: app-managed storage (icons, portraits, thumbnails) | – | [[F-062 Asset-Ablage\|Asset-Ablage]] | 1 | 3 | in progress | teils |
| [[REQ-146]] | NAS / Nextcloud backend for large assets (mount vs WebDAV → AD-15) | – | [[F-062 Asset-Ablage\|Asset-Ablage]] | 2 | 5 | defined | offen |
| [[REQ-147]] | Image upload, portraits, icons | – | [[F-063 Bildverwaltung\|Bildverwaltung]] | 2 | 2 | in progress | teils |
| [[REQ-148]] | External URL assets | – | [[F-062 Asset-Ablage\|Asset-Ablage]] | 3 | 1 | done | steht |
| [[REQ-149]] | PDF viewer with page-anchor jump from SourceRef | – | [[F-066 PDF & OCR\|PDF & OCR]] | 4 | 5 | defined | offen |
| [[REQ-150]] | Audio asset storage | – | [[F-062 Asset-Ablage\|Asset-Ablage]] | 5 | 2 | idea | offen |
| [[REQ-151]] | 3D file viewer / repository | – | [[F-062 Asset-Ablage\|Asset-Ablage]] | 5 | 8 | idea | offen |
| [[REQ-152]] | OCR / PDF import to structured content with editable raw output (MonsterBox-style) | – | [[F-066 PDF & OCR\|PDF & OCR]] | 5 | 13 | idea | offen |
| [[REQ-153]] | German UI output with i18n-ready string handling | – | [[F-072 Design & Stilkonzept\|Design & Stilkonzept]] | 2 | 2 | dropped | ersetzt |
| [[REQ-154]] | Ausrollen nach dev und prod | Verwaltung | [[F-017 Ausrollen & Sicherung\|Ausrollen & Sicherung]] | 1 | 3 | done | steht |
| [[REQ-155]] | Sicherungen | Verwaltung | [[F-017 Ausrollen & Sicherung\|Ausrollen & Sicherung]] | 2 | 2 | done | steht |
| [[REQ-156]] | Sichtbarkeit vererben | – | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 2 | 2 | dropped | verworfen |
| [[REQ-157]] | Canvas boards: free positioning, scaling and arrangement of entity placements on a board (Figma/Canva-style), beyond the widget grid | – | [[F-067 Boards\|Boards]] | 2 | 8 | done | steht |
| [[REQ-158]] | Placement rendering: each placement resolves to a facet/renderer via the display resolution; explicit per-placement override always wins | – | [[F-067 Boards\|Boards]] | 2 | 3 | done | steht |
| [[REQ-159]] | Frames / viewpoint anchors: named canvas viewports (position, zoom depth, target facet, visible layers), persisted in the board config | – | [[F-067 Boards\|Boards]] | 3 | 3 | done | steht |
| [[REQ-160]] | Anchor quick navigation: jump between anchors (list, hotkeys) — session notes → map → house rules without leaving the board | – | [[F-067 Boards\|Boards]] | 3 | 2 | in progress | teils |
| [[REQ-161]] | Display resolution as priority system: entity profile proposes, board rules (per interface / attribute value) decide, user overrides; placement override wins; ties → board rule; works board-only | – | [[F-067 Boards\|Boards]] | 2 | 5 | done | steht |
| [[REQ-162]] | Semantic zoom: zoom depth maps onto facets (compact list of weapon properties → full detail on zoom-in); anchors may store a target facet | – | [[F-067 Boards\|Boards]] | 4 | 5 | defined | offen |
| [[REQ-163]] | Bezeichner ohne Bedeutung | Spielleitung | [[F-001 Artikelmodell\|Artikelmodell]] | 1 | 1 | done | steht |
| [[REQ-164]] | Darstellungsstufen als eigenes System | – | [[F-006 Ansichten & Anordnung\|Ansichten & Anordnung]] | 2 | 3 | dropped | ersetzt |
| [[REQ-165]] | Board placements beyond content entities: assets (images, icons), geometric/mathematical shapes as inline canvas objects, and tool objects (interactive widgets such as creature creator or generators) on the canvas | – | [[F-067 Boards\|Boards]] | 2 | 3 | done | steht |
| [[REQ-166]] | Board-first authoring: create entities directly on the canvas (into the campaign layer), choose their facet and place them in one flow | – | [[F-067 Boards\|Boards]] | 2 | 2 | in progress | teils |
| [[REQ-167]] | Print & export outputs: item cards, creature cards, character sheets (PDF), maps (image/print) rendered from facets — the facet defines *what* appears, the medium (screen/print/pdf/image) *how*; card-sheet assembly (n cards per page) as export config | – | [[F-065 Druck & Ausfuhr\|Druck & Ausfuhr]] | 3 | 5 | defined | offen |
| [[REQ-168]] | Point-crawl travel: node/edge graph attached to a Location, with per-edge sensory read-aloud text and per-node arrival state | – | [[F-060 Reisen & Erkundung\|Reisen & Erkundung]] | 3 | 5 | done | steht |
| [[REQ-169]] | Exploration state ladder per map feature (verborgen → entdeckt → erkundet) with cascade: exploring a node reveals its edges as discovered | – | [[F-060 Reisen & Erkundung\|Reisen & Erkundung]] | 3 | 3 | done | steht |
| [[REQ-170]] | Travel resource cadence: consumables consumed every N nodes or watches, configurable per travel ruleset | – | [[F-060 Reisen & Erkundung\|Reisen & Erkundung]] | 4 | 2 | done | steht |
| [[REQ-171]] | Per-node action budget: one action per character per node from a configurable list (sneak, craft, forage, rest) | – | [[F-060 Reisen & Erkundung\|Reisen & Erkundung]] | 4 | 3 | done | steht |
| [[REQ-172]] | Weighted encounter tables per region, with per-location type constraints and safety states that restrict the pool | – | [[F-032 Begegnungen\|Begegnungen]] | 3 | 3 | done | steht |
| [[REQ-173]] | World-state decay between sessions: roll to degrade secured locations, weighted by adjacency to faction territory | – | [[F-032 Begegnungen\|Begegnungen]] | 4 | 3 | idea | offen |
| [[REQ-174]] | Regeltexte mit Platzhaltern | Spielleitung | [[F-007 Verweise & Platzhalter\|Verweise & Platzhalter]] | 2 | 3 | done | steht |
| [[REQ-175]] | Regelbegriffe im Text erkennen | Spieler | [[F-007 Verweise & Platzhalter\|Verweise & Platzhalter]] | 3 | 2 | done | steht |
| [[REQ-176]] | Ähnliches vor dem Anlegen vorschlagen | Spielleitung | [[F-007 Verweise & Platzhalter\|Verweise & Platzhalter]] | 3 | 3 | in progress | teils |
| [[REQ-177]] | Einzelne Felder freigeben | Spielleitung | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 2 | 3 | done | steht |
| [[REQ-178]] | Decknamen | Spielleitung | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 3 | 1 | done | steht |
| [[REQ-179]] | Zeigen, dass es mehr gibt | Spieler | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 4 | 1 | done | steht |
| [[REQ-180]] | Narrative seeds: planted threads with category (Backstory · Geheimnis · Faden · Idee · Versprechen · Konsequenz) and status (offen · gepflanzt · aufgegangen · verworfen), bound to a character and the session planted in | – | [[F-030 Bereich Story\|Bereich Story]] | 3 | 3 | idea | offen |
| [[REQ-181]] | Freie Felder an einem einzelnen Artikel | Spielleitung | [[F-001 Artikelmodell\|Artikelmodell]] | 2 | 3 | done | steht |
| [[REQ-182]] | Kanten lesen sich von beiden Enden | Spielleitung | [[F-001 Artikelmodell\|Artikelmodell]] | 2 | 1 | done | steht |
| [[REQ-183]] | Party-owned inventory as a shared container distinct from character inventories | – | [[F-026 Inventar\|Inventar]] | 3 | 2 | done | steht |
| [[REQ-184]] | Crafting: recipes with material inputs, skill checks and DC, time, and output; consumption on completion | – | [[F-047 Handwerk\|Handwerk]] | 4 | 5 | done | steht |
| [[REQ-185]] | Non-coin economies: barter and alternative currency ladders per region | – | [[F-040 Läden & Wirtschaft\|Läden & Wirtschaft]] | 5 | 2 | idea | offen |
| [[REQ-186]] | Nested loot tables: a table entry may reference another table, with cycle protection | – | [[F-054 Werkzeuge am Tisch\|Werkzeuge am Tisch]] | 3 | 2 | done | steht |
| [[REQ-187]] | Table display mode: a shared read-only presentation view for a screen at the table, distinct from per-player accounts | – | [[F-050 Spielleiter-Schirm\|Spielleiter-Schirm]] | 3 | 2 | idea | offen |
| [[REQ-188]] | Cross-type "unfinished" overview: everything at status idea/planned across all interfaces, with jump-to and bulk status change | – | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 3 | 2 | done | steht |
| [[REQ-189]] | Aggregated todo list across containers and entities (campaign, arc, session, quest, NPC) | – | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 3 | 2 | done | steht |
| [[REQ-190]] | Quick capture during play: one field that files a seed, todo or idea against the current session without leaving the view | – | [[F-031 Sitzungen & Vorbereitung\|Sitzungen & Vorbereitung]] | 3 | 2 | done | steht |
| [[REQ-191]] | Nichts still überschreiben | Spielleitung | [[F-009 Verlauf & gleichzeitiges Schreiben\|Verlauf & gleichzeitiges Schreiben]] | 1 | 2 | done | steht |
| [[REQ-192]] | Gleichzeitig bearbeiten ohne Verlust | Spielleitung | [[F-009 Verlauf & gleichzeitiges Schreiben\|Verlauf & gleichzeitiges Schreiben]] | 2 | 3 | done | steht |
| [[REQ-193]] | Territory overlays rasterised onto the map grid from shapes (rect, circle, ellipse, polygon) | – | [[F-059 Gebiete & Overlays\|Gebiete & Overlays]] | 4 | 3 | done | steht |
| [[REQ-194]] | Mobile navigation: the user chooses which entries occupy the phone bottom bar | – | [[F-025 Spieleransicht & Telefon\|Spieleransicht & Telefon]] | 4 | 1 | idea | offen |
| [[REQ-195]] | Statblock export back to Obsidian markdown, preserving `{VAR}` placeholders unresolved | – | [[F-065 Druck & Ausfuhr\|Druck & Ausfuhr]] | 4 | 2 | idea | offen |
| [[REQ-196]] | Sitzungsmitschnitt: Audio einer Sitzung aufnehmen oder eine fertige Aufnahme anhängen, als Asset am Sitzungs-Container, mit Startzeit und Kapitelmarken | – | [[F-036 Sitzungsmitschnitt\|Sitzungsmitschnitt]] | 4 | 5 | idea | offen |
| [[REQ-197]] | Transkription und Recap-Entwurf: Mitschnitt transkribieren, am Sitzungsverlauf ausrichten und daraus einen Recap-Entwurf erzeugen, den die SL bearbeitet | – | [[F-036 Sitzungsmitschnitt\|Sitzungsmitschnitt]] | 4 | 8 | idea | offen |
| [[REQ-198]] | Sprecherzuordnung im Transkript: Abschnitte einer Figur oder der SL zuordnen, damit „was hat meine Figur mitbekommen“ beantwortbar wird | – | [[F-036 Sitzungsmitschnitt\|Sitzungsmitschnitt]] | 5 | 5 | idea | offen |
| [[REQ-199]] | Produktionsdaten nach dev spiegeln | Verwaltung | [[F-017 Ausrollen & Sicherung\|Ausrollen & Sicherung]] | 3 | 3 | done | steht |
| [[REQ-200]] | Chat: Fäden zwischen SL und einzelnen Spielern und zwischen Spielern untereinander, an der Kampagne und nicht an einer Sitzung | – | [[F-028 Chat\|Chat]] | 3 | 5 | idea | offen |
| [[REQ-201]] | Aus einer Stelle im Chat wird Kampagneninhalt: eine Nachricht (oder ein markierter Abschnitt) wird zur Idee, zum Todo, zum Faden oder zu einem ContentBlock an einem Artikel, mit Rückverweis auf die Stelle | – | [[F-028 Chat\|Chat]] | 3 | 3 | idea | offen |
| [[REQ-202]] | Chats stehen ausserhalb von Abzug, Ausfuhr und Recap: ein Faden zwischen zwei Spielern gehört weder in den Prod-nach-preprod-Abzug noch in eine Kampagnenausfuhr, und die SL liest nicht mit | – | [[F-028 Chat\|Chat]] | 2 | 2 | idea | offen |
| [[REQ-203]] | Wissen nach Rang in einer Fraktion | Spielleitung | [[F-012 Sichtbarkeit & Wissen\|Sichtbarkeit & Wissen]] | 2 | 2 | done | steht |
| [[REQ-204]] | Spielleiter-Schirm je Kampagne: Fenster (mehrere Bildschirme als Browser-Reiter), darin Plätze, die ein Board oder ein Werkzeug zeigen; zuklappbar, umstellbar, zwischen Fenstern verschiebbar | – | [[F-050 Spielleiter-Schirm\|Spielleiter-Schirm]] | 3 | 5 | idea | offen |
| [[REQ-205]] | Ein Board je Geschichtsartikel (Kampagne, Kapitel, Sitzung, nicht Szene) und Regel-Boards; der Schirm schaltet zwischen ihnen, die Artikelansicht filtert nach Artikeln aus den offenen Boards | – | [[F-050 Spielleiter-Schirm\|Spielleiter-Schirm]] | 3 | 3 | in progress | teils |
| [[REQ-206]] | Bewegungsrechner auf der Karte: Diagonalen 5-10-5, gezählt je Kreatur und Zug und mit jedem Zug neu; Modi „genauer Weg“, „grösste Reichweite“, „aus“; das Tempo des Zuges ist eine Zahl, die man ändert (Spurt, Klettern, Schwimmen, Sonderfälle), und die SL darf übersteuern | – | [[F-058 Bewegung & Zonen\|Bewegung & Zonen]] | 3 | 3 | done | steht |
| [[REQ-207]] | Wählbarer Pfad: Wegpunkte setzen (um eine Falle herum, nicht an einem Gegner vorbei), zwischen ihnen der günstigste Weg; die Diagonalenzählung läuft über die Wegpunkte weiter; Gefahren und Reichweite von Gegnern können gemieden werden | – | [[F-058 Bewegung & Zonen\|Bewegung & Zonen]] | 3 | 2 | done | steht |
| [[REQ-208]] | Zonen mit eigenen Regeln: eine Zonenart ist ein Regelartikel; Bewegungskosten, Licht, Sicht und „versteckt bis passive Wahrnehmung n“ rechnet die Karte, Schaden, Rettungswurf, Zustand und freie Regeln zeigt sie und schreibt sie beim Betreten ins Protokoll | – | [[F-058 Bewegung & Zonen\|Bewegung & Zonen]] | 3 | 5 | in progress | teils |
| [[REQ-209]] | Aufdecken: von Hand oder beim Bestätigen einer Bewegung, dann entlang des Pfads Schritt für Schritt; von Hand zeigt das Token, wen es sieht und von wem es gesehen wird (Sichtlinie, passive Wahrnehmung gegen Heimlichkeit, −5 im Dämmerlicht) | – | [[F-057 Nebel, Licht & Sicht\|Nebel, Licht & Sicht]] | 3 | 3 | done | steht |
| [[REQ-210]] | Karte und Initiative je als Vollbild, je mit SL- und Spieleransicht; Spielende bewegen ihre eigenen Tokens und prüfen die Reichweite selbst | – | [[F-058 Bewegung & Zonen\|Bewegung & Zonen]] | 3 | 3 | in progress | teils |
| [[REQ-211]] | Initiative wie Improved Initiative: je Zeile Initiative, RK, TP und Zustände, aus der Zeile der Statblock | – | [[F-051 Initiative\|Initiative]] | 2 | 3 | done | steht |
| [[REQ-212]] | Zustände und Notizen mit Dauer: Anzahl Runden, Anker (wessen Zug) und Zeitpunkt (Anfang oder Ende dieses Zuges); eine Notiz ist ein freier Text mit derselben Dauer | – | [[F-051 Initiative\|Initiative]] | 2 | 2 | done | steht |
| [[REQ-213]] | Initiative der Spielenden: die eigene Reihenfolge und jede Kreatur, die aufgedeckt oder schon beteiligt ist; nicht erkannte Kreaturen mit Decknamen, TP von Gegnern als Wort | – | [[F-051 Initiative\|Initiative]] | 3 | 2 | done | steht |
| [[REQ-214]] | Ausrüstungsfigur nach dem Inventarblatt: Figur je Kreatur wählbar (männlich, weiblich, neutral) und dort gespeichert; Plätze Kopf, Schulter, Torso, rechte und linke Hand, Beine, Stiefel, Gurt mit zwei Holstern, Ringe je Hand, Halskette | – | [[F-026 Inventar\|Inventar]] | 4 | 2 | done | steht |
| [[REQ-215]] | Tragraster aus Grösse und Statblock: ein Grundquadrat nach Grösse (Tiny 3 … Large 6) und ein Zusatzquadrat in der Grösse des Stärkemodifikators (+1 … +5) aus dem Statblock des Trägers — beim Lesen gerechnet, nie eingetippt | – | [[F-026 Inventar\|Inventar]] | 3 | 2 | done | steht |
| [[REQ-216]] | Behälter in Behältern: jeder Behälter gibt eine Ziehstufe dazu, ausgehend davon, wo er selbst liegt; die Basiszonen kommen aus dem Blatt und sind je Behälter änderbar | – | [[F-026 Inventar\|Inventar]] | 3 | 2 | done | steht |
| [[REQ-217]] | Ziehen am Bogen: unter Aktion, Bonusaktion usw. je ein Eintrag „Ziehen“; ein Klick zeigt, was sich mit dieser Aktion herausnehmen lässt, mit Dauer | – | [[F-026 Inventar\|Inventar]] | 3 | 2 | done | steht |
| [[REQ-218]] | Blaupausen werden gelernt: alle Rezepte sind sichtbar, ungelernte mit „muss noch gelernt werden“ (ohne festen Fundort); Filter „kann der Charakter“ und „alle“, „machbar“ und „fast“, nach Material und nach Beruf | – | [[F-047 Handwerk\|Handwerk]] | 3 | 2 | done | steht |
| [[REQ-219]] | Material wird beim Start an den Vorgang gebunden: es verlässt den Vorrat und kann nicht doppelt oder anderweitig gebraucht werden; was beim Misslingen zurückkommt, sagt `Recipe.onFailure` | – | [[F-047 Handwerk\|Handwerk]] | 3 | 2 | done | steht |
| [[REQ-220]] | Zeitleisten der Weltgeschichte: mehrere Spuren (ein Krieg, eine Dynastie, Zeitalter) neben der Kampagnenzeitleiste; ein Ereignis mit Spanne enthält seine Ereignisse, und die Kampagne ist eine Spur unter ihnen | – | [[F-038 Kalender & Zeitleisten\|Kalender & Zeitleisten]] | 3 | 3 | done | steht |
| [[REQ-221]] | Begegnungsbau: Schwierigkeit aus den XP-Schwellen der Gruppe mit Multiplikator nach Anzahl (2014), Kreaturen aus dem Kompendium, dann auf die Karte setzen und Initiative starten | – | [[F-032 Begegnungen\|Begegnungen]] | 3 | 3 | idea | offen |
| [[REQ-222]] | Stufenaufstieg: Schritte aus Klassen- und Unterklassentabellen (TP, Attributsverbesserung oder Talent, Zauber), Folgewerte gerechnet | – | [[F-024 Charaktermanager\|Charaktermanager]] | 4 | 5 | idea | offen |
| [[REQ-223]] | Regelsysteme als Rahmen (Taverne, Alley, Kanalisation): ein Ort, seine Kennzahlen, ein Wochenwurf und ein Protokoll | – | [[F-048 Regelsysteme & Module\|Regelsysteme & Module]] | 4 | 5 | idea | offen |
| [[REQ-224]] | Kreaturen nehmen auf der Karte Felder nach ihrer Grösse ein (Regeln 2014): Tiny, Small, Medium, Large 2 × 2, Huge 3 × 3, Gargantuan 4 × 4; Bewegung, Wege, Sicht und Reichweite rechnen mit dem ganzen Platz | – | [[F-056 Tokens & Marker\|Tokens & Marker]] | 3 | 3 | done | steht |
| [[REQ-225]] | Fallenlassen ist eine freie Aktion, Verstauen eine Bonusaktion, egal wohin; der Gurt ist eine freie Aktion | – | [[F-026 Inventar\|Inventar]] | 3 | 1 | done | steht |
| [[REQ-226]] | In der ersten Runde erscheinen Gegner in der Initiative der Spielenden erst, wenn sie an der Reihe sind; ab der zweiten Runde stehen die bereits gezeigten fest | – | [[F-051 Initiative\|Initiative]] | 3 | 1 | done | steht |
| [[REQ-227]] | Masse im Fliesstext umrechnen: Fuss und Meilen in Regeltexten („within 120 feet“) nach der Einstellung `units` zeigen, beim Lesen gerechnet, gespeichert bleibt der Wortlaut | – | [[F-049 Masse & Einheiten\|Masse & Einheiten]] | 3 | 2 | idea | offen |
| [[REQ-228]] | Verlorene Einladung neu ausgeben | Spielleitung | [[F-010 Anmeldung & Konten\|Anmeldung & Konten]] | 4 | 1 | idea | offen |
| [[REQ-229]] | Konten in der Seite verwalten | Verwaltung | [[F-010 Anmeldung & Konten\|Anmeldung & Konten]] | 3 | 2 | idea | offen |
| [[REQ-230]] | Register in der Seite bearbeiten | Spielleitung | [[F-002 Register\|Register]] | 2 | 5 | done | steht |
| [[REQ-231]] | Klassenansicht wie 5e.tools: Stufentabelle (Übungsbonus, Merkmale, Spalten der Klasse und gewählter Unterklassen), Merkmale je Stufe ausgeschrieben, optionale Merkmale und Varianten zuschaltbar, Unterklassen nach Name und Quelle filtern und mehrere nebeneinander vergleichen (am Telefon untereinander) | – | [[F-044 Klassen\|Klassen]] | 3 | 3 | done | steht |
| [[REQ-232]] | Listen rechnet der Server | Spieler | [[F-019 Leistung & Laden\|Leistung & Laden]] | 2 | 5 | done | steht |
| [[REQ-233]] | 5e.tools über eine Pipeline einlesen statt von Hand auf dem Server: dev von selbst, wenn sich der Importer ändert, prod nur von Hand; vorher eine Sicherung, ein Probelauf ist möglich, der Bericht steht im Lauf | – | [[F-073 5e.tools-Import\|5e.tools-Import]] | 3 | 3 | done | steht |
| [[REQ-234]] | API-Tokens für Werkzeuge | Verwaltung | [[F-015 API-Tokens & Werkzeugzugang\|API-Tokens & Werkzeugzugang]] | 3 | 2 | done | steht |
| [[REQ-235]] | Werkbank: Prüfungen und Massenänderungen | Spielleitung | [[F-016 Werkbank\|Werkbank]] | 3 | 5 | done | steht |
| [[REQ-236]] | Kampagne anlegen mit Dialog: Name, aufgeschaltete Ebenen (Liste mit Häkchen und Reihenfolge, vorhandene vorausgewählt), eigene Kampagnenebene, Leitung | – | [[F-029 Kampagne\|Kampagne]] | 2 | 3 | defined | offen |
| [[REQ-237]] | Spielende legen Artikel an, die Leitung gibt frei | Spieler | [[F-013 Schreibrechte & Freigabe\|Schreibrechte & Freigabe]] | 2 | 5 | done | steht |
| [[REQ-238]] | Charaktererstellung aus den Artikeln: Klasse, Herkunft (Ancestry) und Hintergrund wählen und ihre Entscheidungen treffen; Schritte und Wahlmöglichkeiten kommen aus den Artikeln, nicht aus Code — eine Änderung am Artikel wirkt sofort | – | [[F-024 Charaktermanager\|Charaktermanager]] | 1 | 13 | done | steht |
| [[REQ-239]] | Jedes Buch eine eigene Ebene (PHB, MM, DMG, XGE …), statt einer Ebene für alles aus 5e.tools; eine Kampagne schaltet die Bücher auf, die sie nutzt | – | [[F-073 5e.tools-Import\|5e.tools-Import]] | 2 | 3 | done | steht |
| [[REQ-240]] | Vorgefertigte Abenteuer aus 5e.tools: je Abenteuer eine Ebene mit Kapiteln, Abschnitten, Begegnungen, Karten und NSC als Artikeln; die Leitung übernimmt sie in die eigene Geschichte und passt sie an, ohne das Original zu verlieren | – | [[F-033 Abenteuer übernehmen\|Abenteuer übernehmen]] | 2 | 13 | done | steht |
| [[REQ-241]] | Die Sicht eines Spielers einnehmen | Spielleitung | [[F-014 Sicht eines Spielers\|Sicht eines Spielers]] | 1 | 5 | done | steht |
| [[REQ-242]] | Felder der eigenen Figur sperren | Spielleitung | [[F-013 Schreibrechte & Freigabe\|Schreibrechte & Freigabe]] | 3 | 5 | defined | offen |
| [[REQ-243]] | Alle 5e.tools-Inhalte als eigene Ebenen, abschaltbar: 2024-Regeln, Unearthed Arcana, Fahrzeuge, Kartendecks, Bastionen — damit die Leitung Ebenen umschalten und Fassungen eines Artikels nebeneinander zeigen kann | – | [[F-073 5e.tools-Import\|5e.tools-Import]] | 2 | 8 | done | steht |
| [[REQ-244]] | Ebenen gruppieren | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 2 | 3 | done | steht |
| [[REQ-245]] | Ebenen beschreiben sich selbst | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 2 | 2 | done | steht |
| [[REQ-246]] | Navigation ohne Einfrieren | Spieler | [[F-019 Leistung & Laden\|Leistung & Laden]] | 1 | 5 | done | steht |
| [[REQ-247]] | Leseansicht für Bücher und Abenteuer: eine Ebene als Buch lesen — Inhaltsverzeichnis, Kapitel in Reihenfolge, eingebettete Artikel (Zauber, Monster, Tabellen) als Verweise bzw. Karten, Lesestand gemerkt | – | [[F-043 Bücher & Leseansicht\|Bücher & Leseansicht]] | 2 | 8 | done | steht |
| [[REQ-248]] | Kurzansicht überall: wo ein Artikel genannt wird (auch Ebenen in Filtern, Chips, Listen), öffnet ein Klick bzw. Antippen ein Popup mit der Quick-Ansicht und einem Link zum Artikel; Brotkrumen für die Navigation | – | [[F-070 Navigation & Kurzansicht\|Navigation & Kurzansicht]] | 2 | 5 | done | steht |
| [[REQ-249]] | Ebenen nach Herausgeber | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 2 | 3 | in progress | teils |
| [[REQ-250]] | Startausrüstung je Kampagne einstellbar: nach Regeln (Klasse/Hintergrund), Gold (fest oder gewürfelt) oder frei mit eigenen Grenzen (Goldbudget, höchstens N magische Gegenstände je Seltenheit u. ä.) | – | [[F-024 Charaktermanager\|Charaktermanager]] | 2 | 5 | done | steht |
| [[REQ-251]] | Sprachen der Kampagne: die Kampagne nennt die sinnvollen/möglichen Sprachen; Sprachwahlen in der Charaktererstellung bieten genau diese an | – | [[F-024 Charaktermanager\|Charaktermanager]] | 1 | 2 | done | steht |
| [[REQ-252]] | Abenteuer modular: Kapitel als Arcs, Begegnungen und Karten als eigene Szenen; einzelne Vorlesetexte oder ganze Kapitel in die eigene Kampagne übernehmen | – | [[F-033 Abenteuer übernehmen\|Abenteuer übernehmen]] | 2 | 5 | done | steht |
| [[REQ-253]] | Ebenen und Artikel kopieren | Spielleitung | [[F-004 Ebenen & Stapel\|Ebenen & Stapel]] | 3 | 5 | defined | offen |
| [[REQ-254]] | Namensgenerator: Namen für NSC, Orte usw. erzeugen (z. B. aus den Namenstabellen der Abstammungen/Kulturen), übernehmbar beim Anlegen | – | [[F-041 Namensgenerator\|Namensgenerator]] | 4 | 3 | defined | offen |
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
| [[REQ-305]] | Kampagne und Ebene immer sichtbar | Spielleitung | [[F-070 Navigation & Kurzansicht\|Navigation & Kurzansicht]] | 2 | 2 | defined | offen |
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

## Verlauf
- **0.9** (2026-10-14): Umstellung auf User Stories (T-154): 12 Epics, Features, je Story eine Notiz; REQ-236 … REQ-257 aus dem Projektbrett nachgetragen, REQ-258 ff. aus der Ernte aller Gespräche. Die Tabelle wird seither erzeugt.
- **0.1 … 0.8** (2026-08-28 … 2026-10-13): eine von Hand gepflegte Tabelle — im Git-Verlauf dieser Datei.
