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

## Block 2 — Welt · vorbereitet

### Was auffällt

**`Weapon.Properties`** — als einziges Feld im ganzen Register
grossgeschrieben, und es ist ein String. Waffeneigenschaften sind
eigentlich gepoolte Regeln, die über die Kante `hasProperty` hängen; genau
das war der Grund, sie nicht als Text zu importieren. Drei Gegenstände
tragen es. Entweder umbenennen (`properties`) oder durch die Kante
ersetzen und den Text wegwerfen.

**`Group` liegt im Bereich `play`.** Sie ist ein Wissensempfänger („die
Spieler dieser Kampagne") — das ist Einrichtung und nicht das, worauf man
während der Sitzung schaut. Kein Artikel benutzt sie bisher.

**`Companion` und `Retainer`** haben keine eigenen Felder, keine eigenen
Kanten und keine Artikel: sie sind reine Beschriftungen auf `Creature`. Das
darf so sein — ein Begleiter ist eine Kreatur, auf die man zeigen kann —,
aber es ist eine Entscheidung und kein Versehen.

### Felder, die kein Artikel füllt

| Typ | Feld | Anmerkung |
|---|---|---|
| `Place` | `settlementType` | `kind` hat schon `Stadt`/`Distrikt`/`Gebäude` — vermutlich das ältere von beiden |
| `Place` | `since` | seit wann es den Ort gibt; `Time` kann das |
| `Item` | `availability` | neben `rarity`, das 17× gefüllt ist |
| `Item` | `stackSize` | Stapelgrösse — kam aus dem Vault, nie benutzt |
| `Item` | `weight` | trägt `unit: 'lb'`; das Inventar rechnet heute mit `rows` |
| `Group` | `purpose`, `kind` | beide nie, weil es keine Gruppe gibt |

### Was stimmt

`Creature` (5 Felder, alle gefüllt), `PlayerCharacter`, `Place.kind/state/arrival`,
`Item.itemType/rarity/copperPrice/rows`, `Weapon.damage/damageType/range`,
`Armor`, `Material`, `Faction.kind`, `Party` (acht Felder, alle gefüllt).

---

## Noch nicht gemessen

Block 3 (Geschichte), Block 4 (Regelwerk), Block 5 (Spiel). Die Zahlen
stehen in `docs/Artikeltypen.md`, das `pnpm --filter @nw/registry catalogue`
erzeugt.
