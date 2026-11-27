# Die Leiste und die Tasten

Stand 2026-10-22. **Vorschlag, nicht gebaut.** Er antwortet auf drei Wünsche
der Leitung:

1. Eine **Leiste** für alles, was man in einer Seite tut: übergreifend,
   mit Inhalt aus dem Ort (auf der Karte die Kartenwerkzeuge) und Inhalt,
   den man selbst einrichtet (Links, Würfe, Artikel). Gewechselt wird per
   **Karussell**. Jede Leiste hat eine **Hilfe** und **Tastenkürzel**, und
   wie viele Felder sie hat, lässt sich einstellen.
2. **Umschalttasten**, die sich überall gleich verhalten. Ob Shift oder
   Ctrl das Quadrat macht, soll sich aus einem Bild ableiten lassen, das
   man im Kopf behält.
3. **Das Einrasten bleibt, wie es ist** (Punkt, Gitterecke, Linie, Stärke
   in Bildschirmpunkten, Alt setzt ohne; [Karten.md](../Karten.md)). Es
   wird höchstens ergänzt.

Woher die Ideen kommen: Fantasy Grounds hat zwölf Felder (F1–F12) und
Ebenen über Ctrl, Shift und Alt, zusammen 96 Felder. Bei den Zeigern
wählt die Taste die Form (Shift Quadrat, Ctrl Kreis, Alt Kegel; laut
Forum, nicht amtlich). Baldur's Gate 3 hat Aktionsleisten, die mit der
Figur wechseln. Wie die beiden Belegungen im Browser kollidieren, steht
unten unter „Warum nicht die Ebenen von Fantasy Grounds“.

---

## Teil 1 · Die Tasten: drei Wörter

Heute gilt schon, verstreut über die Karte:

| Taste | heute | wo |
|---|---|---|
| Alt | setzt **ohne Einrasten** | jedes Werkzeug, das einen Punkt setzt |
| Shift | Gitterschritt **×10** | Pfeile beim Gitter |
| Shift / Ctrl / Cmd + Klick | öffnet die **volle Seite** statt der Kurzansicht | Token, Marker |
| Shift+F | Vollbild | Karte |
| Buchstabe | Werkzeuggruppe (S, P, T, M, E, F, L, W, G, K, N, D), I, Y | Karte |
| Esc · Enter · Entf | zurück · Linienzug fertig · Token weg | Karte |

Daraus lässt sich ein Bild machen, das nichts davon bricht, und es reicht
für alles Weitere:

> **Shift heisst *in Stufen*. Alt heisst *frei*. Ctrl (Mac: Cmd) heisst *weiter*.**

| Wort | Bild | Was es tut |
|---|---|---|
| **Shift · in Stufen** | Die Hand rastet in feste Schritte ein. | Winkel in 15°-Schritten (0, 45, 90 dabei), **Rechteck → Quadrat**, Ellipse → Kreis, Drehen in 15°, Verschieben nur waagrecht oder senkrecht, Pfeilschritt ×10 (wie heute), Seitenverhältnis halten beim Strecken |
| **Alt · frei** | Alle Hilfen los. | ohne Einrasten (wie heute), ohne Winkelstufe, ohne Gitter beim Verschieben; Alt-**Klick** ohne Ziehen zeigt auf eine Stelle (Ping) |
| **Ctrl/Cmd · weiter** | Einen Schritt weiter als sonst. | Klick öffnet die volle Seite (wie heute), Klick in der Auswahl **nimmt dazu**, nach dem Setzen **bleibt das Werkzeug** für den nächsten Punkt |

**Daraus folgt das Quadrat:** Ein Quadrat ist ein Rechteck in gleichen
Stufen, eine gerade Linie ein Winkel in Stufen. Beides ist also **Shift**.
Wer „Shift hält die Linie gerade“ einmal kennt, findet das Quadrat von
selbst, und umgekehrt.

**Shift und Alt zusammen:** in Stufen, aber ohne Einrasten. Der Winkel
steht auf 45°, die Länge bleibt, wo die Hand sie hinlegt. Das ist der
einzige Fall, in dem sich zwei Wörter treffen. Die Regel dafür: Stufen
gelten für Winkel und Seitenverhältnis, Einrasten für Punkte. Beides
schliesst sich nicht aus.

**Warum nicht Ctrl für das Quadrat:**

- Ctrl-Klick ist auf dem Mac ein Rechtsklick.
- Ctrl+Rad zoomt im Browser.
- Ctrl+Klick öffnet heute schon die volle Seite.

Ctrl hiesse dann an derselben Stelle zweierlei.

**Was ergänzt wird, nicht geändert:**

- **Stufen beim Zeichnen** (Shift): neu. Das Einrasten läuft danach weiter
  wie heute, und zwar entlang des Strahls. Liegt eine Gitterecke oder ein
  Punkt nahe am gestuften Strahl, rastet er dort ein; sonst bleibt der
  Punkt auf dem Strahl. Erst Winkel, dann Ort, sonst stimmt das eine oder
  das andere nicht.
- **Aus der Mitte aufziehen** (Rechteck, Ellipse, Rahmen) ist **kein**
  Modifikator, weil Alt schon „frei“ heisst. Es wird ein Schalter in der
  Werkzeugleiste: *From corner / From centre*, gemerkt wie *Closed* und
  *Cut walls* (`EditorStand`).
- **Einrasten an/aus** bleibt der Schalter, den es gibt (`snap`, Stärke).
  Neu ist nur, dass er in der Leiste ein Kürzel und eine Zeile Hilfe
  bekommt: Alt halten setzt ihn für einen Zug aus, der Schalter für
  länger.

**Am Telefon und am Tablet** gibt es keine Umschalttasten. Shift und Alt
stehen deshalb auch als **einrastende Knöpfe** in der Leiste:

- einmal tippen: gilt für den nächsten Zug;
- zweimal tippen: bleibt, bis man es löst.

Gezeichnet wird das gleich wie eine gehaltene Taste.

**Sichtbar, was gilt:** Solange eine Taste gehalten wird, steht an der
Leiste in einer Zeile, was sie gerade tut (`Shift · 45°`,
`Alt · no snapping`). Wer eine Taste aus Versehen hält, sieht es, bevor
die Linie falsch liegt.

---

## Teil 2 · Die Leiste

### Ein Element, viele Inhalte

Die Leiste ist **ein** Element der Seite, unten am Rand (am Telefon über
dem Daumen). Was in ihr steht, ist eine **Belegung**:

| Belegung | woher | Beispiel |
|---|---|---|
| **Kontext** | der Ort sagt es, man stellt nichts ein | auf der Karte die Kartenwerkzeuge, unter Play der Zugplan, im Register die Registerwerkzeuge |
| **Eigene** | man richtet sie ein | „Kampf“, „Wissen“, „Orte“, „Vorbereitung“ |
| **Von der Leitung** | die Leitung gibt sie der Gruppe | „Szene: Hafen“ mit den drei Händlern |

Heute gibt es dafür drei Stellen:

- die Werkzeugleiste der Karte (`.werkzeugleiste`, die Gruppen in `GRUPPEN`);
- den Zugplan (T-325), der schon „in derselben Leiste“ steht;
- noch keine für Links.

Der Vorschlag macht daraus eine. Die Kartenwerkzeuge sind die erste
Belegung der Sorte Kontext und werden nicht neu gebaut, sondern
umgehängt.

### Das Karussell

```
        ◀  Map tools · 1 / 4  ▶                         ?   ⚙
 ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
 │ ↖ │ ⚔ │ ◉ │ ↔ │ ⧉ │ ☁ │ ☀ │ ▥ │ # │ ⊡ │
 │ S │ P │ T │ M │ E │ F │ L │ W │ G │ K │
 └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
   [Map tools] · Combat · Lore · Places
```

- **Wechseln:**
  - ◀ ▶, Rad über der Leiste, Wischen am Telefon;
  - `[` und `]`;
  - den Namen darunter antippen.

  Shift, Alt und Ctrl bleiben dem Zeichnen und blättern **nicht**. Das
  ist der Grund, warum das Karussell hier besser passt als die Ebenen von
  Fantasy Grounds.
- **Die erste Belegung kommt aus dem Ort:** Wer eine Karte öffnet, sieht
  die Kartenwerkzeuge, ohne zu drehen. Die eigenen Belegungen folgen
  dahinter, in einer festen Reihenfolge, die man einstellt. Die Leiste
  folgt nicht dem zuletzt Benutzten, sonst wandert eine Belegung, die man
  blind trifft.
- **An einer Figur:** Eine eigene Belegung darf an einer Figur hängen.
  Wer zwei Figuren führt, bekommt beim Wechsel der Figur deren Belegungen,
  wie bei Baldur's Gate 3. Eine Belegung ohne Figur gilt immer.

### Was in jeder Leiste steht: ? und ⚙

Jede Belegung bringt zwei Knöpfe am Rand mit. Die Kontext-Belegungen
bekommen sie aus demselben Eintrag wie heute die Tooltips der Gruppen,
die eigenen aus einer Vorlage.

- **? Hilfe**: Was die Felder tun, die Kürzel jedes Feldes und die
  **Tasten, die in dieser Belegung gelten**, mit dem Wort aus Teil 1:

  ```
  Walls (W)
    Click        set a point          Enter   finish
    Shift        in steps: 15°, square
    Alt          free: no snapping
    Ctrl/Cmd     keep drawing after finishing
    Esc          cancel · Backspace  last point back
  ```

  Gelesen aus `help.json`, wie jede Hilfe der Seite. Die Zeilen zu den
  Umschalttasten stehen **einmal** in einer gemeinsamen Vorlage, und die
  Belegung nennt nur, welche davon gelten. So steht „Alt · free“ an jeder
  Stelle gleich da, und eine neue Belegung erklärt sie nicht neu.
- **⚙ Einrichten**: Name, Anzahl Felder, Reihenfolge, an welcher Figur,
  leeren.

### Felder, Anzahl und Kürzel

- **Wie viele Felder:** einstellbar je Belegung, 6 bis 20, Vorgabe 10.
  Eine Kontext-Belegung nimmt so viele, wie sie Werkzeuge hat, und lässt
  sich nicht kürzen. Wer weniger sehen will, blendet Werkzeuggruppen aus;
  das kann die Karte schon (`Campaign.mapTools`, ⚙ Tools).
- **Kürzel:**
  - Kontext-Belegungen behalten ihre **Buchstaben** (S, T, M, F, W …).
    Die sitzen und bleiben.
  - Eigene Belegungen nehmen **Ziffern** `1`–`0`, darüber `-` und `=`.
    Mehr als zwölf Felder haben dann kein Kürzel, und das sagt die
    Einrichtung.
  - **Ziffern lösen auch auf der Karte aus**, wenn eine eigene Belegung
    zu sehen ist. Buchstaben gehören weiter den Kartenwerkzeugen.
    Ziffern lösen nie aus, wenn ein Eingabefeld den Fokus hat.

### Ein Feld ist ein Verweis

| Was | Klick | Ctrl/Cmd-Klick (*weiter*) |
|---|---|---|
| Artikel | Kurzansicht | volle Seite |
| Karte, Board | auf den Schirm | im eigenen Fenster |
| Tabelle, Würfelausdruck | würfeln | bearbeiten |
| Begegnung (Leitung) | starten | öffnen |

Belegen geht durch **Ziehen**, aus einem Verweis, einer Listenzeile,
einem Token oder einem Teilnehmer der Initiative. Was der Betrachter
nicht sehen darf, kommt als Lücke an, gesiebt am Server wie jeder
Artikel (`redactEntity`), mit dem Decknamen, wo einer steht. Ein Feld,
dessen Ziel verschwand, bleibt grau stehen.

### Wo es gespeichert wird

Eine eigene Belegung gehört dem **Konto**, nicht der Kampagne. Auch die
Leitung hat eine, obwohl sie keine Figur führt. Konten sind keine
Artikel ([Zugang.md](../Zugang.md)). Ein Feld ist deshalb keine Kante,
sondern ein Zeiger von ausserhalb der Fiktion, aus demselben Grund wie
`app_user_actor.actor_id`.

Vorschlag: zwei Tabellen, ohne Fremdschlüssel auf Artikel. Beim Spiegeln
von prod nach preprod wandern sie nicht mit, wie die übrigen
Kontotabellen.

- `app_user_bar`: Konto, Name, Reihenfolge, Anzahl Felder, optional
  `actor_id`;
- `app_user_bar_slot`: Leiste, Lage, Ziel, Beschriftung.

Die Belegungen der Leitung für die Gruppe hängen an der Sitzung, wie
alles, was gerade läuft (`Session`).

---

## Warum nicht die Ebenen von Fantasy Grounds

Zwölf Felder mal acht Ebenen aus Ctrl, Shift und Alt sind schnell, wenn
man sie in der Hand hat. Hier sprechen drei Dinge dagegen:

1. **Die Tasten sind vergeben.** Shift heisst *in Stufen*, Alt *frei*,
   Ctrl *weiter*. Blätterte Shift die Leiste um, klappte sie bei jeder
   geraden Linie mit.
2. **Der Browser gibt sie nicht her.**
   - F-Tasten: F5 lädt neu, F11 schaltet auf Vollbild, F12 öffnet die
     Entwicklerwerkzeuge.
   - Alt+F4 schliesst das Fenster.
   - Ctrl+Ziffer wechselt den Tab und lässt sich in Chrome nicht
     abbestellen.
3. **Acht Ebenen ohne Namen** merkt sich nur, wer jede Woche spielt. Ein
   Karussell mit Namen findet man auch nach drei Wochen Pause.

Was davon bleibt: Belegungen per Ziehen, Auslösen per Taste und die Zahl
der Felder als eigene Wahl.

---

## Reihenfolge, falls es gebaut wird

1. **Die drei Wörter**: Shift-Stufen beim Zeichnen, der Schalter
   *From centre*, Ctrl/Cmd *weiter* (Auswahl dazu, Werkzeug bleibt) und
   die Zeile „was gerade gilt“. Klein und ohne Datenmodell.
2. **Die Leiste als Element** mit der Kontext-Belegung Karte, ? und ⚙.
   Das ist ein Umbau der heutigen Werkzeugleiste und keine neue.
3. **Eigene Belegungen** mit Tabellen, Ziehen, Ziffern und Anzahl
   Felder.
4. **Belegungen an der Figur** und **von der Leitung**.

## Offen

- **E-?**: Gilt *Ctrl/Cmd · weiter* auch für „Werkzeug bleibt“? Heute
  bleibt *Walls* nach dem Fertigstellen ohnehin aktiv. Prüfen, bei
  welchen Werkzeugen das anders ist, bevor die Taste dafür steht.
- **Story anlegen** (T-154): Leiste (F-? Bedienung) und Tastenbild, je
  mit Akzeptanzkriterien aus diesem Vorschlag.
