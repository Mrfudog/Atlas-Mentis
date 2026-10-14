# Begriffe

Stand 2026-09-21.

Diese Datei sagt, wie die Dinge heissen. Sie steht hier, weil dieselbe Sache
in den letzten Wochen „Komponente", „Schnittstelle", „Interface", „Karte",
„Ansicht", „View", „Facet" und „Stufe" geheissen hat — je nachdem, wer sie
gerade aufschrieb. Wer zwei Namen für eine Sache hat, hat bald zwei Sachen.

Sichtbarer Text ist englisch (siehe [CLAUDE.md](../CLAUDE.md)); deutsche
Prosa benutzt das deutsche Wort und nennt den englischen Bezeichner dazu.

**Was gilt, steht in [Datenmodell.md](Datenmodell.md)** — die Regeln, die
Formen, das Register heute. Diese Datei sagt, *warum* es so ist und was
nicht mehr gilt. Wer nur wissen will, wie es ist, liest dort.

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
  wer eins nachzog, zog das andere nicht nach. Sechs gibt es: `Ability`,
  `Size`, `DamageType`, `DrawTime`, `RuleKind`, `State`. Fertigkeiten,
  Sprachen, Werkzeuge, Waffen- und Rüstungsgruppen und Wissensgebiete
  standen bis P4 auch hier; sie sind jetzt Artikel oder die Liste eines
  Feldes (M6, siehe Feld).

Ein Zusammenschluss darf aus Zusammenschlüssen bestehen; `PlayerCharacter`
besteht aus `Creature`, und `Creature` besteht aus fünfzehn anderen.

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
Moment, in dem er eigene Felder braucht. Dasselbe geschah am 7.10. mit
`Story` (`Arc` und `Chapter` wurden Werte von `kind`; `Session` blieb eine
Zeile, weil sie den Sitzungszustand trägt — und am 14.10. wurde `Arc`
wieder eine, als er Stufen, Hook und Ausgang bekam, siehe unten), mit `Event` (`Era`,
`Cataclysm`, `Milestone`) und mit `Item` (`Consumable` ist ein
`itemType`). Sechs Zeilen weniger, und keine davon hatte je ein Feld
gebraucht. (`itemType` ist seit P3 eine Aufzählung am Feld, die
Gegenstandsarten von 5e.tools; ein Verbrauchsgut ist dort `potion`,
`scroll` oder `food and drink`.)

### Der erste Bestandteil zählt anders

`extends` ist eine Liste, und die Reihenfolge ist keine Zierde. Der **erste**
Eintrag zeichnet den Baum und entscheidet den Bereich (`area`); alle anderen
bringen nur ihre Felder und Kanten mit. Sonst gäbe es zwei Antworten auf die
Frage, wo eine Art hingehört, und die eine wäre still falsch.

### Story ist nicht History

Der Bereich hiess bis 13.10. `history` und hielt zweierlei: was in der
Kampagne geschah (Sitzungen, Szenen, Aufträge) und was der Welt widerfuhr,
bevor jemand sie bespielte. Das sind zwei Fragen — „was haben wir gespielt"
und „was ist hier einmal passiert" —, und wer die eine stellt, will die
Antworten der anderen nicht dazwischen. Jetzt heisst der eine Bereich
`story` und ist nur die Kampagne; die Weltgeschichte (`World`, `Event`)
steht unter `world`, bei der Welt, zu der sie gehört.

### Ein Fahrzeug ist ein Statblock, eine Karte ist eine Regel

Als T-087 hereinholte, was 5e.tools bis dahin zurückhielt — Fahrzeuge,
ihre Aufrüstungen, Kartendecks, Bastionen, Waffenmeisterschaften —, lag
nahe, je eine Art anzulegen: `Vehicle`, `Deck`, `Card`, `Facility`. Keine
davon hätte ein Feld getragen, das eine bestehende Art nicht schon hat.
Ein Fahrzeug hat RK, TP, Attribute und Immunitäten wie ein Statblock, und
ein Belagerungsgerät ist dort schon einer („siege weapon"); was es sonst
hat — Rumpf, Steuerung, Antrieb, Besatzung, Laderaum —, sind Zahlen, mit
denen heute nichts rechnet, und die stehen als Text. Ein Deck ist eine
Tabelle, auf der man zieht statt würfelt: je Karte ein Eintrag, die
Anzahl als Gewicht. Eine Karte, eine Aufrüstung, ein Bastionsraum sind
Regeln mit einem Wort (`card`, `upgrade`, `facility`), eine
Waffenmeisterschaft ist eine Eigenschaft der Waffe wie „Finesse". **Ein
Untertyp ohne eigene Felder ist ein Wort** — und wird eine Zeile, sobald
eine Initiative mit Fahrzeugzügen rechnet oder eine Bastion ihre Runden
zählt.

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
  Werkzeugen, Sprachen, Waffen und Rüstungen. Ein Feld je Sorte hiesse,
  dieselbe Frage sechsmal zu stellen, und die siebte Sorte bräuchte ein
  siebtes Feld; woher ein Wert kommt, sagt die Liste, in der er steht.
  **Statt einer Zeile darf das Feld eine Artikelart nennen** (M6): dann
  sind die Werte die Namen der Artikel dieser Art, die man sehen darf. Eine
  Fertigkeit ist ein Artikel mit Regeltext und Attribut, eine Sprache einer
  mit Schrift; als Wort in einer Zeile konnte sie beides nicht tragen, und
  die Zuordnung „Stealth rechnet auf DEX" stand darum in einer Einstellung
  daneben — die zweite Stelle für dieselbe Sache. **Die Zeile hält, die Art
  schlägt vor:** ein Artikelname ist der heutige Stand, und eine
  Umbenennung machte eine gespeicherte Übung sonst rückwirkend falsch,
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
  gespeicherten Verweis rückwirkend falsch machen. **Meint ein Feld einen
  Artikel, ist es ein Verweis und kein Name** (T-078): die
  Zustandsimmunitäten eines Statblocks hielten „Poisoned", und ein
  umbenannter Zustand liess sie auf nichts zeigen; jetzt halten sie die
  Id, wie die Zustände an der Figur; ebenso die Domänen einer Gottheit,
  die auf die Unterklasse „Knowledge Domain" zeigen (T-099). Ein Name
  bleibt, wo ein Feld Artikel und Wörter mischt (die Übungen), und wo es
  **mit** einem solchen Feld verglichen wird: das Werkzeug eines Rezepts
  wählt man aus den Werkzeug-Artikeln, gespeichert wird aber der Name,
  weil die Werkzeugübung ein Name ist,
- bei einem **Mass** die Einheit, in der es dasteht (`unit`),
- bei einer **Form** (`format: 'grid'`) ein Zeichen je Feld — und die Maske
  malt sie als Raster. `##.,##.` als Text sagt der Eingabe nicht, was dabei
  herauskommt, und beim Abzählen verrutscht eine Spalte,
- **immer bearbeitbar oder erst auf Klick** (`alwaysEdit`). Der Stand der
  Trefferpunkte wird mitten im Zug gesetzt; erst „Bearbeiten" zu sagen
  sind drei Klicks für eine Zahl. Es steht **am Feld und nur dort**: am Typ
  war es ein Schalter für zwanzig Felder auf einmal, und an `Vitals` sind
  die Trefferpunkte ein Stand, die Zustandsliste aber ein Satz Häkchen,
- bei einem freien Wort, ob es **vorschlägt, was schon dasteht** (`suggest`)
  — für eine Sorte wie `Creature.kind` oder `Deity.pantheon`, damit sie nicht
  dreimal anders geschrieben wird, und **nicht** für einen Namen: der
  Deckname bot einmal die Decknamen anderer Artikel an, weil jedes freie
  Textfeld vorschlug. Angeboten wird nur aus Artikeln, die man sehen darf,
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

### Langer Text

Ein langes Feld ist **Markdown**: Überschriften, Listen, Tabellen,
Einschübe, fett und kursiv. Was aus 5e.tools kommt, ist so gebaut — ein
Zauber mit einer Tabelle je Stufe, ein Monster mit einer Liste von
Optionen —, und als Fliesstext wäre jeder davon ein Absatzbrei. Gelesen
wird in zwei Stufen: `parseMarkdown` findet die Blöcke, `parseInline`
liest jede Zeile darin. Eine Stufe für beides hiesse zwei Stellen, an
denen `{VAR}` aufgelöst wird, und eine davon vergässe die Bindung an der
Kante.

**Nichts im Text wird HTML.** Ein Block ist ein Datum, und der Renderer
setzt Text als Text. Ein Feld kann jeder bearbeiten, der schreiben darf,
und ein Import schreibt, was in der Quelle stand — eine Stelle, an der
Text Markup wird, ist die Stelle, an der jemand Skript einschleust.

**Ein Verweis nennt die Nummer**, nicht den Namen: `[[npc-0042|Volo]]`.
Ein Name war eindeutig, solange jeder Artikel von Hand angelegt wurde;
mit zwei Ausgaben desselben Monsters heissen zwei Artikel „Goblin", und
`[[Goblin]]` meint einen von beiden, ohne zu sagen, welchen. Getippt
werden darf weiter der Name — beim Speichern wird er zur Nummer, wenn
genau ein Artikel so heisst (`idLinks`). Trifft er mehrere, bleibt er
stehen und sagt es; den ersten Treffer zu nehmen wäre bei zwei Goblins in
der Hälfte der Fälle der falsche, und niemand merkte es. Die Nummer
übersteht ausserdem das Umbenennen des Ziels. Eine Instanz ist kein
Verweisziel und zählt nicht als Namensvetter ihrer Vorlage.

**Ein Würfel steht in doppelten geschweiften Klammern**: `{{1d6+2}}`.
Einfache gehören den Platzhaltern, eckige den Verweisen; so bleibt jede
Klammer eine Sache. `{{+4}}` ist ein Wurf auf den W20 mit Bonus — so
steht der Angriffsbonus in jedem Statblock, und am Tisch heisst „+4"
genau das. Ein Platzhalter darf im Ausdruck stehen und wird zuerst
eingesetzt; ein Ausdruck, der keiner ist, bleibt Text. Gewürfelt wird ohne
`eval`, aus demselben Grund wie beim Rechenwerk.

**Ein Platzhalter trägt seinen Artikel**: „{CREATURE} can breathe air and
water." mit „the dragon" an der einen Kante und „Venomfang" an der
anderen. Stünde der Artikel im Text („The {CREATURE} can …"), wäre der
Text einer benannten Kreatur ein anderer als der eines Drachen, und
Amphibious stünde vierundsechzigmal da. Dass „the dragon" am Satzanfang
„The dragon" heisst, ist eine Frage des Lesens und nicht der Bindung —
also schreibt `parseInline` den Wert dort gross, und gespeichert bleibt,
was gemeint ist.

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

### Zwei Geräte, ein Artikel

Ein Artikel trägt seine **Revision**: wie oft er geschrieben wurde. Wer ihn
bearbeitet, hat eine Revision gelesen und schreibt gegen genau diese. Hat
inzwischen jemand anders gespeichert — das Telefon am Tisch, der Laptop zu
Hause —, gewinnt nicht still der Spätere: er wird abgewiesen, bekommt den
neuen Stand und führt zusammen. Was nur eine Seite geändert hat, kommt
ohne Frage zusammen; gefragt wird nur bei einem Feld, das beide verschieden
geändert haben. `updatedAt` reicht dafür nicht: zwei Schreiben in derselben
Millisekunde sehen gleich aus, und ein Zeitstempel sagt nicht, *wovon* eine
Änderung ausging.

Dahinter steht dieselbe Lehre wie hinter REQ-191: **was nicht sicher
gelesen ist, wird nicht überschrieben.** Die alte App lud bei einem Fehler
die Vorgaben und speicherte sie 700 ms später über alles. Darum schreibt
die Seite nichts ohne gelesenen Stand, und ein Entwurf, der nicht
gespeichert werden konnte, bleibt in der Maske und lässt sich herunterladen.

### Ein Bild ist ein Artikel, die Datei nicht

Ein hochgeladenes Bild sind zwei Dinge (T-114): ein **`Asset`-Artikel**
und eine **Datei** in der Ablage. Der Artikel trägt, was man über das Bild
wissen will — Name, Marken, Quelle, wer es sehen darf —, die Datei nur die
Bytes. Wer ein Bild zeigt, nennt die Id des Artikels (`Image.image`), nie
eine Adresse und nie einen Dateinamen: eine Adresse gilt so lange, wie die
Ablage dieselbe bleibt, die Id für immer (E-032).

Warum nicht einfach ein Feld mit der Datei am NSC? Weil dasselbe Wappen an
fünf Orten hängt und dann fünfmal dazuläge, mit fünf Quellenangaben, die
auseinanderlaufen. Und weil ein Bild **eine eigene Sichtbarkeit** braucht:
das Porträt des verborgenen Fremden darf nicht über die Adresse an die
Spielenden gehen, nur weil sie die Adresse erraten. Also fragt der Server
bei jeder Datei, ob ihr Artikel sichtbar ist — dieselbe Frage wie überall.

Die Datei heisst nach ihrem Inhalt (`<sha256>.png`). Dasselbe Bild zweimal
hochgeladen liegt einmal da, eine Datei ändert sich nie, und darum darf der
Browser sie behalten, solange er nach diesem Namen fragt.

Gezeigt wird ein Bild mit dem Block **`image`**, und wie gross, sagt der
Ort und nicht ein Wähler: in der Listenzeile ein Daumennagel, auf der
Karte die Vorschau, auf der Seite das ganze Bild. Eine Spieleransicht gibt
es auch hier nicht — wer das Asset nicht sehen darf, bekommt in der Liste
kein Bild und an der Adresse nichts.

---

## Ansicht

Wie ein Artikel gezeichnet wird. Es gibt **vier**, nach denen ein Ort fragt,
und welche gilt, sagt der Ort und kein Schalter:

| Ansicht | Wo sie gilt | Was sie zeigt |
|---|---|---|
| **Overview** | Ein Verweis im Text, eine Listenzeile | Name und die Beschreibung — eine Handvoll Zeilen, wie ein Hover; die Felder darin sind die Spalten im Kompendium |
| **Quick** (Kurzansicht) | Eine Karte auf dem Board, die Vorschau neben der Liste, das Popup an einem genannten Artikel, die Schnellanlage aus einem anderen Artikel | Das Nötigste, um zu wissen, was man vor sich hat |
| **Full** | Die Artikelseite | Alles, was dieser Artikel trägt |
| **Print** | „Print" an der Artikelseite | Was auf ein Blatt A4 gehört — ohne Knöpfe und Seitenspalte |

Einen Wähler „welche Ansicht hätten Sie gern" gibt es an diesen Orten
nicht. Ein Verweis ist ein Verweis, und eine Artikelseite ist eine
Artikelseite — wer das jedes Mal sagen muss, sagt es irgendwann falsch.

**Eigene Ansichten** (T-110, E-030 b) gibt es trotzdem: der **Handzettel**
(`handout` — Beschreibung, Absatz, Vorlesetext, nichts, was man nur als
Leitung wissen will) ist die erste, „Spielertisch" könnte die nächste
sein — im Register angelegt und dort gewählt, wo ohnehin gewählt
wird: auf der Kachel und beim Drucken. Die Leitung wollte festlegen, was
erscheint, ohne Code zu ändern; dass dafür niemand an jedem Ort wählen
muss, hält die vier fest.

**Was eine Ansicht zeigt, steht einmal, global** — eine Liste von
Elementen, darin ganze Typen oder einzelne Felder —, und **ein Artikel
zeigt davon, was er hat**. Eine Art, die anders aussehen soll, sagt nur
die Abweichung (**angepasst**: dies dazu, das weg, umgestellt) oder, wenn
sie wirklich anders aussieht, ihre **eigene Anordnung**. Die Anpassung ist
der Normalfall, weil sie richtig bleibt, wenn die Ansicht sich ändert; eine
Abschrift wäre am Tag der nächsten Änderung die Stelle, die beim Alten
stehen blieb. Ob leere Felder mit „—" dastehen und ob Ungenanntes am Ende
folgt, sagt die Ansicht: die Artikelseite lässt nichts fallen, die
Karte und der Druck nehmen, was sie nennen.

Nur auf dem Board wählt die **Kachel**: dort liegen Karten nebeneinander,
und wie gross eine davon ist, ist eine Frage an sie. Sagt weder die
Platzierung noch das Board etwas, entscheidet die Grösse — flach ist eine
Zeile (Overview), höher eine Karte (Quick). Wer die Kachel grösser zieht,
hat damit schon gewählt.

**Es gibt keine Spieleransicht.** Es gab einmal eine, und sie war die zweite
Stelle, an der stand, was ein Spieler nicht sehen darf. Zurückgehalten wird
am Server (`redactEntity`): was bei einem Spieler ankommt, darf er sehen, und
er sieht dieselbe Ansicht wie alle anderen — nur steht weniger darin.
Will die Leitung wissen, was eine Spielerin sieht, **nimmt sie deren Sicht
ein** („View as", REQ-241): der Server rechnet dann als dieses Konto, und
geschrieben wird darin nichts. Hätte sie stattdessen eine allgemeine Rolle
„Spieler" gewählt, fehlte gerade das, wonach gefragt wird — das Wissen an
der Figur und die eigenen Entwürfe (E-019).

**Die Anordnung wohnt am Typ.** Eine Kreatur ordnet ihre Full anders als ein
Rezept, und das steht bei der Kreatur. Untertypen erben sie, bis einer etwas
Eigenes sagt — eine Anpassung erbt dabei weiter, was über ihr gilt.

**Eine Listenzeile ist ein Verweis**, also Overview (W7). Darum sagt die
Overview einer Art auch, welche Spalten das Kompendium für sie zeigt und
wonach es filtert — Grad und Schule beim Zauber, HG beim Statblock,
Seltenheit beim Gegenstand. Eine Spaltenliste im Code wäre eine zweite
Stelle, die am Tag der nächsten Art falsch ist; so bringt die neue Art ihre
Spalten mit. Und weil die Vorschau neben der Liste eine Karte ist, zeigt
sie Quick.

**Die Kurzansicht** ist das deutsche Wort für Quick, kein zehntes Wort
(T-093, REQ-248, 14.10.2026). Sie steht auch als **Popup**: wo ein Artikel
genannt wird — ein Verweis im Text, eine Kante, eine Ebene im Filter oder
in der Kampagnenliste, der Info-Knopf einer Listenzeile am Telefon —,
öffnet ein Klick oder Antippen seine Karte mit „Open article", am Desktop
auch das Ruhen des Zeigers. Ein Verweis zeigt im Text weiter seinen Namen
(Overview); erst wer ihn anklickt, hat nach der Karte gefragt, und eine
Karte ist Quick. So muss niemand die Seite verlassen, um zu sehen, wer
Volo ist — und wer doch hin will, nimmt den Link in der Karte oder klickt
mit Strg/⌘ wie auf jeden Link. Am Telefon ist das Popup ein Blatt von
unten. Die Leseansicht hatte dafür eine eigene Spalte neben dem Text; sie
ist im Popup aufgegangen, damit ein Verweis überall dasselbe tut.

**Wie im Buch** (W2, 13.10.2026) ist darum auch eine Anordnung und kein
Sonderfall: ein Statblock liest sich wie im Monster Manual, weil am Typ
`Statblock` das Element `statblock` steht — nicht, weil der Code nach dem
Namen „Statblock" fragt. Eine eigene Art, die von `Statblock` erbt, liest
sich ebenso; eine, die etwas anderes will, sagt es an sich.

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

### Was eine Kante bedeutet, sagt die Zeile; was sie bewirkt, der Code

Eine Kante an einen Artikel zu hängen, kann viel tun — ihn in den Stapel
bringen (`inLayer`), einer Figur eine Stufe geben (`hasClass`), einer
Gruppe ein Geheimnis verraten (`knownBy`) — oder gar nichts ausser einer
Zeile unter „Relations" (`livesIn`). Von aussen sah man den Unterschied
nicht. Darum trägt jede Kantenart einen Satz, was sie **bedeutet**
(`means`), und ihre **Wirkung** wird gerechnet: aus dem Verzeichnis der
Auswerter (`EDGE_READERS`), das ein Test gegen den Quelltext hält, und aus
der Zeile selbst (`section`, `asField`, Rechnungen wie `sum(hasClass.level)`).
Eine Wirkung von Hand ins Register zu schreiben hiesse, eine Behauptung zu
pflegen, die beim nächsten Umbau still falsch wird.

Verspricht eine Kante mehr, als heute jemand liest — `affects` mit `effect`,
`casts` mit `uses` —, steht das in `intended`, und die Oberfläche sagt „not
evaluated yet". Sobald ein Auswerter sie liest, muss `intended` weg: der
Test lässt beides nicht zugleich stehen.

### Eine Stufe ist ein Zustand, eine Wirkung ist eine Kante

„Exhaustion 3" ist ein Artikel der Art `Condition` mit `stage` 3 und einer
Kante `stageOf` auf den Grundzustand „Exhaustion". Das sieht nach mehr aus
als ein Zähler und ist weniger: eine Zahl `Vitals.exhaustion` neben einer
Zustandsliste wären zwei Stellen für dieselbe Auskunft, und die eine
stimmte irgendwann nicht mehr. Der Preis ist eine Prüfregel — höchstens
eine Stufe je Grundzustand in der Liste — und ein Ersetzen statt Zählen.
Dafür kann eine andere Regel „Exhaustion 3" **nennen** (`affects`:
Nachteil bei Angriffen), und der Bogen kann es anzeigen.

`affects` ist eine Kante mit Art der Wirkung (`imposes`, `prevents`,
`limits`, `advantage`, `disadvantage`, `triggers`): gelähmt *bewirkt*
kampfunfähig, kampfunfähig *verbietet* Reaktionen. Gespeichert wird
vorwärts, die Gegenfrage ist eine Abfrage, und ausgewertet wird nichts —
eine Regelmaschine wäre ein eigenes Vorhaben. Das Warum der Familie
(Messlatte: eine Regelart wird ein Typ, wenn ein Feld oder eine Kante sie
als Art verlangt oder sie eigene Felder trägt) steht in D48.

### Ein Zauber steht einmal da, wer ihn kann, an der Kante

Ein Zauber ist eine Regel mit eigenen Feldern (`Spell` unter `Rule`):
Grad, Schule, Wirkzeit, Reichweite, Komponenten, Dauer. **Wer ihn wirkt,
steht nicht am Zauber**, sondern an der Kante `casts` vom Wirkenden —
vom Statblock, vom Spielercharakter, vom Gegenstand. Derselbe Feuerball ist
bei der Magierin vorbereitet, beim Kultisten angeboren und dreimal am Tag,
im Stab drei Ladungen wert; drei Felder am Zauber könnten das nicht sagen,
drei Kanten schon (`mode`, `uses`, `charges`). Ein Talent ist darum
ebenfalls ein Wirkender (Drow High Magic: Levitate einmal am Tag) und
nicht etwas, das den Zauber nur „gewährt" — `grants` kennt kein „1/day".

Die **Wirkzeit nennt ihre Aktionsart** (`castingAction` → `ActionType`):
„1 bonus action" als Wort wäre neben `Action.actionType` die zweite
Schreibweise derselben Sache. Und **welche Zustände ein Zauber bewirkt**,
sagt `affects` (`imposes`) und kein Feld `conditions` — die Kante sagt das
zwischen zwei Regeln schon, und ein Feld daneben wäre die zweite Antwort,
die als erste veraltet (D49).


### Eine Dauer hängt an einem Zug, nicht an einer Runde

„Bis zum Ende deines nächsten Zuges", sagt der Zauberer zum Goblin. Ein
Rundenzähler am Goblin zählt am Ende des Goblin-Zuges, und der kommt vor
oder nach dem des Zauberers — je nachdem, wer besser gewürfelt hat. Die
Dauer gehört also nicht dem Ziel, sondern einem **Zeitpunkt**: dem Anfang
oder Ende eines bestimmten Zuges. Darum trägt der Eintrag einen Anker (die
Kante des Teilnehmers, an dessen Zug gezählt wird) und `at`. Ohne beides
bleibt es der eigene Zug, Ende — so zählte der Tisch bisher, und kein
gespeicherter Kampf muss dafür angefasst werden (D53).

Ob „1 Runde" im eigenen Zug schon an dessen Ende abläuft, beantwortet
jeder Tisch anders. Statt eine Antwort zu verstecken, sagt die Maske beim
Setzen, wann es so weit ist. Eine **Notiz** ist derselbe Eintrag mit Text
statt Zustand — „konzentriert sich auf Segen" läuft genauso ab.

Die Zahlen stehen nicht an der Kante: RK und Maximum sind die des
Statblocks, und eine Abschrift daneben wäre die zweite Stelle, die beim
ersten Stufenaufstieg falsch steht. Die Kante hält den Stand — wie viel
von diesem Maximum in diesem Kampf noch übrig ist.

**Was die Spielenden sehen, siebt das Modell, nicht die Maske.** Eine
Reihe, die alles schickt und im Browser die Hälfte ausblendet, verrät den
Rest jedem, der die Entwicklerwerkzeuge öffnet. Also geht nur die Gruppe
hinaus und wer aufgedeckt oder beteiligt ist; ein Gegner, den niemand
erkannt hat, heisst wie sein Deckname, und seine Trefferpunkte sind ein
Wort — „angeschlagen" ist, was man am Tisch sieht, „7 von 18" nicht.

**Auch die Reihe selbst verrät etwas** (D58). Steht ein aufgedeckter
Gegner schon vor Kampfbeginn auf Platz drei, wissen alle, dass er nach der
Magierin kommt und vor dem Kämpfer — eine Auskunft, die am Tisch niemand
hat, bevor er handelt. Also erscheint ein Gegner in der ersten Runde erst,
wenn sein Zug beginnt, und bleibt dann stehen; ab der zweiten Runde ist die
Reihe ohnehin bekannt. Aus demselben Grund geht die **Zugnummer** nicht
hinaus: „der siebte ist dran" bei vier sichtbaren Zeilen zählt die
Verborgenen mit. Stattdessen trägt der Teilnehmer, der dran ist, eine
Marke — und wer verborgen dran ist, hat eben keinen Zeiger.
### Eine Spur hält, was zu ihr gehört, nicht was in ihre Zeit fällt

Die Weltgeschichte steht in **Spuren**: ein Krieg, eine Dynastie, ein
Zeitalter — jedes ein Ereignis mit Spanne (`Time.sort` bis `untilSort`).
Was darin liegt, sagt die Kante `partOf`, dieselbe, die das Zimmer ins Haus
und das Kapitel in den Arc legt (D57).

Die andere Antwort lag nahe: was in die Spanne fällt, liegt in der Spur.
Sie kostet keine Kante, aber sie weiss nicht, wovon die Rede ist — die
Hochzeit im Norden fiele in den Krieg im Süden, und jedes Ereignis läge in
jeder Spur, die gerade läuft. Eine Spur ist eine Geschichte und kein
Zeitfenster. Die Spanne bleibt trotzdem nützlich: was über die Kante
drinliegt und ausserhalb fällt, ist vermutlich ein Tippfehler, und die
Leitung sieht es gestrichelt.

**Die Kampagne ist eine Spur wie die anderen** und hält, was keine andere
hält: Sitzungen, Aufträge, Ereignisse am Tisch. Ihre Spanne wird beim
Lesen gerechnet, wenn sie keine eigene trägt (D8) — eine gespeicherte
wäre nach der nächsten Sitzung falsch.

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
Information | Knowledge --knownBy--> Creature | Party | Faction
```

Ein Bündel in einem Bündel zählt nicht: ein Schritt weit, dieselbe Regel wie
bei den Haltern. Sonst reichte eine Freigabe weiter, als jemand gemeint hat.

> **Nicht mehr:** es gab einen `KnowledgeLevel` — einen *Stand*, dem Figuren
> über `atLevel` angehörten. Das war ein zweiter Weg zu „wer weiss das",
> obwohl `Party` schon Empfänger sein konnte, und in zwei Jahren
> hat ihn niemand benutzt: kein Artikel, keine Kante.

---

## Sichtbarkeit

**Die grobe Frage, und sie kommt vor der feinen.** Das Wissen sagt, welche
*Felder* eines Artikels jemand liest; die Sichtbarkeit sagt, ob er den
Artikel überhaupt bekommt. Beides zu einer Frage zu machen hiesse, einen
Artikel dadurch zu verbergen, dass man alle seine Felder wegnimmt — und er
stünde trotzdem in der Liste, mit Namen und Bereich.

Der Bestandteil `Visibility` hat drei Felder, und alle drei werden gelesen:

| Feld | Was es sagt |
|---|---|
| `audience` | die Stufe: `public` · `campaign` · `players` · `gm` |
| `revealedTo` | ausdrücklich freigegeben — an Träger, nicht an Konten |
| `hiddenFrom` | ausdrücklich verborgen, dieselben Träger |

**`public` ist die Vorgabe und heisst: jeder darf es sehen.** Ein Artikel,
den niemand eingestuft hat, ist offen — wer etwas verbergen will, sagt es,
und nicht umgekehrt. Andersherum wäre die halbe Kampagne unsichtbar, und
niemand wüsste, warum.

Die vier Stufen von aussen nach innen:

- **`public`** — jedes Konto.
- **`campaign`** — jedes Konto **am Tisch**: eines mit einer Rolle in dieser
  Kampagne. Ein Konto ohne Rolle hat noch keinen Platz.
- **`players`** — die Spielenden: `player`, `co-gm` oder `gm`, keine
  Zuschauer. Die Leitung sieht jede Stufe unter sich mit.
- **`gm`** — die Leitung **dieser Kampagne**: `gm` oder `co-gm`. Ein
  Mitleiter sitzt hinter dem Schirm und nicht davor.

**Die Reihenfolge ist die Regel:** `hiddenFrom` schlägt `revealedTo` schlägt
`audience`. Das ausdrückliche Verbot gewinnt, weil es die Ausnahme ist, die
jemand von Hand eingetragen hat; eine Freigabe, die ein Verbot aufhebt, wäre
die Sorte Regel, deren Wirkung man erst am Tisch merkt.

Beide Listen nennen **Träger** — `Creature`, `Party`, `Faction`,
dieselben drei wie `knownBy`, denn es ist dieselbe Frage: wem gehört etwas.
Ein Träger zählt einen Schritt weit auch als seine Gruppe: wer den
Reisetrupp nennt, verbirgt es vor seinen Mitgliedern.

**Ein Spieler steht für seine Figuren** (T-100, E-007). Die Leitung wollte
„Mia" wählen können, ohne zu wissen, wie Mias Figur heisst. Die Maske
bietet darum Spieler an — und schreibt ihre Figuren in die Liste. Ein
Konto im Artikel wanderte mit der Ausfuhr mit (REQ-199), und bei einer
Einfuhr anderswo hiesse ein verlorenes `hiddenFrom`, dass plötzlich jemand
etwas sieht. Darum auch **eine Gruppe je Kampagne, von selbst**: sie ist
der häufigste Empfänger („alle am Tisch, aber nicht der neue Gast"), und
wer einem Spieler eine Figur zuteilt, setzt sie gleich hinein. Anpassbar
heisst: es ist eine gewöhnliche Kante, die man an der Figur wegnimmt.

**Unfertiges sehen Spielende nicht** (REQ-237, D72). Der Vorbereitungsstand
(`Status`: `idea`, `prepared`, `ready`) ist seit dem 13.10. auch Teil der
groben Frage: wer nicht hinter dem Schirm sitzt, bekommt nur, was `ready`
ist — ausser seinen eigenen Artikeln, die er in jedem Stand sieht. Warum am
Stand und nicht an einem eigenen Feld „zur Abnahme": ein zweites Feld wäre
ein zweiter Stand, und die beiden liefen auseinander; die Leitung sagt
ohnehin schon mit `ready`, dass etwas fertig ist (E-011). **Ohne Stand heisst
fertig**: eine Ebene oder ein Regelteil ohne Status-Karte verschwände sonst
für alle Spielenden, und niemand wüsste, warum — dieselbe Überlegung wie bei
`public` als Vorgabe.

**Ändert eine Spielerin etwas Fertiges, gilt für die anderen der fertige
Stand weiter** (E-012, D74). Er fällt auf `prepared`, und der Stand davor
bleibt als Kopie am Server (`entity_ready`) — nicht als zweite Karte im
Artikel: die wanderte mit jeder Ausfuhr mit, und jede Prüfung müsste zwei
Fassungen kennen. Wer den Arbeitsstand sieht (Verfasserin, Leitung), sieht
den neuen mit einem Band „not ready yet — the version from … applies";
alle anderen merken nichts, bis die Leitung `ready` setzt. **Die eigene
Figur ist ausgenommen** (E-014 d): sie gehört dem Spieler, er setzt ihren
Stand selbst, und am Tisch fiele sie sonst beim ersten Treffer zurück. Was
an ihr die Leitung prüfen soll, kommt später Feld für Feld (REQ-242),
nicht als Liste je Figur.

**Vererbt wird nichts.** Ein Artikel sagt für sich, wer ihn sehen darf; dass
das Zimmer zum Haus gehört, sagt nichts darüber, wer das Zimmer kennt. Es
gab dafür ein Feld (`inherit`, Vorgabe `true`), und es war nie ausgewertet —
sobald es stimmen soll, braucht es eine **Tiefe**, und eine Vererbung ohne
Tiefe gibt irgendwann einen ganzen Zweig frei, den niemand gemeint hat.
Bewusst weggelassen, bis jemand sie braucht.

> **Nicht mehr:** `scope` — nirgends erklärt und nirgends gelesen; ein Feld,
> dessen Bedeutung niemand aufgeschrieben hat, füllt beim nächsten Mal
> jemand anders als beim letzten. Und `sharedUsers` — dasselbe wie
> `revealedTo`, nur in Konto-Ids statt in Artikel-Ids. Alle sechs Felder
> standen da, weil zwei Entwürfe sich nicht einig waren und jemand die
> Vereinigung nahm; gefüllt war keines, in fünfundsiebzig Artikeln.

### Die Rolle steht am Konto, je Kampagne

**Was ein Konto am Tisch ist, ist eine Angabe über das Konto** und steht in
keinem Artikel:

| Was | Wo |
|---|---|
| welche Figuren ein Konto führt | `app_user_actor` (Server) |
| welche Rolle es in welcher Kampagne hat | `campaign_member (campaign, user, role)` |
| beides im Prototyp | Sammlung `members`, ein Dokument je Konto |

Die Rollen: `gm` · `co-gm` · `player` · `spectator`. Wer in einer Runde
leitet und in einer anderen mitspielt, hat zwei Zeilen — und gefragt wird die
Rolle in **der** Kampagne, der der Artikel gehört. Leitung und Mitleitung
sehen dasselbe; was sie trennt, ist, wer die Mitglieder pflegt: die Leitung
(und die Verwaltung) ändert sie auf der Kampagnenseite (Element `members`),
ein Mitleiter sieht die Liste.

`app_user.is_admin` ist etwas anderes: die Verwaltung der **Installation**.
Sie schaltet Register, Einladungen und unbeschnittenes Lesen.

> **Nicht mehr:** `Access` — eine Karte mit `userIds` und `role` an der
> Figur, für einen Tag auch an der Kampagne. Der Server las sie nie, denn
> welche Figur ein Konto führt, stand längst am Konto; `userIds` war in
> keinem Artikel gefüllt. Eine Figur sagt nicht, in welcher Runde ihr Konto
> was ist, und eine Konto-Id in einem Artikel wandert mit jeder Ausfuhr mit
> — Zugänge wandern nicht (REQ-199). Darum steht auch `members` nicht in
> der Ausfuhr. Aus demselben Grund sind seit dem 7.10. `PlayerCharacter.player`
> (ein Name als Text) und die Kante `playedBy` weg (Abgleich A1): wer eine
> Figur spielt, steht in `app_user_actor`.

**Und wem ein Artikel gehört, sagt die Ebene.** Ein Artikel liegt in Ebenen
(`inLayer`), eine Kampagne schaltet Ebenen auf (`activates`) — also gehört
eine Ebene, die genau **eine** Kampagne aufschaltet, ihr, und eine, die
mehrere aufschalten, ist gemeinsam:

| Der Artikel liegt … | `audience: 'gm'` heisst |
|---|---|
| in der Ebene **einer** Kampagne | nur deren Leitung |
| in einer Ebene, die **mehrere** aufschalten | jede Leitung |
| in **keiner** Ebene | jede Leitung |

Ein Grundregelwerk, das drei Runden aufschalten, gehört keiner davon — seine
Spielleitungshinweise vor den anderen zwei zu verbergen wäre eine Sperre ohne
Grund.

**Aufschalten heisst auf der Seite „Layers in play".** Die Kante hiess
„runs on" — und als nach dem Anlegen einer Kampagne alle Artikel aus
5e.tools fehlten (nicht gelöscht, nur nicht aufgeschaltet), fand die
Leitung sie nicht. Was eine Kampagne zeigt, ist ihre wichtigste
Einstellung; sie steht jetzt auf der Kampagnenseite als Liste mit Häkchen
und Reihenfolge, und die Listen sagen, was fehlt und warum (T-069).

Dass die Zugehörigkeit so von selbst herausfällt, ist der Grund, dafür **kein
Feld** zu setzen. `Layer.kind` kennt zwar ein Wort `campaign`, aber ein Feld,
das gleichzeitig Regel ist, leckt beim ersten Tippfehler: ein Paket, das
versehentlich `campaign` heisst, gehörte plötzlich wem? Das `kind` bleibt
Beschreibung.

**Je Buch eine Ebene** (T-081, E-017). Bis zum 13.10.2026 lag alles aus
5e.tools in einer Ebene „D&D 5e (2014)", und welches Buch, stand nur am
Artikel. Eine Runde, die *Curse of Strahd* spielt und keine anderen
Abenteuer, sah trotzdem jedes Abenteuer — abschalten hiess, alles
abzuschalten. Jetzt ist jedes Buch eine Ebene (`kind: book`), und eine
Kampagne schaltet die Bücher auf, die sie nutzt. Die Sorge von damals,
hundert Ebenen seien ein Stapel, den niemand umschaltet, trifft den
Stapel und nicht die Liste: die Kampagnenseite zeigt die Bücher darum
getrennt, gruppiert nach Grundregelwerk, Quellenbuch und Abenteuer
(einer Marke an der Ebene), mit Häkchen und ohne Pfeile — zwischen zwei
Büchern gibt es nichts zu ordnen. `book` ist wie jedes `kind`
Beschreibung: es gruppiert und hält die Ausfuhr klein, aber wer etwas
sieht, sagt es nicht.

**Ein Abenteuer ist eine Ebene, und anpassen heisst darüberlegen** (T-082,
E-018, REQ-240). Bis T-082 übersprang der Importer den Abenteuertext;
von *Lost Mine of Phandelver* kamen nur die NSC herein. Jetzt bringt ein
Abenteuer seine Geschichte mit — Kapitel, Abschnitte, Begegnungen, Karten
— als Artikel in seiner Ebene (`kind: adventure`), und die Kampagne zeigt
die Kapitel jedes aufgeschalteten Abenteuers in ihrer Geschichte. Was
darin vorkommt, ist ein Verweis auf den Buchartikel und keine Kopie: der
Goblin in Raum 2 *ist* der Goblin aus dem Monster Manual.

Wie eine Runde ein Kapitel ändert, ohne das Original zu verlieren, war die
Frage von E-018. **Kopieren** wäre einfach, und die Kopie gehörte der
Kampagne — aber die Verbindung zum Original wäre weg, und jeder Verweis im
Abenteuer zeigte weiter darauf. **Darüberlegen** (`overrides`, gewählt)
heisst: „Adapt" legt eine Fassung in die Ebene der Kampagne, und solange
die läuft, gilt die Fassung. Das Original bleibt darunter, für jede andere
Runde unverändert; eine Korrektur daran erreicht jede, die es nicht
angepasst hat, und zurück heisst, die Fassung zu löschen. Damit ein Verweis
aufs Original nicht ins Leere führt, liefert der Server die Fassung, die
gilt (E5) — dieselbe Frage, die der Stapel ohnehin stellt (`resolveArticle`),
nur jetzt auch beim Öffnen und bei den Namen.

**2014, 2024 und Unearthed Arcana sind Ebenen, kein Schalter** (T-087,
E-021 d). Bis 13.10. kam nur 2014 herein (E2 des Arbeitsplans), und 2024
wurde weggesiebt — wer vergleichen wollte, konnte nicht. Jetzt kommt alles
herein, jede Quelle in ihre Ebene, und aufgeschaltet wird, was die
Kampagne will; keine neue Ebene ist von selbst im Spiel, auch nicht über
die Gruppe „D&D 5e (2014)". Dass es Fireball zweimal gibt, löst dasselbe,
was Fassungen innerhalb von 2014 schon löste: die eine ist die
Grundfassung, die andere heisst nach ihrem Buch und zeigt mit `variantOf`
darauf. Welche die Grundfassung ist, entscheidet hier nicht „das Neueste
gilt" — das sagte 5e.tools mit `reprintedAs` und machte aus dem
2014-Fireball „Fireball (PHB)". Ein Artikel, den Kampagnen schon nennen,
hiesse dann auf einmal anders, und `[[Fireball]]` träfe den, den niemand
gemeint hat. **Was schon da war, bleibt, wie es war** — der Importer
schreibt den Grundstand mit denselben Ids, Nummern und Namen, wie ihn ein
Lauf ohne 2024 schriebe, und teilt keinen Angriff und kein Merkmal mit dem
Rest. Nur Buch- und Abenteuertext findet jetzt auch das Schiff oder das
Deck, das er nennt: seine Teile hängen an ihrer Stelle im Buch und nicht
am Text, und `--only-new` legt in einem Kapitel, das schon steht, ohnehin
nichts dazu.

**Ein Kapitel ist ein Arc, und ein Abenteuer besteht aus Teilen** (T-097,
E-026, REQ-252). Die Leitung will ein Abenteuer nicht nur als Ganzes
aufschalten, sondern Teile davon in die eigene Geschichte holen: einen
Abschnitt, eine Begegnung, ein ganzes Kapitel. Dafür muss ein Kapitel
dasselbe sein wie ein Arc der eigenen Kampagne — sonst stünde es in der
Geschichte als etwas Fremdes zwischen den Arcs. Ein Wort an einer Story
hätte das getragen, aber ein Arc braucht eigene Felder (für welche Stufen,
womit er die Runde hereinholt, wie er ausgehen kann), und eine Sprosse mit
eigenen Feldern ist eine Zeile (T2). Also ist `Arc` eine Art, die von
`Story` erbt, und der Importer legt jedes Kapitel als `Arc` an. Die
Peg-Id eines Kapitels rechnet er weiter wie für eine Story, damit
`--only-new` die schon geladenen wiederfindet. Eine Karte steht immer an
einer Szene: liegt sie im Text des Kapitels selbst, bekommt sie ihre
eigene — eine Karte, die nur Abschnittstext ist, lässt sich nicht einzeln
holen. **In die Geschichte holen** (`take`) heisst dann dasselbe wie
Anpassen (E-018 a), nur für einen Teil mit allem darunter und an eine
andere Stelle: Fassungen in der Ebene der Kampagne, die Teile an den
Fassungen ihrer Eltern, das Ganze an der Kampagne oder einem ihrer Arcs.
Es heisst bewusst nicht „Übernehmen": das ist schon das Wort für eine
Fassung aus einer Vergleichsebene (E7), und zwei Sachen unter einem Namen
werden irgendwann eine.

**Ein Buch besteht aus Teilen, und jeder Teil ist ein Artikel** (T-108,
E-028, E-029). Ein Textblock ist ein Feld — das gilt weiter für alles, was
jemand an einem Artikel schreibt. Buchtext ist die Ausnahme, und zwar aus
einem Grund, den ein Feld nicht tragen kann: die Leitung will einen
Vorlesetext, einen Absatz, eine Überschrift samt dem, was darunter steht,
**einzeln** in ihre Geschichte holen. Was man einzeln holt, braucht eine
Id, eine Ebene, eine Fassung — es ist ein Artikel. Also ist ein Kapitel
(`Chapter`) die Lesestruktur, und seine Teile (`Heading`, `Paragraph`,
`ReadAloudText`, `Embed`, im Abenteuer Szenen) sind Artikel in einer
Reihenfolge. **Die Reihenfolge steht an der Kante** (`partOf.rank`), nicht
am Teil: derselbe Vorlesetext steht im Kapitel an dritter Stelle und in
der eigenen Szene an erster, und eine Zahl am Teil gälte nur für eines
davon. **Lesen und Spielen sind zwei Arten** (E-029 a): ein Regelkapitel
ist keine Geschichte, und ein Arc trägt Stufen, Hook und Ausgang, die in
„Chapter 9: Combat" nichts bedeuten. Ein Kapitel eines offiziellen
Abenteuers ist darum zweimal da — als `Chapter` zum Lesen und als `Arc`
zum Spielen, über `chapterOf` verbunden — und seine Teile einmal: beide
zeigen auf dieselben Szenen, nichts ist verdoppelt. Was für sich steht
(ein Monster aus dem Monster Manual, eine Regel), wird nicht kopiert und
bekommt keine Kante zum Kapitel — die stünde in einem Artikel einer
fremden Ebene —, sondern ein Teil `Embed` zeigt darauf. **Teile stehen in
keiner Liste und sind kein Verweisziel nach Namen:** ein Absatz heisst
nach seinen ersten Worten, eine Überschrift „Surprise" wie die Regel
darunter, und hundertfünfzigtausend solcher Namen machten jeden
`[[Verweis]]` mehrdeutig. Teil heisst hier ein Stück Buchtext; ein
**Bestandteil** ist weiter ein Typ, aus dem ein anderer gemacht ist — der
abstrakte Obertyp heisst darum `BookPart` und nicht `Part`.
**Holen oder verwenden** (E-028): einen Teil holt man wie ein Kapitel —
als Fassung in der Kampagnenebene, die man ändern darf (E-018 a). Wer ihn
nur zeigen will, wie er ist, *verwendet* ihn: ein `Embed` in der eigenen
Szene zeigt aufs Original, und eine Korrektur am Original kommt mit.
Zwei Wege, weil es zwei Absichten sind; einer allein hiesse, entweder
jeden Vorlesetext zu kopieren oder keinen ändern zu können.

**Wer schreibt, schreibt in eine Ebene** (T-098, E-001). Die Leitung
konnte bis zum 14.10. ihre eigene Kampagne lesen und nichts daran ändern;
die naheliegende Regel „die Leitung schreibt, was ihrer Kampagne gehört"
hätte an jedem Artikel gefragt, wem er gehört — und für einen, der auch im
Regelwerk liegt, keine gute Antwort gehabt. Jetzt ist die Ebene der Ort
**und** das Recht: wer in einer Ebene schreibt, schreibt alles darin, und
was woanders liegt, ändert er, indem er es darüberlegt — derselbe Weg wie
„Adapt", nur von „Edit" aus. Darum gibt es keine Rechteliste je Artikel:
die wäre bei jedem neuen Artikel anzufassen, und wer sie vergisst, hat
einen Artikel, den niemand ändern kann. Wer in welcher Ebene schreibt,
steht am Konto (`app_user_layer`) und nicht an der Ebene — eine Konto-Id
in einem Artikel wanderte mit der Ausfuhr (REQ-199). Und eine eigene Ebene
wird nie zur Ebene der Kampagne, auch wenn nur diese sie aufschaltet:
sonst entschiede die Reihenfolge im Stapel, wem eine Ebene gehört.

**Fassungen stehen am Feld, nicht hinter einem Umschalter** (T-092,
E-021 d). Fireball gibt es im PHB von 2014, im PHB von 2024 und mit
Reichweite 120 in Xanathar's Guide. Ein Umschalter „2014 · 2024" oben am
Artikel hiesse: eine Fassung lesen und die andere vergessen. Die Leitung
will beides sehen, wo es sich unterscheidet — also bleiben die Fassungen
eigene Artikel, und an jedem Feld, an dem eine andere Fassung etwas anderes
sagt, steht ihr Wert dabei, mit dem Kürzel ihrer Ebene. Wer liest, schaltet
das ein und aus und wählt die Ebenen; gemerkt wird es **am Konto**
(`app_user_pref`), weil es eine Frage ist, wie jemand liest, und nicht, was
gilt.

*Wo der Wert dabeisteht*, ist die Stelle, an der man ihn liest (T-103).
An Aasimar stand die andere Grösse unter „Languages": der Text war als
Ganzes verglichen, und die andere Fassung hing am Ende — beim letzten
Abschnitt, „Languages". Ein Text aus 5e.tools ist aber „## Age … ## Size …
## Languages …", also wird er Abschnitt für Abschnitt verglichen, nach
Überschrift und nicht nach Nummer; was nur die andere Fassung hat, steht
unter seiner eigenen Überschrift. Ebenso ein Statblock nach seinen Zeilen
(„Armor Class", nicht `Statblock.ac`), denn die Zeile ist, was man liest.
Und ein Feld, das nur die andere Fassung füllt, steht an seinem Platz mit
„—" — in einer Liste am Ende hiesse es, die Stelle suchen zu gehen.

*Was eine Fassung ist*, sagt nicht `variantOf` allein: die Kante verbindet
auch den Oathbow mit dem Longbow und die Kopie „Goblin Boss" mit dem
Goblin — das sind andere Dinge, und im Kompendium unter dem Longbow
verschwände der Oathbow. Eine Fassung ist dieselbe Art mit demselben Namen,
nachdem ein angehängtes „(Buch)" der eigenen Quelle weg ist — so nennt der
Importer die Fassungen aus mehreren Büchern. Eine Überschreibung sagt es
selbst und zählt immer.

*Vergleichsebenen* sind Ebenen, die eine Kampagne nennt, ohne sie
aufzuschalten (`activates` mit `mode: 'compare'`). Was sie bringen, steht
in keiner Liste, ist an keinem Verweis und gehört der Kampagne nicht — es
ist auf Wunsch sichtbar, für die Leitung und, wenn die Kampagne es sagt,
für die Spielenden. Eine Fassung daraus **übernimmt** die Leitung als
Kopie in die Ebene der Kampagne, mit `overrides` auf die geltende — wie „Adapt" eines Abenteuers, nur aus
einer Vergleichsebene und mit der Herkunft in `variantOf`. Eine
Kante am Buchartikel wäre kürzer und falsch: das Buch liegt in einer
geteilten Ebene, und eine Überschreibung dort gälte in jeder Runde, die es
aufschaltet.

**Gruppen sind Ebenen** (E-022 b, T-088). Mit einer Ebene je Buch werden
es über hundert Ebenen, und die Kampagnenseite braucht Abschnitte:
Grundregeln, Ergänzungen, Settings, Abenteuer, Unearthed Arcana. Ein Feld
`Layer.group` hätte gereicht, um zu ordnen — aber eine Ebene stünde dann in
genau einer Gruppe, und „alle Abenteuer an" wäre siebzig Kanten, die beim
nächsten Abenteuer eine zu wenig sind. Also ist eine Gruppe selbst eine
Ebene (`kind: 'group'`), ihre Mitglieder hängen mit `partOf` an ihr, und wer
sie aufschaltet, hat alle — auch das nächste Buch, das der Importer
einhängt. Dafür braucht die Stapelauflösung eine Regel für „Gruppe an, ein
Buch darin aus": **die ausdrückliche Kante schlägt die Gruppe, aus schlägt
an** (`activates` mit `mode: 'off'`). Eigentum folgt der Gruppe nicht — wem
eine Ebene gehört, sagt weiter nur, wer sie selbst aufschaltet; sonst
machte eine geteilte Gruppe eine Kampagnenebene still gemeinsam.

**Eine Ebene darf nur einen Teil bringen** (T-105, REQ-255). Die Leitung
will aus einem Abenteuer die Gegenstände und Regeln, nicht dessen Orte, NSC
und Begegnungen — die gehören in eine andere Geschichte. Die Artikel aus
der Ebene zu nehmen hiesse, das Buch zu verändern, und jede andere Runde
verlöre sie mit. Also sagt die **Kante** `activates`, was die Ebene in
*dieser* Kampagne bringt: Bereiche (`areas`, aus `area` der Art) und
einzelne Arten (`types`). Der Bereich ist die grobe Wahl, weil eine neue
Art darin ohne Zutun mitkommt; die Art die feine, weil ein Gegenstand im
selben Bereich steht wie ein Ort. Was nicht passt, bringt die Ebene in
keiner Rolle — auch nicht als Überschreibung: eine Hausregel, die nur
überschreibt, ohne da zu sein, wäre eine unsichtbare Änderung.

**Eine Ebene erklärt ihr Kürzel.** „XGE" steht an jedem Artikel aus
Xanathar's Guide; wer das Buch nicht kennt, liest drei Buchstaben. Darum
trägt die Ebene ihr Kürzel (`Layer.abbreviation`) neben dem vollen Titel,
und wo ein Kürzel steht, zeigt die Seite den Titel beim Darüberfahren und
auf dem Telefon beim Antippen. Was eine Ebene enthält, wird gezählt, wenn
man fragt — gespeichert wäre es nach dem ersten neuen Artikel falsch (D8).

**Der Herausgeber ist eine Gruppe, kein Feld** (T-094, REQ-249). Die
Leitung will offizielles D&D auf einen Blick von Partner-Inhalten,
Drittanbietern und Homebrew unterscheiden. Ein Feld `Layer.publisher` hätte
die Marke getragen — aber „alle offiziellen Bücher an" wäre dann wieder
eine Kante je Buch gewesen, und neben einer Gruppe „Partnered" stünde ein
Feld, das etwas anderes sagen kann. Also ist ein Herausgeber eine Gruppe wie
eine Kategorie (E-022 b), sie sagt mit `groupBy: 'publisher'`, in welche
Ansicht sie gehört, und die Marke an einer Ebene wird aus ihr gerechnet.
Was in keiner Herausgeber-Gruppe steht, ist **Homebrew** — aber nur, wenn
es hier entstand: eigener Inhalt braucht keinen Verlag, um als eigener
erkannt zu werden. Was eingelesen wurde und an keinem Verlag hängt, heisst
**Unassigned** (T-109). Bis dahin hiess auch die alte Sammelebene
„D&D 5e (2014)" Homebrew, und weil die Marke an keinem Feld stand, sah
niemand, woher sie kam und wie man sie ändert. Darum steht der Grund jetzt
an der Ebene, und geändert wird dort die Kante — nicht ein Feld, das der
Kante widersprechen könnte. Die Sammelebene selbst ist seither eine Gruppe
der offiziellen 2014-Bücher: so schaltet man „die Regeln von 2014" als
Ganzes auf.

> **Die dritte Zeile der Tabelle ist die, die heute zählt.** Von
> fünfundsiebzig Artikeln tragen fünfundsechzig keine Ebenenkante — die
> Regel „ohne Ebene gehört er der Kampagne und ist immer da" (siehe
> [Ebenen.md](Ebenen.md)) ist richtig, solange es *eine* Kampagne gibt. Die
> zweite Runde braucht je Kampagne eine eigene Ebene, und das ist eine
> eigene Entscheidung.

---

## Die Zahlen einer Kreatur

**Sie wohnen am Statblock** — auch die eines Spielercharakters. Er hat mehr
darüber hinaus (Stufe, Klasse, Hintergrund), aber AC, HP-Maximum, die
sechs Werte und die **Übungen** sind dieselbe Sache wie bei jedem Monster.
Die Übungen standen bis P4 an der Kreatur; seither nimmt der Statblock
`Proficiencies` dazu, denn worin jemand geübt ist, rechnet mit seinem
Übungsbonus und seinen Werten — an zwei Stellen wären es zwei Antworten. Welcher Statblock es
ist, sagt `belongsTo`; gespeichert wird nur vorwärts, und „welchen Statblock
hat Rook" ist der Rückbezug.

`Vitals` bleibt bei der Figur: das ist, was sich **während** der Sitzung
ändert — Trefferpunkte jetzt, Zustände, Todesretter, verbrauchte
Zauberplätze. Es gehört ihr und nicht ihrem Bogen.

**Zauberwirken steht am Statblock** (`spellAbility`, `casterLevel`,
`spellSlots`), und **SG und Angriffsbonus werden gerechnet**:
`8+prof+modOf(spellAbility)`. `prof` steht in der Statblock-Karte, der Wert
in `Abilities` — darum fragt eine Rechnung erst ihre eigene Karte und dann
die übrigen Karten desselben Artikels. Was die eigene Karte trägt, gewinnt;
ohne Attribut gibt es keinen SG, denn 8 + Übung sähe aus wie einer. Wie viele
Plätze es gibt, ist die Festlegung am Statblock; wie viele verbraucht sind,
der Stand an der Figur (`Vitals.slotsUsed`) — wie `hp` an beiden.

**Was im Buch steht und nicht aus Übung folgt, ist ein fester Bonus**
(`Statblock.bonuses`, `{"Stealth": 6}`): der Goblin hat Heimlichkeit +6, wo
DEX und Übung +4 ergäben. Der Bogen nimmt ihn statt der Rechnung. Was ein
Monster führt, sagt die Kante `equips` zum Gegenstand aus dem Buch; ein
Inventar hat erst die Figur am Tisch.

### Klasse, Stufe und was gewährt wird

Klasse, Unterklasse, Abstammung und Hintergrund sind **Regeln mit eigenen
Feldern** und darum Arten unter `Rule`. Die Figur zeigt auf sie: `hasClass`
einmal je Klasse, **mit der Stufe an der Kante** — Kämpfer 3 und Magier 2
sind zwei Kanten, und die Unterklasse steht an der Kante, weil sie zu
dieser Klasse der Figur gehört. `PlayerCharacter.class` war ein Wort; ein
Wort kann nicht sagen, welche Trefferwürfel die Figur hat oder auf welche
Rettungswürfe sie geübt ist.

**Ein Angriff gehört allen, die so angreifen, und seine Zahlen dem, der
angreift** (D51). „Bite" stand im Bestand 870-mal, jedes Mal mit eigenen
Zahlen im Satz: der Wolf mit +4 und 2d4 + 2, der Hai mit +5 und 1d8 + 3.
Die Zahlen folgen aber fast immer aus dem, was am Statblock steht —
Übung plus Attributmodifikator, Würfel plus derselbe Modifikator; nachgerechnet
bei 83 % der Monster genau. Also sagt der Biss, worauf gerechnet wird
(Attribut, Würfel, Schadensart), und der Statblock rechnet. Was ein Wolf
anders macht als die anderen Beisser, steht an **seiner** Kante: dieselbe
Regel wie bei der Instanz, die nur ihre Abweichung speichert, nur eine
Ebene tiefer. Wo das Buch eine Zahl nennt, die aus der Rechnung nicht
folgt, steht **die Buchzahl** an der Kante, und man sieht ihr an, dass sie
fest ist — sonst wiche jeder sechste Monsterangriff still vom Buch ab.
Und woher ein Merkmal kommt, sagt am ehesten, wer es hat: der Biss zeigt
seine Träger nach Kreaturentyp, das „Aggressive" des Orks zeigt auf das
Volksmerkmal der Orks.

**Die Stufe der Figur wird gerechnet** — die Summe der Klassenkanten
(`sum(hasClass.level)`), und der Übungsbonus aus ihr. Eingetippt wäre sie
die dritte Stelle neben den Kanten und nach dem ersten Aufstieg falsch.

**Was eine Klasse gewährt, ist eine Kante, und die Stufe steht an ihr**
(`grants`, `props.level`). „Ability Score Improvement" kommt beim Kämpfer
auf Stufe 4, 6, 8, 12, 14, 16 und 19: ein Artikel, sieben Kanten. Ein Feld
`level` am Merkmal hätte eine davon gewählt und die anderen verschwiegen —
darum gibt es `Feature.level` nicht mehr (D50). Was gewählt wird statt
gewährt („zwei aus Acrobatics, Athletics …"), steht als **Wahl** an der
Klasse (`Choices.choices`), und getroffen wird sie an der Figur: eine
Kante `chose` mit der `id` der Wahl und den Antworten.

**Die Figur kopiert nicht, sie antwortet** (REQ-238, E-015 a). Es stand
einmal genau eine Wahl je Klasse in drei Feldern (`ProficiencyChoice`),
und alles Weitere — „+1 auf zwei Attribute", Ausrüstung (a) oder (b), ein
Talent, die Unterklasse auf Stufe 3 — war ein Satz im Text. Aus einem Satz
baut kein Assistent einen Schritt. Hätte die Figur beim Erstellen
übernommen, was die Wahl ergibt, erreichte eine Korrektur an der Klasse
keine bestehende Figur mehr. Also: die Wahl ist ein Eintrag mit Form am
Artikel, die Antwort eine Kante an der Figur, und was beides ergibt, wird
beim Lesen gerechnet (D8). Die `id` einer Wahl kommt aus dem Text
(`skills`, `fighting-style-2`) — wie bei jedem `many`-Feld, weil eine
durchgezählte beim Umsortieren still zur falschen Wahl gehörte. **Eine
Wahl ohne Spielraum ist beantwortet**: „+1 auf Con" an einem Talent ist
eine Wahl aus einem Wert und fragt niemanden.

**Ein Gegenstand wirkt, solange er getragen wird — und keinen Augenblick
länger** (REQ-063, E-025 a). Handschuhe der Ogerstärke setzen STR auf 19;
stünde die 19 im Statblock, wäre sie nach dem Ablegen noch da, und wer
vorher 20 hatte, hätte plötzlich weniger. Also steht die Wirkung am
Gegenstand (`Effects.effects`: Ziel, Art, Wert, Bedingung), der Zustand
an der Inventarkante (`holds.tier`, `slot`, `attuned`), und was beides
ergibt, rechnet `effectsAt` beim Lesen (D8). Es ist dieselbe Form wie die
Wahlen — ein Eintrag mit `id` aus dem Text —, damit Klasse, Talent und
Gegenstand eine Rechnung teilen und eine neue Wirkungsart ein Eintrag ist
und kein neues Feld. Je Wirkung ein eigenes Feld (`abilitySet`,
`resist`, `speedBonus` …) wäre einfacher zu lesen gewesen, aber jede
neue Art hätte Feld und Code gebraucht. Die alten `bonusAc` & Co. bleiben
stehen und zählen beim Lesen mit.

**Der Assistent zählt keine Schritte auf, er liest sie** (T-080). Fest ist
nur, was das Modell selbst vorgibt: drei Kanten (Abstammung, Hintergrund,
Klasse), sechs Werte, ein Name. Dazwischen steht je offene Wahl der
gewählten Artikel ein Schritt (`builderSteps` über `choicesAtCharacter`),
und was eine Wahl öffnet — die Unterklasse, ein Talent, das selbst fragt —,
wird eine Quelle und hängt seinen Schritt dahinter an. Eine Liste der
Schritte im Code wäre am Tag der ersten selbst angelegten Klasse falsch.
Der **Stufenaufstieg ist derselbe Assistent**: der Entwurf ist die
gespeicherte Figur mit einer Stufe mehr, und es fehlt, was sie schon
beantwortet hat. Gespeichert werden die **Grundwerte** am Statblock; Boni
aus Abstammung und Wahlen kommen beim Lesen dazu (`chosenResult`) — sonst
erreichte „+2 statt +1" an der Abstammung keine bestehende Figur.

**Was die neue Stufe bringt, steht beim Aufstieg da** (T-095). Ein
Aufstieg, der nur die Zahl erhöht, lässt die Spielerin suchen, was sie
jetzt kann. Die Merkmale stehen schon an der Klasse — `grants` mit der
Stufe an der Kante —, also nennt der Aufstieg sie, und was davon fragt
(Unterklasse, Kampfstil), ist ohnehin ein Schritt. **Eine Klasse ist ein
Eintrag:** Klasse, Stufe, Unterklasse und die Antworten auf ihre Wahlen
stehen am Artikel zusammen, weil sie zusammengehören; gespeichert bleiben
sie, wie sie sind — die Kante `hasClass` und je Antwort eine Kante
`chose` —, nur gezeigt wird eins. Eine zweite Stelle für die Stufe gibt
es nicht.

**Ein Wert der Reihe ist einmal da** (T-095). Die Standardreihe, ein Wurf
und der Gruppenpool sind sechs Werte zum Verteilen, keine Auswahlliste je
Attribut. Wer einen schon vergebenen Wert wählt, tauscht: das andere
Attribut bekommt den bisherigen. So kann keine Verteilung doppelt werden,
und niemand muss erst einen Wert freiräumen.

**Eine Sprachwahl wählt aus den Sprachen** (T-095, REQ-251). Ältere Wahlen
sagen nur „two standard languages of your choice"; daraus wurde ein
Freitext, obwohl es die Sprachen als Artikel gibt. Gelesen wird so ein
Satz als Wahl aus `Language` — gespeichert wird nichts dazu. Welche
Sprachen an einem Tisch Sinn ergeben, sagt die Kampagne
(`Campaign.languages`); leer heisst jede. Ein Feld mit Häkchen und keine
Kante, weil Übungen Namen halten und die Maske für Namen aus einer Art
schon Häkchen zeigt.

**Ein Merkmal, mehrfach gewährt, fragt jedes Mal** (T-107, E-027). Die
Attributssteigerung ist ein Merkmal der Klasse wie jedes andere: ein
Artikel, den der Kämpfer auf Stufe 4, 6, 8 … bekommt (`grants` mit
`props.level`). Ihre Wahl steht am Merkmal — Steigerung oder Talent, +1
auf zwei Attribute, dasselbe zweimal erlaubt —, und eine Änderung daran
wirkt an jeder Klasse und jeder Figur. Damit sieben Gewährungen sieben
Antworten tragen und nicht eine, merkt sich die Antwort, zu welcher Kante
sie gehört (`chose` mit `props.by` und `props.level`). Die Alternative
wäre eine Wahl je Stufe an der Klasse gewesen („asi-4", „asi-8") — dann
stünde dieselbe Frage dreizehnmal da, und wer sie ändert, ändert sie
dreizehnmal. Eine ältere Antwort ohne Stufe gilt für die erste Gewährung,
also verliert keine Figur, was sie gewählt hat. Was nur ein Weg von zweien
ist, sagt die Wahl selbst (`onlyIf`), und eine Vorgabe (`default`) zeigt
die Attributspunkte sofort; erlaubt die Kampagne keine Talente
(`Campaign.feats`), bleibt nur die Steigerung, und die Frage nach dem Weg
entfällt.

**Ein Attributsverfahren ist ein Artikel** (E-016 a). Standardreihe,
Punktekauf und Würfeln sind drei Formen derselben Frage, und die Leitung
wollte eigene dazu erfinden — den Gruppenpool, bei dem alle dieselben sechs
gewürfelten Werte verteilen. Als Code wäre jede neue Form ein Umbau; als
Artikel (`AbilityMethod`: Art, Reihe, Budget und Kosten, Würfelausdruck,
Geltung je Figur oder Gruppe) ist sie ein Eintrag, und die Kampagne nennt
die erlaubten (`allowsMethod`). Nennt sie keines, gilt die Vorgabe der
Grundregeln. **Gewürfelt wird am Server**, weil nur so jeder Wurf im
Protokoll steht; der Pool einer Gruppe steht an ihr (`abilityPool`), und
neu würfelt ihn nur die Leitung — sonst würfelte die Gruppe, bis es passt.

**Die Startausrüstung ist ein Verfahren wie die Attribute** (T-096,
REQ-250). Die Leitung wollte drei Wege — nach den Regeln, mit Gold, oder
frei mit eigenen Grenzen („200 gp, höchstens ein ungewöhnlicher magischer
Gegenstand") — und wird weitere erfinden. Also ist jeder ein Artikel
(`EquipmentMethod`), und die Kampagne nennt die erlaubten
(`allowsEquipment`), genau wie bei `AbilityMethod`. **Die Varianten
bleiben Wahlen** (E-015 a): wer (a) nimmt, hat eine Antwort an der Figur
und keine Kopie der Liste. Das Feste ist eine Wahl mit einer einzigen
Möglichkeit — sie fragt niemanden und zählt doch. **Eine Möglichkeit nennt
ihre Stücke** (`items`); wo sie es nicht tut, weil die Klasse vor T-096
eingelesen wurde, liest das Modell die Verweise in ihrem Text, denn die
Ebene neu einzulesen verlöre, was die Leitung an ihr geändert hat.
**Gerechnet und geprüft wird am Server**: das Gold würfelt er, und der
Eintrag im Protokoll ist der Beleg — ein Betrag aus der Maske gälte sonst
ungeprüft; der Einkauf wird gegen Budget und Grenzen gerechnet, bevor das
Inventar entsteht. Danach ist die Ausrüstung **Inventar wie jedes andere**
(`carries`, `holds`, `Inventory.copper`) — kein zweiter Ort, an dem „was
sie hat" steht.

**Ein Merkmal, das allein in einem Absatz steht, ist eingebettet** (W6).
5e.tools zieht Merkmale in andere hinein — der Battle Master beginnt mit
einem Kopf, der „Student of War" und „Combat Superiority" enthält, und
„Fighting Style" enthält die Stile. Der Importer schreibt dafür einen
Absatz, der nur aus dem Verweis besteht. Eine eigene Kante dafür wäre eine
zweite Stelle neben dem Text, die sagt, wo das Merkmal steht — und die
Reihenfolge im Text sagt es schon. Ein Verweis mitten im Satz bleibt ein
Verweis; nur der allein stehende wird in der Klassenansicht ausgeschrieben.

Damit heisst `hp` am Statblock das Maximum und an der Figur, was sie gerade
noch hat. Die Namensgleichheit ist keine Falle mehr, sondern die Wahrheit:
zwei Karten an zwei Artikeln.

**Ohne Statblock keine Zahlen.** Der Bogen zeichnet nichts, solange keiner
anhängt — vorher stand dort HP 0, AC „—" und Init +0, Werte, die es nicht
gibt. Wo der Statblock sonst seine Felder zeigt, stehen dann zwei Wege:
**anlegen**, und er trägt den Namen der Kreatur (er ist ihre Zahlenseite und
kein Ding für sich), oder **aus einer Vorlage**. Der Anlegedialog
fragt danach — neu, aus einer Vorlage oder später —, und „später" gibt es, weil eine
NSC-Idee noch keine Zahlen hat. Solche Kreaturen stehen auf der
Vorbereitungsseite unter „Creatures without a statblock", statt dass eine
Prüfung das Anlegen verbietet. Der Stand an der Figur bleibt gespeichert und
erscheint wieder, sobald etwas da ist, an dem er sich misst.

**Vorlage und Instanz.** Zwei Wachen aus einer Vorlage sollen verschieden
werden dürfen. Wer an einer Kreatur „aus einer Vorlage" wählt, hängt darum
nicht die Vorlage selbst an, sondern eine **Instanz**: ein eigener Statblock
mit dem Namen der Kreatur und einer Kante `instanceOf` auf die Vorlage.
Gespeichert wird an ihr **nur, was abweicht**; gelesen wird beides zusammen
(`resolveInstance`), Feld für Feld.

| | `hp` | `ac` | `str` |
| --- | --- | --- | --- |
| Vorlage „Wache" | 11 | 16 | 13 |
| Wache 1 (Instanz, nichts Eigenes) | → 11 | → 16 | → 13 |
| Wache 2 (Instanz, `hp: 18`) | **18** | → 16 | → 13 |
| Vorlage `ac` auf 17 | Wache 1: 11 · Wache 2: 18 | beide 17 | beide 13 |

- **Gleich wie die Vorlage heisst: folgt der Vorlage.** Beim Speichern fällt
  weg, was gleich steht wie dort (`thinInstance`). Wer den Wert der Vorlage
  einträgt oder ein Feld leert, folgt ihr wieder; ↺ an einem Feld tut
  dasselbe mit einem Klick. Eine Maske, die den aufgelösten Artikel
  zurückschickt, schreibt so nicht still jeden Wert der Vorlage fest.
- **Kanten nach Art.** Die Aktionen der Vorlage (`composedOf`) kommen mit,
  solange die Instanz keine eigenen hat; ändert jemand die Liste, gehört sie
  ganz der Instanz. Was zur Vorlage **als Artikel** gehört — `inLayer`,
  `belongsTo`, `overrides`, `variantOf` — kommt nicht mit, ebenso wenig ihr
  Name (`Identity`) und ihre Sichtbarkeit (`Visibility`).
- **Eine Vorlage darf selbst eine Instanz sein** („Hauptmann" aus „Wache");
  gelesen wird die Kette hoch, ein Kreis bricht ab.
- **Instanzen stehen an ihrer Kreatur und sonst nirgends** — nicht in
  Listen, nicht im Kompendium, nicht als Verweisziel. Dreissig Wachen wären
  sonst dreissig „Wache"-Statblocks im Regelwerk. Die Vorlage sagt
  „template of 30", die Instanz „instance of Wache".
- **Löschen nimmt nichts weg.** Geht die Vorlage, bekommen ihre Instanzen
  vorher, was sie von ihr lasen. Geht die Kreatur, geht ihre Instanz mit;
  ein eigener Statblock ohne Vorlage bleibt stehen, nur seine Kante geht.
- Am Server kommt eine Instanz aufgelöst an, mit `fromTemplate` (Vorlage und
  die Felder, die von dort kommen) — nur gelesen, nie gespeichert.

Ein Statblock gehört damit **einer** Kreatur (`belongsTo` ist wieder `one`).

> **Nicht mehr:** für einen Tag durfte ein Statblock vielen gehören, und die
> Seite warnte „shared by 30". Die Warnung beschrieb genau den Fall, den
> niemand wollte: jede Änderung an Wache 7 war eine an allen dreissig. Eine
> Kopie je Wache wäre das andere Extrem gewesen — dreissig Stellen für einen
> Tippfehler in der Vorlage.

„Hängt einer an" und „trägt er Zahlen" sind zwei Fragen (`statblockOf`,
`statsOf`): ein eben angelegter Statblock ist leer und trotzdem da.

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

## Behälter, Form und Zone

Ein **Behälter** ist ein Artikel (`Inventory`), und er hat seine eigene
Form: `grid` ist dieselbe Schreibweise wie die Kachelform eines Gegenstands
— ein Zeichen je Feld, `.` ist **kein** Feld. Damit ist ein Köcher, ein L
und ein Schlauch ein Behälter und kein Sonderfall. Sagt er nichts, gilt das
Rechteck aus den Einstellungen; eine Einstellung wegzunehmen, die für die
einfachen Fälle reicht, wäre kein Gewinn.

`zones` sagt je Feld, **was es kostet**, etwas von dort zu holen —
`{"x,y": "action"}`, Werte aus der Aufzählungszeile `DrawTime` (freie
Handlung, Bonushandlung, Handlung, Zug, Runde). Der Name steht als Wort in
der Karte und nicht als Nummer: eine Nummer wäre beim Umsortieren der Zeile
still die falsche Zone. Die Zone eines Stücks ist die **langsamste**, die
es bedeckt — man muss das Ganze herausbekommen, nicht nur eine Ecke.

Die **Drehung** steht an der Kante (`holds.props.rot`) und nicht am
Gegenstand: derselbe Bogen liegt quer oder längs, und dieselbe Fackel soll
nicht in jedem Beutel gleich liegen. Ein Stück **vom Raster** zu nehmen und
es **aus dem Behälter** zu nehmen sind zwei Dinge, und beide braucht man:
das eine räumt um, das andere gibt her.

**Fallen lassen heisst nicht weggeben** (D58). Ein Schwert, das mitten im
Kampf aus der Hand fällt, gehört der Figur weiter und liegt zu ihren
Füssen; nach dem Kampf hebt sie es auf. Darum bleibt die `holds`-Kante,
verliert Platz und Rasterlage und sagt `tier: ground`. Es auf die Karte zu
legen hiesse, die Kante zu löschen und einen Marker anzulegen — zwei
Schritte, ein zweiter Ort, und ohne laufende Karte fiele das Schwert ins
Nichts. **Verstauen** ist die Gegenrichtung zum Ziehen: aus der Hand an
einen freien Platz oder ins Raster, und es kostet dasselbe, wohin auch
immer. Beide Kosten stehen wie `slotDraw` als Einstellung (`handActions`):
sie sind das Blatt der Kampagne und rechnen nichts.

**Ein Gegenstand darf selbst ein Behälter sein** (M4): der Rucksack
`carries` sein Inventar wie eine Figur, mit derselben Kante und derselben
Darstellung. **Und jeder Behälter gibt eine Ziehstufe dazu** (D54): was in
einer Bag of Holding liegt, ist weiter weg als die Bag selbst — die Stufe
eines Stücks ist das Langsamere aus seiner Zone und der Stufe des Behälters
+ 1, die Kette hinauf. Eine eigene Kante „Inventar in Inventar" braucht es
dafür nicht: die Bag ist ein Gegenstand, der ein Inventar trägt, und genau
das sagte `carries` schon. Ein Behälter an einem Körperplatz nimmt die
Stufe des Platzes, und welche das ist, steht als Einstellung (`slotDraw`)
und nicht im Code: eine Runde, in der ein Holster eine Bonusaktion kostet,
ändert eine Zeile.

**Das Tragraster wird gerechnet und nicht gemalt** (D54). Basils Blatt
hat links ein Quadrat nach Grösse und rechts eines, das mit der Stärke
wächst. Das Zusatzquadrat steht als **Feld mit Rechnung am Statblock**
(`carryExtra`, `mod(str)`) und nicht als Einstellung: es rechnet gegen die
Nachbarn des Statblocks wie der Zauber-SG und ein Angriff, der Bogen zeigt
die Zahl, und wer die Regel ändert, ändert die Formel an einer Stelle. Eine
Einstellung wäre ein ungeprüfter Text ohne Ort, an dem man die Zahl sieht.
Die Grundquadrate je Grösse und die Zonen nach Spalten sind dagegen
Einstellungen (`carrySquares`, `carryZones`): sie sind das Blatt der
Kampagne und rechnen nichts. Ein Stück, das nach einem Schrumpfen
ausserhalb der Form liegt, behält seine Lage; es liegt im Fach, bis es
jemand neu hinlegt, und hat bis dahin keine Ziehstufe.

**Die Figur gehört der Kreatur, die Plätze der Kante.** Männlich, weiblich
oder neutral ist eine Angabe darüber, wie eine Figur aussieht, und das
Inventar wechselt den Träger. Welche Plätze es gibt, sagt die Liste an
`holds.props.slot`; wo sie auf dem Blatt sitzen, ist Darstellung. Und **das Stück am Tisch darf eine Instanz** des Gegenstands im
Buch sein (`instanceOf`, wie beim Statblock): das +1-Langschwert speichert
nur, was es vom Langschwert unterscheidet, und eine Korrektur am Langschwert
erreicht es.

---

## Blaupause und Gang

Eine **Blaupause** ist ein Rezept, das jemand **gelernt** hat — und gelernt
heisst zugeteilt: eine Information über das Rezept geht über `knownBy` an
die Figur, ihre Gruppe oder ihre Fraktion. Ein Feld „gelernt von" am Rezept
wäre ein zweites, schwächeres Wissensmodell neben dem, das es schon gibt.
Bis D52 lag ein Rezept ohne Information offen, und jeder konnte es; jetzt
werden Blaupausen gelernt, also kann ein Rezept, das niemandem zugeteilt
ist, auch niemand. **Sehen** darf man es trotzdem — ob etwas dasteht, ist
die Frage der Sichtbarkeit, nicht des Wissens —, nur gestrichelt und mit
„must still be learned". Einen Fundort nennt die Werkbank nicht: wo man
eine Blaupause lernt, ist Kampagneninhalt.

Ein **Gang** ist ein laufendes Handwerk und eine Kante (`crafting`) von dem,
der arbeitet, zum Rezept. **Beim Start wird gebunden**, was das Rezept
braucht: es verlässt das Inventar und steht am Gang. Bis dahin ging nichts
hinein, und man legte unterwegs nach — dann lag dieselbe Zange im Beutel und
im Gang zugleich und reichte für zwei Gänge. Gebunden wird auch, was nicht
verbraucht wird; es kommt am Ende immer zurück. Das Nachlegen bleibt für
das, was erst unterwegs dazukommt.

Was beim Misslingen und beim Abbruch zurückkommt, sagt das Rezept
(`onFailure`) — sonst entschiede es jedes Mal die Laune am Tisch.

---

## Was ein Spieler von einer Karte bekommt

**Eine Karte geht gekürzt hinaus, nicht verdeckt.** Ein versteckter Marker,
den die Seite nur nicht zeichnet, ist trotzdem angekommen — wer die
Antwort liest, sieht die Kante und weiss, dass dort jemand lauert. Darum
nimmt der Server sie heraus (`redactMap`), bevor die Karte losgeht: die
versteckten Marker, die Marker auf Artikel, die der Spieler nicht sieht
(sonst verriete die Id, dass dort etwas ist), und die Blätter der Leitung.
Wer die Karte leitet oder schreibt, bekommt sie ganz — sonst schriebe er
beim nächsten Verschieben eines Markers eine gekürzte Karte zurück.

**Was neben der Karte steht, ist eine Frage und kein Feld.** Welche
Unterkarten in ihr liegen, sagt keine Liste an ihr: jede Unterkarte nennt
ihre Umgebung (`insideMap`), und die Gegenrichtung fragt der Server — so
wie bei jeder Kante. Ein Feld „Unterkarten" an der grossen Karte wäre die
zweite Stelle, die beim ersten Verschieben nicht mitkommt.

## Zug, Tempo und Zone auf der Karte

**Ein Zug ist kein Feld der Kreatur.** Dass der Kämpfer schon 20 Fuss
gelaufen ist, stimmt für diesen Zug und in einer Minute nicht mehr; an der
Kreatur stünde es noch, wenn sie längst in einer anderen Sitzung ist. Darum
steht es an der Sitzung (`SessionState.moves`), zusammen mit dem Zug, für
den es gilt — und ein Eintrag aus einem anderen Zug ist einfach alt. Ein
Zähler, den jemand zurücksetzen muss, setzt am Tisch niemand zurück.

**Das Tempo ist eine Zahl und kein Schalter.** Spurt, Klettern, Schwimmen,
ein Bonusaktions-Spurt, ein Zauber, der das Tempo halbiert: jede Ausnahme
ist eine andere Zahl. Ein Schalter je Ausnahme wäre eine Regel im Code je
Ausnahme, und die nächste fehlt. Die Kurzwahl schreibt nur die Zahl.

**Die Diagonale zählt der Weg und nicht das Feld.** Ob ein schräger
Schritt fünf oder zehn Fuss kostet, hängt davon ab, wie viele schräge
Schritte vorher kamen — also sucht der Rechner über Feld *und* Parität. Wer
nur über Felder sucht, nimmt den ersten Weg, der ein Feld erreicht, und der
ist mit der falschen Parität dort angekommen.

**Eine Zone ist eine Regel, die an einem Ort gilt.** Eis ist kein Feld der
Karte, sondern ein Artikel mit Regeln (rutschig, schwieriges Gelände,
Geschicklichkeitswurf), und jede Stelle, an der Eis liegt, zeigt darauf —
wie ein Token auf seinen Artikel. Was die Karte selbst rechnen kann (Kosten,
Licht, Sicht, wer es bemerkt), rechnet sie; was der Tisch würfelt, zeigt sie
und schreibt es ins Protokoll, wenn jemand hineinläuft.

**Ein Oger ist vier Felder und nicht ein grosses** (D58). Ein Token nimmt
nach der Grösse seines Statblocks einen Platz ein — large 2 × 2, huge 3 × 3,
gargantuan 4 × 4 —, und alles, was die Karte rechnet, rechnet mit dem
ganzen Platz: er muss durch die Lücke passen, eine Wand hält ihn, wenn sie
eines seiner Felder hält, und er sieht von jedem seiner Felder aus. Die
Grösse steht am Statblock und wird beim Lesen geholt; am Token stünde sie
ein zweites Mal und wäre nach der ersten Korrektur falsch. Gespeichert wird
die **Mitte** des Platzes, weil sie für jede Grösse dasselbe meint (wo das
Token steht); gerechnet wird über seine **Ecke**, weil sich ein Platz so
Feld für Feld verschieben lässt.

**Teuer ist der Schritt, nicht der Körper.** Tritt der Oger mit einem Fuss
ins Eis, ist sein Schritt langsam — aber nicht doppelt so langsam, weil
zwei seiner Felder darin landen, und nicht noch einmal, weil er beim
nächsten Schritt mit dem anderen Fuss nachzieht. Gezählt wird das
teuerste Feld, das der Schritt **neu** betritt: so zählt die Regel
(„jeder Fuss in schwierigem Gelände kostet einen mehr“) für eine Kreatur,
die sich als Ganzes bewegt, und so kostet der Schritt aus dem Eis heraus
nichts extra, wie bei einem Feld.

**Aufgedeckt wird, wenn die Bewegung feststeht.** Während jemand noch den
Weg sucht, verrät eine Karte, die schon aufdeckt, was hinter der Ecke
liegt. Erst beim Bestätigen wird der Weg Schritt für Schritt abgelaufen,
und an jedem Schritt gilt dieselbe Prüfung wie von Hand.

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

Und eine Figur, weil an ihr Klasse und Stufe hängen (so, wie sie seit P4
aussähe — der Bestand wird nicht umgezogen, sondern ersetzt):

```
Artikel  pc_rook
  ist    PlayerCharacter                ← erbt Creature
  Karten
    PlayerCharacter  level* 5, proficiency* +3   ← gerechnet aus den Kanten
    Vitals        hp 19/24, conditions …    ← was sich in der Sitzung ändert
  Kanten
    hasClass      → Rogue    level 5 · subclass Thief
    hasAncestry   → Lightfoot Halfling
    hasBackground → Criminal
    belongsTo ← sb_rook                 ← dort wohnen Werte und Übungen
```

Und der Bogen, auf den `belongsTo` zeigt:

```
Artikel  sb_rook
  ist    Statblock
  Karten
    Abilities     str 10, dex 18, con 12, int 14, wis 12, cha 13
                  strMod … chaMod, initiative, passivePerception  ← gerechnet
    Statblock     system, size, ac, hp, speed, cr, prof, senses …
    Proficiencies
      proficient  Stealth, Sleight of Hand, Investigation, …  ← Skill-Artikel
                  Common, Thieves' Cant, Halfling             ← Language-Artikel
                  Thieves' tools                              ← Item (Werkzeug)
                  simple, light                               ← Weapon.category, Armor.armorType
      expertise   Stealth, Sleight of Hand
      saves       dex, int                                    ← Zeile Ability
```

**`StatblockInfo` gibt es nicht mehr.** Es war eine Karte mit dreissig
Feldern, von der Rüstungsklasse bis zu den Immunitäten — ein Sammelname für
„alles, was an einem Statblock steht", und damit keine Auskunft. Jetzt trägt
der Statblock seine eigenen Felder und nimmt `Abilities` dazu; eine andere
Art, die die sechs Werte braucht, nimmt dieselbe Zeile. Die Modifikatoren
stehen **bei** den Werten, weil `mod(dex)` zuerst gegen die Nachbarn
derselben Karte auflöst; der Zauber-SG in der Statblock-Karte findet `int`
über den Rückgriff auf die übrigen Karten.

**Ein Feld, sechs Quellen.** `proficient` zieht aus den Artikeln der Arten
`Skill`, `Language`, `Item` (nur Werkzeuge) und `Weapon` und aus den Listen
von `Weapon.category` und `Armor.armorType`. Vorher stand je Sorte ein Feld
— also dieselbe Frage sechsmal, und die siebte Sorte hätte ein siebtes Feld
gebraucht —, und danach sechs Wortlisten, von denen keine sagen konnte,
worauf eine Fertigkeit rechnet. Woher ein Wert kommt, sagt die Quelle: der
Bogen gruppiert danach, und was keine Quelle kennt (eine Hausregel ohne
Artikel), steht unter „Other" und bleibt gespeichert.

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

Das Mass dafür: **ohne das andere wäre dieser Artikel unvollständig, und an
seinem Ende liest es sich als eines.** Der Statblock einer Kreatur und das
Inventar einer Gruppe sind so; ein Gegenstand, den ein Rezept liefert, ist es
nicht — den gäbe es auch ohne das Rezept, und er bleibt ein Verweis.

Ein Feld hat einen Wert: jede Kante mit `asField` ist `one`, an welchem Ende
sie auch liegt. Eine Kreatur trägt ein Inventar, ein Statblock gehört einer
Kreatur. Was dreissig Wachen gemeinsam haben, steht an einer **Vorlage**, aus
der jede ihre Instanz liest (siehe Statblock).

