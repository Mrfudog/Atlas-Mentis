# Durchgang durch die Typen

Stand 2026-09-20, nach Block 1. Was hier steht, ist **gemessen** und nicht
geschätzt: die Zahlen kommen aus dem Register und dem Prüfbestand (70
Artikel), und „— nie" heisst, dass kein einziger Artikel das Feld füllt.

Ein gerechnetes Feld (`derived`) steht nie im Bestand — es entsteht beim
Lesen (D8). Es taucht hier deshalb nicht als ungenutzt auf.

---

## Block 1 — die Basisteile · erledigt

| Was | Entscheidung |
|---|---|
| `Map.image` doppelte `Image.image` | weg; das Bild der Karte ist ihr `Image.image` |
| `Table.note`, `Access.note` doppelten `Notes.note` | weg; die Werte wanderten als Einträge |
| `Access.role` hiess „Role" wie `Creature.role` | heisst „Account role" |
| `Image.url` („Source (legacy)") | weg; Bildherkunft gehört ans Asset, das `Source` erbt |
| `Imported` | weg mit den Importern |
| `elImage` las `Image.ref` | **Fehler**: das Feld heisst `image`, `ref` gab es nie — das Bildelement zeichnete nie etwas |
| `Faction.color` ohne `format: 'color'` | **Fehler**: die Farbe stand als Text da; der Prüflauf sah es nicht, weil er die Feldart selbst setzt |

Offen aus Block 1:

- **`Time.until`/`untilSort`** — bleiben; `until` heisst an der Quest
  „Deadline".

### `Visibility` — entschieden am 30.9.

Sechs Felder, gelesen wurden zwei, gefüllt war keines (0 von 75). Sie waren
die **Vereinigung zweier Entwürfe**, die sich nicht einig waren; angenommen,
weil eine Bereichsentscheidung „full visibility schema stored from day one"
sagte. `allowedRoles`/`deniedRoles` aus dem zweiten Entwurf kamen nie an.

| Feld | Entscheidung |
|---|---|
| `audience` | bleibt, **`public` wird die Vorgabe** und heisst „jeder darf es sehen". Vier Stufen von aussen nach innen: `public` · `campaign` · `players` · `gm` |
| `revealedTo` | bleibt — und wird jetzt auch gelesen. Ein Verweisfeld auf Träger (`Creature ǀ Party ǀ Faction ǀ Group`) |
| `hiddenFrom` | bleibt, dieselben Träger. Es schlägt `revealedTo` schlägt `audience` |
| `scope` | **weg** — nirgends erklärt, nirgends gelesen. Ein Feld ohne aufgeschriebene Bedeutung füllt beim nächsten Mal jemand anders als beim letzten |
| `sharedUsers` | **weg** — dasselbe wie `revealedTo`, nur in Konto-Ids. Zwei Listen für eine Frage heissen, dass eine vergessen wird |
| `inherit` | **weg, und zwar bewusst.** Eine Vererbung an die „Kinder" stimmt nicht — ein Haus zu kennen heisst nicht, jedes Zimmer zu kennen. Sie bräuchte eine **Tiefe**, und die ist eine eigene Entscheidung. Kommt bei Bedarf wieder |

Der frühere Vorschlag (`audience` auf `gm | table` kürzen, `public`
streichen) war falsch: `public` heisst nicht „ein anonymer Leser", sondern
„jedes Konto" — und genau das ist die richtige Vorgabe.

Dazu drei Dinge, die keine Feldfrage waren und daran hingen:

- **Der Server wertete die Sichtbarkeit gar nicht aus.** `redactEntity`
  siebte Felder; `audience: 'gm'` stand in der Karte, und der Artikel ging
  raus. Jetzt filtert `sieve` zuerst (`articleVisible` in
  `packages/model/src/visibility.ts`), und ein Einzelabruf, der durchfällt,
  antwortet mit 404.
- **`app_user.is_gm` heisst `is_admin`.** Das Merkmal gilt für die ganze
  Installation und schaltet Register, Einladungen und unbeschnittenes Lesen —
  eine Verwaltungsrolle. „GM" las sich wie eine Rolle am Tisch.
- **Die Leitung je Kampagne** — am selben Tag nachgezogen, siehe unten.

### Eine Leitung je Kampagne — entschieden am 30.9.

`audience: 'gm'` hiess „die Verwaltung dieser Installation". Wer in einer
Runde leitet, kann in einer anderen mitspielen; also:

| Was | Entscheidung |
|---|---|
| `Access.role` | bekommt `gm`; die Liste steht jetzt von innen nach aussen (`gm ǀ co-gm ǀ player ǀ spectator`) |
| `Campaign` | nimmt `Access` dazu — eine Karte mit `role: 'gm'` und den Konten hinter dem Schirm |
| `co-gm` | bleibt an der Figur: am Schirm sieht ein Mitleiter dasselbe wie die Leitung |
| Wem ein Artikel gehört | **kein Feld** — eine Ebene, die genau eine Kampagne aufschaltet, gehört ihr; eine, die mehrere aufschalten, ist gemeinsam |

Damit heisst `audience: 'gm'` dreierlei, je nachdem wo der Artikel liegt: in
der Kampagnenebene nur deren Leitung, in einer geteilten Ebene jede Leitung,
in keiner Ebene ebenfalls jede. Ein Grundregelwerk, das drei Runden
aufschalten, gehört keiner davon.

`Layer.kind` kennt ein Wort `campaign` und wäre der naheliegende Ort gewesen.
Er ist es nicht: ein Feld, das gleichzeitig Regel ist, leckt beim ersten
Tippfehler — und ein geteiltes Paket mit `kind: 'campaign'`, das drei Runden
aufschalten, gehörte welcher?

**Offen und benannt:** ohne Ebenenkante gehört ein Artikel niemandem besonders
(65 von 75 heute — richtig bei *einer* Kampagne, falsch bei zweien);
`mayWrite` kennt die Leitung noch nicht; die laufende Kampagne ist eine
globale Einstellung.

### Die Rolle steht am Konto — entschieden am 1.10.

Einen Tag später nachgezogen: **eine Kontorolle gehört ans Konto**, nicht an
eine Figur und nicht an eine Kampagne. `Access` fällt als Typ weg.

| Was | Entscheidung |
|---|---|
| `Access` (`userIds`, `role`) | **weg** an Creature, PlayerCharacter, Party und Campaign. Der Server las die Karte nie, `userIds` war in keinem Artikel gefüllt |
| Konto → Figuren | bleibt `app_user_actor` |
| Konto → Rolle je Kampagne | neue Tabelle `campaign_member`; im Prototyp die Sammlung `members`, **nicht** in der Ausfuhr (REQ-199) |
| `gm` und `co-gm` | sehen dasselbe; die Leitung pflegt die Mitglieder, der Mitleiter sieht sie |
| Gepflegt | auf der Kampagnenseite, Element `members`; am Server `user role <name> <kampagne> <rolle>` |

Die Wanderung `prototype/migration/rollen-ans-konto.mjs` nimmt die Karten
heraus und zählt auf, was darin stand: im Prüfbestand zweimal `role player`
(Rook, Sela), keine einzige Konto-Id.

Dabei gefunden: **der Katalog verschwieg zwei ganze Bereiche.** Seine
Bereichsliste stand fest im Skript und nannte `story` und `game` — die Namen
von vor der Umbenennung zu `history` und `rules`. Einundzwanzig Artikelarten
standen deshalb nirgends darin, und eine fehlende Überschrift hinterlässt
keine Lücke. Die Bereiche kommen jetzt aus den Zeilen; 59 von 59 Arten stehen
im Katalog, vorher 38.

---

## Block 2 — Welt · erledigt

| Was | Entscheidung |
|---|---|
| `Weapon.Properties` | **weg** — die Eigenschaften sind `hasProperty`-Kanten auf gepoolte Regeln. Aus „finesse, leicht" wurden 6 Kanten; für Finesse, Leicht und Laden entstanden Regelartikel |
| `Group` lag in `play` | steht in `rules` — die Umbenennung `game` → `rules` hatte hier `play` eingesetzt, und der Kommentar daneben sagte weiter `game` |
| `Place.settlementType` | weg — `kind` sagt es schon (`Stadt`, `Distrikt`, `Gebäude`). Wird eine Siedlung genauer, ist sie ein Untertyp von `Place` und keine zweite Spalte |
| `Place.since` | weg — seit wann ist ein Datum, und `Time` führt Daten |
| `Item.availability` | bleibt, heisst „Purchase rarity": es ist die **Kaufrarität** aus dem Vault und nicht die Seltenheit des magischen Gegenstands |
| `Item.stackSize` | bleibt — gilt, wenn das Hausregel-Inventar läuft |
| `Item.weight` | bleibt — gilt mit dem Standardmodul; das Kachelinventar rechnet mit `rows` |
| `Group.purpose` | weg — wozu eine Gruppe da ist, steht in ihrer Beschreibung |

Die drei neuen Regeln (Finesse, Leicht, Laden) tragen `status: idea` und
keinen Text. Das ist Absicht: einen Regeltext zu erfinden, den niemand
geprüft hat, wäre schlimmer als eine Lücke, die sich zeigt — sie stehen
auf der Vorbereitungsseite unter „Unfinished".

Offen aus Block 2:

- **`Group.kind`** — die Aufzählung heisst heute `players|table|guests|crew`.
  Gemeint sind eher „Spielergruppe", „Fraktion" und was sonst eine
  Menschengruppe sein kann. „Fraktion" überschneidet sich allerdings mit der
  Artikelart `Faction`, also braucht die Liste ein Wort von dir.
- **`Companion` und `Retainer`** — keine eigenen Felder, keine eigenen
  Kanten, keine Artikel: reine Beschriftungen auf `Creature`. Das darf so
  sein, ist aber eine Entscheidung und kein Versehen.

### Was stimmt

`Creature` (5 Felder, alle gefüllt), `PlayerCharacter`, `Place.kind/state/arrival`,
`Item.itemType/rarity/copperPrice/rows`, `Weapon.damage/damageType/range`,
`Armor`, `Material`, `Faction.kind` und `Faction.color` (das jetzt eine Farbe
ist), `Party` (acht Felder, alle gefüllt).

---

## Abgleich mit dem Konzept — 2026-10-07

Das Register, gemessen gegen [Datenmodell.md](Datenmodell.md) (die Regeln
A, T, F, K, E, V) und gegen den Prüfbestand (75 Artikel). Je Punkt der Befund,
eine Empfehlung und eine leere Spalte für die Entscheidung — die fällt im
Gespräch, nicht hier.

| | Befund | Verstösst gegen | Empfehlung | Entscheidung |
|---|---|---|---|---|
| **A1** | `PlayerCharacter.player` (freier Text) und die Kante `playedBy` (→ `*`, one): wer eine Figur spielt, steht am Konto (`app_user_actor`). Beides ist eine Kontoangabe im Artikel, die mit der Ausfuhr wandert — dieselbe Lage wie `Access`. Im Bestand: `player` zweimal „—", `playedBy` nie | A10, REQ-199 | beide weg | **weg** (7.10., `spieler-am-konto.mjs`) |
| **A2** | **Der Server kennt den Stapel nicht.** `inStack` und `resolveArticle` laufen nur im Prototyp; das Modell liest `inLayer` nur für die Zugehörigkeit (`campaignsOf`). Ein Artikel, den eine Ebene herausnimmt (`removes`) oder überschreibt, geht vom Server trotzdem hinaus | E2 | E2 ins Modellpaket, vom Sieb vor `articleVisible` gerufen | **E2 im Modellpaket** (7.10., `packages/model/src/stack.ts`): `inPlay` = im Stapel und nicht überschrieben; das Server-Sieb ruft es vor `articleVisible`, für jeden, auch die Verwaltung. Die laufende Kampagne: Einstellung `campaign`, sonst die erste; ohne Kampagne gilt alles. |
| **A3** | `conditions` (gelesen von `Vitals.conditions` und `participates.conditions`) und `travelActions` (`Party.actions`) sind Wortlisten mit zwei Nutzern — als **Einstellung**, nicht als Zeile. `skills` bleibt Einstellung: eine Zuordnung, keine Liste | F1 | Zeilen `Condition` und `TravelAction`; `Vitals.conditions` wird `array` + `enumRef` | **Regelartikel** (7.10., `zustaende-als-regeln.mjs`): ein Zustand ist eine `Rule` mit `kind: condition`, eine Reisehandlung eine mit `kind: travel` (neuer Wert). `Vitals.conditions` ist ein Verweisfeld (`array` + `link`, Ziel `Rule` mit `kind: condition`), `participates.conditions[].rule` und `Party.actions` tragen die Id. Die beiden Einstellungen sind weg; `skills` bleibt. |
| **A4** | `State` (nur `Status.status`) und `DrawTime` (nur `Inventory.zones`) sind Zeilen mit **einem** Nutzer — F1 sagt wörtlich, so eine Liste bleibe am Feld. Sie stehen als Zeile, damit jemand die Wörter pflegen kann | F1 | die Regel ergänzen: „… oder wenn die Wörter Kampagneninhalt sind, den jemand pflegt"; beide behalten | |
| **A5** | **Dieselbe Einordnung zweimal:** `Story.kind` (campaign · arc · chapter · session · scene) *und* die Arten `Campaign`, `Arc`, `Chapter`, `Session`, `Scene`. `Arc` und `Chapter` tragen kein eigenes Feld und keine Kante; ebenso `Era`, `Cataclysm`, `Milestone` unter `Event` und `Consumable` unter `Item`. Im Bestand: Arc 1, alle anderen 0 | T2 | `Story.kind` weg — die Art sagt es. Dann **dein Wort**: `Arc`/`Chapter` als Arten behalten (die Leiste listet je Art, `partOf` trägt die Hierarchie) oder als Wörter an `Session`/`Story`? `Era`/`Cataclysm`/`Milestone` → `Event.kind` (frei, `suggest`); `Consumable` → `Item.itemType` | **Wörter** (7.10., `arten-werden-woerter.mjs`): `Story` ist konkret, `Arc`/`Chapter` sind `Story.kind`; `Era`/`Cataclysm`/`Milestone` sind `Event.kind`; `Consumable` ist `Item.itemType`. `Story.kind` bleibt frei mit Vorschlägen und steht an `Campaign`/`Session`/`Scene` leer — ob die Sprossen je eigene Felder brauchen, wird sich zeigen; dann werden sie wieder Zeilen. |
| **A6** | **Wo die Gruppe ist, steht zweimal:** `Party.at` (Verweis auf einen Ort, von der Punktreise geschrieben) und `{PARTYWHERE}` (vom Gruppen-Token auf der Karte). Spieltisch.md sagt „genau einmal — als Token" | K3, D8 | entweder sind es zwei Fragen (Knoten der Punktreise ≠ Ort auf der Karte), dann heisst `at` so, dass man es sieht — oder eine Stelle | **Eine Stelle, das Token** (7.10., `ort-am-token.mjs`): `Party.at` ist weg. Der Ort ist die Marke, auf der das Token steht, sonst der Ort der Karte; der Knoten der Punktreise ist der Ort oder der Knoten darüber; gröbere Karten bilden das Token durch den Rahmen der Unterkarte ab (gestrichelt). Weiterziehen setzt das Token um — auf die Karte des Knotens, sonst auf seine Marke auf der nächsten Karte darüber, die es bei Bedarf bekommt. |
| **A7** | **Ein Träger und seine Mitglieder:** Modell und Prototyp zählen einen Schritt nur über `memberOfParty`. Eine Information `knownBy` → `Faction` erreicht deren Mitglieder (`memberOf`) **nicht**; `hiddenFrom: Faction` verbirgt vor niemandem. CLAUDE.md verspricht „ein Träger zählt einen Schritt weit auch als seine Gruppe" | §9.1, §9.3 | `memberOf` wie `memberOfParty` behandeln — oder die Regel auf `Party` und `Group` einschränken und `Faction` als Träger streichen | **Mitglieder je Rang** (7.10.): `memberOf` zählt wie `memberOfParty`. `Faction.ranks` ist die Leiter, `memberOf.props.rank` die Sprosse, `knownBy.props.rank` an einer Zuteilung an die Fraktion ein Mindestrang; ohne Rang jedes Mitglied, ein Rang ausserhalb der Leiter schliesst nichts auf. `hiddenFrom`/`revealedTo` meinen jedes Mitglied (REQ-203). |
| **A8** | `Group`: Träger von Konten, `kind` players · table · guests · crew (offen seit Block 2). Seit `campaign_member` sind „die Spieler dieser Kampagne" eine **Rolle**, keine Gruppe | — | `Group` behalten für Mengen, die keine Rolle sind (Gäste, ein Teil des Tischs); `kind` frei mit `suggest` statt Aufzählung | **`Group` weg, `Party` hängt an der Kampagne** (7.10., `gruppe-ist-party.mjs`): die Gruppe ist das Figurengefüge einer Runde (`partyOf` → `Campaign`, one), eine andere Konstellation gibt es nicht; `Group` (ein Konto führte sie wie eine Figur) war eine zweite Sorte Träger, und „die Spieler dieser Kampagne“ sind eine Rolle. Träger sind `Creature`, `Party`, `Faction`. |
| **A9** | **Keine Art für Zauber.** REQ-067, 092, 097 offen; `Statblock` kennt kein `knows`. Im Vault waren `Spell`, `Class`, `Species`, `Background` Arten | — | eine Zeile `Spell` unter `Rule` (Bereich rules), Kante `knows` Statblock → Spell — wenn du sie brauchst | |
| **A10** | `kind` steht an zehn Arten mit verschiedenen Beschriftungen; `Statblock.kind` „Creature type" und `Creature.kind` „Kind" stehen auf **derselben** Seite nebeneinander (verlinkte Gruppe) | T6 | `Statblock.kind` → `creatureType` (humanoid, undead …); `Creature.kind` bleibt die Sorte (npc, companion …) | **`creatureType`** (7.10., `statblock-creaturetype.mjs`): das Feld am Statblock heisst, was es ist; `Creature.kind` bleibt die Sorte. |
| **A11** | `Time.calendar` je Artikel (frei, `suggest`) neben der Einstellung `calendar` — zwei Stellen für dieselbe Angabe, im Bestand nie gefüllt | — | behalten nur als „dieses Datum steht in einem anderen Kalender als die Kampagne", dann so beschriften; sonst weg | **Die Welt trägt den Kalender** (7.10., `welt-mit-kalender.mjs`): neue Art `World` mit `calendar`, Kante `inWorld` (Campaign → World, one); `Time.calendar` und die Einstellung `calendar` sind weg, `{CALENDAR}` liest die Welt. |
| **A12** | `regards.from`/`to` nennen `PlayerCharacter` neben `Creature`, obwohl die Kette das abdeckt | §3.3 | streichen (kosmetisch) | **gestrichen** (7.10.): `regards` nennt `Creature`, `Party`, `Faction`. |
| **A13** | `Asset` und `Layer` haben keinen Bereich und stehen in keiner Liste; erreicht über das Bildfeld bzw. die Kampagnenseite. Datenmodell §3.1 schreibt das jetzt so | — | bestätigen — oder ihnen einen Bereich geben | |
| **A14** | **Felder, die im Prüfbestand nie gefüllt sind** (Art hat Artikel): `Rule.uses`, `Rule.recharge` (8 Regeln) · `Statblock.resistances`, `vulnerabilities` (4) · `Item.availability`, `stackSize`, `weight` (5) · `Inventory.grid`, `zones` (2) · `Session.recap`, `activeScene` (1) · `Map.sheets`, `baseHidden`, `baseGmOnly`, `tiles`, `tileCols`, `tileRows`, `tileSize` (2) · `Board.background` (1) · `Article.poem`, `song` (2). Die meisten sind jünger als der Bestand | — | je Art durchgehen: behalten, wenn der Tisch sie braucht; sonst streichen | |
| **A15** | **Kanten ohne Einsatz:** `playedBy` (A1), `followsFrom` (Story → Story, one — neben `partOf` und `Time.sort`), `variantOf`, `includes`, `instanceOf`, `crafting` (die letzten drei sind neu) | — | `followsFrom` weg, wenn `Time.sort` die Reihenfolge trägt; `variantOf` bleibt (REQ-008) | |
| **A16** | **Das Konzept im Vault ist überholt** (`Schemas.md`, `Data Definitions.md`, `Backbone Concept.md`, Stand 5.9.): Komponenten, `requires`/`allows`, `Access`, `KnowledgeLevel`, `successorId`, `key`, Facetten | — | oben in den drei Dateien „überholt durch Nebelwacht/docs/Datenmodell.md" eintragen — ich kann es, wenn das Repo mit Schreibzugriff angehängt ist | **erledigt** (7.10.): die drei Seiten tragen `status: superseded` und einen Hinweis auf Datenmodell.md; Decision Log D25–D41 nachgetragen; `VTT/Umsetzung.md` wird aus dem Repo erzeugt (`anforderungen.mjs --umsetzung`). |

**Was dabei in Ordnung war:** alle 36 Artikelarten nehmen die Grundausstattung;
kein `measure` ohne `unit`, kein Verweis ohne Zieltyp; keine wörtliche
Aufzählung an zwei Feldern; keine Umbenennung auf ein fremdes Feld; keine
Kante auf einen unbekannten Typ; jeder Standardwert steht in seiner Auswahl.

**Bekannt offen, nicht neu:** mehrere Kampagnen (die laufende ist eine
globale Einstellung, 65 von 75 Artikeln ohne Ebene, `gmFields` gilt
installationsweit); `mayWrite` kennt die Leitung nicht; Rollen setzt am
Server nur die Kommandozeile.

---

## Noch nicht durchgegangen

Block 3 (Geschichte), Block 4 (Regelwerk), Block 5 (Spiel) — Feld für Feld
mit dir. Die Nutzung ist gemessen (A14), die Felder stehen in
`docs/Artikeltypen.md`, das `pnpm --filter @nw/registry catalogue` erzeugt.
