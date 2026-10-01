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

## Noch nicht gemessen

Block 3 (Geschichte), Block 4 (Regelwerk), Block 5 (Spiel). Die Zahlen
stehen in `docs/Artikeltypen.md`, das `pnpm --filter @nw/registry catalogue`
erzeugt.
