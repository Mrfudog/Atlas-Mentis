# Anforderungen — was gefordert war und was steht

Stand 2026-10-07. Jede Nummer aus dem Vault ([`Mrfudog/atlas-mentis`](https://github.com/Mrfudog/atlas-mentis), `Requirements.md` v0.6) und aus der Ernte
([Requirements from Kanalgang.md](Requirements%20from%20Kanalgang.md)), mit dem Stand im Repo.
Erzeugt von `packages/registry/scripts/anforderungen.mjs` aus einer Zuordnung, die ein Urteil ist:
wer eine Zeile anders sieht, ändert sie dort und lässt das Skript laufen.

| Stand | Heisst |
|---|---|
| **steht** | gebaut, in der Form der Anforderung oder einer gleichwertigen |
| **teils** | ein Teil steht; was fehlt, steht in der Anmerkung |
| **offen** | nichts davon steht |
| **ersetzt** | anders gelöst als gefordert, mit Absicht — die Anmerkung sagt wie |
| **verworfen** | entschieden gegen die Anforderung |

Zusammen: **105** steht · **10** ersetzt · **27** teils · **55** offen · **6** verworfen — 203 Anforderungen.

## Aus den Gesprächen (September und Oktober 2026)

Was nicht als Nummer im Vault steht, sondern hier entschieden wurde — alles gebaut:

| Wann | Entscheidung | Wo |
|---|---|---|
| 19.9. | Prototyp bleibt Artefakt; Zugang ein Passwort je Nutzer, kein SSO; Bearbeiten per Klick aufs Feld; Wissen über ein Seitenpanel; Massenbearbeitung; Session als Artikel | Roadmap.md |
| 19.9. | Oberfläche und Bezeichner englisch | CLAUDE.md |
| 20.9. | Importer weg, `Imported` weg; Register steht einmal (`emit-seed`) | CLAUDE.md |
| 20.9. | Komponenten weg, Arten tragen ihre Felder (D27); `extends` ist ein Array | Roadmap.md D25, D27 |
| 21.9. | Aufzählungszeilen (`enums`), Spannen, Übungen in einem Feld; Identity.key wird Identity.id | Begriffe.md |
| 30.9. | Sichtbarkeit: `public` ist die Vorgabe, drei Felder, keine Vererbung; `is_gm` heisst `is_admin` | Durchgang.md |
| 30.9. | Eine Leitung je Kampagne; wem ein Artikel gehört, sagt die Ebene | Ebenen.md |
| 1.10. | Rollen am Konto (`campaign_member`), `Access` weg | Zugang.md |
| 1.10. | Ohne Statblock keine Zahlen; Anlegen oder aus einer Vorlage; Kreaturen ohne Statblock in der Vorbereitung | Begriffe.md |
| 1.10. | Hetzner: `preprod` → dev, `main` → prod, nur CI baut; Durchstich gegen Postgres | Betrieb.md |
| 1.10. | Vorlage und Instanz: eine Instanz je Kreatur, nur Abweichungen gespeichert | Datenmodell.md §7 |
| 7.10. | Vorschläge nur, wo das Feld es sagt (`suggest`); der Deckname ist keine Sorte | Begriffe.md |

## Die Nummern

| ID | Anforderung | Prio | Stand | Anmerkung |
|---|---|---|---|---|
| REQ-001 | Core entity model: entity types, shared property types, typed relations, immutable IDs | 1 | **steht** | Peg, Karten, Kanten, Register — Datenmodell.md §1–5 |
| REQ-002 | Successor chain: successorId, resolution to head so old links stay valid | 1 | **ersetzt** | keine Nachfolgerkette; Fassungen über `overrides` und `variantOf` in Ebenen |
| REQ-003 | Change chain: every change as entry (who/when/what) along the version chain, git-log style | 1 | **teils** | Server schreibt `event_log` (`entity.written`, `entity.deleted`); keine Anzeige, keine Kette |
| REQ-004 | Layer entity: types system/expansion/world/pack/campaign/override-set, dependsOn, nesting by link with priority | 1 | **steht** | `Layer.kind` system · expansion · world · pack · campaign · overrides, `order`, `version` |
| REQ-005 | Entry relation: entity→layer with mode adds/overrides/removes, addedAt/addedBy, optional version pin | 1 | **steht** | `inLayer` mit `mode` adds/removes; Überschreiben ist die Kante `overrides`; kein Pin |
| REQ-006 | Stack resolution: campaign-activated ordered layers, specificity precedence (campaign > pack > world > system) | 1 | **teils** | Prototyp: `inStack`/`resolveArticle`; Server kennt nur die Zugehörigkeit (`campaignsOf`) — Abgleich A2 |
| REQ-007 | Stack expert settings: layer priority, per-entry pick, disable single override, flatten into independent layer | 3 | **offen** |  |
| REQ-008 | Variant mechanism: copy with variantOf link | 1 | **teils** | Kante `variantOf` da; kein Kopierknopf |
| REQ-009 | Override mechanism: explicit overrides relation with scope | 2 | **steht** | `overrides` in einer Ebene, Auflösung im Prototyp |
| REQ-010 | Dimensions: optional, sparsely stored property bundles (Visibility, TemporalValidity, KnowledgeRequirement, Reputation…) | 1 | **steht** | als Grundtypen: `Visibility`, `Status`, `Time` |
| REQ-011 | ContentBlock primitive: text + visibility + knowledge requirement + scope + temporal validity + pack membership | 1 | **ersetzt** | ein Textblock ist ein Feld (`many` + `long`) mit Eintrags-Id; gesperrt wird je Eintrag über eine Information |
| REQ-012 | Block types: paragraph, readaloud, fact, secret, poem/song/review… extensible list | 2 | **steht** | als Prosafelder: paragraph, readaloud, fact, secret, lore, tactics, note, poem, song, appearance, personality |
| REQ-013 | Reference registry & auto-linking: ID-based links, alias matching, auto-link when unambiguous, suggest when ambiguous | 1 | **teils** | `[[Verweise]]` nach Name und Alias, Vorschläge beim Tippen, `Rule.autolink`; kein Auto-Link beim Schreiben |
| REQ-014 | Backlinks view | 3 | **steht** | Rückbezüge in der Seitenleiste (`backlinks`) |
| REQ-015 | Graph view | 4 | **offen** | Typdiagramm steht (Register › How it works); Artikelgraph nicht — Aufgabe #44 |
| REQ-016 | Term / translation layer: pseudoname key, LocalizedText, fallback chain DE → EN → key | 1 | **verworfen** | keine Übersetzungsschicht; Bezeichner englisch, Inhalte in der Sprache der Kampagne |
| REQ-017 | Term engine bindings: system-specific semantic evaluation of rule terms | 4 | **offen** |  |
| REQ-018 | Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types | 1 | **offen** | keine `effects[]`; Regeln sind Text mit `{VAR}` |
| REQ-019 | RawContent coexistence: every import keeps its raw form (markdown, OCR, JSON) next to structured data | 1 | **verworfen** | die Importer sind weg (2026-09-20), mit ihnen `Imported`; kommt mit neuen Importern zurück |
| REQ-020 | SourceRef provenance: publication, page, optional file + page anchor | 1 | **steht** | `Source`: publication, page, anchor, url |
| REQ-021 | Asset entity contract: backend app/nas/external, consumers resolve URLs via asset service | 1 | **steht** | `Asset`: backend app/external, ref, mime, width, height, bytes |
| REQ-022 | Derived asset variants: thumbnails, map tiles, PDF page renders, stored app-side | 3 | **offen** |  |
| REQ-023 | Status dimension: idea / planned / used / discarded | 2 | **ersetzt** | `State`: idea · prepared · ready; used/discarded waren Ereignisse und sind das Feld der Art (`Quest.progress`, `Encounter.phase`) |
| REQ-024 | WorldDate property type: canonical sortable value + display string + CalendarSystem reference | 1 | **steht** | `Time.sort` (sortierbar), `Time.display`, `Time.calendar` |
| REQ-025 | CalendarSystem definition: months, eras, moons, configurable per world/system | 3 | **offen** | nur die Einstellung `calendar`; keine Kalenderzeile |
| REQ-026 | View config format: mode raw/structured/hybrid, field list, resolution priority per view | 1 | **steht** | drei Ansichten, Anordnung am Typ (`InterfaceDef.views`) |
| REQ-027 | Generic template engine & Template Manager UI (generalize hardcoded types) | 4 | **steht** | das Register ist Daten mit Masken (Prototyp); keine Codeänderung je Art |
| REQ-028 | Full-text search across content | 3 | **teils** | Suche über Name, Marken und Feldwerte im Kompendium; keine Volltextindizierung am Server |
| REQ-029 | Serializable schema / export (future file or git backing) | 3 | **steht** | Ausfuhr/Einfuhr als eine Datei; Register allein (`register-datei.mjs`) |
| REQ-030 | Reputation hooks: weighted tags on relations, propagation rule slot reserved | 2 | **ersetzt** | Kante `regards` mit Marken (Beziehungen.md) |
| REQ-031 | Authentication: password hash check behind an auth interface | 1 | **steht** | Argon2id, Sitzung beim Server (Zugang.md) |
| REQ-032 | Nextcloud / OIDC SSO behind the auth interface | 4 | **verworfen** | Entscheidung 2 (19.9.): kein SSO |
| REQ-033 | User accounts & profile | 1 | **steht** | `app_user` |
| REQ-034 | Simplest onboarding: GM-created accounts or plain invite link, whichever is cheaper | 2 | **steht** | Einladung, Konto selbst anlegen |
| REQ-035 | Membership triples: user + scope (campaign/world/layer) + role | 1 | **steht** | `campaign_member (campaign, user, role)`; Scope ist die Kampagne |
| REQ-036 | Roles GM / Player (Admin global) | 1 | **steht** | gm · co-gm · player · spectator; `is_admin` global |
| REQ-037 | Roles Co-GM / Spectator | 3 | **steht** |  |
| REQ-038 | Visibility evaluation, simple: gm_only vs campaign | 1 | **steht** | `audience`, am Server ausgewertet (`articleVisible`) |
| REQ-039 | Visibility evaluation, full: scope, allowed/denied roles, knowledgeTags, requiresTags, sharedUsers | 3 | **ersetzt** | drei Felder statt sechs; scope, Rollenlisten, sharedUsers weg (30.9.) |
| REQ-040 | Knowledge tags & KnowledgeState per campaign (grants, holders, since) | 2 | **steht** | anders: `Information`/`Knowledge` als Artikel, `knownBy` an Träger |
| REQ-041 | Per-document edit permissions: owner, GM-default (overridable), co-editors / wardship / open | 2 | **teils** | Verwaltung oder eigene Figur (+ carries/holds/crafting); die Leitung fehlt in `mayWrite` |
| REQ-042 | Field-group edit granularity (e.g. vitals editable, abilities locked) | 4 | **offen** |  |
| REQ-043 | Campaign configuration store: key-value, each area interprets its keys | 2 | **steht** | Registerteil `settings` |
| REQ-044 | Scope inspector sidebar, slim: effective source layer per block/property | 2 | **steht** | Herkunft am Artikelkopf, Ansicht `stack` |
| REQ-045 | Scope inspector sidebar, full: layer actions (override here, create variant, move to pack, pick entry) | 3 | **offen** |  |
| REQ-046 | Creature / Statblock split with PC and NPC specializations | 1 | **steht** | `belongsTo`, `PlayerCharacter`; NPC ist `Creature.kind` |
| REQ-047 | Import-first entry: 5e.tools JSON, Improved Initiative JSON, markdown paste from Obsidian | 2 | **verworfen** | Importer entfernt; wiederkommen heisst neu schreiben |
| REQ-048 | Minimal edit form for core creature fields | 2 | **steht** | Bearbeiten in der Ansicht und im Dialog |
| REQ-049 | Quick add: name-only NPC or statblock-only mob in one field | 2 | **steht** | Anlegedialog mit Statblock-Frage, Schnellanlage aus einem Verweis |
| REQ-050 | Simple creature viewer: social / description / combat sections | 2 | **steht** | Reiter Overview · Combat · Gear · Craft · Ties |
| REQ-051 | Quick changes: HP, temp HP, conditions, rest, inspiration | 2 | **steht** | `Vitals` mit `alwaysEdit`, Bogen |
| REQ-052 | Detailed statblock viewer | 3 | **steht** | Statblock-Seite mit eingesetzten Regeln |
| REQ-053 | Statblock as composition of RuleElement references (traits, feats, actions) | 2 | **steht** | `composedOf` mit `{VAR}`-Bindung |
| REQ-054 | Fightingtype field (MCDM roles) on statblock | 2 | **steht** | `Statblock.combatRole` |
| REQ-055 | Inline trait reuse & variant creation while typing | 3 | **offen** | Pool steht; Variante beim Tippen nicht |
| REQ-056 | Creature builder with suggestions (origin + fightingtype filter, grants applied via effects) | 4 | **offen** |  |
| REQ-057 | Point-buy ability setting | 4 | **offen** |  |
| REQ-058 | Monster scaling | 5 | **offen** |  |
| REQ-059 | Creature knowledge facts: gated ContentBlocks on type / species / faction | 3 | **steht** | `Facts.fact#id` über eine Information |
| REQ-060 | Companions / summons as regular creatures via companionOf + overrides | 3 | **teils** | `Creature.kind` companion/summon; keine `companionOf`-Kante |
| REQ-061 | Creature relations (creature ↔ creature / faction) with relation type | 2 | **steht** | `owes`, `memberOf`, `livesIn`, `regards` |
| REQ-062 | Multi-system statblock extension point (system reference on composition) | 5 | **offen** | `Statblock.system` als Feld vorhanden |
| REQ-063 | Character sheet: General tab (HP, temp, hit dice, death saves, AC, conditions, resources, rest) | 2 | **steht** |  |
| REQ-064 | Inventory as list: coins / attuned / worn / carried / stored / deeds | 2 | **steht** | `holds.tier`, `holds.slot` |
| REQ-065 | Tile-based visual inventory (alternative view over same data) | 4 | **steht** | Kachelraster, `Item.rows`, `Inventory.grid`/`zones` |
| REQ-066 | Character sheet: Combat tab (initiative, actions, companions) | 3 | **steht** | Reiter Combat; Initiative am Spieltisch |
| REQ-067 | Character sheet: Spellcasting tab (slots/points, concentration, active spells, list) | 3 | **offen** | es gibt keine Art für Zauber — Abgleich A9 |
| REQ-068 | Character sheet: Freeplay tab | 4 | **offen** |  |
| REQ-069 | Phone-first responsive layout for all player-facing views | 1 | **teils** | Prototyp passt sich an; `apps/web` ist noch klein |
| REQ-070 | Local dice roller (selector, modifiers, results) | 2 | **steht** |  |
| REQ-071 | Shared rolls & roll log per session | 4 | **steht** | Würfe über den Raum-Kanal, Protokoll |
| REQ-072 | Player notes as owned documents | 2 | **offen** | `Notes` an Artikeln; kein eigener Notizartikel je Spieler |
| REQ-073 | Custom / reorderable sheet layout | 4 | **ersetzt** | die Anordnung steht am Typ im Register, nicht je Nutzer |
| REQ-074 | Quicklinks: campaign, quests, party, session | 3 | **teils** | Bereich Play und die Leiste |
| REQ-075 | Campaign as root NarrativeContainer with attached CampaignSettings, WorldDate, KnowledgeState | 1 | **steht** | `Campaign`, `settings`, Zeitleiste |
| REQ-076 | NarrativeContainer hierarchy with DM-definable container types (Arc, Session, Scene, Kapitel…) | 1 | **steht** | `Story` (`kind`: arc, chapter …) · Campaign · Session · Scene, Hierarchie über `partOf` |
| REQ-077 | Session documents with planned vs occurred encounters and reports | 2 | **steht** | `Session`, `Encounter.phase` |
| REQ-078 | Session prep cockpit: container view aggregating scenes, quests, storylines, encounters, notes | 2 | **steht** | Element `prep` |
| REQ-079 | DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap | 2 | **teils** | Wissen zuteilen im Seitenpanel; kein Ein-Tipp-Knopf in der Sitzung |
| REQ-080 | Readaloud blocks unlocking for players after session (time/event-based grant) | 3 | **offen** |  |
| REQ-081 | Reputation & relationship system: interaction tags propagate NPC → faction → city with renown thresholds and status | 4 | **ersetzt** | siehe REQ-030 |
| REQ-082 | Quests with tasks, rewards, restrictions; player-facing quest board with gated GM parts | 3 | **steht** | `Quest.tasks`, `reward`, `restriction`; Auftragsbrett |
| REQ-083 | Player-created quests and personal goals | 3 | **offen** | Spieler schreiben nur ihre Figur |
| REQ-084 | Ideas inbox per campaign/player and clean vs planning view toggle | 3 | **steht** | Unfinished, Todos |
| REQ-085 | Encounter entity: links notes, maps, NPCs, loot tables; attachable to any container level; dice-table semantics | 2 | **steht** | `Encounter`, `participates`, `onMap`, `loot`, `tableFor` |
| REQ-086 | Party view: passive perception, feats, inventory overview | 3 | **teils** | Party-Seite mit Inventar und Werkbank; keine Übersicht der passiven Wahrnehmung |
| REQ-087 | Calendar module: months, moons, holidays, time-of-day widget with triggers, lore coupling | 5 | **offen** |  |
| REQ-088 | Bulk actions: knowledge / permission assignment | 3 | **teils** | Massenbearbeitung ohne Wissen |
| REQ-089 | RuleElement reference objects: structured text, tags, optional effects/constraints, rawContent | 1 | **steht** | `Rule`, `Feat`, `Skill` |
| REQ-090 | Rule import from Obsidian markdown and 5e.tools data | 2 | **verworfen** | siehe REQ-047 |
| REQ-091 | Rules browser: filtered, grouped, searchable, with layer origin in scope sidebar | 2 | **steht** | Bereich Rules mit Filter |
| REQ-092 | Spell entities with layer-scoped attached rule sets (5e 2014 / 2024 / homebrew) | 2 | **offen** | keine Art für Zauber — Abgleich A9 |
| REQ-093 | Rule engine per system evaluating rules against entity data (constraints, terms) | 5 | **offen** |  |
| REQ-094 | Entity ↔ rule attachment as layer-scoped relation | 2 | **steht** | `hasProperty`, `composedOf`; die Ebene über `inLayer` |
| REQ-095 | Effects interpreter for grants (first consumer: creature builder) | 4 | **offen** |  |
| REQ-096 | Constraint interpreter (first consumer: settlement / building validation) | 5 | **offen** |  |
| REQ-097 | Spell lists as relations (class ↔ spell) | 3 | **offen** | braucht REQ-092 |
| REQ-098 | Sub-5-second rule lookup during play | 2 | **steht** | Verweise im Text, Merkzettel |
| REQ-099 | Pinnable rules: bookmark object (user + context + rule) | 3 | **steht** | Merkzettel (pinned) |
| REQ-100 | World as scope and layer (members, owns content, activated by campaigns) | 1 | **teils** | `Layer.kind: world`; keine Mitglieder je Welt |
| REQ-101 | Lore articles: categories, composed of ContentBlocks | 2 | **steht** | `Article` mit poem/song |
| REQ-102 | Contextual article rendering per stack: knowledge, time, scope resolved at read time | 2 | **teils** | Prototyp ja; Server ohne Stapel — Abgleich A2 |
| REQ-103 | Locations: hierarchy via parent, type, biome | 2 | **steht** | `Place.kind`, `environment`, `partOf` |
| REQ-104 | Factions: type/subtype taxonomy, relations | 2 | **steht** | `Faction.kind`, `controls`, `memberOf` |
| REQ-105 | NPC directory as filtered view over creatures with relations | 3 | **steht** | Kompendium nach Art gefiltert |
| REQ-106 | Events & timelines sorted by WorldDate | 3 | **steht** | `Event`, `Time`, Element `timeline` |
| REQ-107 | Pantheons / deities as article subtype | 4 | **offen** | eine Zeile, wenn gebraucht |
| REQ-108 | Campaign-specific lore divergence via campaign-scoped blocks and overrides | 3 | **steht** | `overrides` in der Kampagnenebene |
| REQ-109 | Player-authored ContentBlocks with per-view block-type whitelist | 3 | **teils** | Felder da (`Article.poem/song`); Schreibrecht offen (REQ-041) |
| REQ-110 | Bibliothek von Tan'Jit: illustrated navigation presentation layer over articles | 5 | **offen** | Aufgabe #59 Portal |
| REQ-111 | Boards: user-owned configurable views with tabs/pages and widgets; DM and player boards share the mechanism | 2 | **steht** | `Board`, `placed` |
| REQ-112 | Widget: reference box holding multiple open articles with inner tabs | 2 | **ersetzt** | Platzierungen auf dem Board |
| REQ-113 | Widget: notes | 2 | **offen** | Aufgabe #58 |
| REQ-114 | Widget: quick-create (creates entries in the campaign layer inline) | 2 | **teils** | Anlegen aus dem Board |
| REQ-115 | Widget: initiative tracker — session-aware, conditions with durations, damage attributed to current actor by default | 2 | **steht** | `participates` mit init, hp, conditions (je Eintrag ein Regelartikel `kind: condition`, Runden, Quelle) |
| REQ-116 | Session state objects (initiative, now-playing, active scene, party note) + realtime channel per session | 2 | **steht** | `Session.activeMap/activeEncounter/activeScene`; Raum-Kanal für Augenblicke |
| REQ-117 | Stewardship: write permission on a state object per user, GM override configurable | 3 | **steht** | `Session.stewardship` gm/table |
| REQ-118 | Widget: encounter runner — instantiate participants, roll random entries, raw statblocks trackable | 3 | **steht** | Begegnung mit Teilnehmern und Tabellen |
| REQ-119 | Player boards | 3 | **offen** |  |
| REQ-120 | Play log: persist state events (actor, target, delta) | 3 | **teils** | Würfe im Protokoll; Zustandsereignisse nicht gespeichert |
| REQ-121 | Statistics widget: kills, damage per character, monsters faced, records | 4 | **offen** |  |
| REQ-122 | Widget: party overview | 3 | **steht** | Party-Seite |
| REQ-123 | Widget: timers | 3 | **offen** |  |
| REQ-124 | Widget: quest board | 3 | **steht** | Element `quests` |
| REQ-125 | Widget: random tables & generators (names, shops, loot, cities) | 3 | **steht** | `Table.kind` loot · encounter · name · shop · event · generic |
| REQ-126 | Widget: sound — embed/link external tool, native now-playing state only | 4 | **teils** | `Session.nowPlaying` als Feld; kein Einbetten |
| REQ-127 | Native soundboard / music engine | 5 | **offen** |  |
| REQ-128 | Combat player view: own initiative, conditions, health comments | 3 | **teils** | dieselbe Ansicht, gesiebt |
| REQ-129 | Chatbot: rules Q&A, facts, quick edit | 5 | **offen** |  |
| REQ-130 | Map entity: image asset, scale, grid config (size, offset, square/hex), link to Location | 3 | **steht** | `Map` mit Gitter, Massstab, `mapOf` |
| REQ-131 | Nested maps: parent + anchor region, zoom-through transitions world → region → city → district → battlemap | 3 | **steht** | `insideMap` mit Rahmen, Hineinzoomen |
| REQ-132 | Level lock: pin current map level while zooming | 3 | **offen** |  |
| REQ-133 | Static tokens: reference markers linked to entities (pin opens article) | 3 | **steht** | `marker` |
| REQ-134 | Static tokens: scenery / props as part of prepared map state | 4 | **steht** | `marker.kind: scenery` |
| REQ-135 | Play tokens: session- or campaign-scoped state objects (combat positions, temporary changes) | 3 | **teils** | Tokens als Kanten; keine getrennte Lebensdauer je Sitzung |
| REQ-136 | Party and quest markers on region maps (campaign-scoped play tokens) | 3 | **steht** | Gruppen-Token, `{PARTYWHERE}` |
| REQ-137 | Overlays: query-driven highlights (faction locations, biomes, routes) | 4 | **teils** | `territory` von Hand; keine Abfrage |
| REQ-138 | Map tiling for smooth zoom (derived asset) | 4 | **steht** | `Map.tiles` |
| REQ-139 | Fog of war | 4 | **steht** | `Map.reveal` |
| REQ-140 | Light & line of sight with walls | 5 | **steht** | `marker.light/dim`, `Map.walls`, `visionPoly` |
| REQ-141 | Map effects & animations (conditions, weather) | 5 | **offen** |  |
| REQ-142 | Drawing, stamps, brushes, layers on maps | 5 | **offen** | Aufgabe #60 |
| REQ-143 | Map editor / full map creation | 5 | **offen** |  |
| REQ-144 | Initiative indicator on battlemap (current / next) | 4 | **steht** |  |
| REQ-145 | Asset service implementation: app-managed storage (icons, portraits, thumbnails) | 1 | **teils** | Assets als Artikel; Ablage im Artefakt |
| REQ-146 | NAS / Nextcloud backend for large assets (mount vs WebDAV → AD-15) | 2 | **offen** |  |
| REQ-147 | Image upload, portraits, icons | 2 | **teils** | Prototyp ja; Server noch nicht |
| REQ-148 | External URL assets | 3 | **steht** | `Asset.backend: external` |
| REQ-149 | PDF viewer with page-anchor jump from SourceRef | 4 | **offen** |  |
| REQ-150 | Audio asset storage | 5 | **offen** |  |
| REQ-151 | 3D file viewer / repository | 5 | **offen** |  |
| REQ-152 | OCR / PDF import to structured content with editable raw output (MonsterBox-style) | 5 | **offen** |  |
| REQ-153 | German UI output with i18n-ready string handling | 2 | **ersetzt** | Oberfläche englisch (19.9.) |
| REQ-154 | Deployment: container(s) on NAS, reverse proxy, TLS, remote player access | 1 | **steht** | Hetzner, Caddy, GHCR (Betrieb.md) |
| REQ-155 | Backups of database and app-managed assets | 2 | **steht** | Sicherung vor jedem Ausrollen; nächtliche als Rezept |
| REQ-156 | Visibility inheritance container → children: `inherit: true` on Visibility, evaluated by Resolution | 2 | **verworfen** | `inherit` bewusst weg — kommt mit einer Tiefe wieder, wenn gebraucht |
| REQ-157 | Canvas boards: free positioning, scaling and arrangement of entity placements on a board (Figma/Canva-style), beyond the widget grid | 2 | **steht** | `placed` mit x, y, w, h, z |
| REQ-158 | Placement rendering: each placement resolves to a facet/renderer via the display resolution; explicit per-placement override always wins | 2 | **steht** | `placed.view` |
| REQ-159 | Frames / viewpoint anchors: named canvas viewports (position, zoom depth, target facet, visible layers), persisted in the board config | 3 | **steht** | `Board.anchors` |
| REQ-160 | Anchor quick navigation: jump between anchors (list, hotkeys) — session notes → map → house rules without leaving the board | 3 | **teils** |  |
| REQ-161 | Display resolution as priority system: entity profile proposes, board rules (per interface / attribute value) decide, user overrides; placement override wins; ties → board rule; works board-only | 2 | **steht** | `Board.rules`, `placed.view` |
| REQ-162 | Semantic zoom: zoom depth maps onto facets (compact list of weapon properties → full detail on zoom-in); anchors may store a target facet | 4 | **offen** |  |
| REQ-163 | Opaque IDs: no semantics (pack/type/version) in peg IDs; provenance via source metadata (`source_pack`, `source_version`); copying only as explicit fork with `forkedFrom` | 1 | **steht** | undurchsichtige Id; `Identity.id` als Nummer |
| REQ-164 | Facets (Darstellungsstufen): system-wide set short/description/full/image/token/map/link, reusable across boards, sheets, statblocks, notes; `renderer_def` analogous to `projection_def` | 2 | **ersetzt** | drei Ansichten; Bild, Token, Karte sind Elemente |
| REQ-165 | Board placements beyond content entities: assets (images, icons), geometric/mathematical shapes as inline canvas objects, and tool objects (interactive widgets such as creature creator or generators) on the canvas | 2 | **steht** | `Board.shapes`, Assets als Platzierung |
| REQ-166 | Board-first authoring: create entities directly on the canvas (into the campaign layer), choose their facet and place them in one flow | 2 | **teils** | Anlegen auf dem Board |
| REQ-167 | Print & export outputs: item cards, creature cards, character sheets (PDF), maps (image/print) rendered from facets — the facet defines *what* appears, the medium (screen/print/pdf/image) *how*; card-sheet assembly (n cards per page) as export config | 3 | **offen** |  |
| REQ-168 | Point-crawl travel: node/edge graph attached to a Location, with per-edge sensory read-aloud text and per-node arrival state | 3 | **steht** | `route` mit signal, `Place.state` |
| REQ-169 | Exploration state ladder per map feature (verborgen → entdeckt → erkundet) with cascade: exploring a node reveals its edges as discovered | 3 | **steht** | `Place.state` hidden · discovered · explored |
| REQ-170 | Travel resource cadence: consumables consumed every N nodes or watches, configurable per travel ruleset | 4 | **steht** | Einstellungen `travel*`, `Party.sinceRation/sinceLight` |
| REQ-171 | Per-node action budget: one action per character per node from a configurable list (sneak, craft, forage, rest) | 4 | **steht** | `Party.actions`: Figur → Regelartikel `kind: travel` |
| REQ-172 | Weighted encounter tables per region, with per-location type constraints and safety states that restrict the pool | 3 | **steht** | `entry.weight`, `requiresTag`, `tableFor` |
| REQ-173 | World-state decay between sessions: roll to degrade secured locations, weighted by adjacency to faction territory | 4 | **offen** |  |
| REQ-174 | Parameterised rule templates: `{VAR}` placeholders in RuleElement text, bound per reference; resolution order reference → entity → campaign register | 2 | **steht** | `{VAR}`: Kante → Artikel → Kampagnenwerte → Register |
| REQ-175 | Inline rule reference panel: text scanned against RuleElement names and aliases, matches shown as an expandable block in the view | 3 | **steht** | `Rule.autolink` |
| REQ-176 | Similarity suggestions on create: fuzzy name/text matching proposes existing entities before a duplicate is made; promote-to-reference in one action | 3 | **teils** | Vorschläge nach Name und Alias; keine Ähnlichkeit |
| REQ-177 | Field-level knowledge gating: grant individual components or fields of an entity, not only ContentBlocks | 2 | **steht** | `Information.fields` je Feld und je Eintrag |
| REQ-178 | Cover names: an entity may carry a player-facing alias shown while its identity is ungranted | 3 | **steht** | `Identity.cover` |
| REQ-179 | Known-unknowns disclosure: a gated view may reveal the count of withheld facts without revealing them | 4 | **steht** | „…and 3 more things" |
| REQ-180 | Narrative seeds: planted threads with category (Backstory · Geheimnis · Faden · Idee · Versprechen · Konsequenz) and status (offen · gepflanzt · aufgegangen · verworfen), bound to a character and the session planted in | 3 | **offen** | keine Art und kein Feld für gepflanzte Fäden |
| REQ-181 | Ad-hoc fields on a single entity, promotable into the interface definition | 2 | **steht** | `adhoc` mit Befördern |
| REQ-182 | Relation inverse labels in `relation_def`, so one stored edge renders correctly from both ends | 2 | **steht** | `inverseLabel` |
| REQ-183 | Party-owned inventory as a shared container distinct from character inventories | 3 | **steht** | `carries` von `Party` |
| REQ-184 | Crafting: recipes with material inputs, skill checks and DC, time, and output; consumption on completion | 4 | **steht** | `Recipe`, `needs`, `yields`, `crafting` |
| REQ-185 | Non-coin economies: barter and alternative currency ladders per region | 5 | **offen** |  |
| REQ-186 | Nested loot tables: a table entry may reference another table, with cycle protection | 3 | **steht** | `entry` auf eine Tabelle |
| REQ-187 | Table display mode: a shared read-only presentation view for a screen at the table, distinct from per-player accounts | 3 | **offen** |  |
| REQ-188 | Cross-type "unfinished" overview: everything at status idea/planned across all interfaces, with jump-to and bulk status change | 3 | **steht** | Unfinished |
| REQ-189 | Aggregated todo list across containers and entities (campaign, arc, session, quest, NPC) | 3 | **steht** | `Todos`, gesammelt |
| REQ-190 | Quick capture during play: one field that files a seed, todo or idea against the current session without leaving the view | 3 | **steht** | Schnellerfassung an der Sitzung |
| REQ-191 | Fail-closed persistence: a failed load or migration must never be overwritten by a later autosave; the unreadable state is preserved and downloadable | 1 | **steht** | Fail-closed im Prototyp |
| REQ-192 | Optimistic concurrency for non-realtime edits: per-entity revision check; the second writer is rejected with a merge prompt rather than silently winning | 2 | **teils** | Prototyp; Server ohne Revisionsprüfung |
| REQ-193 | Territory overlays rasterised onto the map grid from shapes (rect, circle, ellipse, polygon) | 4 | **steht** | `territory` |
| REQ-194 | Mobile navigation: the user chooses which entries occupy the phone bottom bar | 4 | **offen** |  |
| REQ-195 | Statblock export back to Obsidian markdown, preserving `{VAR}` placeholders unresolved | 4 | **offen** |  |
| REQ-196 | Sitzungsmitschnitt: Audio einer Sitzung aufnehmen oder eine fertige Aufnahme anhängen, als Asset am Sitzungs-Container, mit Startzeit und Kapitelmarken | 4 | **offen** |  |
| REQ-197 | Transkription und Recap-Entwurf: Mitschnitt transkribieren, am Sitzungsverlauf ausrichten und daraus einen Recap-Entwurf erzeugen, den die SL bearbeitet | 4 | **offen** |  |
| REQ-198 | Sprecherzuordnung im Transkript: Abschnitte einer Figur oder der SL zuordnen, damit „was hat meine Figur mitbekommen“ beantwortbar wird | 5 | **offen** |  |
| REQ-199 | Produktionsdaten nach preprod spiegeln: regelmässiger Abzug aus der Prod-Datenbank in die Testinstanz, damit gegen echte Inhalte getestet wird | 3 | **steht** | Rezept in Betrieb.md, ohne Konten; `members` nicht in der Ausfuhr |
| REQ-200 | Chat: Fäden zwischen SL und einzelnen Spielern und zwischen Spielern untereinander, an der Kampagne und nicht an einer Sitzung | 3 | **offen** |  |
| REQ-201 | Aus einer Stelle im Chat wird Kampagneninhalt: eine Nachricht (oder ein markierter Abschnitt) wird zur Idee, zum Todo, zum Faden oder zu einem ContentBlock an einem Artikel, mit Rückverweis auf die Stelle | 3 | **offen** |  |
| REQ-202 | Chats stehen ausserhalb von Abzug, Ausfuhr und Recap: ein Faden zwischen zwei Spielern gehört weder in den Prod-nach-preprod-Abzug noch in eine Kampagnenausfuhr, und die SL liest nicht mit | 2 | **offen** |  |
| REQ-203 | Fraktionen mit Rängen: `Faction.ranks` als Leiter (niedrigster zuerst), der Rang eines Mitglieds an der Kante `memberOf`, und eine Wissenszuteilung an die Fraktion darf einen Mindestrang nennen — was der Zirkel weiss, weiss der Novize noch nicht | 2 | **steht** | `Faction.ranks`, `memberOf.props.rank`, `knownBy.props.rank` als Mindestrang (7.10., A7) |

## Was offen ist und wehtut

Offene Anforderungen mit Priorität 1 bis 3, nach Bereich:

- **REQ-003** (1, teils) — Change chain: every change as entry (who/when/what) along the version chain, git-log style — *Server schreibt `event_log` (`entity.written`, `entity.deleted`); keine Anzeige, keine Kette*
- **REQ-006** (1, teils) — Stack resolution: campaign-activated ordered layers, specificity precedence (campaign > pack > world > system) — *Prototyp: `inStack`/`resolveArticle`; Server kennt nur die Zugehörigkeit (`campaignsOf`) — Abgleich A2*
- **REQ-008** (1, teils) — Variant mechanism: copy with variantOf link — *Kante `variantOf` da; kein Kopierknopf*
- **REQ-013** (1, teils) — Reference registry & auto-linking: ID-based links, alias matching, auto-link when unambiguous, suggest when ambiguous — *`[[Verweise]]` nach Name und Alias, Vorschläge beim Tippen, `Rule.autolink`; kein Auto-Link beim Schreiben*
- **REQ-018** (1, offen) — Rule effects format: effects[] with grants/constraints, open type list, consumers ignore unknown types — *keine `effects[]`; Regeln sind Text mit `{VAR}`*
- **REQ-069** (1, teils) — Phone-first responsive layout for all player-facing views — *Prototyp passt sich an; `apps/web` ist noch klein*
- **REQ-100** (1, teils) — World as scope and layer (members, owns content, activated by campaigns) — *`Layer.kind: world`; keine Mitglieder je Welt*
- **REQ-145** (1, teils) — Asset service implementation: app-managed storage (icons, portraits, thumbnails) — *Assets als Artikel; Ablage im Artefakt*
- **REQ-041** (2, teils) — Per-document edit permissions: owner, GM-default (overridable), co-editors / wardship / open — *Verwaltung oder eigene Figur (+ carries/holds/crafting); die Leitung fehlt in `mayWrite`*
- **REQ-072** (2, offen) — Player notes as owned documents — *`Notes` an Artikeln; kein eigener Notizartikel je Spieler*
- **REQ-079** (2, teils) — DM session quick actions: grant knowledge, reveal block, mark encounter occurred — one tap — *Wissen zuteilen im Seitenpanel; kein Ein-Tipp-Knopf in der Sitzung*
- **REQ-092** (2, offen) — Spell entities with layer-scoped attached rule sets (5e 2014 / 2024 / homebrew) — *keine Art für Zauber — Abgleich A9*
- **REQ-102** (2, teils) — Contextual article rendering per stack: knowledge, time, scope resolved at read time — *Prototyp ja; Server ohne Stapel — Abgleich A2*
- **REQ-113** (2, offen) — Widget: notes — *Aufgabe #58*
- **REQ-114** (2, teils) — Widget: quick-create (creates entries in the campaign layer inline) — *Anlegen aus dem Board*
- **REQ-146** (2, offen) — NAS / Nextcloud backend for large assets (mount vs WebDAV → AD-15)
- **REQ-147** (2, teils) — Image upload, portraits, icons — *Prototyp ja; Server noch nicht*
- **REQ-166** (2, teils) — Board-first authoring: create entities directly on the canvas (into the campaign layer), choose their facet and place them in one flow — *Anlegen auf dem Board*
- **REQ-192** (2, teils) — Optimistic concurrency for non-realtime edits: per-entity revision check; the second writer is rejected with a merge prompt rather than silently winning — *Prototyp; Server ohne Revisionsprüfung*
- **REQ-202** (2, offen) — Chats stehen ausserhalb von Abzug, Ausfuhr und Recap: ein Faden zwischen zwei Spielern gehört weder in den Prod-nach-preprod-Abzug noch in eine Kampagnenausfuhr, und die SL liest nicht mit
- **REQ-007** (3, offen) — Stack expert settings: layer priority, per-entry pick, disable single override, flatten into independent layer
- **REQ-022** (3, offen) — Derived asset variants: thumbnails, map tiles, PDF page renders, stored app-side
- **REQ-025** (3, offen) — CalendarSystem definition: months, eras, moons, configurable per world/system — *nur die Einstellung `calendar`; keine Kalenderzeile*
- **REQ-028** (3, teils) — Full-text search across content — *Suche über Name, Marken und Feldwerte im Kompendium; keine Volltextindizierung am Server*
- **REQ-045** (3, offen) — Scope inspector sidebar, full: layer actions (override here, create variant, move to pack, pick entry)
- **REQ-055** (3, offen) — Inline trait reuse & variant creation while typing — *Pool steht; Variante beim Tippen nicht*
- **REQ-060** (3, teils) — Companions / summons as regular creatures via companionOf + overrides — *`Creature.kind` companion/summon; keine `companionOf`-Kante*
- **REQ-067** (3, offen) — Character sheet: Spellcasting tab (slots/points, concentration, active spells, list) — *es gibt keine Art für Zauber — Abgleich A9*
- **REQ-074** (3, teils) — Quicklinks: campaign, quests, party, session — *Bereich Play und die Leiste*
- **REQ-080** (3, offen) — Readaloud blocks unlocking for players after session (time/event-based grant)
- **REQ-083** (3, offen) — Player-created quests and personal goals — *Spieler schreiben nur ihre Figur*
- **REQ-086** (3, teils) — Party view: passive perception, feats, inventory overview — *Party-Seite mit Inventar und Werkbank; keine Übersicht der passiven Wahrnehmung*
- **REQ-088** (3, teils) — Bulk actions: knowledge / permission assignment — *Massenbearbeitung ohne Wissen*
- **REQ-097** (3, offen) — Spell lists as relations (class ↔ spell) — *braucht REQ-092*
- **REQ-109** (3, teils) — Player-authored ContentBlocks with per-view block-type whitelist — *Felder da (`Article.poem/song`); Schreibrecht offen (REQ-041)*
- **REQ-119** (3, offen) — Player boards
- **REQ-120** (3, teils) — Play log: persist state events (actor, target, delta) — *Würfe im Protokoll; Zustandsereignisse nicht gespeichert*
- **REQ-123** (3, offen) — Widget: timers
- **REQ-128** (3, teils) — Combat player view: own initiative, conditions, health comments — *dieselbe Ansicht, gesiebt*
- **REQ-132** (3, offen) — Level lock: pin current map level while zooming
- **REQ-135** (3, teils) — Play tokens: session- or campaign-scoped state objects (combat positions, temporary changes) — *Tokens als Kanten; keine getrennte Lebensdauer je Sitzung*
- **REQ-160** (3, teils) — Anchor quick navigation: jump between anchors (list, hotkeys) — session notes → map → house rules without leaving the board
- **REQ-167** (3, offen) — Print & export outputs: item cards, creature cards, character sheets (PDF), maps (image/print) rendered from facets — the facet defines *what* appears, the medium (screen/print/pdf/image) *how*; card-sheet assembly (n cards per page) as export config
- **REQ-176** (3, teils) — Similarity suggestions on create: fuzzy name/text matching proposes existing entities before a duplicate is made; promote-to-reference in one action — *Vorschläge nach Name und Alias; keine Ähnlichkeit*
- **REQ-180** (3, offen) — Narrative seeds: planted threads with category (Backstory · Geheimnis · Faden · Idee · Versprechen · Konsequenz) and status (offen · gepflanzt · aufgegangen · verworfen), bound to a character and the session planted in — *keine Art und kein Feld für gepflanzte Fäden*
- **REQ-187** (3, offen) — Table display mode: a shared read-only presentation view for a screen at the table, distinct from per-player accounts
- **REQ-200** (3, offen) — Chat: Fäden zwischen SL und einzelnen Spielern und zwischen Spielern untereinander, an der Kampagne und nicht an einer Sitzung
- **REQ-201** (3, offen) — Aus einer Stelle im Chat wird Kampagneninhalt: eine Nachricht (oder ein markierter Abschnitt) wird zur Idee, zum Todo, zum Faden oder zu einem ContentBlock an einem Artikel, mit Rückverweis auf die Stelle

