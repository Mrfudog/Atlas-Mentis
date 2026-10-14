# Zugang

Stand 2026-10-14. REQ-031 und REQ-032 aus
[`VTT/`](../VTT/) in diesem Repo (überholt durch [Datenmodell.md](Datenmodell.md)).

Das hier betrifft den **Server** (`apps/server`), nicht den Artefakt-Prototyp.
Dort kommt die Identität von der Laufzeit; ein Passwort im Browser wäre keines.

---

## Die Annahme, die keine Kontrolle ist

Die Anwendung bindet auf `127.0.0.1`, und der Reverse Proxy ist das, was nach
aussen zeigt. Das ist richtig so — aber **„nur das Heimnetz" ist keine
Zugangskontrolle, sondern eine Annahme über das Heimnetz.** Jedes Gerät darin,
jeder Gast im WLAN, jeder Dienst mit einer Schwachstelle spricht dann mit
einer Anwendung, die jeden für die Verwaltung hält.

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

### Und vorher die grobe Frage

`redactEntity` siebt **Felder**. Ob ein Artikel überhaupt an jemanden geht,
sagt `articleVisible` — und das tat bis zum 30.9. niemand: `audience: 'gm'`
stand in der Karte, und der Server schickte den Artikel trotzdem. Ein Feld
auszuwerten und die Antwort dann doch zu schicken ist keine halbe
Sichtbarkeit, sondern keine.

Jetzt filtert `sieve` zuerst und siebt danach. Ein Artikel, den der
Betrachter nicht sehen darf, fehlt in der Liste und beantwortet den
Einzelabruf mit **404** — „verboten" wäre die genauere Auskunft und die
falsche: sie sagt, dass da etwas ist. (An der Stelle stand `einer ?? entity`:
der Rückfall schickte genau den Artikel, den das Sieb zurückgehalten hatte.)

Die Regel selbst steht in `packages/model/src/visibility.ts` und ist in
[Begriffe.md](Begriffe.md#sichtbarkeit) ausgeschrieben: `hiddenFrom` schlägt
`revealedTo` schlägt `audience`, und `public` ist die Vorgabe.

---

## Wer was darf

Die Regel ist kurz, weil eine lange niemand mehr nachliest:

- **Die Verwaltung darf alles.**
- **Ein Spieler liest alles** (was die Sichtbarkeit ihn lesen lässt) **und
  schreibt genau seine Figur und was an ihr hängt** — und was er selbst
  angelegt hat (D72). „Hängt an" heisst: über
  eine Kante aus `OWNING_RELATIONS` — `carries`, `holds`, `crafting`. Die
  Kante steht in den Daten, also wird sie dort nachgesehen und nicht im
  Server behauptet.
- **Wer in einer Ebene schreibt, schreibt darin alles** (T-098, E-001):
  jedes Konto die Ebenen, die es besitzt oder zugeteilt bekam
  (`app_user_layer`, neben dem Konto), und `gm` wie `co-gm` die **Ebene
  ihrer Kampagne**. Geschrieben wird ein Artikel nur, wenn er **ganz** in
  solchen Ebenen liegt — einer, der auch im geteilten Regelwerk liegt, nicht.
  **Eine eigene Ebene legt jedes Konto an** (Seite „Account" › Layers,
  `POST /api/layers`); wer sie anlegt, besitzt sie und sagt, wer sonst darin
  schreibt. Die Verwaltung teilt jedem Konto Ebenen zu (Seite „Campaign" ›
  Accounts of this installation). Sie wirkt, sobald die Leitung sie aufschaltet. **Was nicht in
  den eigenen Ebenen liegt — auch was ohne Ebene ist —, ändert man als
  Fassung:** „Edit" legt sie in eine eigene Ebene im Spiel
  (`POST /api/entities/:id/adapt`, bei mehreren `{ layer }`).
- **Spielende legen Artikel an, „ready" setzt die Leitung** (REQ-237, D72).
  Wer in der laufenden Kampagne `player` ist, legt jede Art an, die einen
  Stand trägt; sie landet in der Ebene der Kampagne, auf `idea` oder
  `prepared`. Wer was angelegt hat, steht in `app_user_article` neben dem
  Konto. **Unfertiges sieht nur die Leitung der Kampagne** — und wer es
  angelegt hat oder schreiben darf; ein Artikel ohne Status-Karte zählt als
  fertig.
- **Die eigene Figur verwaltet der Spieler ganz** (E-014 d, D74): seinen
  Spielercharakter samt Statblock (`belongsTo`, auch eine Instanz) und
  Inventar (`carries`) schreibt er und setzt ihren Stand selbst, auch
  `ready`; nichts fällt zurück, und die Mitspielenden sehen sie nach der
  gewöhnlichen Sichtbarkeit, nicht nach dem Stand.
- **Ändert eine Spielerin einen anderen fertigen Artikel, fällt er auf
  `prepared`** (E-012, D74), und für alle ausser ihr und der Leitung gilt
  der letzte fertige Stand weiter (`entity_ready`), bis `gm` wieder `ready`
  setzt. Was wartet, steht in der Werkbank („Not ready, by players",
  `GET /api/unready`, Knopf `POST /api/entities/:id/ready`).

| | legt an | schreibt | setzt `ready` | sieht Unfertiges | ändert er Fertiges |
|---|---|---|---|---|---|
| Verwaltung (`is_admin`) | ja | alles | ja | alles | bleibt fertig |
| `gm` der Kampagne | in der Ebene der Kampagne | die Ebene der Kampagne, was Spielende angelegt haben; Fremdes als Fassung | ja | ja | bleibt fertig |
| `co-gm` der Kampagne | in der Ebene der Kampagne, unfertig | die Ebene der Kampagne; Fremdes als Fassung | nein | ja, mit Band | fällt auf `prepared` |
| `player` der laufenden Kampagne | jede Art mit Stand | eigene Figur samt Statblock und Anhang, eigene Artikel | nur an der eigenen Figur | nur eigenes; die Figuren der anderen ja | fällt auf `prepared`, für die anderen gilt der fertige Stand — ausser an der eigenen Figur |
| `spectator`, ohne Rolle | nein | nein | nein | nein; die Figuren der Spielenden ja | — |
| jedes Konto, in **eigenen** Ebenen (T-098) | darin, sobald sie im Spiel ist, unfertig | alles darin; Fremdes als Fassung darin | nein (das tut `gm`) | was darin liegt | fällt auf `prepared` |
- **Das Register gehört der Verwaltung und der Leitung der laufenden
  Kampagne** (`gm` in der Kampagne, die `currentCampaign` nennt; seit W5).
  Eine Registerzeile zu ändern heisst, die Regeln zu ändern, und die
  Antwort sagt das auch so. Ein Mitleiter ändert es nicht, eine Leitung
  einer anderen Runde auch nicht — dieselbe Trennung wie bei den
  Mitgliedern. Die Zählung `/api/registry/usage` gehört denselben: sie
  zählt ungesiebt.
- **Die eigene Kampagne als Datei** (`GET /api/export?campaign=<id>`,
  T-077) holen die Verwaltung und die Leitung dieser Kampagne (`gm` und
  `co-gm` — sehen tun beide dasselbe, und Ausführen ist Lesen). Gesiebt
  wird nach der Sichtbarkeit (`articleVisible`); die Felder der Leitung
  (`gmFields`) bleiben drin, denn eine Sicherung ohne die Geheimnisse wäre
  keine. Den ganzen Bestand (`&layers=all`) holt nur die Verwaltung. Was in
  der Datei steht: [Betrieb.md › Die eigene Ausfuhr](Betrieb.md#die-eigene-ausfuhr).

### Verwaltung ist keine Rolle am Tisch

Das Konto-Merkmal hiess `is_gm` und heisst seit dem 30.9. **`is_admin`**. Es
gilt für die **ganze Installation** und schaltet vier Dinge: alles schreiben,
das Register ändern, Einladungen anlegen — und unbeschnitten lesen. Das ist
eine Verwaltungsrolle. „GM" las sich aber wie eine Rolle am Tisch: als stünde
dort, wer in *dieser* Kampagne leitet.

Der Unterschied ist keiner auf dem Papier. Wer in einer Runde leitet, kann in
einer anderen mitspielen; ein Merkmal je Konto kann das nicht sagen. Die
Rolle am Tisch steht deshalb **am Konto, je Kampagne**:

```sql
campaign_member (campaign_id, user_id, role)   -- gm | co-gm | player | spectator
```

Eine Zeile je Konto und Kampagne, neben `app_user_actor` (welche Figuren ein
Konto führt). Gesetzt wird sie auf der Seite **Campaign** (`/campaign`, W3)
oder von der Kommandozeile:

```bash
pnpm --filter @nw/server user role basil camp_nebel gm
pnpm --filter @nw/server user role sela camp_nebel player
pnpm --filter @nw/server user role sela camp_nebel none     # nimmt sie weg
```

`Visibility.audience: 'gm'` fragt seither: **hat dieser Betrachter in der
Kampagne, der der Artikel gehört, die Rolle `gm` oder `co-gm`?** Und wem er
gehört, sagt der Ebenenstapel — eine Ebene, die genau eine Kampagne
aufschaltet, gehört ihr; eine, die mehrere aufschalten, ist gemeinsam (siehe
[Ebenen.md](Ebenen.md)).

Für einen Tag stand die Leitung als `Access`-Karte an der Kampagne, davor die
Rolle der Spielenden als `Access`-Karte an der Figur. Beides war eine
Kontoangabe in einem Artikel: der Server las die Karte nie, und sie wäre mit
jeder Ausfuhr mitgewandert (REQ-199).

Das Sieb bekommt dafür die Rollen des Kontos mit, nicht nur die Figuren:
eine Leitung hat keine Figur. Das Wissen
fragt weiter nur nach den Figuren — was jemand erfahren hat, hat eine Figur
erfahren.

---

### Die Seite „Campaign" (W3)

Was die Kommandozeile mit `user role` und `user actor` tut, geht seit dem
13.10. auch über die Oberfläche (`/campaign`, Routen in
`apps/server/src/verwaltung.ts`). Die Regel ist dieselbe wie in CLAUDE.md:

| | sieht Mitglieder und Einladungen | ändert Rollen, Figuren, lädt ein, widerruft | sieht alle Konten, legt Kampagnen an |
|---|---|---|---|
| Verwaltung (`is_admin`) | jede Kampagne | jede Kampagne | ja |
| `gm` der Kampagne | ja | ja | nein |
| `co-gm` der Kampagne | ja | **nein** | nein |
| `player`, `spectator` | nein | nein | nein |

Drei Grenzen, die man leicht übersieht:

- **Eine Leitung ändert sich selbst nicht.** Wer sich zum Zuschauer macht,
  hat sich ausgesperrt; zurück käme er nur über die Verwaltung. Die
  Verwaltung darf es.
- **Keine Figur einer anderen Runde.** Wer eine Figur führt, darf sie
  schreiben (`mayWrite`). Vergeben darf eine Kampagne nur Figuren ohne
  Ebenenkante oder solche, deren Ebenen sie aufschaltet (`campaignsOf`);
  eine fremde Figur, die ein Mitglied schon führt, bleibt, auch wenn die
  Liste sie nicht nennt. Eine Leitung gibt sich selbst keine Figur — sie
  schreibt die Ebene ihrer Kampagne ohnehin (T-098, oben).
- **Die Kontoliste sieht nur die Verwaltung.** Eine Leitung nimmt ein
  bestehendes Konto beim Namen dazu oder lädt ein.

**Eine Einladung führt in eine Kampagne, mit der Rolle darin** (Migration
022: `app_invite.campaign_id`, `role`). Die Leitung, die nicht Verwaltung
ist, fände ein eingeladenes Konto sonst nirgends. Nach dem Einlösen steht
die Rolle am Konto (`campaign_member`) und nicht mehr an der Einladung — die
ist mit dem letzten Gebrauch weg. Der Link heisst `/login?invite=<code>` und
steht **einmal** da: gespeichert ist nur der Hash. Wer ihn verliert,
widerruft und legt einen neuen an.

```bash
pnpm --filter @nw/server user invite new --campaign camp_nebel --role player --uses 1 --days 7
```

Gibt es noch keine Kampagne (`Campaign`-Artikel), legt die Verwaltung auf
der Seite eine an und leitet sie auf Wunsch gleich selbst.

## Konten anlegen

Von der Kommandozeile, nicht über das Netz. Der erste Zugang muss irgendwo
herkommen, und jeder Weg dafür über HTTP ist eine Tür, die danach offen
bleibt. Wer auf dem Server eine Shell hat, kommt ohnehin an die Datenbank.

```bash
pnpm --filter @nw/server user add basil --admin
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
- **Und sie rechnet nicht aus, was jemand schreiben darf.** `/api/me` gibt
  `writable` mit — eine Liste von Ids, oder `null` für „alles" (die
  Verwaltung bekommt keine Aufzählung über den ganzen Bestand). Der Server
  wendet die Regel ohnehin an; sie in der Maske nachzurechnen wäre die zweite
  Stelle, an der jemand eine Kante vergisst, und dann stünde dort ein Knopf,
  den der Server danach abweist.

Eine Abmeldung, die der Server nicht bestätigt, meldet **lokal trotzdem ab**
und sagt es. Beides andere wäre falsch: weiter so tun, als wäre jemand da —
oder „abgemeldet" sagen, während die Sitzung dort weiterlebt.

---

## API-Tokens

Seit W9 (13.10.2026). Ein Werkzeug — ein Skript, eine Claude-Sitzung, die
Kommandozeile — hält keinen Keks. Es meldet sich mit einem **Token** an:

```
Authorization: Bearer atm_…
```

| | |
|---|---|
| wirkt wie | die Sitzung **seines Kontos**: dieselben Rollen, dieselben Figuren, dasselbe Sieb, dieselben Schreibrechte (`mayWrite`) |
| Rechte | `read` oder `write`. `read` darf alles lesen, was das Konto liest, und die zwei POST, die nichts schreiben: `/api/validate` und `/api/bulk` mit `dryRun: true` |
| Ablauf | immer — Vorgabe 30 Tage, höchstens 365. Ein Token, das ewig gilt, vergisst man in irgendeiner Umgebung |
| gespeichert | nur der Hash (`app_token.token_hash`), wie bei Sitzung und Einladung; der Klartext steht **genau einmal** in der Antwort auf das Anlegen |
| Präfix | `atm_` — damit man es erkennt, wo es auftaucht (Log, Umgebung, Chat) |

Drei Regeln, die man leicht weglässt:

- **Ein Token sieht und darf nie mehr als sein Konto.** Es gibt keine
  eigene Rechteprüfung für Tokens: der Server rechnet mit dem `User` des
  Kontos weiter, und `read` nimmt davon nur weg. Ist das Konto gesperrt,
  gilt das Token nicht.
- **Ein Token legt keine Tokens an.** Anlegen, ansehen und widerrufen
  geht nur aus einer angemeldeten Sitzung (Seite „Account") oder von der
  Kommandozeile. Sonst machte ein Lesetoken sich ein Schreibtoken, und aus
  einem verlorenen würden zehn.
- **Ein falsches Token ist niemand** — auch wenn daneben ein gültiger Keks
  mitkommt. Ein Werkzeug, das still als jemand anderes weiterläuft, sucht
  man lange.

```bash
pnpm --filter @nw/server user token werkbank new claude-dev --days 30 --write
pnpm --filter @nw/server user token werkbank list
pnpm --filter @nw/server user token werkbank drop tok_…
```

In der Seite: Klick auf den eigenen Namen in der Kopfleiste → **Account** →
API tokens. Wie die Leitung einer Claude-Sitzung damit Zugang zu dev gibt:
[Betrieb › Werkzeugzugang](Betrieb.md#werkzeugzugang).

**Die Werkbank** (Prüfungen `GET /api/checks`, Massenänderungen
`POST /api/bulk`) ist für Leitung (`gm`/`co-gm` in irgendeiner Kampagne)
und Verwaltung. Geschrieben wird trotzdem nur, was `mayWrite` dem Konto
erlaubt — die Leitung die Ebene ihrer Kampagne (T-098). Alles andere zeigt
die Vorschau als „Das gehört dir nicht."

---

## Was nicht mitwandert

**Zugänge sind keine Artikel.** Ein Artikel gehört der Kampagne und wandert
mit ihr; ein Zugang gehört der Instanz. `app_user`, `app_session`, `app_token` und
`login_attempt` sind eigene Tabellen (dazu `app_user_actor`,
`campaign_member`, `app_user_article`, wer was angelegt hat, und
`app_user_layer`, wer in welcher Ebene schreibt) und dürfen beim Spiegeln von prod nach
preprod ausdrücklich **nicht** mitwandern (REQ-199). In der Artikeltabelle
steht davon nichts — nur beim Nutzer steht die Id der Figur, die er spielt.
Darum steht auch in der eigenen Ausfuhr (`/api/export`) keins davon: sie
liest nur Register und Artikel.

`actor_id` hat bewusst keinen Fremdschlüssel: die Figur kann gelöscht und neu
eingelesen werden, und ein Zugang, der daran zerbricht, sperrt jemanden mitten
in der Sitzung aus.

---

### Die Sicht eines Mitglieds (REQ-241, E-019 a)

Die Leitung sieht die Kampagne **als ein bestimmtes Mitglied**: dieselben
Artikel, Felder und Entwürfe, dasselbe Wissen über seine Figuren, Gruppe
und Fraktion samt Rang, dieselbe Statusregel. Gemeint ist die Frage „warum
sieht Mara das nicht?".

- **Gerechnet am Server, als dieses Konto.** Die Oberfläche schickt je
  Anfrage den Kopf `X-View-As: <Konto-Id>`; der Server löst ihn dort auf,
  wo jede Route fragt, wer fragt (`viewerOf`). Liste, Suche, Artikel,
  Board, Werkbank und `/api/me` rechnen danach mit dem Zielkonto samt
  seinen Figuren (`app_user_actor`) und dem, was es angelegt hat. Eine
  eigene Spieleransicht gibt es nicht — es ist dieselbe Rechnung mit einem
  anderen Konto.
- **Wer darf:** die Verwaltung und die Leitung (`gm`, `co-gm`) der
  **laufenden** Kampagne, und nur für ein Mitglied dieser Kampagne
  (`mayViewAs`). Sonst `403` mit `code: 'view_as_forbidden'`. Die Leitung
  nimmt keine Verwaltung ein (die sieht alles), und vom Zielkonto zählt für
  sie nur die Rolle in der laufenden Kampagne — leitet das Ziel anderswo,
  sähe sie über eine geteilte Ebene sonst, was dort nur dessen Leitung
  sieht (`viewedAs`).
- **Nur lesen.** Jeder schreibende Aufruf mit dem Kopf wird abgelehnt
  (`403`, `code: 'view_as_read_only'`), auch die Tokens des Ziels — die
  gehören zum Konto, nicht zur Kampagne. `/api/me` sagt in dieser Sicht
  `viewAs: {id, name, role, by}` und bietet nichts zum Schreiben an.
- **Protokolliert:** eine Zeile `view_as.start` im Protokoll (`event_log`,
  `subject` = wer schaut, `payload.target`, `payload.campaign`) je Beginn —
  die erste Anfrage mit diesem Ziel oder die erste nach einer halben
  Stunde ohne.
- **In der Oberfläche:** auf der Kampagnenseite je Mitglied „View as" (der
  Server sagt je Mitglied, ob, `members[].viewAs`), oben ein fester Balken
  „Viewing as <Name> — Exit", Bearbeiten ausgeblendet. Der Wert hält je Tab
  über Seitenwechsel und Neuladen (`sessionStorage`), nicht über
  Abmelden.
- **Echtzeit-Ereignisse** gibt es noch nicht; wenn sie kommen, werden sie
  für das Zielkonto gefiltert wie jede andere Antwort.

## Was noch fehlt

- **Die Bereiche in der Oberfläche.** Anmeldung, Liste, Artikelansicht und
  Bearbeiten stehen; Karten, Bogen, Inventar, Boards und Handwerk sind im
  Prototyp und noch nicht dort.
- **Artikel ohne Ebene** schreibt nur die Verwaltung; die Leitung ändert
  sie als Fassung in der Ebene ihrer Kampagne (T-098). Ob sie mit der
  Kampagne wandern sollen, hängt an der offenen Frage unten.
- **Die laufende Kampagne ist eine globale Einstellung.** `currentCampaign()`
  liest `setting('campaign')` — wer umschaltet, schaltet für alle um.
  Solange das so ist, gibt es faktisch eine Kampagne. Sie muss der
  Betrachter mitbringen: die, in denen er leitet, plus die, in deren Stapel
  seine Figur liegt.
- **Ohne Ebenenkante gehört ein Artikel niemandem besonders** — heute 65 von
  75. Das stimmt bei *einer* Kampagne; bei zweien braucht jede ihre eigene
  Ebene, und die Umkehrung kostet eine Wanderung.
- **`gmFields`** („was nie an einen Spieler geht") gilt installationsweit.
  Mit mehreren Kampagnen heisst es „nie an jemanden ausserhalb dieser".
- **Einen zweiten Blick auf das Sieb.** `redactEntity` hält Felder, Blöcke
  und den Namen zurück; die Kanten bleiben, weil eine verborgene Verbindung
  den Rückbezug am anderen Ende mitverbergen müsste und das eine andere
  Frage ist. Ob das die richtige Grenze ist, entscheidet sich am Tisch.
