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

- **`Visibility`** — sechs Felder, gelesen werden zwei (`audience === 'gm'`,
  `hiddenFrom`). Vorschlag: `audience` auf `gm | table` kürzen, `hiddenFrom`
  behalten, `scope`/`revealedTo`/`sharedUsers`/`inherit` streichen. `public`
  verspricht einen anonymen Leser, den es nicht gibt — der Server verlangt
  eine Anmeldung.
- **`Time.until`/`untilSort`** — bleiben; `until` heisst an der Quest
  „Deadline".

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
