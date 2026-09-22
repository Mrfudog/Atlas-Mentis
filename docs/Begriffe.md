# Begriffe

Stand 2026-09-21.

Diese Datei sagt, wie die Dinge heissen. Sie steht hier, weil dieselbe Sache
in den letzten Wochen „Komponente", „Schnittstelle", „Interface", „Karte",
„Ansicht", „View", „Facet" und „Stufe" geheissen hat — je nachdem, wer sie
gerade aufschrieb. Wer zwei Namen für eine Sache hat, hat bald zwei Sachen.

Sichtbarer Text ist englisch (siehe [CLAUDE.md](../CLAUDE.md)); deutsche
Prosa benutzt das deutsche Wort und nennt den englischen Bezeichner dazu.

---

## Die neun Wörter

| Deutsch | Englisch | Was es ist |
|---|---|---|
| **Typ** | Type | Eine Registerzeile. **Alles im Register ist ein Typ.** |
| **Bestandteil** | Part | Ein Typ, aus dem ein anderer zusammengesetzt ist. |
| **Feld** | Field | Ein Typ **an einer Stelle**: die Tatsache, die er dort festhält. |
| **Bezeichner** | Identifier | Die ausgegebene Nummer eines Artikels. |
| **Artikel** | Article | Ein Ding in der Kampagne. |
| **Ansicht** | View | Wie ein Artikel gezeichnet wird. |
| **Block** | Block | Ein Stück einer Ansicht. |
| **Kante** | Edge | Eine gerichtete Verbindung zwischen zwei Artikeln. |
| **Einheit** | Unit | Wie ein Mass geschrieben und umgerechnet wird. |

Mehr sind es nicht. Was früher **Komponente** hiess, gibt es nicht mehr —
eine Zeile, die Felder trug, ohne ein Typ zu sein, war ein zweites Ding für
dieselbe Arbeit (D27). Was früher **Schnittstelle** hiess, heisst jetzt
schlicht Typ. Und **Facet** und **Stufe** hiessen beide Ansicht.

---

## Typ

Eine Registerzeile. Sie hat drei Formen:

- **Basistyp** — er erklärt Felder und erbt nichts. `Identity` ist einer:
  Name, Nummer, Aliasse, Deckname. `Time` ist einer. `Tags` ist einer.
- **Zusammenschluss** — er ist aus anderen Typen gemacht und erklärt
  daneben vielleicht eigene Felder. `Quest` ist einer: `Identity`,
  `Status`, `Description`, `Visibility`, `Tags`, `Todos`, `Time` und ein
  paar eigene.
- **Aufzählung** (`REG.enums`) — eine Liste von Wörtern mit einem Namen und
  ohne Felder. `Ability` ist eine: `str`, `dex`, `con`, `int`, `wis`, `cha`.
  Sie steht im Register, weil **mehrere Felder dieselbe Liste brauchen** —
  die sechs Kürzel standen wörtlich an der Fertigkeit und am Rezept, und
  wer eins nachzog, zog das andere nicht nach. Acht gibt es: `Ability`,
  `Skill`, `Tool`, `Language`, `WeaponTraining`, `ArmorTraining`,
  `KnowledgeField`, `State`.

Ein Zusammenschluss darf aus Zusammenschlüssen bestehen; `PlayerCharacter`
besteht aus `Creature`, und `Creature` besteht aus siebzehn anderen.

**Text, Zahl, Datum, Farbe sind keine Registerzeilen.** Sie sind die *Form*
eines Feldes (`type` und `format`) — es gibt nichts an ihnen zu
konfigurieren, und eine Zeile „Text" wäre eine Zeile, die niemand öffnet.
Eine Aufzählung dagegen hat Inhalt, den man ändert, und darum steht sie da.

Ein Typ ist **abstrakt**, wenn kein Artikel ihn direkt trägt. `Identity` ist
abstrakt — niemand legt einen Artikel „Identität" an. Ohne die Angabe
stünde jeder Bestandteil im Kompendium als etwas, das man anlegen kann; das
ist der einzige Zweck, und es ist ein guter.

Ein **Artikeltyp** ist ein Typ, der nicht abstrakt ist: einer, von dem es
Artikel gibt. `Creature` ist einer — sie war einmal abstrakt, mit `NPC`,
`Companion` und `Retainer` darunter; drei Zeilen, die zusammen kein eigenes
Feld trugen. Was sie trennt, ist jetzt das freie Feld `kind`: npc,
companion, retainer, pet, summon. **Ein Untertyp, der nichts eigenes
erklärt, ist ein Wort und keine Zeile** — und wird eine Zeile in dem
Moment, in dem er eigene Felder braucht.

### Der erste Bestandteil zählt anders

`extends` ist eine Liste, und die Reihenfolge ist keine Zierde. Der **erste**
Eintrag zeichnet den Baum und entscheidet den Bereich (`area`); alle anderen
bringen nur ihre Felder und Kanten mit. Sonst gäbe es zwei Antworten auf die
Frage, wo eine Art hingehört, und die eine wäre still falsch.

---

## Bestandteil

Ein Typ in der `extends`-Liste eines anderen. Auf der Typenseite steht er
unter **Made of**.

**Ein Feld wird entfernt, indem der Bestandteil entfernt wird, der es
mitbringt.** Ein einzelnes geerbtes Feld auszublenden gibt es nicht: eine
Ausnahmeliste wäre an dem Tag unvollständig, an dem das nächste Feld
dazukommt, und gemerkt hätte es niemand.

---

## Feld

Eine Tatsache, die ein Typ festhält. Ein Feld hat

- einen **Schlüssel** (`hp`) und eine **Beschriftung** (`Hit points`) —
  die ein Typ für sich umbenennen darf, siehe unten,
- eine **Art** — Text, langer Text, Zahl, Datum, Farbe, Auswahl, Verweis,
  Ablage —,
- bei einer **Auswahl** entweder eigene Werte oder den Namen einer
  Aufzählungszeile (`enumRef`), nie beides: zwei Listen an einem Feld wären
  zwei Antworten auf dieselbe Frage. **Mehrere Zeilen sind erlaubt** und
  gelten zusammen — worin jemand geübt ist, kommt aus Fertigkeiten,
  Werkzeugen, Sprachen, Waffen, Rüstungen und Wissensgebieten. Ein Feld je
  Sorte hiesse, dieselbe Frage sechsmal zu stellen, und die siebte Sorte
  bräuchte ein siebtes Feld; woher ein Wert kommt, sagt die Liste, in der
  er steht,
- **eines oder mehrere**: dasselbe Feld mit `type: 'array'` hält mehrere
  Werte aus denselben Listen. „Welches Attribut trägt die Probe" ist eines,
  „auf welche Rettungswürfe ist sie geübt" sind mehrere,
- bei einer **Zahl** vielleicht eine Spanne (`min`, `max`). Eine
  Schwierigkeit von 1 bis 20 ist eine Spanne und keine Aufzählung von
  zwanzig Wörtern; fünf Wörter wären fünf Stufen mit Lücken dazwischen,
  und „zwischen medium und hard" gäbe es dann nicht,
- bei einem **Verweis** die Artikelarten, auf die er zeigen darf
  (`target.interfaces`, Untertypen eingeschlossen — eine Spielerfigur
  *ist* eine Kreatur). Kanten sagen das längst mit `from` und `to`; ein
  Feld sagte es nicht, und „Scene in play" hielt darum die Id von
  irgendetwas. Marken und Feldwert dürfen auch dastehen, aber die sind ein
  **Vorschlag für die Maske** und keine Regel: sie lesen den heutigen
  Zustand des Ziels, und ein entfernter Marker würde einen längst
  gespeicherten Verweis rückwirkend falsch machen,
- bei einem **Mass** die Einheit, in der es dasteht (`unit`),
- **Pflicht oder optional**,
- vielleicht einen **Standard**, der beim Anlegen gilt und nicht rückwirkend,
- vielleicht eine **Rechnung** (`derived`), und dann bekommt es keine
  Eingabe und wird nie gespeichert (D8).

Gespeichert wird **eine Karte je Typ**, benannt nach dem Typ, der das Feld
erklärt. Das hält `hp` an der Kreatur von `hp` am Statblock auseinander,
ohne dass eines von beiden einen Namen bekommt, den niemand gewählt hätte.

### Wie es an dieser Art heisst

Ein Typ darf ein geerbtes Feld umbenennen: `InterfaceDef.titles` ist eine
Karte `Typ.feld` → Beschriftung, aufgelöst die `extends`-Kette hoch wie
`area` und `units`. Derselbe `Time.until` ist an einem Ereignis, wann es
aufhört, und an einem Auftrag, wann es zu spät ist — also heisst er dort
„Deadline".

Es ist **keine zweite Feldliste**. Der Bestandteil bleibt einer, und ein
Feld, das morgen dazukommt, bringt seinen eigenen Namen mit. `Time` dafür
zu verdoppeln wäre der teurere Weg zum selben Satz, und die Kopie wäre am
Tag des nächsten Feldes unvollständig.

Geändert wird die Beschriftung auf der Typenseite, in der Zeile des
geerbten Feldes — und sie schreibt in den Typ, den man gerade offen hat.
Die Zeile steht in der Gruppe ihres Typs: zugeklappt sagt die Kopfzeile
nur, welcher Typ es ist und woher er kommt; aufgeklappt stehen seine
Felder, jedes mit seinen Einstellungen. Die gehören dem Typ, dem das Feld
gehört, und gelten für jede Art, die ihn nimmt.
Eine Umbenennung, die ein *Obertyp* gesetzt hat, steht dort lesbar und wird
dort geändert, wo sie steht: sie gilt für jede Unterart mit.

### Eins oder mehrere

Ein Feld mit `many` hält **mehrere** Werte, und jeder trägt eine Id:
`[{id, value}]`. Drei Geheimnisse an einer Kreatur sind drei Einträge in
`Secrets.secret` und nicht drei Felder.

Die Id ist kein Beiwerk. Eine Wissensfreigabe hängt an ihr — `Secrets.secret#
schuldet-floon-achtzig-drachen` gibt **genau dieses** Geheimnis frei und nicht
die anderen zwei. Deshalb wird sie aus dem Text gebildet und nicht
durchgezählt: derselbe Text ergibt dieselbe Id, und ein erneuter Import nimmt
die Freigaben nicht mit ins Leere. Das war der Blockanker, und das ist alles,
was von ihm übrig ist.

Ein Prosafeld — `many` und lange Eingabe — steht **nicht** in der Feldtabelle.
Es gehört dem Prosa-Element der Ansicht; zweimal dasselbe zu zeigen, oben als
Zeile und unten als Absatz, war genau das, was an den Blöcken störte.

---

## Bezeichner

`Identity.id` ist **ausgegeben, nicht eingetippt**: `npc-0042`, die
Artikelart und eine laufende Nummer darin. Er bekommt keine Eingabe und
ändert sich nach dem Anlegen nicht mehr.

Er hiess einmal `key` und stand als `npc/volo-geddarm` da — ein Name, der
ein zweites Mal derselbe Name war. Beim Umbenennen musste er entweder
mitwandern, dann war er kein fester Bezeichner, oder nicht, dann log er.
Eine Nummer sagt nichts und bleibt deshalb richtig; wie der Artikel heisst,
steht daneben.

**Er überlebt auch einen Wechsel der Art.** Die drei NSC, die Kreaturen
wurden, heissen weiter `npc-0001` bis `npc-0003`: der Anfang sagt, wie die
Art beim Anlegen hiess, und nicht, wie sie heute heisst. Eine Wanderung, die
Bezeichner umschreibt, wäre genau die Stelle, an der ein fester Bezeichner
wandert — und jede Freigabe, die ihn nennt, zeigte danach ins Leere.

Gezählt wird, was dasteht: die höchste vergebene plus eins. Ein
gespeicherter Zähler wäre eine zweite Stelle, die sagt, wie weit man ist,
und die nach dem ersten Import falsch steht. Eine Lücke, die ein Löschen
hinterlässt, bleibt eine Lücke — eine Nummer wiederzuverwenden hiesse, eine
Freigabe auf den falschen Artikel zeigen zu lassen.

Das ist **nicht** `derived`: ein gerechneter Wert entsteht bei jedem Lesen
neu (D8), eine ausgegebene Nummer muss stehen bleiben.

---

## Artikel

Ein Ding in der Kampagne: eine undurchsichtige ID, eine Liste von Typen, die
Karten mit den Feldwerten und die Kanten. Ein Artikel **ist** einen
Artikeltyp; was er festhält, sagt dieser Typ und die Bestandteile, aus denen
er gemacht ist.

---

## Ansicht

Wie ein Artikel gezeichnet wird. Es gibt **drei**, und welche gilt, sagt der
Ort und kein Schalter:

| Ansicht | Wo sie gilt | Was sie zeigt |
|---|---|---|
| **Overview** | Ein Verweis im Text, eine Listenzeile | Name und die Beschreibung — eine Handvoll Zeilen, wie ein Hover |
| **Quick** | Eine Karte auf dem Board, die Schnellanlage aus einem anderen Artikel | Das Nötigste, um zu wissen, was man vor sich hat |
| **Full** | Die Artikelseite | Alles, was dieser Artikel trägt |

Einen Wähler „welche Ansicht hätten Sie gern" gibt es nicht. Ein Verweis ist
ein Verweis, und eine Artikelseite ist eine Artikelseite — wer das jedes Mal
sagen muss, sagt es irgendwann falsch.

**Es gibt keine Spieleransicht.** Es gab einmal eine, und sie war die zweite
Stelle, an der stand, was ein Spieler nicht sehen darf. Zurückgehalten wird
am Server (`redactEntity`): was bei einem Spieler ankommt, darf er sehen, und
er sieht dieselbe Ansicht wie alle anderen — nur steht weniger darin.

**Die Anordnung wohnt am Typ.** Eine Kreatur ordnet ihre Full anders als ein
Rezept, und das steht bei der Kreatur. Untertypen erben sie, bis einer etwas
Eigenes sagt.

---

## Block

Ein Stück einer Ansicht — und dasselbe Stück in der Typdefinition. Ein Block
ist entweder

- die Felder **eines Bestandteils** (`Time` mit `sort`, `display`, `until` …),
- **ein einzelnes Feld** mit seiner Definition,
- oder etwas, das keine Felder sind: das Bild, die Kanten, die eingesetzten
  Regeln.

Typdefinition und Ansicht zeigen dieselben Blöcke. Wer in der Definition
einen Bestandteil sieht, sieht ihn in der Ansicht wieder — sonst müsste man
zwei Bilder derselben Sache im Kopf zusammenhalten.

> **Nicht mehr:** „Block" hiess einmal ein Stück Fliesstext am Artikel
> (`paragraph`, `readaloud`, `secret`). Das ist jetzt ein Feld mit langer
> Eingabe; mehrere davon macht „eins oder mehrere". Ein eigener Begriff für
> Text, der neben den Feldern lag, war eine zweite Art, dasselbe zu sagen.

---

## Kante

Eine typisierte, gerichtete Verbindung zwischen zwei Artikeln, die eigene
Eigenschaften tragen darf. **Gespeichert wird nur vorwärts**; die
Gegenrichtung ist immer eine Abfrage, und wie sie sich von dort liest, sagt
`inverseLabel`. Ein gespiegeltes Gegenstück verwaist.

Eine Kante mit `section` **setzt ein**, statt zu verweisen: die drei
gepoolten Regeln eines Statblocks stehen im Artikel und nicht als Links
daneben.

---

## Wissen

Eine **Information** ist eine Tatsache über *einen* Artikel: sie nennt seine
Felder und Textstellen (`Information.fields`) und wird Empfängern zugeteilt.

Ein **Knowledge** ist ein **Bündel** von Informationen. Es nennt sie über
`includes` und wird über dieselbe Kante zugeteilt wie eine einzelne — wer
„was ein Kanalgänger weiss" kennt, kennt alles darin, ohne dass jemand die
Zuteilungen einzeln nachzieht.

```
Artikel     --knowledge--> Information        (owned: stirbt mit dem Artikel)
Knowledge   --includes-->  Information
Information | Knowledge --knownBy--> Creature | Party | Faction | Group
```

Ein Bündel in einem Bündel zählt nicht: ein Schritt weit, dieselbe Regel wie
bei den Haltern. Sonst reichte eine Freigabe weiter, als jemand gemeint hat.

> **Nicht mehr:** es gab einen `KnowledgeLevel` — einen *Stand*, dem Figuren
> über `atLevel` angehörten. Das war ein zweiter Weg zu „wer weiss das",
> obwohl `Party` und `Group` schon Empfänger sein konnten, und in zwei Jahren
> hat ihn niemand benutzt: kein Artikel, keine Kante.

---

## Die Zahlen einer Kreatur

**Sie wohnen am Statblock** — auch die eines Spielercharakters. Er hat mehr
darüber hinaus (Stufe, Klasse, Hintergrund), aber AC, HP-Maximum und die
sechs Werte sind dieselbe Sache wie bei jedem Monster. Welcher Statblock es
ist, sagt `belongsTo`; gespeichert wird nur vorwärts, und „welchen Statblock
hat Rook" ist der Rückbezug.

`Vitals` bleibt bei der Figur: das ist, was sich **während** der Sitzung
ändert — Trefferpunkte jetzt, Erschöpfung, Zustände, Todesretter. Es gehört
ihr und nicht ihrem Bogen.

Damit heisst `hp` am Statblock das Maximum und an der Figur, was sie gerade
noch hat. Die Namensgleichheit ist keine Falle mehr, sondern die Wahrheit:
zwei Karten an zwei Artikeln.

> **Nicht mehr:** eine Kreatur trug die Statblockzahlen auch selbst, und der
> Bogen las „erst die eigene, dann die geliehene". Zwei Formen für dasselbe —
> wer eine Kreatur änderte, musste wissen, in welcher der beiden ihre Zahlen
> gerade standen. Und `belongsTo` reichte nur bis zum NSC, ein
> Spielercharakter konnte also gar keinen haben.

---

## Einheit

Der Vault ist imperial, weil die Regeln es sind: vierzig Fuss Bewegung,
dreissig Pfund Gepäck. Am Tisch sitzen Leute, für die das nichts bedeutet.

Deshalb steht **eine** Zahl in den Daten, und die andere wird beim Lesen
gerechnet (D8) — zwei Zahlen für dasselbe Mass sind zwei Zahlen, die sich
widersprechen können.

Wie gerechnet wird, ist eine Registerzeile: `ft` hat `quantity: length`,
`system: imperial` und `base: 0.3048` — so viel Meter ist einer. Damit ist
jede Umrechnung eine Division, und eine neue Einheit ist ein Einfügen. In
welcher Einheit ein Wert im Zielsystem dasteht, entscheidet die
Grössenordnung: drei Meilen sind knapp fünf Kilometer und nicht 4828 Meter.

Ein Feld sagt mit `unit`, in welcher Einheit sein Wert steht. Ein Textfeld
mit `format: measure` darf Masse im Fliesstext tragen („40 ft, climb 20 ft")
— umgeschrieben wird nur, was wie eine Zahl mit bekannter Einheit aussieht.

**Ein Mass ohne Einheit ist keines.** Umgerechnet wird aus der
gespeicherten Einheit; nennt das Feld keine, rechnet nichts, und das sieht
aus wie eine Zahl, die schon stimmt — genau so stand die Geschwindigkeit
einer Kreatur in Fuss auf einem metrischen Tisch. Darum verlangt die
Prüfung `unit` an jedem `measure`-Feld. An einem Text ist es das
**Ausgangsmass**: die Einheit der Zahlen, die selbst keine nennen. Es
greift nur, wenn im ganzen Text kein Buchstabe steht — „40" und „30/120"
sind dann Fuss, „7 zorp" bleibt sieben Zorp. Alles andere wäre geraten,
und ein Umschreiben, das auch nur manchmal danebengreift, ist schlimmer
als gar keines: man sieht es dem Ergebnis nicht an.

Was gezeigt wird, sagt die Einstellung `units` (`imperial`, `metric`,
`both`); eine Artikelart darf es überschreiben und vererbt es wie `area`.
Eine Kreatur darf imperial bleiben, weil ihre Zahlen aus dem Regelwerk
kommen, während der Rest der Kampagne metrisch dasteht.

---

## Was nirgends steht

Zwei Dinge werden nie gespeichert, und beide aus demselben Grund — zwei
Stellen können sich widersprechen:

- ein **gerechneter Wert** (`derived`), er entsteht beim Lesen,
- die **Gegenrichtung einer Kante**, sie ist eine Abfrage.

Und eines steht nie im Code, sondern im Register: **welche Artikelarten es
gibt**. Eine neue anzulegen ist ein Einfügen und keine Migration. Das ist die
Behauptung, die der Prototyp prüft.

---

## Ein Beispiel, ganz durch

Volothamp Geddarm, wie er heute im Bestand steht. Dieselbe Kette zeigt der
Prototyp unter **Registry › How it works**, dort aus dem laufenden Register
gezogen statt abgeschrieben.

```
Artikel  n_volo
  ist    Creature                       ← eine Art, kein Oberbegriff
  Nummer npc-0003                       ← ausgegeben, als „NPC" noch eine Art war
  Karten
    Identity     name, aliases, cover   ← Basistyp
    Status       status: ready          ← Auswahl aus der Aufzählung State
    Description  description
    Tags         tags: händler, kerzengasse
    Creature     kind: npc              ← freies Wort; früher eine eigene Art
                 species: Mensch, role: Händler, attitude: freundlich
    Secrets      secret[0] = „Schuldet Floon achtzig Drachen…"
    Vars         bindings
  Kanten
    owes     → n_floon                  ← trägt nichts, sagt aber beides
    livesIn  → o_kerzengasse
    knowledge→ i_volo_name              ← was an ihm verborgen ist
    regards  → pa_wacht                 ← mit Marken an der Kante
```

Daran hängt alles, was dieses Dokument erklärt:

- **`Creature` ist die Art**, `kind: npc` der Untertyp. Wäre der Unterschied
  eine Registerzeile, gäbe es drei Zeilen ohne eigenes Feld.
- **`Status.status` nennt die Aufzählung `State`** und trägt die Werte nicht
  selbst. Wer `ready` in `abgeschlossen` umbenennen will, ändert eine Zeile.
- **`npc-0003` bleibt `npc-0003`**, obwohl die Art heute anders heisst.
- **`Secrets.secret[0]` trägt eine Id aus dem Text.** Daran hängt die
  Freigabe, und darum übersteht sie einen erneuten Import.
- **Die Zahlen fehlen**, und das ist richtig: Volo kämpft nicht. Wer einen
  Statblock hat, hat ihn über `belongsTo` — und nicht, weil die Art es
  verlangt.

Und eine Figur, weil an ihr die Listen hängen:

```
Artikel  pc_rook
  ist    PlayerCharacter                ← erbt Creature, dazu Stufe und Klasse
  Karten
    Proficiencies
      proficient  stealth, sleightOfHand, investigation, …   ← aus Skill
                  Gemeinsprache, Diebeszinken, Elfisch        ← aus Language
                  Diebeswerkzeug, Fälscherwerkzeug, …         ← aus Tool
      expertise   stealth, sleightOfHand
      saves       dex, int                                    ← aus Ability
    Vitals        hp 19/24, conditions …    ← was sich in der Sitzung ändert
  Kanten
    belongsTo ← sb_rook                 ← dort wohnen die sechs Werte
```

Und der Bogen, auf den `belongsTo` zeigt:

```
Artikel  sb_rook
  ist    Statblock
  Karten
    Abilities     str 10, dex 18, con 12, int 14, wis 12, cha 13
                  strMod … chaMod, initiative, passivePerception  ← gerechnet
    Statblock     system, size, ac, hp, speed, cr, prof, senses …
```

**`StatblockInfo` gibt es nicht mehr.** Es war eine Karte mit dreissig
Feldern, von der Rüstungsklasse bis zu den Immunitäten — ein Sammelname für
„alles, was an einem Statblock steht", und damit keine Auskunft. Jetzt trägt
der Statblock seine eigenen Felder und nimmt `Abilities` dazu; eine andere
Art, die die sechs Werte braucht, nimmt dieselbe Zeile. Die Modifikatoren
stehen **bei** den Werten, weil `mod(dex)` gegen die Nachbarn derselben
Karte auflöst.

**Ein Feld, sechs Listen.** `proficient` zieht aus `Skill`, `Tool`,
`Language`, `WeaponTraining`, `ArmorTraining` und `KnowledgeField`. Vorher
stand je Sorte ein Feld — also dieselbe Frage sechsmal, und die siebte
Sorte hätte ein siebtes Feld gebraucht. Woher ein Wert kommt, sagt die
Liste, in der er steht: der Bogen gruppiert danach, und das Handwerk liest
sich die Werkzeugübungen daraus heraus.

**Die sechs Werte stehen nicht an der Figur.** Sie wohnen am Statblock
(`sb_rook`), und `belongsTo` sagt, an welchem — auch bei einem
Spielercharakter.

**Im Register stehen sie trotzdem an ihr.** Eine Kante darf sich an einem
Ende wie ein Feld lesen (`asField`), und dann zeigt die Typenseite die
Felder des anderen Typs als eigene Gruppe: gestrichelt, mit der Marke
`linked · belongsTo` — sie gehören dazu und stehen doch in einem anderen
Artikel. Auf der Artikelseite zeichnet das Element `linked` sie mit ihren
eigenen Eingaben, und die schreiben in **jenen** Artikel. Wer eine Zahl
ändern will, springt nicht mehr hin und sucht den Weg zurück.

Das Mass dafür: **ohne das andere wäre dieser Artikel unvollständig, und es
gehört keinem zweiten.** Der Statblock einer Kreatur und das Inventar einer
Gruppe sind so; ein Gegenstand, den ein Rezept liefert, ist es nicht — den
gäbe es auch ohne das Rezept, und er bleibt ein Verweis.

