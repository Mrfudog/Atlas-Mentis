/*
  Erzeugt docs/Anforderungen.md: jede REQ-Nummer aus dem Vault
  (`Mrfudog/atlas-mentis`, VTT/Requirements.md) und aus der Ernte
  (docs/Requirements from Kanalgang.md), mit dem Stand im Repo.

  Der Stand ist eine Zuordnung in dieser Datei — ein Urteil, keine Messung.
  Darum steht er hier und nicht im Katalog-Erzeuger: wer eine Zeile anders
  sieht, ändert sie in `STAND` und lässt das Skript laufen.

  Aufruf: node scripts/anforderungen.mjs [pfad-zum-vault/VTT/Requirements.md]
  Ohne Pfad wird der Vault neben dem Repo gesucht (../atlas-mentis).
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HIER, '..', '..', '..');
const VAULT = resolve(process.argv[2] ?? join(REPO, '..', 'atlas-mentis', 'VTT', 'Requirements.md'));
const vault = readFileSync(VAULT, 'utf8');
const ernte = readFileSync(join(REPO, 'docs', 'Requirements from Kanalgang.md'), 'utf8');

const reqs = new Map();
for (const line of vault.split('\n')) {
  const m = line.match(/^\| \*\*(REQ-\d{3})\*\* \| (.+?) \| (\d) \| (\d+) \|/);
  if (m) reqs.set(m[1], { text: m[2], prio: m[3], quelle: 'Vault' });
}
for (const line of ernte.split('\n')) {
  const m = line.match(/^\| (REQ-\d{3}) \| (.+?) \| (\d) \| (\d+) \|/);
  if (m && !reqs.has(m[1])) reqs.set(m[1], { text: m[2], prio: m[3], quelle: 'Ernte' });
}

/* steht · teils · offen · ersetzt · verworfen */
const STAND = {
  'REQ-001': ['steht', 'Peg, Karten, Kanten, Register — Datenmodell.md §1–5'],
  'REQ-002': ['ersetzt', 'keine Nachfolgerkette; Fassungen über `overrides` und `variantOf` in Ebenen'],
  'REQ-003': ['teils', 'Server schreibt `event_log` (`entity.written`, `entity.deleted`); keine Anzeige, keine Kette'],
  'REQ-004': ['steht', '`Layer.kind` system · expansion · world · pack · campaign · overrides, `order`, `version`'],
  'REQ-005': ['steht', '`inLayer` mit `mode` adds/removes; Überschreiben ist die Kante `overrides`; kein Pin'],
  'REQ-006': ['teils', 'Prototyp: `inStack`/`resolveArticle`; Server kennt nur die Zugehörigkeit (`campaignsOf`) — Abgleich A2'],
  'REQ-007': ['offen', ''],
  'REQ-008': ['teils', 'Kante `variantOf` da; kein Kopierknopf'],
  'REQ-009': ['steht', '`overrides` in einer Ebene, Auflösung im Prototyp'],
  'REQ-010': ['steht', 'als Grundtypen: `Visibility`, `Status`, `Time`'],
  'REQ-011': ['ersetzt', 'ein Textblock ist ein Feld (`many` + `long`) mit Eintrags-Id; gesperrt wird je Eintrag über eine Information'],
  'REQ-012': ['steht', 'als Prosafelder: paragraph, readaloud, fact, secret, lore, tactics, note, poem, song, appearance, personality'],
  'REQ-013': ['teils', '`[[Verweise]]` nach Name und Alias, Vorschläge beim Tippen, `Rule.autolink`; kein Auto-Link beim Schreiben'],
  'REQ-014': ['steht', 'Rückbezüge in der Seitenleiste (`backlinks`)'],
  'REQ-015': ['offen', 'Typdiagramm steht (Register › How it works); Artikelgraph nicht — Aufgabe #44'],
  'REQ-016': ['verworfen', 'keine Übersetzungsschicht; Bezeichner englisch, Inhalte in der Sprache der Kampagne'],
  'REQ-017': ['offen', ''],
  'REQ-018': ['offen', 'keine `effects[]`; Regeln sind Text mit `{VAR}`'],
  'REQ-019': ['verworfen', 'die Importer sind weg (2026-09-20), mit ihnen `Imported`; kommt mit neuen Importern zurück'],
  'REQ-020': ['steht', '`Source`: publication, page, anchor, url'],
  'REQ-021': ['steht', '`Asset`: backend app/external, ref, mime, width, height, bytes'],
  'REQ-022': ['offen', ''],
  'REQ-023': ['ersetzt', '`State`: idea · prepared · ready; used/discarded waren Ereignisse und sind das Feld der Art (`Quest.progress`, `Encounter.phase`)'],
  'REQ-024': ['steht', '`Time.sort` (sortierbar), `Time.display`, `Time.calendar`'],
  'REQ-025': ['offen', 'nur die Einstellung `calendar`; keine Kalenderzeile'],
  'REQ-026': ['steht', 'drei Ansichten, Anordnung am Typ (`InterfaceDef.views`)'],
  'REQ-027': ['steht', 'das Register ist Daten mit Masken (Prototyp); keine Codeänderung je Art'],
  'REQ-028': ['teils', 'Suche über Name, Marken und Feldwerte im Kompendium; keine Volltextindizierung am Server'],
  'REQ-029': ['steht', 'Ausfuhr/Einfuhr als eine Datei; Register allein (`register-datei.mjs`)'],
  'REQ-030': ['ersetzt', 'Kante `regards` mit Marken (Beziehungen.md)'],
  'REQ-031': ['steht', 'Argon2id, Sitzung beim Server (Zugang.md)'],
  'REQ-032': ['verworfen', 'Entscheidung 2 (19.9.): kein SSO'],
  'REQ-033': ['steht', '`app_user`'],
  'REQ-034': ['steht', 'Einladung, Konto selbst anlegen'],
  'REQ-035': ['steht', '`campaign_member (campaign, user, role)`; Scope ist die Kampagne'],
  'REQ-036': ['steht', 'gm · co-gm · player · spectator; `is_admin` global'],
  'REQ-037': ['steht', ''],
  'REQ-038': ['steht', '`audience`, am Server ausgewertet (`articleVisible`)'],
  'REQ-039': ['ersetzt', 'drei Felder statt sechs; scope, Rollenlisten, sharedUsers weg (30.9.)'],
  'REQ-040': ['steht', 'anders: `Information`/`Knowledge` als Artikel, `knownBy` an Träger'],
  'REQ-041': ['teils', 'Verwaltung oder eigene Figur (+ carries/holds/crafting); die Leitung fehlt in `mayWrite`'],
  'REQ-042': ['offen', ''],
  'REQ-043': ['steht', 'Registerteil `settings`'],
  'REQ-044': ['steht', 'Herkunft am Artikelkopf, Ansicht `stack`'],
  'REQ-045': ['offen', ''],
  'REQ-046': ['steht', '`belongsTo`, `PlayerCharacter`; NPC ist `Creature.kind`'],
  'REQ-047': ['verworfen', 'Importer entfernt; wiederkommen heisst neu schreiben'],
  'REQ-048': ['steht', 'Bearbeiten in der Ansicht und im Dialog'],
  'REQ-049': ['steht', 'Anlegedialog mit Statblock-Frage, Schnellanlage aus einem Verweis'],
  'REQ-050': ['steht', 'Reiter Overview · Combat · Gear · Craft · Ties'],
  'REQ-051': ['steht', '`Vitals` mit `alwaysEdit`, Bogen'],
  'REQ-052': ['steht', 'Statblock-Seite mit eingesetzten Regeln'],
  'REQ-053': ['steht', '`composedOf` mit `{VAR}`-Bindung'],
  'REQ-054': ['steht', '`Statblock.combatRole`'],
  'REQ-055': ['offen', 'Pool steht; Variante beim Tippen nicht'],
  'REQ-056': ['offen', ''],
  'REQ-057': ['offen', ''],
  'REQ-058': ['offen', ''],
  'REQ-059': ['steht', '`Facts.fact#id` über eine Information'],
  'REQ-060': ['teils', '`Creature.kind` companion/summon; keine `companionOf`-Kante'],
  'REQ-061': ['steht', '`owes`, `memberOf`, `livesIn`, `regards`'],
  'REQ-062': ['offen', '`Statblock.system` als Feld vorhanden'],
  'REQ-063': ['steht', ''],
  'REQ-064': ['steht', '`holds.tier`, `holds.slot`'],
  'REQ-065': ['steht', 'Kachelraster, `Item.rows`, `Inventory.grid`/`zones`'],
  'REQ-066': ['steht', 'Reiter Combat; Initiative am Spieltisch'],
  'REQ-067': ['offen', 'es gibt keine Art für Zauber — Abgleich A9'],
  'REQ-068': ['offen', ''],
  'REQ-069': ['teils', 'Prototyp passt sich an; `apps/web` ist noch klein'],
  'REQ-070': ['steht', ''],
  'REQ-071': ['steht', 'Würfe über den Raum-Kanal, Protokoll'],
  'REQ-072': ['offen', '`Notes` an Artikeln; kein eigener Notizartikel je Spieler'],
  'REQ-073': ['ersetzt', 'die Anordnung steht am Typ im Register, nicht je Nutzer'],
  'REQ-074': ['teils', 'Bereich Play und die Leiste'],
  'REQ-075': ['steht', '`Campaign`, `settings`, Zeitleiste'],
  'REQ-076': ['steht', '`Story`: Campaign · Arc · Chapter · Session · Scene, Hierarchie über `partOf`'],
  'REQ-077': ['steht', '`Session`, `Encounter.phase`'],
  'REQ-078': ['steht', 'Element `prep`'],
  'REQ-079': ['teils', 'Wissen zuteilen im Seitenpanel; kein Ein-Tipp-Knopf in der Sitzung'],
  'REQ-080': ['offen', ''],
  'REQ-081': ['ersetzt', 'siehe REQ-030'],
  'REQ-082': ['steht', '`Quest.tasks`, `reward`, `restriction`; Auftragsbrett'],
  'REQ-083': ['offen', 'Spieler schreiben nur ihre Figur'],
  'REQ-084': ['steht', 'Unfinished, Todos'],
  'REQ-085': ['steht', '`Encounter`, `participates`, `onMap`, `loot`, `tableFor`'],
  'REQ-086': ['teils', 'Party-Seite mit Inventar und Werkbank; keine Übersicht der passiven Wahrnehmung'],
  'REQ-087': ['offen', ''],
  'REQ-088': ['teils', 'Massenbearbeitung ohne Wissen'],
  'REQ-089': ['steht', '`Rule`, `Feat`, `Skill`'],
  'REQ-090': ['verworfen', 'siehe REQ-047'],
  'REQ-091': ['steht', 'Bereich Rules mit Filter'],
  'REQ-092': ['offen', 'keine Art für Zauber — Abgleich A9'],
  'REQ-093': ['offen', ''],
  'REQ-094': ['steht', '`hasProperty`, `composedOf`; die Ebene über `inLayer`'],
  'REQ-095': ['offen', ''],
  'REQ-096': ['offen', ''],
  'REQ-097': ['offen', 'braucht REQ-092'],
  'REQ-098': ['steht', 'Verweise im Text, Merkzettel'],
  'REQ-099': ['steht', 'Merkzettel (pinned)'],
  'REQ-100': ['teils', '`Layer.kind: world`; keine Mitglieder je Welt'],
  'REQ-101': ['steht', '`Article` mit poem/song'],
  'REQ-102': ['teils', 'Prototyp ja; Server ohne Stapel — Abgleich A2'],
  'REQ-103': ['steht', '`Place.kind`, `environment`, `partOf`'],
  'REQ-104': ['steht', '`Faction.kind`, `controls`, `memberOf`'],
  'REQ-105': ['steht', 'Kompendium nach Art gefiltert'],
  'REQ-106': ['steht', '`Event`, `Time`, Element `timeline`'],
  'REQ-107': ['offen', 'eine Zeile, wenn gebraucht'],
  'REQ-108': ['steht', '`overrides` in der Kampagnenebene'],
  'REQ-109': ['teils', 'Felder da (`Article.poem/song`); Schreibrecht offen (REQ-041)'],
  'REQ-110': ['offen', 'Aufgabe #59 Portal'],
  'REQ-111': ['steht', '`Board`, `placed`'],
  'REQ-112': ['ersetzt', 'Platzierungen auf dem Board'],
  'REQ-113': ['offen', 'Aufgabe #58'],
  'REQ-114': ['teils', 'Anlegen aus dem Board'],
  'REQ-115': ['steht', '`participates` mit init, hp, conditions'],
  'REQ-116': ['steht', '`Session.activeMap/activeEncounter/activeScene`; Raum-Kanal für Augenblicke'],
  'REQ-117': ['steht', '`Session.stewardship` gm/table'],
  'REQ-118': ['steht', 'Begegnung mit Teilnehmern und Tabellen'],
  'REQ-119': ['offen', ''],
  'REQ-120': ['teils', 'Würfe im Protokoll; Zustandsereignisse nicht gespeichert'],
  'REQ-121': ['offen', ''],
  'REQ-122': ['steht', 'Party-Seite'],
  'REQ-123': ['offen', ''],
  'REQ-124': ['steht', 'Element `quests`'],
  'REQ-125': ['steht', '`Table.kind` loot · encounter · name · shop · event · generic'],
  'REQ-126': ['teils', '`Session.nowPlaying` als Feld; kein Einbetten'],
  'REQ-127': ['offen', ''],
  'REQ-128': ['teils', 'dieselbe Ansicht, gesiebt'],
  'REQ-129': ['offen', ''],
  'REQ-130': ['steht', '`Map` mit Gitter, Massstab, `mapOf`'],
  'REQ-131': ['steht', '`insideMap` mit Rahmen, Hineinzoomen'],
  'REQ-132': ['offen', ''],
  'REQ-133': ['steht', '`marker`'],
  'REQ-134': ['steht', '`marker.kind: scenery`'],
  'REQ-135': ['teils', 'Tokens als Kanten; keine getrennte Lebensdauer je Sitzung'],
  'REQ-136': ['steht', 'Gruppen-Token, `{PARTYWHERE}`'],
  'REQ-137': ['teils', '`territory` von Hand; keine Abfrage'],
  'REQ-138': ['steht', '`Map.tiles`'],
  'REQ-139': ['steht', '`Map.reveal`'],
  'REQ-140': ['steht', '`marker.light/dim`, `Map.walls`, `visionPoly`'],
  'REQ-141': ['offen', ''],
  'REQ-142': ['offen', 'Aufgabe #60'],
  'REQ-143': ['offen', ''],
  'REQ-144': ['steht', ''],
  'REQ-145': ['teils', 'Assets als Artikel; Ablage im Artefakt'],
  'REQ-146': ['offen', ''],
  'REQ-147': ['teils', 'Prototyp ja; Server noch nicht'],
  'REQ-148': ['steht', '`Asset.backend: external`'],
  'REQ-149': ['offen', ''],
  'REQ-150': ['offen', ''],
  'REQ-151': ['offen', ''],
  'REQ-152': ['offen', ''],
  'REQ-153': ['ersetzt', 'Oberfläche englisch (19.9.)'],
  'REQ-154': ['steht', 'Hetzner, Caddy, GHCR (Betrieb.md)'],
  'REQ-155': ['steht', 'Sicherung vor jedem Ausrollen; nächtliche als Rezept'],
  'REQ-156': ['verworfen', '`inherit` bewusst weg — kommt mit einer Tiefe wieder, wenn gebraucht'],
  'REQ-157': ['steht', '`placed` mit x, y, w, h, z'],
  'REQ-158': ['steht', '`placed.view`'],
  'REQ-159': ['steht', '`Board.anchors`'],
  'REQ-160': ['teils', ''],
  'REQ-161': ['steht', '`Board.rules`, `placed.view`'],
  'REQ-162': ['offen', ''],
  'REQ-163': ['steht', 'undurchsichtige Id; `Identity.id` als Nummer'],
  'REQ-164': ['ersetzt', 'drei Ansichten; Bild, Token, Karte sind Elemente'],
  'REQ-165': ['steht', '`Board.shapes`, Assets als Platzierung'],
  'REQ-166': ['teils', 'Anlegen auf dem Board'],
  'REQ-167': ['offen', ''],
  'REQ-168': ['steht', '`route` mit signal, `Place.state`'],
  'REQ-169': ['steht', '`Place.state` hidden · discovered · explored'],
  'REQ-170': ['steht', 'Einstellungen `travel*`, `Party.sinceRation/sinceLight`'],
  'REQ-171': ['steht', '`Party.actions`'],
  'REQ-172': ['steht', '`entry.weight`, `requiresTag`, `tableFor`'],
  'REQ-173': ['offen', ''],
  'REQ-174': ['steht', '`{VAR}`: Kante → Artikel → Kampagnenwerte → Register'],
  'REQ-175': ['steht', '`Rule.autolink`'],
  'REQ-176': ['teils', 'Vorschläge nach Name und Alias; keine Ähnlichkeit'],
  'REQ-177': ['steht', '`Information.fields` je Feld und je Eintrag'],
  'REQ-178': ['steht', '`Identity.cover`'],
  'REQ-179': ['steht', '„…and 3 more things"'],
  'REQ-180': ['offen', 'keine Art und kein Feld für gepflanzte Fäden'],
  'REQ-181': ['steht', '`adhoc` mit Befördern'],
  'REQ-182': ['steht', '`inverseLabel`'],
  'REQ-183': ['steht', '`carries` von `Party`'],
  'REQ-184': ['steht', '`Recipe`, `needs`, `yields`, `crafting`'],
  'REQ-185': ['offen', ''],
  'REQ-186': ['steht', '`entry` auf eine Tabelle'],
  'REQ-187': ['offen', ''],
  'REQ-188': ['steht', 'Unfinished'],
  'REQ-189': ['steht', '`Todos`, gesammelt'],
  'REQ-190': ['steht', 'Schnellerfassung an der Sitzung'],
  'REQ-191': ['steht', 'Fail-closed im Prototyp'],
  'REQ-192': ['teils', 'Prototyp; Server ohne Revisionsprüfung'],
  'REQ-193': ['steht', '`territory`'],
  'REQ-194': ['offen', ''],
  'REQ-195': ['offen', ''],
  'REQ-196': ['offen', ''],
  'REQ-197': ['offen', ''],
  'REQ-198': ['offen', ''],
  'REQ-199': ['steht', 'Rezept in Betrieb.md, ohne Konten; `members` nicht in der Ausfuhr'],
  'REQ-200': ['offen', ''],
  'REQ-201': ['offen', ''],
  'REQ-202': ['offen', ''],
};

const z = [];
const w = (s = '') => z.push(s);
w('# Anforderungen — was gefordert war und was steht');
w();
w(`Stand ${new Date().toISOString().slice(0, 10)}. Jede Nummer aus dem Vault ` +
  '([`Mrfudog/atlas-mentis`](https://github.com/Mrfudog/atlas-mentis), `Requirements.md` v0.6) und aus der Ernte');
w('([Requirements from Kanalgang.md](Requirements%20from%20Kanalgang.md)), mit dem Stand im Repo.');
w('Erzeugt von `packages/registry/scripts/anforderungen.mjs` aus einer Zuordnung, die ein Urteil ist:');
w('wer eine Zeile anders sieht, ändert sie dort und lässt das Skript laufen.');
w();
w('| Stand | Heisst |');
w('|---|---|');
w('| **steht** | gebaut, in der Form der Anforderung oder einer gleichwertigen |');
w('| **teils** | ein Teil steht; was fehlt, steht in der Anmerkung |');
w('| **offen** | nichts davon steht |');
w('| **ersetzt** | anders gelöst als gefordert, mit Absicht — die Anmerkung sagt wie |');
w('| **verworfen** | entschieden gegen die Anforderung |');
w();
const zaehl = {};
for (const id of reqs.keys()) { const s = STAND[id]?.[0] ?? '?'; zaehl[s] = (zaehl[s] ?? 0) + 1; }
w('Zusammen: ' + Object.entries(zaehl).map(([s, n]) => `**${n}** ${s}`).join(' · ') + ` — ${reqs.size} Anforderungen.`);
w();
w('## Aus den Gesprächen (September und Oktober 2026)');
w();
w('Was nicht als Nummer im Vault steht, sondern hier entschieden wurde — alles gebaut:');
w();
w('| Wann | Entscheidung | Wo |');
w('|---|---|---|');
w('| 19.9. | Prototyp bleibt Artefakt; Zugang ein Passwort je Nutzer, kein SSO; Bearbeiten per Klick aufs Feld; Wissen über ein Seitenpanel; Massenbearbeitung; Session als Artikel | Roadmap.md |');
w('| 19.9. | Oberfläche und Bezeichner englisch | CLAUDE.md |');
w('| 20.9. | Importer weg, `Imported` weg; Register steht einmal (`emit-seed`) | CLAUDE.md |');
w('| 20.9. | Komponenten weg, Arten tragen ihre Felder (D27); `extends` ist ein Array | Roadmap.md D25, D27 |');
w('| 21.9. | Aufzählungszeilen (`enums`), Spannen, Übungen in einem Feld; Identity.key wird Identity.id | Begriffe.md |');
w('| 30.9. | Sichtbarkeit: `public` ist die Vorgabe, drei Felder, keine Vererbung; `is_gm` heisst `is_admin` | Durchgang.md |');
w('| 30.9. | Eine Leitung je Kampagne; wem ein Artikel gehört, sagt die Ebene | Ebenen.md |');
w('| 1.10. | Rollen am Konto (`campaign_member`), `Access` weg | Zugang.md |');
w('| 1.10. | Ohne Statblock keine Zahlen; Anlegen oder aus einer Vorlage; Kreaturen ohne Statblock in der Vorbereitung | Begriffe.md |');
w('| 1.10. | Hetzner: `preprod` → dev, `main` → prod, nur CI baut; Durchstich gegen Postgres | Betrieb.md |');
w('| 1.10. | Vorlage und Instanz: eine Instanz je Kreatur, nur Abweichungen gespeichert | Datenmodell.md §7 |');
w('| 7.10. | Vorschläge nur, wo das Feld es sagt (`suggest`); der Deckname ist keine Sorte | Begriffe.md |');
w();
w('## Die Nummern');
w();
w('| ID | Anforderung | Prio | Stand | Anmerkung |');
w('|---|---|---|---|---|');
for (const [id, r] of [...reqs].sort(([a], [b]) => a.localeCompare(b))) {
  const [stand, note] = STAND[id] ?? ['?', 'nicht zugeordnet'];
  const text = r.text.replace(/\|/g, '\\|').replace(/`/g, '`');
  w(`| ${id} | ${text} | ${r.prio} | **${stand}** | ${note} |`);
}
w();
w('## Was offen ist und wehtut');
w();
w('Offene Anforderungen mit Priorität 1 bis 3, nach Bereich:');
w();
const offen = [...reqs].filter(([id]) => (STAND[id]?.[0] === 'offen' || STAND[id]?.[0] === 'teils') && Number(reqs.get(id).prio) <= 3)
  .sort(([a], [b]) => Number(reqs.get(a).prio) - Number(reqs.get(b).prio) || a.localeCompare(b));
for (const [id, r] of offen) w(`- **${id}** (${r.prio}, ${STAND[id][0]}) — ${r.text}${STAND[id][1] ? ` — *${STAND[id][1]}*` : ''}`);
w();
writeFileSync(join(REPO, 'docs', 'Anforderungen.md'), z.join('\n') + '\n');
console.log(`geschrieben: ${reqs.size} Anforderungen, ${z.length} Zeilen`);
const fehlt = [...reqs.keys()].filter((id) => !STAND[id]);
if (fehlt.length) console.log('ohne Stand: ' + fehlt.join(', '));
const zuviel = Object.keys(STAND).filter((id) => !reqs.has(id));
if (zuviel.length) console.log('Stand ohne Anforderung: ' + zuviel.join(', '));
