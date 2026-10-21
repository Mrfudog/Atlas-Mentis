# Begriffe

Angelegt 2026-09-21, laufend ergänzt; mit den Definitionen der Ernte
abgeglichen 2026-10-15 (T-156). Die neun Wörter stehen auch im Glossar
des Handbuchs (`packages/registry/src/glossar.ts`) — ein Test hält beide
zusammen. Zurück zum [Einstieg](README.md).

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
- ob es beim Bearbeiten **auch leer dasteht** (`prominent`, T-195). Die
  Maske zeigt Pflichtfelder und Felder mit Wert; die übrigen holt man über
  „+ Add field“, denn vierzig leere Eingaben verstecken die fünf, um die
  es geht; ein Wert, der nur die Vorgabe ist, zählt nicht. Die
  Beschreibung, die man fast immer ausfüllt, und den Stand, der über die
  Sichtbarkeit entscheidet, soll man dafür nicht erst suchen,
- **was es meint** (`description`): ein Satz, gezeigt in der Auswahl
  „+ Add field“. Die Beschriftung sagt, wie ein Feld heisst; wer es zum
  ersten Mal hinzufügt, will wissen, wofür,
- ob es **nur in der Maske** steht (`editOnly`): ein Schlüssel, den man
  setzt und niemand liest — `Time.sort` ordnet die Weltgeschichte, gelesen
  wird „Mirtul 12, 1492 DR". In der Feldtabelle stand „Sortable value
  14920512" an jedem Ereignis,
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

### Wonach eine Liste filtert

Eine **Facette** ist ein Feld oder eine Kante, nach der sich die Liste
einer Art filtern lässt — Grad, Schule, Komponenten und „granted by" an
einem Zauber (T-174). Sie ist **kein neues Ding**, sondern eine Frage an
das, was schon dasteht: eine Aufzählung lässt sich ankreuzen, eine Zahl
eingrenzen, ein Verweis auf einen Artikel wählen. Darum steht keine Liste
je Art im Code — eine neue Art bringt ihre Filter mit, und ein Feld, das
morgen dazukommt, auch. Wo die Form lügt (ein Schalter, der nur der Maske
dient), sagt es das Feld selbst: `facet: false`.

Nicht zu verwechseln mit der alten „Facet" (oben): die hiess eine Ansicht
und heisst heute so. Eine Facette **wählt Artikel aus**, eine Ansicht
**zeigt Felder** — die erste fragt eine Liste, die zweite einen Artikel.

Eine Kante filtert in **beide** Richtungen, weil man beide fragt: welche
Zauber gewährt die Klasse, und welche Klasse gewährt diesen Zauber. Die
Gegenrichtung bleibt eine Abfrage (K1) — gezählt wird nur, wessen Quelle
man sieht, also verrät ein verborgener Artikel auch hier nichts.

Zwei Facetten **lesen** ihr Feld statt es nur abzuzählen (T-180): eine
**Voraussetzung** („level 4, STR 13; or level 4, DEX 13") wird beim
Rechnen in Bedingungen zerlegt, und **Wirkungen** werden zu Wörtern aus
Ziel und Art („Resistance: fire", „Bonus: AC"). Der Satz bleibt der
Satz — gespeichert wird keine zweite Form, die beim nächsten Bearbeiten
nicht mehr stimmt. Darauf baut **„usable by"**: die Liste zeigt, was eine
Figur erfüllt. Was der Zerleger nicht versteht („Dragonlance campaign"),
ist **unbekannt und nicht „nein"**: es bleibt in der Liste und trägt ein
„?" — still auszuschliessen hiesse, dass eine unvollständige Erkennung
wie eine Regel wirkt.

Ein **Zauber** hat keinen Voraussetzungssatz — er steht auf einer
**Zauberliste** (T-212). Das ist eine dritte Beziehung zwischen Klasse und
Zauber neben zweien, die schon da waren: `casts` sagt, was jemand
**wirkt** (vorbereitet, angeboren, aus einem Stab), `grants`, was er
**bekommt**, und `spellList`, was er lernen **darf**. Die Liste mit
`grants` zu sagen, sähe kürzer aus und wäre falsch: was gewährt ist, wirkt
an der Figur, und dreihundert Zauber auf der Liste eines Magiers wirken
nicht alle. „Usable by" liest die Liste mit dem Grad: was auf der Liste
einer Klasse der Figur steht und was sie dort wirken kann.

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

In der Oberfläche heissen die Einträge **Textabschnitte** („Text sections",
Knopf „+ Text", T-337) — bis 21.10.2026 „Passages", und das war dasselbe Wort
wie der Kartenübergang. Unter den Feldern steht je Art, die der Typ kennt,
wie viele Abschnitte dastehen; dass jeder einzeln freigegeben werden kann,
sagt der Satz darüber.

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

**Zwischen zwei Installationen gehört die Nummer prod** (T-130). Jede
Installation zählt für sich; legt dev `rule-0042` an und hat prod
inzwischen eine andere `rule-0042`, sind es zwei Artikel mit derselben
Nummer. Einer muss weichen, und es ist der auf dev: auf prod wird gespielt,
dort stehen die Verweise, die zählen, und dev ist die Spielwiese, die sich
nach prod richtet. Die **Id** dagegen ist zufällig und auf beiden Seiten
dieselbe — an ihr erkennt die Übernahme, dass es derselbe Artikel ist. Das
ist die eine Stelle, an der eine Nummer sich nach dem Anlegen noch ändert,
und sie nimmt ihre Verweise (`[[rule-0042|…]]`) mit.

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
Browser sie behalten, solange er nach diesem Namen fragt. Darum nennt der
Server mit jeder Listenzeile und jedem Artikel die **Version** der Bilder
darin (`imageVersion`, `refs.assets`, T-211): ohne sie fragt der Browser
bei jeder Liste jedes Vorschaubild neu nach, und eine Seite mit fünfzig
Zeilen wartet auf fünfzig Rundreisen.

**Eine Kreatur ohne eigenes Bild zeigt das ihres Statblocks** (T-211) —
sein Bild, sonst seinen Token, auch aus der Vorlage einer Instanz. Das
ist keine Kopie: gerechnet wird beim Lesen (`articleImage`), wie jeder
abgeleitete Wert (D8). Eine Wache aus der Vorlage „Guard" hat damit das
Bild der Vorlage, solange niemand ihr ein eigenes gibt — dann gilt ihres.
Ein kopiertes Bild bliebe stehen, wenn jemand das der Vorlage austauscht.

**Ein Token ist ein Bild in einem Kreis — oder schon rund** (T-297). Die
Tokens aus 5e.tools bringen Ring und Schatten mit; schnitte die Karte sie
noch einmal in einen Kreis mit eigenem Rand, läge der Schatten am Rand und
das Gesicht neben der Mitte. Also sagt das Bild, ob es schon rund ist
(`Asset.round`, beim Hochladen an den durchsichtigen Ecken erkannt), und
wo nicht, wo sein Kreis sitzt (`Asset.frame`). Beides steht **am Bild**
und nicht am Statblock: dreissig Wachen aus einer Vorlage haben ein Token,
und wer es einmal zurechtrückt, rückt es für alle zurecht. Auch der
**Rand** steht dort (`frame.ring`), als Id aus einer Liste (`TOKEN_RINGS`):
eigene Ränder sind dann weitere Einträge, keine neue Fallunterscheidung.

**Beim Platzieren zählt das Wesen, nicht seine Fassungen** (T-301): wer
„Demogorgon“ sucht, meint die Kreatur. Gleich Benanntes steht als eine
Zeile da (`placementGroups`), vorn Kreatur, dann Statblock, dann Bild —
die übrigen hinter „+“.

Gezeigt wird ein Bild mit dem Block **`image`**, und wie gross, sagt der
Ort und nicht ein Wähler: in der Listenzeile ein Daumennagel, auf der
Karte die Vorschau, auf der Seite das ganze Bild. Eine Spieleransicht gibt
es auch hier nicht — wer das Asset nicht sehen darf, bekommt in der Liste
kein Bild und an der Adresse nichts.

### Klasse, Fassung, Quelle

Ein Bild hat eine **Klasse** (`Asset.kind`, T-119): ein allgemeines Bild,
ein Kartenbild, ein Token, ein Stück zum Platzieren. Sie sagt, wo das
Bild angeboten wird — wer das Kartenbild wählt, sieht zuerst Karten, wer
ein Token wählt, Tokens. Sie ist ein **Wort und keine Unterart**: eine
Unterart lohnt sich erst, wenn sie eigene Felder trägt, und keine der vier
tut es. Die Grösse eines Tokens ist die seiner Kreatur, das Raster gehört
der Karte; ein Feld dafür am Bild wäre die zweite Stelle für dieselbe
Sache.

Woher die Maske weiss, welche Klasse ein Feld will, steht am Feld
(`target.where`) — und an der Karte, die `Image.image` erbt, steht es am
Typ (`targets`, wie `titles` für die Beschriftung). Eine Liste im Code
(„Karten wollen Kartenbilder") wäre die Stelle, die beim nächsten Feld
fehlt. Es bleibt ein **Vorschlag**: ein Porträt als Kartenhintergrund ist
seltsam, aber nicht falsch.

**Ein Kartenbild ist noch keine Karte** (T-202). Die Karte ist ein
Artikel mit Raster, Blättern, Marken und Nebel; das Bild ist nur ihr
unterstes Blatt. Wer ein Kartenbild hochlädt, sucht es trotzdem dort, wo
eine Karte verlangt wird — unter „Map on the table“ an der Sitzung. Also
bietet eine Auswahl, die eine Art verlangt, deren Bild eine Klasse
anbietet, auch Bilder dieser Klasse an, und wer eines wählt, legt daraus
den Artikel an (`imageBecomes`, `fromImage`, `mapFromImage`). Welche Klasse
zu welcher Art wird, liest sich aus denselben `targets` wie oben — keine
Liste im Code. Dass es zwei Dinge bleiben, ist Absicht: dasselbe Bild darf
zwei Karten tragen, eine mit Raster für den Kampf und eine ohne für die
Reise.

**Wer zieht, ist eine Stufe und keine Liste** (T-290, E-040). Die
Leitung wollte an der Kampagne sagen, wer ziehen darf — eigene Figuren,
die der Gruppe, Verbündete oder alle. Eine Liste erlaubter Tokens an der
Karte wäre die zweite Stelle, die beim nächsten Gefährten nachgezogen
werden muss; die Stufe rechnet aus dem, was ohnehin dasteht (Konto,
Gruppe, Seite an der Begegnung). Jede Stufe schliesst die engere ein,
weil niemand den Hund ziehen lassen will, die eigene Figur aber nicht.
Ob die Leitung bestätigt, war schon eine Einstellung (`moves`) — sie
blieb, statt neben `tokenMoveConfirm` ein zweites Mal dazustehen.

**Den Zug plant, wem die Figur gehört** (T-325). Bis dahin plante eine
Spielerin im Kampf für jede Figur, die `tokenMove` sie ziehen liess — mit
`allies` also auch den Hund der anderen, und Spielende ohne eigene Figur
sahen eine Leiste, die ihnen nichts zu tun gab. Ziehen ausserhalb des
Kampfes ist eine Frage der Ordnung am Tisch; einen Zug planen heisst, für
die Figur zu entscheiden, und das tut, wer sie spielt. Wie viel ein Zug
umfasst, ist eine **Stufe** wie bei `tokenMove` (aus, Bewegung, dazu
Aktionen, dazu Reaktionen): eine Liste erlaubter Kostenarten wäre eine
zweite Stelle für dieselbe Frage. Und weil er ändert, was ein Antippen
der Karte tut, ist er ein **Werkzeug** der Leiste und keine Leiste für
sich; der Tracker und die Gruppe ändern nichts am Antippen und sind
**Panels** aus derselben Leiste — sie bleiben neben jedem Werkzeug offen.

**Wer was aufgedeckt sieht, ist eine Frage an die Form** (T-204). Ein
Nebel je Figur hätte auch je Figur eine Liste aufgedeckter Formen sein
können — dann stünde dasselbe Stück Gang so oft da, wie Figuren es
gesehen haben, und ein Umstellen von „je Gruppe“ auf „je Figur“ müsste
erst Listen verteilen. Stattdessen nennt eine Form, für wen sie ist
(`for`), und die Kampagne sagt, ob das zählt. Je Gruppe bleibt die
Angabe stehen und wird nicht gelesen; wer später umstellt, weiss noch,
wer was gesehen hat. Ob ein Zug aufdeckt, steht an der Kampagne und darf
an einer Karte anders stehen — das Häkchen an der Karte war ein Zustand
im Browser, der beim Neuladen vergass, was die Leitung wollte.

**Was eine Sperre hält, ist eine Zeile und keine Liste je Art** (T-118).
Eine Wand hält Schritt, Blick und Licht, ein Fenster nur den Schritt, eine
offene Tür nichts. Das steht in `WALL_KINDS` je Art als drei Häkchen —
Bewegung, Sicht, Licht — und jede Rechnung fragt die Häkchen, nicht das
Wort: das Sichtpolygon nimmt, was die Sicht hält, der Zugplan, was den
Schritt hält. Eine neue Art (ein Vorhang, der nur die Sicht hält) ist
dann eine Zeile, und keine Abfrage muss sie kennen. Die **Geheimtür** ist
eine Tür, die der Server den Spielenden als Wand schickt, bis sie offen
ist — nicht eine Wand mit einem Vermerk, den die Seite verbergen müsste.

**Eine Form ist eine Folge von Sperren** (T-304). Ein Rechteck, ein Kreis,
ein Polygon werden beim Fertigstellen zu Strecken; es gibt keinen Eintrag
„Rechteck“ in `Map.walls`. Sonst müsste jede Rechnung, die Sperren liest —
Sichtpolygon, Licht, Zugplan —, auch Formen verstehen, und die erste, die
es vergässe, liesse den Blick durch eine Ellipse. Dasselbe gilt für die
**Tür als Viereck**: das Viereck ist, was man anklickt, gerechnet wird die
Linie. Und **Schneiden** ändert die Wände selbst, statt eine Lücke zu
merken: was gespeichert ist, ist, was hält. Darum endet ein Wandstück
genau am Rand der Tür — so findet das Zusammenfügen es wieder.

**Ein Token nimmt seinen Platz, und der Platz steht an einer Stelle**
(T-317). Wie gross ein Token gezeichnet wird und worauf es einrastet, ist
dieselbe Zahl (`tokenSpan`): am Token, wenn jemand sie dort setzt, sonst
aus dem Statblock. Zwei Zahlen — eine fürs Bild, eine fürs Gitter — liessen
einen Oger zwei Felder breit auf einem Feld stehen. Die Tabelle gehört der
Kampagne und nicht dem Code, denn ob ein Winzling ein halbes Feld nimmt,
ist eine Hausregel.

**Aufgedeckt wird, was man sieht, und gespeichert, was man gesehen hat.**
Das Sichtpolygon wird beim Zug gerechnet und als Form in `Map.reveal`
geschrieben; es gibt keine zweite Liste „gerade sichtbar“. Was eine Figur
einmal gesehen hat, bleibt aufgedeckt — so wie am Tisch ein Raum, den man
verlassen hat, nicht wieder aus der Erinnerung fällt. Was die Figur
**gerade** sieht (die laufende Sicht, T-216), rechnet die Seite aus der
Karte, die sie ohnehin hat, und speichert es nicht: es ändert sich mit
jedem Schritt.

**Licht hängt an der Kante, die Dunkelsicht am Statblock** (T-216). Eine
Laterne ist kein eigener Artikel, sondern ein Marker mit Radius — dieselbe
Laterne leuchtet auf einer Stadtkarte anders weit als in einem Keller. Die
Dunkelsicht steht in `senses` am Statblock und wird beim Lesen gezogen;
eine zweite Zahl an der Figur liefe bei der ersten Änderung auseinander.
Wie viel von einem Licht eine Figur sieht, ist die **Schnittmenge** aus
Licht- und Sichtpolygon — sie wird nicht ausgerechnet, sondern als Polygon
mit Klammer (`within`) gespeichert: zwei Fragen beim Prüfen, ein `clip()`
beim Zeichnen.

**Eine Fackel leuchtet aus dem Gegenstand** (T-305). Wie weit, ist eine
Eigenschaft der Fackel (`Item.lightBright`, `lightDim`) und steht deshalb
am Gegenstand und nicht an jeder Figur, die eine hält; *dass* sie leuchtet,
folgt daraus, wo sie liegt — in der Hand ja, im Rucksack nein. Das wird
beim Lesen gerechnet und nicht als Schalter an der Figur gespeichert, der
beim Verstauen stehen bliebe. Ausmachen (`lightOff`) ist dagegen ein
Zustand am Tisch und steht an der Markerkante, wie der Radius einer
Laterne.

**Ein Asset ist fix, bis es etwas anderes sagt** (T-306). Eine Kiste,
die bei jedem Ziehen an einer Figur mitrutscht, ist Kulisse, die man
ständig zurückstellt; also steht `movable` an der Kante und fehlt als
Vorgabe. Was sie hält, ist **eine Sperrart** und kein neues Wort: ihr
Umriss wird beim Lesen zu Sperren der Art, die `blocks` nennt — eine
eigene Liste von Asset-Sperren in `Map.walls` bliebe stehen, wenn die
Kiste wandert.

**Wo ein Bild verwendet wird**, steht nirgends — es ist die Gegenrichtung
der Verweise, und die ist eine Abfrage. Sie zeigt nur, was man sehen
darf: „wird noch an drei Orten gezeigt" verriete drei Artikel, auch ohne
ihre Namen.

Was man über die **Datei** wissen will — Auflösung, Grösse, Format —
steht am Bild, gelesen beim Hochladen (T-201). Die Datei ist die Quelle:
ein Wert, den man bei jedem Lesen neu aus ihr zöge, hiesse, für eine
Listenzeile hundert Dateien zu öffnen. Das **Seitenverhältnis** dagegen
steht nirgends; es ist eine Rechnung aus Breite und Höhe, und eine
gespeicherte Rechnung ist die zweite Stelle, die beim Ersetzen veraltet.

Ein Bild, das **nur als Adresse** in einem Feld steht, zeigt sich zwar,
ist aber kein Artikel — es hat keine Marken, keine Klasse, keine Herkunft
und steht darum in keiner Galerie. Der Nachtrag macht es zu einem Asset in
der Ebene dessen, der es zeigt: dort kam es her.

**„Use as map"** legt die Karte gleich mit an: die Klasse allein sagte
nur, wo das Bild angeboten wird, und wer ein Bild zur Karte erklärt, will
eine Karte. Das Gitter ist ein Vorschlag aus der Auflösung; ein falsches
Gitter ist schlimmer als keins, also bleibt es weg, wenn nichts aufgeht.

Ein Bild **ersetzen** heisst zweierlei, und die Maske fragt:

- **Neue Fassung**: ein zweites Asset mit `variantOf` auf das erste. Beide
  bleiben, und wer das alte zeigt, zeigt es weiter — die Wache bekommt ein
  Winterbild, die Sommerkarte bleibt am Sommerabend.
- **Quelle ersetzen**: derselbe Artikel, eine neue Datei. Jeder Verwender
  zeigt sofort das neue Bild, denn er hält die Id und nicht die Datei. Die
  alte Datei bleibt liegen, bis die nächste Sicherung sie hat — ein
  versehentlich ersetztes Bild ist so nicht verloren.

---

## Ansicht

Wie ein Artikel gezeichnet wird. Es gibt **vier**, nach denen ein Ort fragt,
und welche gilt, sagt der Ort und kein Schalter:

| Ansicht | Wo sie gilt | Was sie zeigt |
|---|---|---|
| **Overview** | Ein Verweis im Text, eine Listenzeile | Name und die Beschreibung — eine Handvoll Zeilen, wie ein Hover; die Felder darin sind die Spalten im Kompendium |
| **Quick** (Kurzansicht) | Eine Karte auf dem Board, die Vorschau neben der Liste, das Popup an einem genannten Artikel und am Marker, das „+" eines Suchtreffers, die Schnellanlage aus einem anderen Artikel | Das Nötigste, um zu wissen, was man vor sich hat — die Kennwerte oben, das Bild zuletzt |
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
muss, hält die vier fest. Das „+" der Suche ist darum **eine Ansicht und
kein Sonderfall** — und zwar **dieselbe wie die Karte** (T-346): von
T-138 bis T-346 hatte es eine eigene, `search`, und die zeigte an jeder
Art, was `quick` zeigte, abgeleitet, damit sie nicht vergessen wurde. Zwei
Ansichten, die dasselbe sagen müssen, sind eine Ansicht, die man zweimal
pflegt; beide beantworten „was habe ich da vor mir?".

**Warum das Bild zuletzt steht** (T-346): eine Karte hat einen Rahmen —
das Popup unter dem Auslöser, die Kachel auf dem Board — und nicht immer
Platz für alles. Steht das Bild oben, schiebt es die Werte aus dem Rahmen,
und wer die Kurzansicht öffnet, sucht Grad und Reichweite, nicht das Bild.
Also stehen die Kennwerte oben, dann Satz und Passagen, und das Bild am
Ende, wo der Rahmen es **abschneidet statt verkleinert**: ein Ausschnitt
bleibt erkennbar, ein Briefmarkenbild nicht.

**Warum der Handzettel Werte trägt, aber nicht alle** (T-234): wer den
Spielenden einen Gegenstand in die Hand gibt, gibt ihnen auch seine
Seltenheit; wer ihnen eine Fraktion vorstellt, nicht ihr Ziel. Was
zurückgehalten ist, siebt der Server ohnehin — der Zettel lässt darüber
hinaus weg, was die Leitung zwar sehen darf, aber nicht austeilt. Darum
wählt die Art die Werte (`h-f`), wie bei der Karte, und eine
„Spieleransicht" daneben gibt es weiter nicht: zwei Stellen, die sagen, was
Spielende sehen, wären zwei Wahrheiten.

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

Ein **Bereich** auf dem Board ist ein benanntes Rechteck, zu dem man über
einen Reiter springt — „Conditions" oben links, „Kerzengasse" unten
rechts. Er ist ein **Anker** mit Grösse und kein Behälter: welche Karten
dazugehören, sagt ihre Lage, nicht eine Kante. Wer eine Karte
hinausschiebt, hat sie damit herausgenommen; eine gespeicherte
Zugehörigkeit müsste man dabei jedes Mal mitändern, und vergessen hiesse,
dass sie im Bereich steht und woanders liegt.

**Was auf dem Board liegt und kein Artikel ist** — ein Text, ein Bild,
eine Zeichnung (T-339) —, ist eine **Form** am Board (`Board.shapes`) und
keine Kante: sie zeigt auf nichts, und sie gehört niemandem sonst. Ein
Text darin ist Markdown wie jeder lange Text, mit `[[Verweisen]]` und
`{VAR}`, und wird beim Zeichnen eingesetzt, nie beim Speichern. Eine
Karte darf eine Kachel sein (die lebendige Karte, gesiebt wie in Play)
oder der **Hintergrund** des Boards (`backgroundMap`) — beides ist keine
neue Art Platzierung, sondern derselbe Artikel an einem anderen Ort.

**Eine Abfrage-Kachel** (T-340) zeigt nicht einen Artikel, sondern eine
Auswahl — die Gerüchte der Stadt, was man über den Baron hören kann. Die
Leitung sagt, *woher* (Arten, einzelne Artikel, Marken, Ebenen, eine
Filterkette), nicht *welche*: eine Liste von Ids veraltete mit dem
nächsten neuen Gerücht. Sie ist eine Kachel wie jede andere, also eine
Kante — ihr Ziel ist das Board selbst, weil die Frage niemandem sonst
gehört. Die Antwort rechnet der Server für jeden, der hinsieht; eine
Kachel, die Spielenden die Liste der Leitung zeigt und im Browser kürzt,
hätte die Liste schon verraten. Gezogen wird ohne Zurücklegen, und der
Stand gehört dem Server: zwei Laptops am Tisch sollen nicht zweimal
dasselbe Gerücht ziehen. **Freigeben beim Ziehen** macht das Gezogene zum
Wissen der Gruppe — dieselbe Kante `knownBy` wie im Reiter Knowledge, und
wo der Artikel selbst noch verborgen ist, die Freigabe an ihm.

**Das Kampagnenboard** (T-342) ist der Ort, an dem Spielende ankommen:
der Titel der Runde, wo die Geschichte steht, die Gruppe, die offenen
Aufträge, die Gerüchte. Es ist kein neues Ding, sondern ein Board, das an
der Kampagne hängt — mit Kacheln, die *fragen*, statt zu kopieren: „die
Szene, die gerade läuft" ist eine Frage an die Sitzung, und eine Kachel,
die die Szene von letzter Woche festhielte, läge am nächsten Abend falsch.
Angelegt wird es beim ersten Öffnen und nicht über eine Migration, weil
die Vorlage dann nur an einer Stelle steht; gelöscht bleibt es gelöscht.
Wohin Spielende nach der Anmeldung kommen, ist eine Tischregel der
Kampagne, keine Einstellung des Kontos: die Leitung will, dass der Tisch
am selben Ort anfängt. Die **Basis-Leiste** daneben ist kein zweites Menü,
sondern der kurze Weg zurück — Board, die eigene Figur, Karten, Suche,
Wissen —, denn wer mitspielt, sucht nicht im Kompendium.

**Eine Struktur-Kachel** (T-341) zeigt eine Fraktion, einen Ort, eine
Familie so, wie die Kanten sie schon sagen: wer Mitglied ist und mit
welchem Rang, welcher Zirkel zu ihr gehört, was sie beherrscht, wen sie
wie sieht. Darum gibt es kein Feld „Organigramm“ — es wäre die zweite
Stelle für dieselben Mitgliedschaften und läge beim ersten Eintritt
falsch. Gespeichert wird nur, *wovon aus* und *welche Kanten*; Baum und
Netz rechnet der Server, je Betrachter, über das, was dieser sehen darf.
Eine Struktur, die im Browser kürzte, hätte der Spielerin den Zirkel
schon geschickt — und eine, die nur den verborgenen Knoten wegliesse,
liesse seine Mitglieder in der Luft hängen und verriete ihn so. Ein Typ
„Familie“ ist sie nicht: eine Familie ist eine Fraktion mit `kind:
family`, und wer zu ihr gehört, sagt `memberOf`.

**Die Leinwand hat keinen Rand.** `width` und `height` waren die Grösse
des Boards; jetzt sind sie die Mindestgrösse, und wie gross es ist, wird
beim Lesen aus dem gerechnet, was darauf liegt (`boardExtent`, D8). Eine
gespeicherte Grösse wäre die zweite Stelle, die beim ersten Ziehen über
den Rand falsch steht.

Auf der Kachel gibt es **keine Stufe „board“** (E-123): eine Kachel wählt
eine Ansicht wie jeder Ort, der wählt — Quick, Full (die ganze Seite,
scrollend), der Handzettel oder eine gestaltete. Wer nicht leitet, bekommt
ohne Wahl den **Handzettel**; was die Leitung wählt, gilt für alle.
Zurückgehalten wird weiter am Server: eine Kachel oder Form mit „GM only“
(`hidden`) geht an Spielende gar nicht erst hinaus (`redactBoard`).

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

**Die Overview ist die Vorgabe, nicht die Grenze** (T-343). Wer eine
Tabelle anders braucht — die Stufe am Zauber, die Klassen, die ihn
gewähren, den Modifikator am Statblock —, wählt die Spalten selbst; die
Wahl gehört dem Konto (wie der Filter der Seite), und die Leitung kann
eine zur Vorgabe der Kampagne machen. Eine Spaltenwahl ist ein Blick, kein
Inhalt: sie steht neben der Kampagne und nicht in ihr, und ohne sie gilt
wieder, was die Art sagt.

**Eine Filtergruppe ist kein Wort, sondern ein gespeicherter Blick**
(T-137). Die Leitung wollte World ohne Gegenstände sehen, ohne es jedes Mal
abzuwählen, und Unterreiter, die sie aus der Kopfleiste wieder findet. Eine
Vorgabe je Seite *und* daneben Gruppen wären zwei Stellen für dieselbe
Frage — „was zeigt diese Seite?" —, also ist die Vorgabe eine Gruppe mit
einer Marke. Sie gehört nicht ins Register: wie jemand seine Listen
schneidet, ist keine Regel, und eine eigene Gruppe trägt eine Konto-Id, die
in keinem Artikel stehen darf. Getrennt bleibt, was eine Gruppe **ist**
(Arten, Marken, Stand — die Grenze des Reiters) und womit sie **anfängt**
(Suche, Facetten — danach gehört der Filter der Seite): sonst liesse sich in
„Places" eine Suche nicht mehr löschen, ohne die Gruppe zu ändern.

**Ebenen wählt man an einer Stelle** (T-186, 15.10.2026). Bis dahin hatte
jede Listenseite ihre Ebenen-Häkchen *neben* dem Stand der Kampagne in der
Kopfleiste — zwei Antworten auf „was ist da?", und die Seite gewann, ohne
es zu sagen. Jetzt folgt die Seite dem Stand, und wer zwischen Ständen
wechselt, speichert ihn als **Ebenenauswahl** im Popup. Eine Auswahl ist
kein Filter, der über dem Stand liegt, sondern der Stand selbst unter einem
Namen: laden heisst schalten, für alle am Tisch.

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

**Ein Buch liest man an ihm selbst** (T-167, 14.10.2026; seit T-191,
15.10.2026, ohne Reiter): die Leseansicht ist das Element `reader` in der
Anordnung der Ebene und steht auf ihrer Artikelseite unter dem Kopf —
nicht eine Seite neben dem Artikel, sondern ein Teil von ihm. Dasselbe gilt
für die Klassenübersicht (`classOverview`) und die Übersicht einer Herkunft
oder eines Hintergrunds (`originOverview`): eine eigene Seite je Art wäre
der Sonderfall mit eigenem Weg, den „Die Anordnung wohnt am Typ"
abgeschafft hat; ein Element nimmt jede Art, die es in ihre Anordnung
schreibt, und jeder Ort, der Anordnungen zeichnet. Eine fünfte Ansicht ist
es nicht: der Ort — die Artikelseite — ist derselbe, also auch die
Ansicht (`full`). Gelesen werden darf auch,
was noch nicht aufgeschaltet ist: wer ein Buch aufschalten soll, will es
vorher ansehen. Das ist die einzige Stelle, an der „steht es im Stapel?"
nicht die erste Frage ist, und darum fragt sie nur die Leseansicht und
nur für diese eine Ebene; was darin jemand sehen darf, sagt das Sieb wie
überall. Eine Gruppe ist dort ein **Regal**: ihre Bücher, und eines ohne
Text steht ausgegraut da — ein fehlendes Buch sähe aus wie eines, das es
nicht gibt. Das **Inhaltsverzeichnis klappt auf**, Stufe für Stufe, und
folgt dem Lesestand; was aufgeklappt ist, merkt sich das Gerät, nicht das
Konto — das ist eine Sache der Hand, nicht des Lesestands.

**Wie im Buch** (W2, 13.10.2026) ist darum auch eine Anordnung und kein
Sonderfall: ein Statblock liest sich wie im Monster Manual, weil am Typ
`Statblock` das Element `statblock` steht — nicht, weil der Code nach dem
Namen „Statblock" fragt. Eine eigene Art, die von `Statblock` erbt, liest
sich ebenso; eine, die etwas anderes will, sagt es an sich.

**Die Kennzahlen** (T-206, 15.10.2026) folgen derselben Regel an einem
anderen Ort: die Kurzansicht eines Statblocks war der ganze Bogen und damit
länger als alles daneben. Am Tisch braucht man in einem Blick AC, HP,
Bewegung, Initiative, passive Wahrnehmung und CR — also steht an
`Statblock` für `quick` das Element `stats`, und an `Creature` dasselbe,
gelesen über `belongsTo` mit ihrem Stand (HP jetzt/Maximum, Zustände). Dass
es ein Element ist und keine Feldliste in der Ansicht, hat denselben Grund
wie beim Bogen: zwei der sechs Zahlen sind gerechnet, und sie stammen aus
drei Karten. Ein Obertyp „Kampfkennzahlen" hätte dafür `ac`, `hp`, `speed`
und `cr` aus der Karte `Statblock` in eine eigene verschieben müssen — eine
Wanderung jedes Statblocks für eine Frage der Darstellung. So gilt:
`overview` < `quick` < `full` — Herausforderung und Art im Verweis, die
Kennzahlen auf der Karte, der Bogen auf der Seite.

### Eine Ansicht gilt für etwas (T-268, E-103)

Bis hierher war eine Ansicht ein Ort, und die Art ordnete sie an. Das
reicht, solange jede Kreatur gleich aussehen soll. Ein Wirt aber ist eine
Kreatur, die einen Laden führt, und am Tisch will man von ihm Stimme,
Waren und Gebäude sehen — das ist keine Art (ein Untertyp ohne eigene
Felder wäre ein Wort), und es sind Felder **anderer** Artikel. Darum hat
eine Ansicht jetzt eine **Geltung**: Typen, Bedingungen auf Felder und
Kanten, oder genau ein Artikel. Gerechnet wird beim Zeigen, nicht
gespeichert: „Durnan bekommt Shop“ steht nirgends, es folgt daraus, dass
eine `shopkeeper`-Kante auf ihn zeigt.

Warum genaueste zuerst und nicht „die letzte gewinnt“: eine Ansicht für
genau Durnan ist eine Ausnahme, und eine Ausnahme soll die Regel schlagen,
egal in welcher Reihenfolge jemand sie angelegt hat. Warum trotzdem alle
zur Wahl: auf dem Board fragt die Kachel, und dort ist die Wahl der Sinn.

Und warum ein **Baum**: die Leitung wollte Struktur gestalten — Kacheln,
Karussell, Spalten — und nicht nur Felder auswählen. Eine Liste kann nur
untereinander; ein Element mit Kindern kann nebeneinander, nacheinander
und aufklappbar. Werte über Kanten (`path`) halten die Daten, wo sie
hingehören: der Preis steht an der `sells`-Kante des Ladens, und die
Ansicht des Wirts liest ihn dort, statt ihn zu kopieren.

### Eine Frage, überall dieselbe (T-310)

Die gestaltete Kurzansicht stand nur auf der Artikelseite: Popup,
Kompendium und Kachel fragten die Art (`layoutFor`) und nicht, was für den
Artikel gilt. Jede Zeichenstelle hatte ihre eigene Wahl, und die neue
Regel erreichte nur die, an die jemand gedacht hatte. Jetzt gibt es eine
Funktion (`pickView`), und ein Test sagt, wer `layoutFor` noch direkt
ruft — wer eine neue Zeichenstelle baut, findet die Frage schon
beantwortet. Die Wahl oben am Artikel steht in der Adresse und nicht am
Konto: sie ist eine Frage an diese Anzeige, und gespeichert hiesse, dass
der nächste Verweis auf denselben Artikel unerwartet anders aussieht.

### Ein Editor, und Speichern fragt wohin (T-276)

Es gab drei Stellen, an denen man eine Ansicht änderte: Registry › Views
(die Ansicht selbst), den Kasten Views an der Typseite (die Anordnung
einer Art) und den Designer (gestaltete Ansichten). Dieselbe Sache — wie
ein Artikel aussieht — hatte drei Masken, und die Leitung fand am Artikel
keine. Jetzt ist es **ein** Editor, und die Frage, die vorher die Wahl der
Maske war, steht beim Speichern: für jeden Artikel, für den ganzen Typ,
für diesen Artikel, oder unter einer Bedingung. Die Typseite zeigt nur
noch, was gilt und woher; wer ändert, landet im Designer mit dem Typ
gewählt.

Warum die **Anpassung** bleibt, obwohl der Designer einen ganzen Baum
zeigt: eine Abschrift bliebe beim Alten stehen, wenn die Ansicht sich
ändert; eine Anpassung sagt nur die Abweichung und nimmt das Neue mit.
Der Designer zeigt darum den Baum, wie er gilt, und rechnet beim
Speichern zurück, was davon Abweichung ist. Was sich so nicht sagen lässt,
sagt er — still eine Abschrift zu speichern hiesse, die Anpassung zu
verlieren, ohne dass es jemand merkt.

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
Ebenso ein Kult und ein Segen (seit T-084): ihre Signaturzauber sind
Zauber, die wirkt, wer dem Kult angehört oder den Segen trägt — eine
Kante `casts` ohne `mode`, nicht ein Absatz, den niemand abfragen kann.

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
                                     | Ancestry | Background | Class | Subclass | Feat
```

Ein Bündel in einem Bündel zählt nicht: ein Schritt weit, dieselbe Regel wie
bei den Haltern. Sonst reichte eine Freigabe weiter, als jemand gemeint hat.

**Wissen über viele Artikel ist eine Regel, kein Stapel Kopien** (T-285).
„Was Orcs auszeichnet" betrifft jeden Orc — hundert angehängte
Informationen wären hundert Stellen, die beim nächsten Orc fehlen. Also
darf eine Information sagen, wofür sie gilt, in derselben Form wie eine
Ansicht (`applies`), und gilt dann an jedem passenden Artikel. Und **wer**
es weiss, muss keine Liste von Figuren sein: ein Wissen der Herkunft Orc
weiss jede Figur, die diese Herkunft hat — heute aus Klasse, Herkunft und
Hintergrund, später auch aus Wissenspunkten bei einer selbst erstellten
Herkunft (REQ-354).

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

**Was nicht aufgeschaltet ist, steht nicht da** (T-207). Nach dem Einlesen
nannte das Kompendium 177 Ebenen, die Hälfte davon in keiner Runde, und
jede Liste zählte die abgeschalteten einzeln auf. Ein Buch, das die
Kampagne nicht aufschaltet, ist für den Tisch nicht da — auch nicht als
Name. Geschaltet wird an der Kampagne; die übrigen Seiten sagen nur, dass
etwas fehlt, und führen dorthin.

**Eine Spielerebene ist Herkunft, kein Versteck** (T-164). Was eine
Spielerin anlegt, liegt in ihrer eigenen Ebene — „Mara · Nebelwacht" —, und
die schaltet nur ihre Kampagne auf, also gehört sie wie die Kampagnenebene
dieser Runde. Warum nicht einfach weiter die Kampagnenebene? Weil dort nach
einem Abend nicht mehr zu sagen ist, was die Leitung vorbereitet und was
die Spielenden dazugeschrieben haben, und weil eine Spielerin, die die
Runde verlässt, ihre Notizen sonst über die ganze Kampagnenebene verteilt
zurücklässt. Wer was sehen darf, sagt weiter der Artikel (`audience`,
`hiddenFrom`, `revealedTo`): eine Ebene, die zugleich verbirgt, wäre eine
zweite Sichtbarkeit, und zwei Sichtbarkeiten sind eine, die man vergisst.
Und **keine Fassungen darin**: der Stapel gilt für alle am Tisch — eine
Überschreibung in Maras Ebene änderte den Artikel auch für Tom. Was Mara an
einem fremden Artikel anmerken will, ist eine Notiz mit Verweis.

**Schreibebene, Zielebene, Vorgabe — drei Wörter für drei Fragen** (T-161).
*Zielebenen* sind alle Ebenen, in die ein Konto in dieser Kampagne anlegen
darf (es schreibt darin, und sie sind im Spiel). Die *Vorgabe* ist die, die
gilt, wenn niemand etwas sagt — die Spielerebene, für die Leitung die Ebene
der Kampagne. Die *Schreibebene* ist die, die gerade gilt: die gewählte,
solange sie eine Zielebene ist, sonst die Vorgabe. Sie steht am Server und
nicht im Browser, weil der Laptop und das Telefon derselben Leiterin sonst
an zwei Orte schrieben, und sie wird **beim Lesen** geprüft und nicht beim
Wählen allein: eine Ebene, die die Leitung abschaltet, soll nicht still
weiter beschrieben werden, und eine Wahl, die man wegen einer Pause
verliert, wählt man nicht gern zweimal. Darum bleibt die Wahl stehen und
die Kopfleiste sagt, dass sie gerade nicht gilt.

Dass die Zugehörigkeit so von selbst herausfällt, ist der Grund, dafür **kein
Feld** zu setzen. `Layer.kind` kennt zwar die Wörter `campaign` und
`player`, aber ein Feld,
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

**Ein Kapitel eines Abenteuers wird ein Arc, und ein Abenteuer besteht
aus Teilen** (T-097, E-026, REQ-252; seit T-108 steht dasselbe Kapitel
zum Lesen zusätzlich als `Chapter` da — „Lesen und Spielen sind zwei
Arten“, weiter unten). Die Leitung will ein Abenteuer nicht nur als Ganzes
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

**Ein Bild im Buch ist ein Teil, kein Verweis** (T-210). Ein `Embed` auf
das Bild läge nahe — aber sein Ziel ist Pflicht, und die Datei kommt erst
mit dem Hochladen; bis dahin gäbe es den Teil nicht, und mit ihm fehlte
die Bildunterschrift. Und die Unterschrift gehört zur Stelle im Buch, nicht
zur Datei: dasselbe Wappen darf in zwei Büchern zweimal anders heissen.
Also ist es eine eigene Teilart, `Illustration`, mit den Feldern von
`Image`; ohne Datei steht die Unterschrift als Platzhalter da. **Eingefügt
wird es, ohne etwas umzunummerieren:** sein Rang ist ein Bruch hinter dem
Teil davor (`3.001`). Die Teile eines Buchs, das schon gelesen wird,
behalten Rang und Id — eine Neunummerierung hätte jeden Teil berührt und
mit ihm jede Fassung, die jemand davon geholt hat.

**Ein Ort steht neben seinem Text, nicht in ihm** (T-175). Barovia war
nur eine Überschrift im Buch — auffindbar beim Lesen, aber nicht in World,
nicht auf einer Karte, nicht als Wohnort einer Kreatur. Der Ort ist darum
ein eigener `Place`, und sein Text bleibt, wo er ist: der Ort zeigt mit
`describedIn` auf den Abschnitt, der ihn beschreibt. Den Text in den Ort
zu kopieren hiesse, ihn zweimal zu haben und beim ersten Korrigieren
zwei Fassungen. Erkannt wird nur, was das Buch selbst sagt — ein Raum mit
Schlüssel, ein Abschnitt mit Karte, ein erster Satz „X is a city" —; was
nach einem Ort klingt, ohne es zu sagen, wird gezählt und nicht angelegt,
denn ein falscher Ort in der Weltliste ist schwerer zu finden als ein
fehlender.

**Wo jemand wohnt, sagt der Text nur einmal** (T-182). Eine Kreatur, die
im Text genau eines Orts steht, wohnt dort; nennen zwei Orte sie, wohnt
sie nirgends — auch wenn der eine im anderen liegt. Eine Gefangene, die
in drei Räumen erwähnt wird, hat dort kein Zuhause, und ob die Burg oder
ihr Turmzimmer gemeint ist, weiss nur, wer das Buch kennt. Ebenso die
Gegend: ein Ort liegt in Barovia, weil die Liste von Barovia ihn mit
seinem Buchstaben führt — nicht, weil er im selben Buch steht. Und
nachgetragen wird mit einem **Weg über Kanten** statt mit einer Liste je
Artikel: „die Szene spielt am Ort, der sie beschreibt" ist eine Regel,
und der Server rechnet sie am Bestand, den er hat.

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
Abschnitt, „Languages". Ein Text aus 5e.tools ist aber
`## Age … ## Size … ## Languages …`, also wird er Abschnitt für Abschnitt verglichen, nach
Überschrift und nicht nach Nummer; was nur die andere Fassung hat, steht
unter seiner eigenen Überschrift. Ebenso ein Statblock nach seinen Zeilen
(„Armor Class", nicht `Statblock.ac`), denn die Zeile ist, was man liest.
Und ein Feld, das nur die andere Fassung füllt, steht an seinem Platz mit
„—" — in einer Liste am Ende hiesse es, die Stelle suchen zu gehen.

*Dass es eine andere Fassung gibt*, muss man sehen, ohne zu suchen
(T-173). An „+1 Weapon" stand der einzige Unterschied — `tier` gibt es
nur in der Fassung von 2014 — als leerer Wert in einem Kasten der
Seitenspalte, am Telefon ganz unten. Also steht unter dem Namen ein
Abzeichen mit der Zahl der Fassungen und dem, worin sie abweichen; ein
fehlender Wert heisst „— not set in XDMG" und nicht „—", denn ein Strich
liest sich wie ein Wert; und wenn nichts abweicht, sagt der Kasten auch
das. Gleich ist eine Auskunft, kein Schweigen. Wer es genau wissen will,
stellt beide nebeneinander — alle Felder, gleiche mit, lange Texte Zeile
für Zeile. Sind beide Ebenen im Spiel, gilt am Tisch die aus der oberen,
und die Seite sagt es, statt es dem Stapel zu überlassen.

*Was eine Fassung ist*, sagt nicht `variantOf` allein: die Kante verbindet
auch den Oathbow mit dem Longbow und die Kopie „Goblin Boss" mit dem
Goblin — das sind andere Dinge, und im Kompendium unter dem Longbow
verschwände der Oathbow. Eine Fassung ist dieselbe Art mit demselben Namen,
nachdem ein angehängtes „(Buch)" der eigenen Quelle weg ist — so nennt der
Importer die Fassungen aus mehreren Büchern. Eine Überschreibung sagt es
selbst und zählt immer.

*Vergleichsebenen* sind Ebenen, die eine Kampagne nennt, ohne sie
aufzuschalten (`activates` mit `mode: 'compare'`) — auch eine **ganze
Gruppe** wie „2024 rules" (T-143): ihre Bücher vergleichen sich, soweit
keines davon ohnehin im Spiel ist, und ein Buch, das später in die Gruppe
kommt, ist dabei, ohne dass jemand ein Häkchen setzt. Was sie bringen, steht
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

**Das Häkchen der Gruppe schaltet alles darin** (T-185, `groupSwitched`).
Zuerst nahm „Gruppe aus" nur die Kante der Gruppe weg; Bücher, die einzeln
aufgeschaltet oder abgeschaltet waren, blieben es. Die Leitung schaltete
eine Gruppe aus und hatte danach wieder ihre alte Teilwahl, und „Core
rules" mit drei einzeln aufgeschalteten Büchern zeigte „teilweise", weil
das Häkchen die Kante der Gruppe las und nicht, was im Spiel ist. Jetzt
liest das Häkchen den Stand der Bücher, und ein Klick macht ihn eindeutig:
an heisst die Gruppe und keine Abschaltung darin, aus heisst keine Kante
mehr darin — und wo eine andere Gruppe ein Buch trotzdem brächte, eine
Abschaltung. „Aus" hiesse sonst „nur nicht über diese Gruppe", und das ist
nicht, was ein leeres Häkchen sagt. Eine Teilwahl gibt es weiter, über die
Häkchen am Buch.

**Die Reihenfolge zeigt, was sie bewirkt** (T-188). Die Leitung konnte
ihre Ebene nach oben und unten schieben, wusste aber nicht, wo oben ist —
das stand in einem Satz über der Liste —, und die Bücher und Gruppen
hatten gar keinen Platz, den man sah. Jetzt steht der Stapel als eigene
Liste mit Platz und Richtung, alles darin ziehbar, eine Gruppe als Block.
Ein Buch aus einer Gruppe herauszulösen ist dabei kein neuer Begriff: es
bekommt seine eigene Kante `activates`, und die ausdrückliche Kante schlägt
die Gruppe schon seit E8. Dazu steht an jeder Ebene, **was** ihr Platz
bewirkt — „replaces 12 articles of PHB", „1 version loses to …" —, denn
eine Reihenfolge, deren Folgen man nicht sieht, ist eine Zahl ohne
Einheit. Gezählt wird, wo der Platz entscheidet: welche von mehreren
Fassungen gilt und ob eine Herausnahme hält. Eine Fassung gegen ihr
Original gewinnt immer; das steht trotzdem da, weil es die häufigste
Frage ist („warum sehe ich die andere Feuerkugel?").

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

**Eine Regel für viele Quellen, eine Freigabe für einen Artikel** (T-187).
Die Leitung will aus fast jedem Abenteuer dasselbe — die Regeln, die
Gegenstände, die Zauber, nicht die Geschichte — und musste das je Buch
sagen. Eine Liste an der Kampagne „für Ebenen der Art adventure" hätte
`Layer.kind` zur Regel gemacht, und das Wort ist Beschreibung (E3). Die
Kategorie steht aber schon als **Gruppe** da („Adventures"), also hängt
die Regel an der Gruppe: eine Kante `layerRule` von der Kampagne, mit
denselben `areas`/`types` wie eine Auswahl. Sie gilt nur, wo nichts
anderes etwas sagt — die Auswahl am Buch und die einer aufgeschalteten
Gruppe sind ausdrücklicher —, und ein Buch lässt sich ausnehmen
(`exempt`). Eine eigene Kante und kein weiterer `mode` an `activates`,
weil eine Regel nichts aufschaltet: jede Stelle, die `activates` liest,
müsste sonst lernen, sie zu übergehen.

Ebenso der Extra-Inhalt: aus einem Buch, das nur zum Vergleich da ist,
will die Leitung *einen* Gegenstand. Das Buch aufzuschalten brächte alles,
eine Kopie (Übernehmen, E7) eine zweite Sache. Also eine Kante `enables`
von der Kampagne an den Artikel: er ist im Spiel, sein Buch nicht. Er
steht unter jeder aufgeschalteten Ebene — was die Kampagne selbst sagt,
schlägt eine Einzelfreigabe —, und zurück geht es an derselben Stelle.

Gefunden wird so ein Gegenstand in der Liste (T-213): ein Schalter im
Popup der Kopfleiste, „Show comparison articles in lists", hängt unter
Kompendium, Bereiche und Suche, was **nur** eine Vergleichsebene bringt —
markiert „not in play", mit „Enable" für die Leitung. Ein **eigener
Block** und kein Merkmal zwischen den Zeilen: im selben Index zählten
Facetten und Summen, was nicht im Spiel ist, und die Liste sagte über das
Spiel etwas Falsches. Und nur, was **keine Fassung im Spiel** hat: eine
andere Fassung des Langschwerts ist ein Vergleich von Varianten, den die
Artikelseite zeigt, kein Extra-Inhalt. Der Schalter ist aus, bis man ihn
einschaltet, und wird je Browser gemerkt — er ändert, was man sieht, nicht
was gilt; die Regel der Leitung (T-207) bleibt: was nicht eingeschaltet
ist, steht nicht da, ausser man fragt danach.

**Was eine Quelle bringt, steht an ihr** (T-189, 15.10.2026). Die
Leitung wollte am Buch sehen, welche Artikel es hinzufügt, und dort auch
wählen — bis zum einzelnen Artikel. Ein Baum Art → Artikel (Element
`contents`) zeigt das, und seine Häkchen sind **keine eigene Wahl**: sie
schreiben die Kanten, die die Kampagnenseite schreibt (`activates`,
`activates.props.types`, `enables`). Zwei Stellen für dieselbe Wahl liefen
beim ersten Klick auseinander. Was mit der Ebene kommt, steht darum
angehakt und gesperrt da: eine Kante, die einen einzelnen Artikel aus
einer Ebene im Spiel nimmt, gibt es nicht, und der Baum erfindet keine
(E-073).

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


**Sichtbarkeit je Gruppe** (T-252, E-098). Ein Artikel, der keine Stufe
sagt, nimmt die seiner Gruppe: die Regel der laufenden Kampagne, sonst die
Vorgabe seiner Ebene, sonst `public`. Warum keine Massenänderung, die
`audience` in jeden Artikel schreibt: dann änderte „D&D → public" in der
einen Runde einen Artikel, den drei Runden teilen, und der Artikel von
morgen folgte der Regel nicht. Warum nicht nur die Ebene: dann wäre
dieselbe Ebene in jeder Runde gleich sichtbar, und gruppieren liesse sich
nur nach ihr. Also gibt die Ebene vor, und die Kampagne überschreibt je
Gruppe — und die Gruppe ist ein Schlüssel der Transformationen, damit die
Übersicht, in der man sie setzt, und die Rechnung, die sie liest, dasselbe
meinen. Das ist keine Vererbung von Artikel zu Artikel (die gibt es weiter
nicht): die Regel steht an der Kampagne und sagt für jeden Artikel der
Gruppe dasselbe.
## Die Zahlen einer Kreatur

**Sie wohnen am Statblock** — auch die eines Spielercharakters. Er hat mehr
darüber hinaus (Stufe, Klasse, Hintergrund), aber AC, HP-Maximum, die
sechs Werte und die **Übungen** sind dieselbe Sache wie bei jedem Monster.
Die Übungen standen bis P4 an der Kreatur; seither nimmt der Statblock
`Proficiencies` dazu, denn worin jemand geübt ist, rechnet mit seinem
Übungsbonus und seinen Werten — an zwei Stellen wären es zwei Antworten. Welcher Statblock es
ist, sagt `belongsTo`; gespeichert wird nur vorwärts, und „welchen Statblock
hat Rook" ist der Rückbezug.

**Am Statblock steht, was von Hand dazukam — geübt ist eine Figur in
mehr** (T-239). Was Klasse, Hintergrund und Talent fest gewähren, steht an
deren Artikeln, und was die Figur gewählt hat, an ihren Kanten `chose`.
Die Karte am Statblock allein zu lesen hiess, dass der Barbar, der beim
Hintergrund Smith's tools wählte, im Handwerk ungeübt war. Die Wahl in den
Statblock zu kopieren hätte zwei Stellen gemacht, die beim nächsten
Klassenwechsel auseinanderlaufen; also rechnet `proficienciesOf` beim
Lesen alle Quellen zusammen und sagt je Übung, woher sie kommt — und wer
fragt, ob jemand geübt ist, fragt diese eine Funktion.

**Was schon da ist, wird nicht noch einmal gewählt** (T-299). Der
Assistent bot in jeder Wahl die ganze Liste an, auch die Sprache, die die
Herkunft schon gab — und eine doppelte Übung ist eine verlorene. Gesperrt
wird mit derselben Rechnung, die sagt, woher eine Übung kommt
(`proficienciesOf`), und „früher" ist die Reihenfolge der Schritte. Eine
Doppelung, die erst durch eine spätere Änderung entsteht, wird gemeldet
und nicht still gelöscht: welche der beiden Wahlen weichen soll, weiss nur,
wer sie getroffen hat.

**Ein Zauber kommt von irgendwoher** (T-309). Bis dahin zauberte eine
Figur, was von Hand an ihr stand — der Magier aus dem Assistenten zauberte
also nicht, obwohl seine Klasse sagte, dass und womit er es tut. Jetzt ist
das Zauberwirken eine Rechnung über die Quellen wie die Übungen: die Klasse
bringt Attribut und Plätze, Herkunft, Talent, Merkmal und Gegenstand ihre
Zauber, und jede Quelle zaubert mit dem Attribut, das das Regelwerk ihr
gibt — der Tiefling-Magier wirkt Thaumaturgy mit CHA und Magic Missile mit
INT. Dass es eine Stelle gibt, die das Attribut sagt, hält den Weg offen
für ein eigenes System, in dem die Spielerin ihr Hauptattribut wählt.

**Mit den Attributen ging es genauso** (T-272). Der Assistent legt die
Grundwerte am Statblock ab, und die Boni aus Herkunft und Hintergrund
rechnete `chosenResult` — aber kein Leser nahm sie, der Bogen zeigte STR
15, wo 16 galt. Die Boni in den Statblock zu schreiben hiesse, dass ein
Wechsel des Hintergrunds die Zahl dort nicht mehr findet. Also gibt
`characterStats` jeden Wert mit seinen Teilen und dazu den Statblock, wie
er an der Figur *gelesen* wird; wer eine Zahl zeigt, nimmt diesen.

**Eine benannte Kreatur aus einem Buch ist eine Figur** (T-169). Strahd
oder Venomfang standen nach dem Einlesen nur als Statblock da — Zahlen
ohne jemanden, dem sie gehören, und damit in keiner Beziehung, keiner
Fraktion, auf keiner Karte. Der Importer legt darum zu jedem Statblock mit
`isNamedCreature` eine `Creature` (`kind: npc`) in dieselbe Ebene, und der
Statblock gehört ihr direkt über `belongsTo`: eine benannte Kreatur gibt es
einmal, also keine Instanz. Eine Spielart (`_versions`) bekommt keine
eigene. Was der Text sonst über sie sagt (Wohnort, Fraktion), kommt nicht
geraten dazu.

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

### Der Kopf und die Reiter der Spielerseite

**Der Kopf steht über den Reitern**, nicht in einem (T-247): Trefferpunkte,
Rüstungsklasse und Zustände braucht man, ohne umzuschalten — dieselbe
Regel wie die Initiative am Spieltisch. Darunter sind die Gruppen der
Kreatur **Reiter und keine Abschnitte untereinander**: am Tisch schaut man
auf einen, und zwischen Kampf und Zaubern zu scrollen ist der Weg, den
niemand zweimal geht. Ein Blatt (Druck) liest weiter alles nacheinander.

**Was am Tisch gesetzt wird, steht in `Vitals`**, auch was die Statuszeile
zeigt: woran die Figur sich konzentriert (ein Zauber, kein Häkchen — die
Zeile nennt ihn, und „Failed" leert ihn), wie lange ein Zustand noch dauert
(ein Wort, weil eine Dauer am Tisch gesagt und nicht gerechnet wird; die
Initiative zählt Runden an ihrer eigenen Kante), ob sie versteckt ist, und
was in diesem Zug verbraucht ist. Letzteres steht an der Figur und nicht in
der Maske, damit Telefon und Laptop dasselbe sehen.

**Gesperrt heisst nicht verborgen.** Eine Aktion, die die Hände gerade
nicht erlauben — ein Zauber ohne freie Hand, das Zaubern hinter einem
Schild ohne Übung —, bleibt in „Your turn" stehen, mit 🔒 und dem Grund.
Verschwände sie, wüsste niemand, warum der Zauber fehlt, und keiner käme
auf die Idee, die Waffe wegzustecken. Die Sperre rechnet das Modell aus
dem, was gehalten wird (`handState`); das Ausrüsten selbst kommt mit dem
Inventar (T-244) und speist dieselbe Funktion.

### Der Initiative-Tracker ist ein eigenes System

**Die Kampagne stellt ihn ein, nicht der Schirm** (T-022): was Spielende
von der Reihe sehen — Deckname oder Name, Gesundheit gar nicht, als Wort
oder als Zahl, welche Effekte, ob die Aktionen der Gegner —, steht als
Feld an der Kampagne (`combat`, `initNames`, `initHealth`, `initEffects`,
`initActions`) und wird am Server gesiebt, in jeder Route gleich. Ein
Schalter am Tracker selbst wäre die zweite Stelle, und der Beamer zeigte
dann, was das Telefon nicht soll. Abschaltbar ist er, weil eine Runde, die
am Tisch mit Karten zählt, keinen zweiten Zähler will.

**Ein Effekt ist ein Eintrag mit Dauer an der Kante**, kein eigener
Artikel: „bis zum Ende von Vex' nächstem Zug" ist ein Anker, ein Zeitpunkt
und eine Zahl (D53), und der Zugwechsel zählt sie. **Verzögern ist eine
Initiative**, keine Marke „wartet": wer verzögert, steht danach eben
weiter hinten, und eine Marke hätte eine zweite Reihe neben der Reihe
bedeutet. **Zurück zählt nichts zurück** — wer zu früh weitertippt, nimmt
den Zug zurück, aber ein abgelaufener Effekt käme nur geraten wieder.

**Den Zug frei setzen ist eine Berichtigung, kein Zug** (T-334): „Make
current", „Skip" und „Back to top" sagen nur, wer jetzt dran ist. Zählten
sie Effekte, liefe ein „Bless" ab, weil die Leitung sich vertippt hat.
**Ohne Stand ist man unverletzt** — das Maximum steht am Statblock, und
einen Stand zu speichern, bevor jemand getroffen wurde, hiesse dasselbe
zweimal halten (D8).

**Die Initiative ist ein Regelsystem** (E-100): „D&D 5e (standard)" ist
das, was `combat: on` schon immer tat, mit einem Namen. Ein System sagt,
was es kann — dieses kennt kein Verzögern, also steht der Knopf nicht da.
Eine Hausregel mit Verzögern ist ein weiteres System (T-336), kein
Schalter am Knopf.

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

**Die Trefferpunkte einer Stufe stehen an der Kante zur Klasse**
(`hasClass.props.hp`, T-194), dort, wo die Stufe steht. Gespeichert wird,
was der Würfel brachte, nicht das Maximum samt KON: wer später KON ändert,
rechnet neu und würfelt nicht noch einmal — und ein Würfelwurf, den man
wiederholen kann, ist keiner. Das Maximum am Statblock schreibt der
Assistent daraus; es ist der Wert, den jeder Bogen liest.

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

**Eine Wirkung, die niemand anwendet, ist eine Behauptung** (T-275). Der
Regelkatalog vom 18.10. fand, dass `effectsAt` sammelte und ausser den
Übungen niemand las: ein Ring der Feuerresistenz stand im Inventar und
änderte keine Zahl, die RK war ein abgetipptes Feld. Jetzt liest
`characterStats` jede Wirkung, und **jede Stelle am Tisch fragt dieselbe
Rechnung** (`creatureStats`): der Bogen, die Initiative, der Zugplan. Die
RK kommt aus der getragenen Rüstung, wo eine getragen wird — abgetippt
wäre sie nach dem ersten Rüstungswechsel falsch. **Ein Zustand ist eine
Quelle wie ein Gegenstand**: gepackt deckelt das Tempo auf 0 (`limit`,
nicht `set`, denn `set` hebt nur). Eine eigene Regel-Engine (E-102) ist
das nicht: die Rechnung hat genau die Eingaben, die eine Automation
„Wirkung anwenden" hätte, und zieht dann um, statt neu zu entstehen.

**Eine Rast ist eine Rechnung, kein Merkzettel** (T-352). „Back on a
long rest" stand als Satz am Bogen, und wer rastete, klickte zwanzig
Punkte zurück. Jetzt rechnet `longRest` aus dem Stand den neuen Stand —
mit je einem Satz, was sich änderte —, und der Bogen schreibt ihn wie
jeden anderen Stand. Erschöpfung geht eine Stufe zurück, indem der
Zustand gegen die niedrigere Stufe getauscht wird (`stageDown`), denn eine
Stufe ist ein eigener Zustand und kein Zähler.

**Eine Regel steht einmal** (T-275). Der Übungsbonus stand im Register als
`2+(…-1)/4` und auf der Klassenseite als `ceil(L/4)+1` — dasselbe Ergebnis,
zwei Stellen, und die nächste Hausregel hätte eine davon vergessen. Jetzt
ist `proficiencyBonus` die Regel und das Register nennt sie
(`profBonus(hasClass.level)`); ebenso rechnet die passive Wahrnehmung im
Register (`10+check(wis.Perception)`) und am Bogen mit `checkBonus`.

**Ein Zug, der bestätigt ist, ist geschehen** (T-275). Der Zugplan
würfelte Schaden und schrieb ihn ins Protokoll — und die Trefferpunkte
standen danach wie vorher; die Leitung tippte die Zahl ein zweites Mal ab.
Jetzt zieht der Server ab, nach der Abwehr des Ziels, und würfelt die
Konzentrationsprobe gleich mit. Gezogen wird von der **Teilnehmerkante**,
weil zwei Goblins derselben Kreatur zwei Stände haben; eine Spielerfigur
hat ihren Stand am Bogen (`Vitals`), also dort auch. Dodge und Help sind
keine Knöpfe, die etwas „merken": sie legen einen **Eintrag in der
Initiative** an, wie ein Zustand, mit der Dauer der Regel — die Initiative
zählt ihn herunter, und wer würfelt, liest ihn als Vorteil oder Nachteil.
So gibt es für „wie lange gilt das" eine Stelle, nicht zwei.

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

**Eine Unterart bringt ihre Grundart mit** (T-193). „Elf (High)" trägt
nur, was Hochelfen anders haben (INT +1, Langschwert); Dex +2, Darkvision
und Trance stehen am Elf, auf den sie mit `subraceOf` zeigt. Bis T-193
zählte an der Figur nur die Unterart — wer einen Hochelfen baute, hatte
keinen Dex-Bonus, und Naga sah im Assistenten nur deshalb vollständig
aus, weil sie keine Grundart hat. Die Grundart je Unterart abzuschreiben
hiesse, dieselben Zahlen an fünf Stellen zu pflegen; also liest
`choiceSources` die Reihe (`ancestryLine`) und jede Grundart zählt wie die
Abstammung selbst, mit ihren Boni und ihren Wahlen.

**Die Wahl zeigt, was sie bringt** (T-193). Wer zwischen Herkünften
wählt, will wissen, was jede ändert — ohne jeden Artikel einzeln zu
öffnen. `optionEffects` rechnet es aus denselben Feldern und Kanten wie
die Figur (Boni, Grösse, Tempo, Sinne, Übungen, Merkmale bis Stufe 1, die
Wahlen danach); aufgeklappt an jeder Karte und bis zu vier nebeneinander.
Aus dem Text gelesen wäre es bei jeder Herkunft anders gewesen. **Was eine
Wahl selbst fragt, steht in ihr** (`builderSteps` mit `nest`): die
Fertigkeiten des Barbaren gleich unter der Klasse, nicht drei Schritte
später, wo niemand mehr weiss, woher sie kamen. Ein gewähltes Talent, das
wieder fragt, bleibt ein eigener Schritt — es gehört keiner Grundwahl.
**Der Entwurf liegt am Server** (`characterDraft` in den Einstellungen
des Kontos): wer einen Artikel öffnet oder das Gerät wechselt, findet ihn
an derselben Stelle. Ein unfertiger Schritt hält niemanden fest, aber er
fragt („Decide later" oder „Stay") und bleibt in der Leiste markiert.

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

**Eine offene Stelle wird gefüllt, nicht abgetippt** (T-162). „Two martial
weapons of your choice" nennt keinen Gegenstand, sondern eine Sorte; der
Assistent zeigte den Satz und liess es dabei, und ins Inventar kam nichts.
Jetzt liest das Modell den Satz (`itemSlotIn` — die gesprochene Form und
die des Importers, „one weapon martial of your choice") und macht daraus
eine Stelle mit Zahl, Art und Sorte; die Figur wählt je Stück einen
Gegenstand, und die Antwort merkt sich die Ids (`chose.props.items`). Ein
Feld an der Möglichkeit wäre die zweite Stelle neben dem Satz gewesen, und
jede eingelesene Klasse hätte es nachgetragen gebraucht. **Geprüft wird
mit derselben Regel, mit der die Auswahl fragt** (`slotAccepts`):
gewöhnlich, die Kategorie, Nah- oder Fernkampf — am Server, bevor etwas ins
Inventar kommt. Eine Übungswahl, deren Satz eine Werkzeugsorte nennt („an
artisan's tools", „three musical instruments"), zieht ebenso aus den
Gegenständen dieser Sorte, statt aus jedem Gegenstand oder aus einem
Freitext.

**Eine Wahl heisst nach Quelle und Sache** (T-162): „Fighter · Skill
proficiencies (choose 2)". Sie hiess „: equipment" — die Überschrift las
`name`, und an einem eingelesenen Artikel steht der Name in `Identity`
(`entityName`). Was eine Wahl anbietet, sind Artikel, und Artikel stehen
**als Verweise** da wie überall: `nw-text` zeichnet `[[weapon-0008|greataxe]]`,
ein Klick zeigt die Kurzansicht, Strg-Klick öffnet einen Reiter. Eine Art
für Möglichkeiten, die nur der Assistent kennt, gäbe es dann zweimal.

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
  Name (`Identity`), ihre Sichtbarkeit (`Visibility`) und ihr Inventar
  (`carries`): zwei Rucksäcke aus einer Vorlage tragen nicht denselben
  Inhalt.
- **Eine Vorlage darf selbst eine Instanz sein** („Hauptmann" aus „Wache");
  gelesen wird die Kette hoch, ein Kreis bricht ab.
- **Instanzen stehen an ihrer Kreatur und sonst nirgends** — nicht in
  Listen, nicht im Kompendium, nicht als Verweisziel. Dreissig Wachen wären
  sonst dreissig „Wache"-Statblocks im Regelwerk. Die Vorlage sagt
  „template of 30", die Instanz „instance of Wache". Die eine Ausnahme ist
  die Karte im Spiel (unten): sie steht unter „Played" an ihrer Vorlage.
- **Löschen nimmt nichts weg.** Geht die Vorlage, bekommen ihre Instanzen
  vorher, was sie von ihr lasen. Geht die Kreatur, geht ihre Instanz mit;
  ein eigener Statblock ohne Vorlage bleibt stehen, nur seine Kante geht.
- Am Server kommt eine Instanz aufgelöst an, mit `fromTemplate` (Vorlage und
  die Felder, die von dort kommen) — nur gelesen, nie gespeichert.

**Enhancement — ein +1-Dolch ist ein Dolch mit einer Regel daran** (T-300,
E-107). Die Bücher kennen „+1 Weapon", „Silvered Weapon", „Adamantine
Armor": Regeln, die an *jeden* passenden Gegenstand kommen. Jedes Paar
auszuschreiben wären tausende Artikel, und die eigene Kombination
(versilbert *und* +1) gäbe es trotzdem nicht. Die Regel an den Dolch selbst
zu hängen machte jeden Dolch zu einem +1-Dolch. Also bekommt die Figur ein
**Stück** — eine Instanz von „Dagger", wie jedes Stück im Inventar — und an
dieses Stück kommt die Regel mit der Kante `enchantedWith`.

Das Wort ist **Enhancement** und nicht „Item property": so heisst seit D48
schon die Art `ItemProperty` (Finesse, Heavy), und ein Wort für zwei Sachen
ist so schlecht wie zwei Wörter für eine. Eine eigene Art ist es nicht: ein
Gegenstand mit `appliesTo` *ist* eines, so wie der Importer die Varianten
immer schon angelegt hat.

Was das Stück heisst und kostet, wird **gerechnet** und nie gespeichert —
stünde der Preis in seiner Karte, hielte das Ausdünnen ihn für eine
Abweichung, und eine Korrektur am Dolch erreichte das Stück nie mehr. Der
**Aufpreis** (Surcharge) sagt, wie ein Enhancement den Grundpreis ändert: ein
Betrag (`priceAdd`), ein Faktor (`priceMult`), sonst sein eigener Preis.
Welche Rechnung gilt, sagt die Kampagne (`itemPricing`: kombiniert,
Grundpreis, nicht gerechnet) — manche Tische handeln magische Gegenstände
nicht nach Liste.

| | Name | Preis | Seltenheit | Angriff/Schaden |
| --- | --- | --- | --- | --- |
| Dagger | Dagger | 2 gp | — | — |
| + „+1 Weapon" (Präfix „+1 ", + 1,000 gp, uncommon, +1) | +1 Dagger | 1,002 gp | uncommon | +1 |
| + „Silvered" (Präfix „Silvered ", + 100 gp) | **+1 Silvered Dagger** | **1,102 gp** | uncommon | +1 |
| dasselbe mit `itemPricing: base` | +1 Silvered Dagger | 2 gp | uncommon | +1 |

Anhängen tut die Leitung. Ob Spielende es beim Handwerk dürfen, entscheidet
später die Kampagne (`enhancementsBy`); die Einstellung steht schon da, das
Handwerk bietet es noch nicht an.

Ein Statblock gehört damit **einer** Kreatur (`belongsTo` ist wieder `one`).

**Eine Karte am Tisch ist eine Instanz** (T-289, E-039, E-041). Dieselbe
Gruft wird in zwei Runden gespielt; lägen Tokens und Nebel an der Karte
selbst, sähe die zweite Runde die Goblins der ersten, und was die erste
aufgedeckt hat, wäre für die zweite schon offen. Also nimmt „Take into
play" eine Instanz: die Vorlage bleibt die Vorbereitung (Bild, Gitter,
Wände, Marker), die Instanz ist der Abend (Nebel, Spiel-Tokens, die
Freigabe für Spielende), und eine Begegnung im Spiel liegt auf der Instanz
und nicht auf der Vorlage. **Freigegeben** heisst: erst dann ist die Karte
für Spielende überhaupt da — vorher nicht einmal als Name, denn eine Karte,
die man nicht sehen darf, aber in der Liste steht, verrät schon, wohin der
Abend geht. Und hier steht eine Instanz **doch in einer Liste**: an ihrer
Vorlage unter „Played". Eine Wache ist ein Stück einer Vorlage und sonst
nichts; ein gespielter Abend ist ein Stand, zu dem man zurück will („wie sah
die Gruft aus, als sie flohen?") — gesucht wird er an der Karte, und nur
dort steht er.

**Zwischen Karten wechselt, wen die Sitzung lässt** (T-308). Eine Gruft
hat einen Keller als Unterkarte; wer am Tisch hineinzoomt, sieht, was
darunter liegt — auch wenn die Gruppe nie hinuntergeht. Darum bleiben
Spielende auf der Karte auf dem Tisch, bis die Leitung es anders schaltet,
und auch dann führt ein Rahmen nur in eine Karte, die diese Sitzung schon
im Spiel und freigegeben hat: die Vorlage ist Vorbereitung, und
Vorbereitung sieht man nicht durch ein Schlüsselloch. Der Schalter steht
an der Sitzung, weil er sagt, was gerade läuft — an der Karte gälte er in
jeder Runde, die sie spielt.

**Stockwerke sind Ebenen einer Karte, verbunden nur über Übergänge**
(T-307, E-108). Ein Turm mit Keller ist *eine* Karte: gespielt wird er
gemeinsam, mit einer Instanz und einem Nebelstand je Geschoss. Je Stockwerk
eine eigene Karte hätte Sichtbarkeit und Wiederverwendung umsonst gebracht
— und dafür mehrere Instanzen, die zusammen entstehen müssen, und Sicht
über Artikelgrenzen. Eine Stapelnummer gibt es nicht: zwei ungleich hohe
Türme hätten keine gemeinsame Zählung (ein Geschoss des einen entspricht
zweien des anderen). Darum trägt eine Ebene einen Gebäudeteil und einen
Höhenbereich, und was womit verbunden ist, sagt allein der Übergang —
Treppe, Leiter, Brücke, Portal. Jede Ebene hat ihren eigenen Massstab: ein
Übergang verbindet zwei Punkte, nicht zwei Koordinatensysteme, und Sicht
und Bewegung rechnen auf jeder Seite in der Ebene, in der sie gerade sind.
Die Gegenseite eines Übergangs ist ein gespiegeltes Ende und kein zweiter
Marker — ein Paar wäre zwei Stellen, die auseinanderlaufen.

**Ein Übergang ist eine Fläche, und wer darin steht, ist dort** (T-326).
Eine Treppe über drei Felder als Punkt hiess, dass genau einer auf ihr
stehen konnte, und ein Portal, vor dem die Gruppe wartet, schickte sie
einzeln. Die Fläche ist ein Vieleck am Marker, keine eigene Markerart: ein
Punkt-Übergang ist die Fläche eines Feldes, und alles, was vorher galt,
gilt weiter. Wer, wann und was es kostet, ist eine Vorgabe der Kampagne
mit einer Ausnahme je Übergang — ein Geheimportal, das nur die Leitung
auslöst, ist eine Zeile am Übergang und keine zweite Art. Im Kampf ist der
Durchgang ein Schritt im Zugplan und kein eigener Weg daneben: nur dort
weiss jemand, wie viel Bewegung der Zug noch hat.

**Der Massstab ist Text, die Fuss werden gerechnet** (T-321). „6 mi" je
Hex steht so an der Karte, wie es jemand gemeint hat; dass das 31 680 Fuss
sind, rechnet das Lesen über die Einheiten des Registers (D8). Ein
gespeichertes `feetPerSquare` daneben wäre die zweite Zahl, die nach dem
ersten Umstellen der Einheit nicht mehr stimmt. Die Tischregel bleibt
dabei die Regel: 1,5 m sind ein Feld von 5 ft, nicht 4,92.

**Ein Stück im Inventar ist eine Instanz** (T-150). Was eine Figur in die
Hand bekommt — gekauft, erbeutet, gefertigt, geschenkt —, ist nicht der
Gegenstand aus dem Buch, sondern ein Stück davon: ein eigener Artikel mit
`instanceOf` auf den Gegenstand, der nur speichert, was abweicht. Rook
graviert seinen Dolch, und der Dolch im Regelwerk bleibt, wie er ist; die
Leitung korrigiert das Gewicht im Regelwerk, und jeder Dolch am Tisch, der
das Gewicht nicht selbst trägt, wiegt danach richtig. Vorher zeigte das
Inventar auf den Gegenstand selbst — wer ihn umbenannte, benannte ihn für
alle um. Zehn gleiche Fackeln sind trotzdem ein Stapel und nicht zehn
Artikel: ein neues Stück legt sich auf einen losen Stapel, der der Vorlage
noch in allem folgt. Und ein Rezept, das „Eisenbarren" braucht, nimmt den
gekauften Barren, denn gezählt wird nach dem Gegenstand, von dem das Stück
eines ist.

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

**Die Form eines Gegenstands wird gemalt** (T-142, Element `shape`): ein
Raster von 5 × 5, das am Rand wächst, umschaltbar auf die Zeilen, wie sie
im Vault stehen (`X` belegt, `0` frei). Gespeichert wird die Form **ohne
leere Ränder** (`trimShape`) — sonst läge eine Fackel im Inventar als
Fünfer mit einem Feld oben links. Das **Spiegeln** steht wie die Drehung
an der Kante (`holds.props.flip`), gespiegelt wird vor dem Drehen, und
angeboten wird es nur, wo die gespiegelte Form keine Drehung der
ursprünglichen ist (`shapeChiral`): ein Stab oder ein T bleibt gespiegelt,
was er war. **Das Bild liegt in der Form**: das Inventarbild
(`Item.inventoryImage`), sonst das Bild des Gegenstands, nach seinem
Ausschnitt (`Item.inventoryFrame`: Zoom, Verschiebung, Drehung zur Form,
Einpassen oder Füllen) und nur in den belegten Feldern. Der Ausschnitt
steht am Gegenstand und nicht an der Kante — dasselbe Schwert sieht in
jedem Rucksack gleich aus; wie es liegt, sagt die Kante.

**Die Formen aus Basils System sind eine Ergänzung** (T-142, E-125) und
keine ganze Fassung. Eine Fassung ersetzt ihr Original, und von mehreren
gilt nur die höchste — eine Formfassung schlösse die Preisfassung aus
„AI generated prices" aus, und wer beides aufschaltet, verlöre eines. Eine
**Ergänzung** nennt an ihrer Kante `overrides` die Felder, die sie trägt
(`props.fields`), und legt beim Lesen nur diese über das, was gilt. Sie
steht selbst in keiner Liste, und ein Feld, das sie trägt, wird nicht in
den Artikel darunter geschrieben: dort stünde es unsichtbar und bliebe,
wenn die Ebene ausgeht.

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
Die Form selbst ist dagegen eine Einstellung, das **Tragblatt**: sie ist
das Blatt der Kampagne und rechnet nichts. Es besteht aus **Bausteinen**
(REQ-356) — je einer gemalten Form mit eigenen Zonen und Bedingungen auf
Felder des Statblocks. Zuerst waren es ein Quadrat je Grösse und Zonen
nach Spalten; aber eine Zone ist ein Ort auf dem Blatt und keine Spalte,
und eine Bedingung „Grösse“ ist nur eine von vielen, die ein Tisch stellen
will. Was gilt, wird **aneinandergefügt**: das Zusatzquadrat stand rechts
vom grössten Grundquadrat, und eine kleine Kreatur hatte dazwischen eine
Lücke — zwei Raster, wo eines gemeint war. Eingestellt wird es gemalt
(Rules & options › Inventory), mit einer Vorschau, die Grösse und STR
nimmt und zeigt, was daraus wird.
Ein Stück, das nach einem Schrumpfen
ausserhalb der Form liegt, behält seine Lage; es liegt im Fach, bis es
jemand neu hinlegt, und hat bis dahin keine Ziehstufe.

**Die Figur gehört der Kreatur, die Plätze der Kante.** Männlich, weiblich
oder neutral ist eine Angabe darüber, wie eine Figur aussieht, und das
Inventar wechselt den Träger. Welche Plätze es gibt, sagt die Liste an
`holds.props.slot`; wo sie auf dem Blatt sitzen, ist Darstellung. Und **das Stück am Tisch darf eine Instanz** des Gegenstands im
Buch sein (`instanceOf`, wie beim Statblock): das +1-Langschwert speichert
nur, was es vom Langschwert unterscheidet, und eine Korrektur am Langschwert
erreicht es.

**Wie gezählt wird, sagt die Kampagne** (T-127). Basils Blatt mit Raster
und Zonen ist eine Art, Inventar zu führen; Gewicht mit Tragestufen und
Slots je Stapel sind zwei andere, und zwei Runden derselben Installation
dürfen verschieden spielen. Darum ist es ein Wort an der Kampagne
(`Campaign.inventory`) und keine Einstellung des Registers. Gelesen wird es
an genau einer Stelle (`inventoryRulesOf`): wenn die Regelsysteme Behälter
werden (T-132), wandert das Wort in ein Modul, und nur diese Funktion sieht
woanders nach.

**Eine Regeloption sucht man an der Kampagne, nicht im Feld** (T-190).
Wie gezählt, gehandwerkt und gewürfelt wird, stand als Felder ohne
Ordnung am Kampagnenartikel und als Einstellungen, die niemand sah — es
gab sie, und gefunden hat sie keiner. Der Reiter „Rules & options" ordnet
sie nach System und sagt je Option, was sie tut. **Jeder Artikel steht
für ein System, eine Regel oder eine Option** (T-270): die Auswahl kommt
aus den Artikeln und nicht aus einer Liste im Code — ein Satz im Code
erklärt, ein Artikel lässt sich nachlesen, ändern und am Tisch zeigen.
Bis T-270 wurde er nach Namen gesucht, und wo keiner passte, bot die Seite
an, einen zu schreiben; an fast jeder Variante stand dann derselbe Knopf,
obwohl die Hausregel längst als Artikel dastand, nur unter einem anderen
Namen. Jetzt sagt der Artikel selbst, wofür er steht (`Rule.key`): der
Name darf sich ändern, der Schlüssel nicht. Und weil ein Buch beim
Neuladen ersetzt wird, steht eine Tischregel nie in der Buchebene,
sondern in den Hausregeln oder in einer eigenen Ebene, und verweist auf
das Buch. **Was nicht gilt,
steht nicht da** — auch hier: die Einstellungen von Basils Raster stehen
nur, wenn die Kampagne nach Raster zählt (T-248); wer reines D&D spielt,
soll nicht lesen müssen, wie eine Hausregel eingestellt ist, die er nicht
spielt.

**Geben heisst, die Kante umzuhängen.** Wer der Gruppe ein Seil gibt,
nimmt die `holds`-Kante aus dem eigenen Inventar und legt sie in das der
Gruppe. Die Lage im Raster bleibt zurück — sie war die im alten Behälter —,
und drüben liegt das Seil im Fach, bis jemand es hinlegt. Das
Gruppeninventar schreibt jeder am Tisch, die Gruppe selbst nicht: etwas
hineinzulegen ist Spiel, ihre Reisezähler zu ändern ist Leitung.

**Reserviert ist ein Stapel.** Was ein Handwerksauftrag (T-128) braucht,
bleibt, wo es liegt, und gehört weiter der Figur; die Kante sagt nur, für
wen es zurückgelegt ist (`holds.props.reservedFor`), und solange wandert es
nicht. An der Kante und nicht am Gegenstand, wie die Drehung: zurückgelegt
sind *diese drei Barren hier*, nicht Eisenbarren überhaupt.

**Was ankommt, ist noch nicht eingepackt** (T-140). Wer im Laden eine
Laterne kauft oder in der Gruft ein Schwert findet, hat es zuerst vor sich
liegen — in der Hand, am Boden, auf dem Tresen —, und wohin es kommt, ist
eine Entscheidung am Tisch: im Raster ist Platz knapp. Darum trägt die
Kante `unstowed`, bis jemand es verstaut, und nicht der Gegenstand: *dieser*
Stapel liegt noch da. Wie streng das ist, ist Spielweise und darum ein Wort
an der Kampagne (`Campaign.stowing`): beliebig lange, bis zum Ende der
Sitzung, oder nur, bis der Tisch weiterzieht. Was dann noch daliegt, ist
**liegengelassen** — nicht gelöscht, sondern dort, wo man es liess: an der
Sitzung, als Kante `leftBehind` mit dem Inventar, aus dem es kam. Wer
zurückgeht, hebt es auf und hat es wieder vor sich. Eine Löschung wäre
endgültig gewesen, und „wir gehen zurück und holen es" ist ein Satz, der
am Tisch fällt.

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

**Wer was kennt, ist eine Tischregel** (T-280, REQ-349). Kibbles lässt
jede Figur jede Blaupause von Anfang an; Nebelwacht beginnt damit, dass
jede die gewöhnlichen ihres Berufs kennt und Seltenes gelernt werden muss.
Darum steht an der Kampagne, *wie* gelernt wird — alle, nur Beigebrachtes,
oder bis zu einer Seltenheit je Werkzeugübung —, und gerechnet wird beim
Lesen. Die Blaupausen den Figuren als Informationen zuzuteilen hätte bei
siebenhundert Rezepten tausende Kanten gemacht, die beim nächsten
Regelwechsel alle falsch stünden; beigebracht wird weiter über `knownBy`,
und das gilt unter jeder Regel dazu.

Ein **Gang** ist ein laufendes Handwerk und eine Kante (`crafting`) von dem,
der arbeitet, zum Rezept. **Beim Start wird gebunden**, was das Rezept
braucht: es verlässt das Inventar und steht am Gang. Bis dahin ging nichts
hinein, und man legte unterwegs nach — dann lag dieselbe Zange im Beutel und
im Gang zugleich und reichte für zwei Gänge. Gebunden wird auch, was nicht
verbraucht wird; es kommt am Ende immer zurück. Das Nachlegen bleibt für
das, was erst unterwegs dazukommt.

Was beim Misslingen und beim Abbruch zurückkommt, sagt das Rezept
(`onFailure`) — sonst entschiede es jedes Mal die Laune am Tisch.

## Materialgruppe und Ersatz

Ein Rezept nennt, was es braucht — oft einen bestimmten Gegenstand, manchmal
nur eine **Eigenschaft**: „ein Reagenz, mindestens ungewöhnlich". Dafür gibt
es die **Materialgruppe**: eine Regel, die sagt, welche Stücke passen, statt
sie aufzuzählen. Eine Aufzählung stünde neben den Stücken und veraltete mit
dem nächsten Fund; die Materialart und die Seltenheit stehen am Stück ohnehin.

Ein **Ersatz** ist eine Regel des Tisches: „Pflanzen statt Reagenzien". Er
ändert kein Rezept — eine Kopie jedes Rezepts mit Pflanzen wäre hundert
Fassungen, die keine Korrektur am Original mehr erreicht —, sondern sagt
einmal, welche Materialart für welche einspringt, und die Kampagne wählt, ob
sie so spielt. Darum wird erst **beim Start** gewählt: was passt, hängt von
der Figur, ihrem Inventar und den Regeln des Tisches ab, und das weiss das
Rezept nicht. Was nicht passt, sagt seinen Grund — wer am Tisch ein Stück
nicht nehmen darf, soll nicht raten müssen, warum.

## Beruf

Ein **Beruf** (`Trade`) ist eine Regel mit Werkzeugen: Schmieden mit dem
Schmiedewerkzeug, Brauen mit dem Braukessel. Er sagt nicht, welche Rezepte
zu ihm gehören — das sagt jedes Rezept selbst (`Recipe.trade`), und eine
Liste am Beruf wäre die Stelle, die beim nächsten Rezept nicht nachgezogen
wird. Daraus folgt alles Übrige als Abfrage: die Übersicht des Berufs, was
ein Werkzeug möglich macht, was eine Figur mit ihren Werkzeugübungen fertigen
kann. Nennt ein Rezept ein eigenes Werkzeug, gilt das statt der Werkzeuge
seines Berufs — es weiss es genauer. Beruf und Werkzeug stehen beim Namen,
weil die Werkzeugübung, mit der sie verglichen werden, Namen hält (F12);
der Beruf antwortet auch auf seine Aliasse, damit ein Regelwerk, das
„Crafting: Smithing" schreibt, und ein Rezept, das „Smithing" sagt,
zusammenfinden.

**Womit** gefertigt wird — Werkzeug, Attribut, SG — sagt ebenfalls das
Rezept, so wie seine Quelle es druckt. Ein Tisch, der Kräuterkunde mit
Weisheit spielt, oder eine Figur, die mit Geschick braut, kopiert das Rezept
nicht, sondern sagt die **Abweichung** mit einer Kante `craftsWith` zum
Rezept oder zum Werkzeug. Eine Kopie wäre eine zweite Fassung, die die
nächste Korrektur am Original nicht mehr erreicht; eine Kante sagt nur, was
anders ist, und das Besondere (Figur) schlägt das Allgemeine (Kampagne).

Manche Regelwerke messen eine Arbeit nicht in Tagen, sondern in **Proben**:
alle zwei Stunden eine, und erst wenn genug gelungen sind, ist das Stück
fertig. Das Rezept sagt es mit `checks`; die Zeit (`time`) bleibt daneben
stehen, weil sie liest, wer plant, und die Proben zählt, wer würfelt.

In der Seite ist ein laufendes Handwerk ein **Auftrag** (T-128), und der
ist eine **Instanz des Rezepts**: dasselbe, was eine Wache für ihren
Statblock ist. Er liest beim Rezept, was dort steht, und hält selbst, was
nur ihm gehört — wie weit er ist, wie er ausging, welche Proben fielen.
Weicht ein Auftrag ab (die Leitung setzt den SG für diesen einen höher),
steht nur das am Auftrag; eine Korrektur am Rezept erreicht jeden anderen.
Eine Instanz des **Endprodukts** wäre die schlechtere Wahl gewesen: drei
Tränke sind ein Stapel im Inventar, und was im Inventar liegt, ist ein
Verweisziel — eine Instanz ist keines.

Das Material **verlässt das Inventar nicht mehr**, es wird für den Auftrag
**reserviert**. Gebunden ist es so wie beim Gang (es reicht nicht für
zwei), aber es liegt sichtbar, wo es lag — im Gepäck der Figur oder in der
Truhe der Gruppe —, und wer nachsieht, findet es dort mit dem Vermerk, für
welchen Auftrag. **Die Sperre steht am Server** (T-134), nicht nur in der
Maske: eine Sperre, die nur die Oberfläche kennt, umgeht jede Anfrage,
die nicht durch die Oberfläche kommt, und das Material wäre zweimal
verkauft. Frei wird es, wenn der Auftrag endet — oder die Leitung es
sagt, denn am Tisch kommt es anders, als ein Auftrag es vorsieht. Was bei einem Fehlschlag verloren geht, ist eine **Regel
des Tisches** (an der Kampagne, später in einem Regelmodul): manche
Runden verlieren das Material, andere nur den Fortschritt, wieder andere
entscheiden es jedes Mal. **Und nur des Tisches** (T-165): das Rezept
sagt, was seine Quelle vorschlägt, als Text, und es gilt nicht. Bis dahin
konnte die Kampagne „dem Rezept folgen", und dann galt am Tisch für jedes
Rezept etwas anderes, ohne dass man es am Auftrag sah. Jetzt steht am
Rezept und am Auftrag ein Kasten mit den Regeln der Kampagne, ein Satz je
Regel, und der Link dorthin, wo die Leitung sie ändert.

Eine Probe am Auftrag ist ein **Kreis**, den man anklickt: einmal ✓,
zweimal ✗, dreimal leer. Am Tisch wird gewürfelt und gesagt „geschafft"
oder „daneben" — eine Summe einzutippen ist dort ein Umweg, und ein
falscher Klick muss sich zurücknehmen lassen. Darum **speichert der
Auftrag die Kreise und rechnet, was sie bewirken** (D8): ein ✗ wendet die
Regel sofort an — der Fortschritt fällt, am reservierten Material steht,
was verloren ginge —, und wer zurückklickt, nimmt es zurück. Gespeichert
wäre die Wirkung eine zweite Stelle, die beim Zurückklicken jemand
rückgängig machen müsste. **Endgültig wird es beim Abschluss**: erst dann
wird abgerechnet und der Ertrag ins Inventar gelegt.

---

## Laden, Ware und Rabatt

**Ein Laden ist ein Ort, der verkauft** (`Shop`, T-129). Was er führt,
steht nicht am Gegenstand, sondern an der Kante `sells`: dieselbe Laterne
kostet im einen Laden zehn Gold und im anderen zwölf, und es gibt hier drei
davon und dort keine. Ein Feld am Gegenstand könnte nur eine der beiden
Wahrheiten tragen.

**Ein Abschlag ist ein Wort** — `−10 gp` oder `−10 %`. Zwei Zahlenfelder
(Gold, Prozent) hiessen, dass eines leer steht und niemand weiss, welches
gilt; das Wort sagt es beim Lesen. Was sich nicht lesen lässt, zählt nicht
und wird trotzdem gezeigt: ein still verschluckter Rabatt sähe aus wie ein
Laden ohne Rabatt.

**Ein Rabatt ist eine Kante vom Gebenden zum Empfangenden** (`discount`).
Die Gilde, die drei Läden kontrolliert (`controls`), gibt ihren Mitgliedern
ab dem Rang „Flame" zehn Prozent — einmal an der Gilde gesagt, nicht
dreimal an den Läden. Der Rang ist dieselbe Leiter wie beim Wissen
(`Faction.ranks`, A7): was der Zirkel bekommt, bekommt der Novize noch
nicht, und ein Rang, der nicht in der Leiter steht, gewährt nichts.

**Ein geschätzter Preis ist eine Fassung, kein Eintrag im Original**
(T-139). Die Quelle nennt für die meisten magischen Gegenstände keinen
Preis; was Claude dafür schätzt, liegt in der Ebene „AI generated prices"
(Gruppe „AI content") als Überschreibung, mit seiner Herkunft in
`priceNote`. So bleibt sichtbar, was das Buch sagt und was geschätzt ist,
und wer ohne Schätzungen spielen will, schaltet eine Gruppe ab, statt
tausend Felder zu leeren. Der Laden liest darum die **geltende** Fassung
seiner Ware — sonst bliebe die Schätzung an der Theke unsichtbar.

**Der Preis wird gerechnet, nie gespeichert** (D8). Ein gespeicherter
Preis wäre am Tag falsch, an dem jemand in der Gilde aufsteigt; der
gerechnete sagt dazu, woher jeder Abschlag kommt. Prozent rechnen auf den
Grundpreis und addieren sich — so hängt das Ergebnis nicht davon ab, in
welcher Reihenfolge die Kanten stehen.

**Was einer vom anderen hält, rechnet nicht mit.** `regards` bleibt eine
Kante mit Marken; ein Wirt, der Rook etwas schuldet, gibt ihm einen
`discount`. Ob Marken einmal Preise bewegen, ist offen (E-043).

**Gekauft wird eine Ware, nicht ein Preis** (T-133). Die Seite schickt,
welche Ware, wie viele und für wen; den Preis rechnet der Server noch
einmal. Ein Preis aus der Maske wäre der, den jemand gern bezahlt hätte.
Die Menge am Laden sinkt, das Stück liegt danach im Inventar der Figur,
und die Münzen gehen von dort ab — drei Stellen, die gemeinsam stimmen
müssen, darum schreibt sie eine Route und nicht drei Masken.

**Gekauft wird ein Stück, nicht der Artikel** (T-133, T-150). Die Laterne
im Kompendium ist die Vorlage; was Ash über den Tresen bekommt, ist eine
Instanz davon — ein eigener Artikel, der nur speichert, was an *dieser*
Laterne anders ist. Hängte das Inventar am Grundartikel, wäre eine Gravur
an Ashs Laterne eine an jeder, und eine Korrektur am Preis im Kompendium
erreichte eine Kopie nie. Zehn gleiche Fackeln sind trotzdem ein Stapel:
eine Instanz, die nicht abweicht, nimmt die nächsten auf, und verkauft
fällt sie wieder weg. Eine abweichende geht als sie selbst an den Laden.

**Verkauft wird zum halben Listenpreis** — die Regel aus 5e, Rabatte
gelten dabei nicht. Ein Stück, das für einen Fertigungsauftrag reserviert
ist, verkauft man nicht: es gehört schon dem Auftrag. Ob ein Hehler weniger
zahlt als ein Sammler, wäre ein Feld am Laden (E-045, offen).

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

**Ein vorplatziertes Token ist ein verstecktes Spiel-Token mit seiner
Begegnung** (T-203). Die Leitung baut den Kampf vor der Sitzung auf; bis
er beginnt, darf ihn niemand sehen. Eine eigene Art „vorbereitet“ wäre
eine zweite Frage an jeden, der Marker liest — `hidden` hält schon, was
der Server zurückhält. Neu ist nur, **für welche Begegnung** es steht
(`marker.props.encounter`): sonst deckte „Start encounter“ auch die
lauernde Wache auf, die versteckt bleiben soll (REQ-209). Der Vermerk
steht an der Kante und nicht an der Kreatur, weil dieselbe Kreatur auf
einer anderen Karte für eine andere Begegnung bereitstehen kann.

**Ein Licht an der Wand ist ein Marker, kein Artikel** (T-320). Eine
Fackel in einer Halterung hat keinen Namen, den jemand nachschlägt, und
keine Werte; ein Artikel „Fackel 3" für jede wäre Bestand ohne Inhalt. Ein
Marker muss aber auf etwas zeigen — also zeigt das freie Licht
(`kind: light`) auf seine eigene Karte, wie es ein Übergang schon tut. Die
Art sagt, dass dahinter kein Artikel steht: kein Kurzansicht-Popup, kein
Token, das jemand nach `tokenMove` zieht, und für Spielende nur der Schein.
Wer eine Laterne mit Namen und Preis will, legt das Item als Marker hin;
es leuchtet nach seinem eigenen Licht.

**Eine Verknüpfung behält ihren Kasten, auch als Form** (T-327). Ein
Hafenviertel ist kein Rechteck, also darf der Bereich ein Vieleck sein —
aber das Bild der Unterkarte ist eines, und alles, was zwischen den beiden
Karten rechnet (Punkte heben, Gruppen-Token, wie viel des Blicks ein
Bereich füllt), braucht ein Rechteck. Die Form sagt darum nur, wo gezeichnet
und getroffen wird; gerechnet wird mit ihrem Kasten. Zwei Rechnungen — eine
für die Form, eine für das Bild — liefen beim ersten schiefen Viertel
auseinander. Ebenso stehen Zoomtiefe und Anzeige **an der Kante**, nicht an
der Unterkarte: dieselbe Karte könnte in einer anderen Karte anders liegen,
und was die Leitung über eine Verknüpfung sagt, sagt sie über diese
Verknüpfung. Der blasse Rand der Karte darüber wird gerechnet und nicht
gespeichert (D8) — ein zugeschnittenes Bild an der Unterkarte wäre beim
nächsten neuen Bild der Karte darüber falsch.

**Ausgerichtet wird gerechnet, nicht gespeichert** (T-329). Die Grösse
eines am Raster ausgerichteten Bereichs folgt aus zwei Massstäben und zwei
Bildgrössen — vier Angaben, von denen jede sich ändern darf. Stünde die
gerechnete Grösse an der Kante, wäre sie beim nächsten neuen Bild oder
Massstab falsch, und niemand merkte es (D8). Darum bleibt `w`/`h` die
freie Grösse, und der Schalter `align` sagt nur, dass sie gerade nicht
gilt; fällt er, ist die Verknüpfung, was sie vorher war. Gerechnet wird in
Fuss, weil das die eine Einheit ist, in die jede Länge des Registers geht —
eine Reisezeit wie „1 day" nicht, und darum lässt sie sich nicht
ausrichten, statt eine Grösse zu raten.

**Ein Marker steht auf einer Karte, und die anderen lesen ihn** (T-328).
Dass der Wirt in der Stadt auch auf der Regionskarte zu sehen ist, wäre
mit einer Kopie oben schnell gemacht — und am nächsten Tag stünde er oben
noch am Hafen, während er unten längst im Tempel ist. Also wird gehoben
statt kopiert: die Regionskarte liest die Marker der Stadt durch den
Rahmen (D8, Kanten nur vorwärts). Umgekehrt ist es eine Frage und keine
Rechnung: ein Punkt auf der Regionskarte ist in der Stadt eine ganze
Strassenecke breit, und wohin genau er gehört, weiss nur die Leitung.
Darum bleibt der Marker oben stehen und ist unten ein **Vorschlag** — kein
zweiter, stiller Marker, sondern die Frage „hierhin?". Bestätigt, wandert
er hinunter und steht oben wieder, gehoben; so gibt es ihn zu jeder Zeit
einmal. Wer ihn oben meint, sagt es (`stay`), und dann fragt niemand mehr.

**Welche Werkzeuge eine Karte zeigt, sagt die Kampagne, nicht die Karte**
(T-320). Eine Weltkarte braucht keine Wände und eine Kampfkarte keine
Unterkarten — aber welche Gruppe auf welcher Art steht, ist eine
Arbeitsweise der Leitung und für alle Karten einer Art dieselbe. Darum
steht die Tabelle an der Kampagne (`Campaign.mapTools`) und nicht als
Feld an jeder Karte: dreissig Kampfkarten hätten sonst dreissig Mal
dieselbe Liste, und die einunddreissigste vergässe sie. Die Liste nimmt
nichts weg, was gilt: eingeschalteter Nebel und eine dunkle Karte
behalten ihre Werkzeuge, sonst sässe die Leitung vor einer Karte, deren
Nebel sie nicht mehr aufdecken kann.

**Wie ein Marker aussieht, sagt die genaueste Stelle, die etwas sagt**
(T-214). Eine Notiz liest man als Karte, ein Händler auf der Stadtkarte
als Name, ein Goblin auf der Kampfkarte als Bild — das ist zuerst eine
Frage an die **Art** und steht darum an der Registerzeile, geerbt wie
`units`. Auf einer Weltkarte aber ist jedes Bild zu gross: also darf die
**Kartenart** (an der Kampagne, wie die Werkzeuge) es überschreiben, die
einzelne **Karte** auch, und der einzelne **Marker** zuletzt. Ohne jede
Angabe bleibt es beim Bild, sonst den Anfangsbuchstaben — wie vorher; eine
neue Einstellung, die bestehende Karten anders zeichnete, wäre eine
Änderung, um die niemand gebeten hat. Die Karte zeigt die Ansicht `quick`
und keine eigene: was auf einer Kurzansicht steht, ist schon so geordnet,
dass das Wichtigste oben steht und das Bild zuletzt (T-346), und ein
Kasten, der unten abschneidet, verliert nur das Unwichtigste.

**Eine Notiz auf der Karte ist ein Artikel** (T-214, E-070 a) und kein
Text am Marker. Am Marker hätte sie keine Sichtbarkeit, keinen Stand,
keine Ebene und keinen Verweis — und die Frage, ob Spielende sie sehen,
bräuchte eine zweite Regel neben `articleVisible`, die irgendwann jemand
vergisst. Als Artikel geht sie durch dasselbe Sieb wie alles andere: eine
Notiz nur für die Leitung ist für Spielende nicht da, und ihr Marker mit
ihr. Der Name ist die erste Zeile des Textes; einen zweiten tippen zu
lassen hiesse, dieselbe Sache zweimal zu sagen.

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

## Art einer Begegnung

Eine **Begegnung** ist, was am Tisch passiert und vorbereitet sein will —
ein Kampf, aber ebenso ein Gespräch, ein Rätsel, eine Falle, ein Fund
oder ein Stück Geschichte. Was davon, sagt `Encounter.kind` (T-178), und
zwar mit **mehreren** Wörtern: ein Verhör, das in eine Schlägerei
kippt, ist beides, und wer sich für eines entscheiden müsste, legte zwei
Artikel für einen Abend an. Die Wörter stehen in einer Zeile
(`EncounterKind`) und nicht am Feld, weil mehr als eine Stelle sie
braucht — die Liste filtert danach, eine Zufallstabelle würfelt
Begegnungen jeder Art. Und es sind **Wörter, keine Arten**: ein Rätsel
hat seine Lösung und seine Hinweise, ein Gespräch sein Ziel, ein Fund
seine Probe (T-184) — aber diese Felder stehen an der Begegnung, nicht an
einer Art `Puzzle`, denn eine Begegnung darf zwei Arten zugleich sein,
und ein Artikel hat genau eine. Dass ein Rätsel seine Lösung oben zeigt
und ein Gespräch keine Initiative, sagt die **Anordnung** mit `when`: ein
Element gilt nur an Artikeln, auf die es zutrifft. Die Bedingung steht am
Element und nicht in einer Ansicht je Art — sonst wären es acht Ansichten,
die bei jeder Änderung auseinanderliefen. Eine Falle steht als `Hazard`
für sich und die Begegnung zeigt auf sie (`features`): dieselbe Falle
steht in zwei Gängen.

## Wurf und Log

Ein **Wurf** (Roll) ist, was ein Würfelknopf auslöst; das **Log** (Rolls)
eines Artikels sind die Würfe, die auf ihm fielen. Das Log ist kein Feld
und keine Kante: es steht im **Protokoll** (`event_log`), wo auch steht,
wer was geschrieben hat — append-only, also lässt sich ein Wurf weder
ändern noch still verschwinden lassen (T-172). Der Grund, ihn dort und
nicht am Artikel zu halten: ein Artikel ist Inhalt und wandert mit der
Ausfuhr und von dev nach prod; ein Wurf ist Spielgeschehen eines Abends
und gehört dem Tisch, an dem er fiel.

Gewürfelt wird am **Server**. Würfelte der Browser und meldete das
Ergebnis, stünde im Log, was der Browser meldet — und wer nicht mag, was
er sieht, lädt neu. **Verdeckt** (hidden) heisst: nur die Leitung und wer
gewürfelt hat sehen Eintrag und Ergebnis; es ist dieselbe Stufe für den
verdeckten Wurf der Leitung und für jeden Spielerwurf unter
`Campaign.playerRolls: 'gm'`.

## Epic, Feature, Story — Wörter der Planung

Keine Wörter des Modells, sondern der Anforderungen (T-154): eine **Story**
ist ein Wunsch einer Rolle („Als Spieler möchte ich mein Token verschieben,
damit meine Bewegung auf der Karte steht“), ein **Feature** eine Funktion,
Artikelart oder Ansicht, an der Stories hängen, ein **Epic** ein
Funktionsbereich mit mehreren Features. Die Bereiche der App (World, Story,
Rules, Play) sind Features: „Bereich World“ wohnt im Epic Welt & Lore.

Zwei Wörter sind doppelt belegt, und es bleibt mit Absicht so, weil beide
Seiten ihr Wort brauchen: **Feature** heisst im Register die Artikelart
für ein Merkmal einer Klasse oder Abstammung (`Feature`, über `grants`) —
in der Planung trägt ein Feature immer seine Kennung `F-nnn`, und wo beides
vorkommen kann, steht die Kennung dabei. **Story** ist im Register der
Obertyp der Geschichtsartikel (Bereich `story`) — eine Anforderung heisst
darum immer mit ihrer Nummer `REQ-nnn`, nie nur „die Story“.

## Ebene und Stapel

Eine **Ebene** (`Layer`) ist ein Paket Inhalt, das als Ganzes an- oder
abgeschaltet wird: ein Regelwerk, ein Buch, ein Abenteuer, die Ebene einer
Kampagne, die Spielerebene eines Kontos. Der **Stapel** ist, was eine
Kampagne aufschaltet, in welcher Reihenfolge — und die nullte Frage jedes
Lesens ist, ob ein Artikel darin steht (`inPlay`). Eine **Gruppe** ist eine
Ebene, die Ebenen enthält (`kind: 'group'`, nach Kategorie oder
Herausgeber); eine **Vergleichsebene** schaltet eine Kampagne zum Ansehen
dazu, ohne sie zu benutzen. Die Regeln stehen in
[Datenmodell §8](Datenmodell.md#8-ebenen-und-stapel), ausführlich in
[Ebenen.md](Ebenen.md). Kein zehntes Wort unter den neun: eine Ebene ist
selbst ein Artikel, und der Stapel ist eine Abfrage über ihre Kanten.

## Glossar und Handbuch

Ein **Glossarbegriff** (`GlossaryTerm`, T-242) ist ein Artikel, kein
zehntes Wort: er hat Ebene, Sichtbarkeit und Stand wie jeder, und eine
Kampagne kann eigene Begriffe neben die des Regelwerks stellen. Er erbt
von `Rule`, weil er wie eine Regel nachgeschlagen wird und `Rule.autolink`
schon sagte, ob ein Name im Text erkannt werden darf (REQ-175) — das Feld
stand da, gelesen hat es bis dahin niemand. Was er erklärt, sagt die Kante
`explains`; die Regel selbst bleibt am Zustand oder an der Eigenschaft.
Warum nicht der Zustand selbst der Eintrag ist: ein Begriff ist kürzer als
seine Regel, hat eine Wirkung „am Tisch" und Übersetzungen, und es gibt
Begriffe ohne Regelartikel (Konzentration, Vorteil).

Die **Wörter der App** stehen dagegen im Code (`APP_TERMS`): sie ändern
sich mit dem Code, gehören in denselben Commit, und ein Test verlangt je
anlegbare Art und je Wort aus der Tabelle oben einen Eintrag. In der
Datenbank stünden sie auf dev und prod je einmal und liefen auseinander.

**Ein Feld nennt seinen Begriff, statt ihn zu erklären** (T-347). „Hit
points" stand als Satz in `description`, als Hilfe am Bogen und als
Glossareintrag — drei Erklärungen, die nach dem ersten Nachbessern
verschieden sind. Jetzt nennt das Feld den Namen (`glossary`), und der
Eintrag erklärt. Nur der Name steht im Code: der Text ist Inhalt eines
Regelwerks und liegt in dessen Ebene; darum kann der Eintrag auf einer
Installation fehlen, und die Werkbank sagt es, statt dass der Test es
nicht wissen kann. **Zwei Regelstände, ein Name:** der Begriff von 2024
ist eine Fassung dessen von 2014 (`overrides`) — zwei gleichnamige
Einträge im Stapel würden beide nicht mehr erkannt.

Das **Handbuch** (`/handbook`, T-225) ist die eine Stelle, an der alles
erklärt wird; was erzeugt werden kann (Hilfe je Seite, Regeloptionen,
Arten, Glossar), wird erzeugt. Es löst `VTT/Glossary.md` ab, das den
Begriffsstand des Konzepts 0.5 beschreibt (Entity, Component,
ContentBlock) und als überholt markiert ist. Wie es mit Stories, Features
und What's new zusammenfindet, ist E-055.

## Regel, Graph und Angebot

Eine **Regel** ist ein Artikel (`Rule`), und was sie am Tisch tut, ist ihr
**Graph** (`Rule.graph`): Auslöser → Bedingung → Folge. Kein zehntes Wort —
der Graph ist ein Feld des Artikels, wie die Formen eines Boards am Board.
Am Tisch (REQ-357) wird aus einer Folge ein **Angebot** oder ein
**Hinweis**, nie eine Änderung: die Reaktion nimmt jemand an oder lässt
sie, den Effekt setzt die Leitung. Eine Regel, die selbst schreibt, wäre
eine Regel, die sich irren darf, ohne dass es jemand sieht.

**Der Graph führt, wo er dasselbe sagt wie der Code** (Leitung,
19.10.2026): ist „Rules from graphs" an, kommt die Gelegenheitsattacke aus
ihrem Regelartikel und nicht mehr aus `opportunityAttacks`. Beide zugleich
hiesse, dieselbe Reaktion zweimal anzubieten; nur den Code hiesse, eine
Hausregel dazu nicht ändern zu können. Was der Graph nicht kann — wer wo
steht, wessen Reichweite ein Weg verlässt —, rechnet weiter der Code und
reicht es als Ereignis hinein (E-102: Rechnung im Code, Automation in
Daten).

## Board, Schirm und Werkbank

Drei Orte der Oberfläche, keine Wörter des Modells. Ein **Board** gehört
zu einem Geschichtsartikel (Kampagne, Kapitel, Sitzung — nicht zu einer
Szene und nicht zur Weltgeschichte) und sammelt, was dort zusammenhängt;
seine Kacheln sind `placed`-Kanten, und die Kachel wählt ihre Ansicht. Der
**Schirm** (Play, der Spielleiter-Schirm) zeigt während der Sitzung, was
an der Sitzung als laufend steht — Karte, Begegnung, Szene, Boards — und
ist darum keine Liste. Die **Werkbank** ist der Ort der Leitung und
Verwaltung für Prüfungen, Massenänderungen mit Rückgängig und die
Übernahme zwischen dev und prod ([Betrieb.md](Betrieb.md)); „Werkbank am
Rezept“ ist etwas anderes, die Fertigung (Handwerk).

## Transformation

Eine **Transformation** ist eine Kette von Schritten — gruppieren,
filtern, sortieren —, die aus einer Liste einen Baum mit Zählern macht,
wie in Jira Structure (T-253). Die Kette ist **Daten**
(`[{group: 'layer'}, {group: 'type'}]`) und keine Einstellung einer
Seite: dieselbe Rechnung (`applyTransform`, `packages/model/src/transform.ts`)
gruppiert Artikel nach Ebene und Art, Prüfungen nach Sorte, Ebenen nach
Herausgeber. Was eine Dimension ist, sagt die Seite; die üblichen für
Artikel stehen in `articleDimensions`.

Der **Schlüssel** eines Knotens ist sein Weg, `layer:dnd|type:Spell`, und
er ist mehr als eine Adresse im Baum: eine Regel, die für eine Gruppe
gilt — die Sichtbarkeit der Kampagne je Gruppe (T-252, E-098) —, hängt an
genau so einem Schlüssel. Treffen mehrere, gewinnt der **genaueste**
(`mostSpecific`, die meisten Glieder), so wie ein Feld am Artikel eine
Regel der Kampagne schlägt. Ein Glied einer Dimension, die es nicht mehr
gibt, trifft nie — sonst gälte eine alte Regel plötzlich für alles.

Warum keine feste Gruppierung je Seite: „nach Ebene, dann Art" ist heute
richtig und morgen „nach Regelmodul, dann Bereich". Eine Liste im Code
müsste jedes Mal geändert werden; eine Kette stellt man um.

Der **Standort** einer Karte (T-330) ist darum auch keine Spalte, sondern
eine Dimension: der Ort, den sie zeigt, und die grösseren darüber, beim
Lesen gerechnet (`locationPath`). Zwei Dimensionen statt einer mit vielen
Stufen — „Location" der nächste Ort, „Region" der äusserste —, weil eine
Kette Stufen schon kann: „nach Region, dann Ort" schachtelt die Stadt unter
die Küste. Die Kartenliste bleibt ohne Schritt der Baum nach Elternkarte.

## Ein Wort, mehrere Sachen

Wörter, die im Gespräch eine andere Sache meinen als im Modell. Was hier
steht, ist die Lesart in Code und Dokumentation; im Zweifel nennt man den
Bezeichner dazu.

| Wort | Im Modell | Im Gespräch auch | So halten wir es |
|---|---|---|---|
| **Instanz** | eine Instanz einer Vorlage (`instanceOf`): Statblock einer Wache, Stück im Inventar | jeder Artikel als „Instanz eines Typs“ | Ein Artikel *hat* Typen, er ist keine Instanz davon; „Instanz“ heisst nur die Kopie, die von einer Vorlage liest. |
| **Beziehung** | die Kante `regards` mit Marken ([Beziehungen.md](Beziehungen.md)) | jede Verbindung zwischen Artikeln | Allgemein heisst es **Kante**; „Beziehung“ ist, was jemand vom anderen hält. |
| **Variante / Fassung** | Fassung: dieselbe Sache aus einer anderen Ebene (`overrides`, `adaptedVersion`); Variante: eine verwandte andere Sache (`variantOf`) | beides „Variante“ | Fassung, wenn es *dieselbe* Sache bleibt; Variante, wenn es eine eigene ist. |
| **Bereich** | `area` einer Art: world, story, rules, play | ein Anker mit Reiter auf dem Board; ein Bereich der App; ein Funktionsbereich (heute Epic) | `area` heisst Bereich; der Anker auf dem Board heisst Bereich *auf dem Board*; Funktionsbereiche heissen Epic. |
| **Zone** | Behälterzone (was das Ziehen kostet, `Inventory.zones`) und Kartenzone (eine Regel an einem Ort, `zone`, `ZoneKind`) | — | Zwei Sachen mit gleichem Wort, getrennt durch den Ort; man sagt, welche. |
| **Gruppe** | Gruppe von Ebenen (`kind: 'group'`) | die Party einer Kampagne | Die Figurengruppe heisst **Party** (`Party`); „Gruppe“ allein meint Ebenen. Die frühere Art `Group` gibt es nicht mehr. |
| **Feature, Story** | Artikelarten (`Feature`, `Story`) | Wörter der Planung | Siehe oben: mit Kennung `F-nnn`, `REQ-nnn`. |
| **Kapitel** | `Chapter` zum Lesen, `Arc` zum Spielen | beides „Kapitel“ | Ein Kapitel eines Abenteuers ist beides, über denselben Teilen (`chapterOf`). |

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

