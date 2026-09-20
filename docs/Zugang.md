# Zugang

Stand 2026-09-20. REQ-031 und REQ-032 aus
[`Mrfudog/atlas-mentis`](https://github.com/Mrfudog/atlas-mentis).

Das hier betrifft den **Server** (`apps/server`), nicht den Artefakt-Prototyp.
Dort kommt die Identität von der Laufzeit; ein Passwort im Browser wäre keines.

---

## Die Annahme, die keine Kontrolle ist

Die Anwendung bindet auf `127.0.0.1`, und der Reverse Proxy ist das, was nach
aussen zeigt. Das ist richtig so — aber **„nur das Heimnetz" ist keine
Zugangskontrolle, sondern eine Annahme über das Heimnetz.** Jedes Gerät darin,
jeder Gast im WLAN, jeder Dienst mit einer Schwachstelle spricht dann mit
einer Anwendung, die jeden für die Spielleitung hält.

---

## Drei Entscheidungen

**Ohne Konto schreibt niemand.** Ein frischer Server hat kein Konto und also
auch kein Standardpasswort, das jemand vergisst zu ändern. `GET /api/me` sagt,
wie man das erste anlegt; lesen geht, schreiben nicht. Ein offener Schreibweg
wäre das Schlimmste von beidem.

**Die Sitzung liegt beim Server.** Ein signierter Keks mit den Rechten darin
liesse sich nicht widerrufen. Eine Zeile in `app_session` schon — und „alle
Geräte abmelden" ist dann ein `DELETE` und keine Schlüsselrotation.

**Gespeichert wird der Hash des Tokens**, nicht das Token. Wer die Datenbank
liest, kann sich damit trotzdem nicht anmelden: dieselbe Überlegung wie beim
Passwort, eine Ebene weiter.

---

## Wie es aussieht

| | |
|---|---|
| Passwort | Argon2id, Parameter im Hash — die Härte lässt sich später erhöhen, ohne alte Passwörter unlesbar zu machen |
| Mindestlänge | 12 Zeichen, **keine Zeichenklassen** — die erzeugen `Passwort1!` und verbieten die Passphrase, die tatsächlich hilft |
| Sitzung | Keks `nw_session`, `httpOnly`, `SameSite=Lax`, `secure` hinter TLS, sieben Tage, bei jedem Zugriff nachgeschoben |
| Fehlversuche | acht je Konto **und** Herkunft in fünfzehn Minuten; ein Erfolg löscht den Zähler |

Zwei Dinge, die man leicht weglässt und die genau deshalb hier stehen:

- **Auch ohne Konto wird gerechnet.** Gibt es den Namen nicht, prüft der
  Server gegen einen Blindhash. Sonst verriete die Antwortzeit, welche Konten
  existieren.
- **Gezählt wird je Konto und je Herkunft.** Nur je Konto liesse sich ein
  Konto von aussen aussperren; nur je Herkunft hülfe gegen ein Botnetz nichts.

Die Auskunft bei einem Fehlschlag ist in beiden Fällen dieselbe: welcher Name
existiert, geht niemanden etwas an, der ihn nicht schon kennt.

---

## Gelesen wird gesiebt

Bis hierher machte das Zurückhalten nur die Oberfläche. Das reicht genau so
lange, wie niemand die Schnittstelle direkt aufruft — und **ein Server, der
einem Spieler die Geheimnisse schickt und darauf baut, dass sein Browser sie
nicht anzeigt, hält gar nichts zurück.**

`redactEntity` steht deshalb in `packages/model`: was dort liegt, gilt für
Server und Oberfläche gleichermassen, und es gibt es nur einmal. Weg gehen

- **Felder**, die eine Information beansprucht, die der Betrachter nicht
  kennt — die Karte wird weggelassen, nicht leer mitgeschickt: „da ist eine
  Karte, aber sie ist leer" wäre eine Auskunft, die niemand geben wollte;
- **Blöcke** ebenso, plus die Blockarten aus `gmBlockTypes`. Nur ein Block,
  den eine **bekannte** Information ausdrücklich freigibt, schlägt die
  Blockart: ein Block, den jemand geschenkt bekommen hat, bleibt sein Block,
  auch wenn er „secret" heisst;
- **der Name**, wenn er beansprucht und ungewusst ist — dann steht der
  Deckname da (REQ-178), und zwar auch in dem bequemen `name` oben am
  Artikel. Ihn stehen zu lassen wäre die Art Lücke, die niemand sucht.

Die Kanten bleiben. Eine Verbindung zu verbergen hiesse, den Rückbezug am
anderen Ende mitzuverbergen, und das ist eine andere Frage als diese.

---

## Wer was darf

Die Regel ist kurz, weil eine lange niemand mehr nachliest:

- **Die Spielleitung darf alles.**
- **Ein Spieler liest alles** (was die Sichtbarkeit ihn lesen lässt) **und
  schreibt genau seine Figur und was an ihr hängt.** „Hängt an" heisst: über
  eine Kante aus `OWNING_RELATIONS` — `carries`, `holds`, `crafting`. Die
  Kante steht in den Daten, also wird sie dort nachgesehen und nicht im
  Server behauptet.
- **Das Register gehört der Spielleitung.** Eine Registerzeile zu ändern
  heisst, die Regeln zu ändern, und die Antwort sagt das auch so.

---

## Konten anlegen

Von der Kommandozeile, nicht über das Netz. Der erste Zugang muss irgendwo
herkommen, und jeder Weg dafür über HTTP ist eine Tür, die danach offen
bleibt. Wer auf dem Server eine Shell hat, kommt ohnehin an die Datenbank.

```bash
pnpm --filter @nw/server user add basil --gm
pnpm --filter @nw/server user add sela --actor pc_sela
pnpm --filter @nw/server user password basil
pnpm --filter @nw/server user disable sela
pnpm --filter @nw/server user list
```

Das Passwort kommt aus `NW_PASSWORD` oder wird zweimal erfragt — **nie aus
einem Argument**: Argumente stehen in der Prozessliste und in der
Shell-Historie, und ein Passwort, das dort steht, ist keines mehr.

Ein neues Passwort und eine Sperre beenden beide die laufenden Sitzungen.
Sonst bliebe genau das Gerät angemeldet, dessentwegen man es geändert hat.

---

## In der Oberfläche

`apps/web` hat seit 2026-09-20 eine Anmeldemaske, eine Wache vor den Routen
und eine Artikelansicht. Drei Sachen daran sind Absicht:

- **Die Sitzung hat drei Zustände**, nicht zwei: „noch nicht gefragt" ist ein
  eigener. Wer ihn mit „nicht angemeldet" verwechselt, wirft den Nutzer beim
  Neuladen für einen Wimpernschlag auf die Anmeldemaske — und wer das einmal
  gesehen hat, traut der Anmeldung nicht mehr.
- **Die Wache ist Bequemlichkeit, keine Sicherheit.** Die Rechte hängen am
  Server; eine Route, die nur in der Maske bewacht wäre, wäre gar nicht
  bewacht.
- **Die Maske prüft nicht nach, was sie zeigen darf.** Der Server hat schon
  gesiebt. Eine zweite Prüfung sähe nach Sorgfalt aus und wäre das Gegenteil:
  sie lüde dazu ein, die erste wegzulassen.

Eine Abmeldung, die der Server nicht bestätigt, meldet **lokal trotzdem ab**
und sagt es. Beides andere wäre falsch: weiter so tun, als wäre jemand da —
oder „abgemeldet" sagen, während die Sitzung dort weiterlebt.

---

## Was nicht mitwandert

**Zugänge sind keine Artikel.** Ein Artikel gehört der Kampagne und wandert
mit ihr; ein Zugang gehört der Instanz. `app_user`, `app_session` und
`login_attempt` sind eigene Tabellen und dürfen beim Spiegeln von prod nach
preprod ausdrücklich **nicht** mitwandern (REQ-199). In der Artikeltabelle
steht davon nichts — nur beim Nutzer steht die Id der Figur, die er spielt.

`actor_id` hat bewusst keinen Fremdschlüssel: die Figur kann gelöscht und neu
eingelesen werden, und ein Zugang, der daran zerbricht, sperrt jemanden mitten
in der Sitzung aus.

---

## Was noch fehlt

- **Mehr als Lesen in der Oberfläche.** Anmeldung, Liste und Artikelansicht
  stehen; Bearbeiten, Karten, Bogen und Inventar sind im Prototyp und noch
  nicht dort.
- **Einladungen für Spieler** (REQ-034). Heute legt die Spielleitung das
  Konto an und sagt das Passwort; ein Einladungstoken wäre bequemer und ist
  eine eigene Entscheidung — auch weil ein Token je Figur nie ins öffentliche
  Repo gehört (REQ-199).
- **Einen zweiten Blick auf das Sieb.** `redactEntity` hält Felder, Blöcke
  und den Namen zurück; die Kanten bleiben, weil eine verborgene Verbindung
  den Rückbezug am anderen Ende mitverbergen müsste und das eine andere
  Frage ist. Ob das die richtige Grenze ist, entscheidet sich am Tisch.
