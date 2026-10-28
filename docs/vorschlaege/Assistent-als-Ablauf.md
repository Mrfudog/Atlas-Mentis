# Der Charakter-Assistent als Ablauf (T-436) — Kurzkonzept

Stand 28.10.2026, **wartet auf Basil**. Zu REQ-433, REQ-440, E-169, E-176
(E-177/E-178 für die Pflicht je Stand). Grundlage: Schnitt 8a von T-425
(PR #399): `create`/`createFull`, Element `steps`, `currentStep`, Element
`builder`, Migration 154.

## Was heute steht

- `apps/web/src/app/figur/assistent.ts` (2777 Zeilen) ist **eine** Komponente
  für `/characters/new` und `/characters/:id/edit`. Die Schritte rechnet
  `builderSteps` (`packages/model/src/builder.ts`) aus dem Entwurf:
  `pick` (Abstammung, Hintergrund, Klasse, mit verschachtelten Wahlen),
  `abilities`, `choice` (je offene Wahl einer), `hitpoints`, `equipment`,
  `details`. Am Aufstieg: `level`, Wahlen, `hitpoints`.
- Der **Fortschritt ist gespeichert**: als Einstellung `characterDraft` je
  Konto (Kanten, Werte, Würfe, Warenkorb, **`index`**, auf später Gelegtes).
  Die Figur entsteht erst bei „Create character“, und zwar gleich `ready`.
- **Einen eigenen Level-up gibt es seit T-319 nicht**: `/characters/:id/level-up`
  leitet auf `edit`, gestiegen wird im Klassen-Schritt je Klasse.
- `PlayerCharacter.views.create` = `[builder]` → „New article“ öffnet den
  Assistenten. `steps` kann bisher nur **Feldelemente** als Seiten; die
  Seitenzahl steht fest, `currentStep` liest nur Felder.

## Die zwei Reibungen mit E-176

1. **Die Seitenzahl des Assistenten ist nicht fest**: je offene Wahl eine
   Seite, und eine gewählte Unterklasse bringt weitere. Ein `steps`-Kind ist
   eine Seite. → Ein Kind darf ein **Ablaufelement** enthalten, das sich in
   **mehrere Seiten auffächert** (`choices`: eine je offene Wahl).
2. **Fortschritt wird nicht gespeichert** — der Assistent speichert ihn
   heute (`characterDraft.index`). → Die Figur wird **früh angelegt**, als
   `idea`, und alles Gewählte steht als Kanten und Felder an ihr; wo man
   steht, liest `currentStep` daraus.

## Vorschlag

### Der Ablauf ist eine Ansicht

`PlayerCharacter.views.createFull` bekommt als Vorgabe:

```text
steps
├─ section "Ancestry"    → pick { edge: hasAncestry }   (+ ihre Wahlen, verschachtelt)
├─ section "Background"  → pick { edge: hasBackground }
├─ section "Class"       → pick { edge: hasClass }
├─ section "Abilities"   → abilities
├─ section "Choices"     → choices            ← fächert auf: eine Seite je offene Wahl
├─ section "Hit points"  → hitpoints
├─ section "Equipment"   → equipment
└─ section "Details"     → fields [Identity.name, Description.description, …]
```

`create` (der schnelle Dialog) behält `builder`: der Dialog fragt Name und
Ebene, legt die Figur als `idea` an und öffnet `createFull` an ihr. Damit
gibt es **keine eigene Route mehr**: `/characters/new` und
`/characters/:id/edit` leiten auf die Artikelseite
(`/artikel/:id?edit=create` bzw. `?edit=steps`).

**`levelUp`** ist eine eigene Ansicht in der Gruppe `createFull`, eine
**Schicht** (`adjust`) auf den Creator:

```text
adjust:
  drop:  [Ancestry, Background, Abilities, Equipment, Details]
  add:   section "Level" → level   (pos 5, vor „Class“)
  # Class bleibt (Stufe je Klasse), Choices zeigt nur das Neue, Hit points zuletzt
```

`/characters/:id/level-up` führt in diese Ansicht (statt heute auf `edit`).
**Das kehrt T-319 teilweise um** — siehe Frage 2.

### Was Code bleibt

Jede **Sorte** Schritt wird ein Layout-Element mit eigener Komponente,
herausgelöst aus `assistent.ts`. Die Logik bleibt, wo sie ist
(`builder.ts`, `choices.ts`, `equipment.ts`):

| Element | Zeichnet | Schreibt |
|---|---|---|
| `pick` (`edge`) | Kandidaten, Vergleich, „More about“, verschachtelte Wahlen | Kante `hasAncestry`/`hasBackground`/`hasClass` (`props.level`, `props.subclass`) |
| `abilities` | Verfahren, Würfe, Gruppenpools, Punkte | `Abilities.*` am Statblock |
| `choices` | je offene Wahl eine Seite (`builderSteps` → `choice`) | Kante `chose` mit `props` (Antwort, `items`) |
| `level` | Klasse wählen, Stufe +1 | `hasClass.props.level` |
| `hitpoints` | Würfeln/Durchschnitt nach Kampagne | `Statblock.hp`, `Vitals.hp` |
| `equipment` | Varianten oder Startgold, Korb | über `applyEquipment` (Server) |

**Wahlen sind Kanten mit Props, keine Felder.** Darum lernt `currentStep`
neben Feldern auch Ablaufelemente: ein `pick` ist befüllt, wenn die Kante
steht; eine `choices`-Seite, wenn die Wahl in `answeredKeys` steht;
`abilities`, wenn die sechs Werte stehen. Eine Funktion
`stepFilled(el, entity, byId)` in `packages/model/src/steps.ts`.

### Speichern und Stand (E-176, E-177/E-178)

- Angelegt wird beim ersten „Next“ (bzw. aus dem Dialog) als **`idea`**,
  samt Statblock. Jeder weitere Schritt **schreibt sofort** (wie heute der
  Entwurf, nur an der Figur statt in der Einstellung).
- „Finish“ setzt `ready`. Fehlt Pflichtiges (`requiredFor: ready` an
  Feld oder Kante, z. B. `hasClass`, `Abilities.*`), weist der Server mit
  `state_gaps` ab, die Figur bleibt `idea`, und der Ablauf springt auf die
  erste Lücke (`currentStep`). „Später“ heisst: einfach gehen.
- Die Spielerin sieht ihre Figur in jedem Stand (D74, `Viewer.ungated`);
  für die Mitspielenden ist eine `idea`-Figur nicht da, bis sie `ready` ist
  — **heute sehen sie sie sofort** (siehe Frage 3).
- Würfe und Warenkorb, die keine Figurfelder sind, bleiben **Sitzungsstand**
  der Seite (nicht gespeichert): ein Wurf zählt erst, wenn sein Ergebnis im
  Feld steht. Ausnahme Startgold-Wurf: der ist heute ein Ereignis
  (`goldWurf.event`) und bleibt eins.

### Mockup

Desktop (1360 px), Artikelseite im Bearbeiten, Ansicht `createFull`:

```text
┌─ Thorin  [idea]  · Layer: Basil (player) ───────────────────────── Full edit ─┐
│ ① Ancestry ✓  ② Background ✓  ③ Class ✓  ④ Abilities ✓  ⑤ Fighting Style ●   │
│ ⑥ Skills  ⑦ Hit points  ⑧ Equipment  ⑨ Details                                │
├───────────────────────────────────────────────┬───────────────────────────────┤
│ Fighting Style (Fighter 1)                    │  Summary                      │
│ ( ) Archery    (•) Defense    ( ) Dueling     │  Dwarf · Soldier · Fighter 1  │
│ +1 AC while wearing armor.                    │  STR 15 DEX 12 CON 14 …       │
│                                               │  AC 17 · HP —                 │
├───────────────────────────────────────────────┴───────────────────────────────┤
│ ◀ Back                    Saved · still an idea                     Next ▶    │
└───────────────────────────────────────────────────────────────────────────────┘
```

Telefon (390 px): die Schritte als waagrecht scrollende Chipleiste, die
Zusammenfassung zugeklappt unter dem Inhalt, Zurück/Weiter als feste
Leiste unten (wie die Werkzeugleiste nach E-171).

```text
┌──────────────────────────┐
│ Thorin  [idea]           │
│ ‹ ④ Abil. ⑤ Fighting… ⑥ ›│
├──────────────────────────┤
│ Fighting Style           │
│ ( ) Archery              │
│ (•) Defense              │
│ ( ) Dueling              │
│ ▸ Summary                │
├──────────────────────────┤
│ ◀ Back          Next ▶   │
└──────────────────────────┘
```

### Migration

- **Figuren:** nichts zu tun. Sie tragen schon Kanten und Felder; wer eine
  öffnet, landet nach `currentStep` am Ende (alles befüllt) bzw. auf der
  ersten Lücke.
- **Register:** Migration 155 setzt `PlayerCharacter.views.createFull` auf
  den Ablauf oben und legt die Ansicht `levelUp` an — nur wo die Art
  nichts Eigenes trägt (sonst wird es aufgezählt, nicht überschrieben).
  `register-abgleich` und `emit-seed` ziehen mit.
- **Offene Entwürfe** (`characterDraft` in den Einstellungen): beim ersten
  Öffnen wird daraus einmal eine `idea`-Figur (Kanten, Name, Werte), danach
  wird die Einstellung geleert. Eine Server-Migration dafür wäre möglich,
  aber sie müsste Ebene und Gruppe raten — im Browser steht beides da.
  Gezählt wird vorher auf dev (`select count(*) from user_pref where key = 'characterDraft'`).

### Schnitte

1. **Modell:** `stepFilled`, `currentStep` für Ablaufelemente, `choices`
   fächert auf (`expandSteps`). Nur `packages/model`, Unit-Tests.
2. **Elemente herauslösen:** `pick`, `abilities`, `choices`, `hitpoints`,
   `equipment`, `level` als Komponenten unter `figur/schritte/`; der
   Assistent nutzt sie selbst noch (kein Verhaltenswechsel, E2E
   `charakter.spec.ts` bleibt grün).
3. **Artikelseite zeichnet sie im `steps`-Element**; Registerzeile
   `createFull` + Migration 155. `/characters/new` leitet um, Anlegen als
   `idea`, „Finish“ → `ready` mit `state_gaps`.
4. **`levelUp`** als Schicht, Route, Ansichtswahl.
5. **Abbau:** `assistent.ts` und `characterDraft` weg (mit einmaliger
   Übernahme offener Entwürfe), Handbuch, Hilfe, Glossar, What's new.

Jeder Schnitt: Test zuerst rot, PR nach `preprod`, selbst mergen, dev prüfen.

## Fragen an Basil

1. **Früh anlegen als `idea`** (statt Entwurf in der Einstellung bis „Create“)?
   Folge: angefangene Figuren stehen als Artikel in der Spielerebene, auch
   halbe. *Empfehlung: ja* — das ist, was E-176 sagt.
2. **`levelUp` als eigene Ansicht** dreht T-319 halb zurück (dort wurde der
   eigene Aufstieg in `edit` gefaltet). Soll `edit` (alle Schritte, mit
   Antworten) daneben bleiben? *Empfehlung: ja, `edit` = `createFull` an
   einer fertigen Figur; `levelUp` = Schicht, die nur das Neue zeigt.*
3. **Sichtbarkeit:** heute ist eine neue Figur sofort `ready` und für die
   Mitspielenden da; nach E-176 erst nach „Finish“. *Empfehlung: so lassen,
   eine halbe Figur ist eine Idee.*
4. **Pflicht für `ready` an der Spielerfigur:** Vorschlag `hasAncestry`,
   `hasClass`, die sechs `Abilities.*`, `Identity.name`; Hintergrund und
   Ausrüstung nicht (heute auf später legbar). Passt das?
