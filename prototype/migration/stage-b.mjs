/* Etappe B als reine Registerzeilen: Geschichts- und Spielerartikel.
   Liest den Live-Stand, ergänzt ihn, schreibt nichts von sich aus zurück —
   die Ausgabe wird geprüft, bevor sie in die Datenbank geht. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EIN = process.argv[2], AUS = process.argv[3];
const lies = (n) => JSON.parse(readFileSync(join(EIN, 'registry', `${n}.json`), 'utf8'));
const ifs = lies('interfaces'), comps = lies('components'), rels = lies('relations');

/* ---------- Komponenten ---------- */
const neueComps = {
  StoryInfo: {
    label: 'Story', engine: null,
    schema: { type: 'object', properties: {
      kind: { type: 'string', title: 'Kind', enum: ['campaign', 'arc', 'chapter', 'session', 'scene'] },
      played: { type: 'string', title: 'Played on' },
      state: { type: 'string', title: 'State', enum: ['planned', 'running', 'played', 'dropped'], default: 'planned' },
      summary: { type: 'string', title: 'Recap', format: 'long' },
    } } },
  SceneInfo: {
    label: 'Scene', engine: null,
    schema: { type: 'object', properties: {
      mode: { type: 'string', title: 'Mode', enum: ['roleplay', 'encounter', 'exploration', 'downtime'], default: 'roleplay' },
      difficulty: { type: 'string', title: 'Difficulty' },
      readaloud: { type: 'string', title: 'Read aloud', format: 'long' },
    } } },
  QuestInfo: {
    label: 'Quest', engine: null,
    schema: { type: 'object', properties: {
      state: { type: 'string', title: 'State', enum: ['rumoured', 'offered', 'accepted', 'done', 'failed', 'abandoned'], default: 'rumoured' },
      reward: { type: 'string', title: 'Reward' },
      deadline: { type: 'string', title: 'Deadline' },
    } } },
  CharacterInfo: {
    label: 'Character', engine: null,
    schema: { type: 'object', properties: {
      player: { type: 'string', title: 'Player' },
      ancestry: { type: 'string', title: 'Ancestry' },
      class: { type: 'string', title: 'Class' },
      level: { type: 'number', title: 'Level', default: 1 },
      /* Der Übungsbonus folgt der Stufe — 5e-Formel, auf ganze Zahlen
         abgeschnitten wie jeder abgeleitete Wert. */
      proficiency: { type: 'number', title: 'Proficiency', format: 'signed', derived: '2+(level-1)/4' },
    } } },
  PartyInfo: {
    label: 'Party', engine: null,
    schema: { type: 'object', properties: {
      level: { type: 'number', title: 'Party level' },
      motto: { type: 'string', title: 'Motto' },
    } } },
  InventoryInfo: {
    label: 'Inventory', engine: null,
    schema: { type: 'object', properties: {
      capacity: { type: 'number', title: 'Slots' },
      copper: { type: 'number', title: 'Purse in copper' },
    } } },
};

/* ---------- Schnittstellen ----------
   Zwei abstrakte Eltern, damit Kanten und Ansichten einmal gesetzt werden
   und für alles darunter gelten. Ohne sie müsste jede Kante jeden der elf
   Typen einzeln aufzählen. */
const neueIfs = {
  Story: { name: 'Story', label: 'Story', abstract: true, extends: ['Base'],
    requires: [], allows: ['StoryInfo'], blockTypes: ['+lore', '+secret', '+readaloud', '+note'] },
  Campaign: { name: 'Campaign', label: 'Campaign', extends: ['Story'], requires: [], allows: [], blockTypes: [] },
  Arc:      { name: 'Arc', label: 'Arc', extends: ['Story'], requires: [], allows: [], blockTypes: [] },
  Chapter:  { name: 'Chapter', label: 'Chapter', extends: ['Story'], requires: [], allows: [], blockTypes: [] },
  Session:  { name: 'Session', label: 'Session', extends: ['Story'], requires: [], allows: [], blockTypes: ['+recap'] },
  Scene:    { name: 'Scene', label: 'Scene / Encounter', extends: ['Story'], requires: [], allows: ['SceneInfo'], blockTypes: ['+tactics'] },
  Quest:    { name: 'Quest', label: 'Quest', extends: ['Base'], requires: ['QuestInfo'], allows: [], blockTypes: ['+lore', '+secret'] },

  /* NPC bleibt, wie es ist — ein abstrakter Elternteil darüber statt einer
     Umbenennung. Ein Spielercharakter, der von „NPC" erbt, läse sich falsch;
     sieben vorhandene Artikel umzuschreiben wäre teurer als eine Zeile. */
  Creature: { name: 'Creature', label: 'Creature', abstract: true, extends: ['Base'],
    requires: [], allows: ['CreatureInfo', 'Vars'], blockTypes: ['+appearance', '+personality', '+lore', '+fact', '+secret', '+readaloud'] },
  PlayerCharacter: { name: 'PlayerCharacter', label: 'Player character', extends: ['Creature'],
    requires: ['CharacterInfo'], allows: [], blockTypes: ['+backstory'] },
  Companion: { name: 'Companion', label: 'Companion', extends: ['Creature'], requires: [], allows: [], blockTypes: [] },
  Retainer:  { name: 'Retainer', label: 'Retainer', extends: ['Creature'], requires: [], allows: [], blockTypes: [] },

  Party:     { name: 'Party', label: 'Party', extends: ['Base'], requires: [], allows: ['PartyInfo'], blockTypes: ['+lore', '+note'] },
  Inventory: { name: 'Inventory', label: 'Inventory', extends: ['Base'], requires: [], allows: ['InventoryInfo'], blockTypes: ['+note'] },
};

/* ---------- Kanten ----------
   Die Hierarchie ist `partOf`, wie überall: Szene › Session › Kapitel › Arc
   › Kampagne. Kein Behälterkonstrukt — das wäre das erste Element, das dem
   Rückgrat nicht folgt. */
const neueRels = {
  playedBy:   { label: 'played by', inverseLabel: 'plays', from: ['PlayerCharacter'], to: ['*'], cardinality: 'one' },
  memberOfParty: { label: 'in the party', inverseLabel: 'members', from: ['Creature'], to: ['Party'] },
  carries:    { label: 'carries', inverseLabel: 'carried by', from: ['Creature', 'Party'], to: ['Inventory'], cardinality: 'one' },
  holds:      { label: 'holds', inverseLabel: 'held in', from: ['Inventory'], to: ['Item'] },
  followsFrom:{ label: 'follows', inverseLabel: 'followed by', from: ['Story'], to: ['Story'], cardinality: 'one' },
  questGiver: { label: 'given by', inverseLabel: 'gives', from: ['Quest'], to: ['Creature', 'Faction'] },
  questAbout: { label: 'concerns', inverseLabel: 'concerned by', from: ['Quest'], to: ['*'] },
  happensAt:  { label: 'happens at', inverseLabel: 'scenes here', from: ['Story'], to: ['Place'] },
  features:   { label: 'features', inverseLabel: 'appears in', from: ['Story'], to: ['Creature', 'NPC', 'Statblock', 'Faction'] },
};

/* `partOf` gab es schon für Orte — die Geschichtskette hängt sich daran,
   statt eine zweite Hierarchie danebenzustellen. */
const partOf = rels.partOf;
if (!partOf) throw new Error('partOf fehlt — die Hierarchie hätte kein Zuhause');
partOf.from = [...new Set([...(partOf.from ?? []).filter((x) => x !== '*'), 'Place', 'Story', 'Quest'])];
partOf.to = [...new Set([...(partOf.to ?? []).filter((x) => x !== '*'), 'Place', 'Story'])];

for (const [k, v] of Object.entries(neueComps)) { if (comps[k]) throw new Error('Komponente existiert schon: ' + k); comps[k] = v; }
for (const [k, v] of Object.entries(neueIfs))   { if (ifs[k])   throw new Error('Schnittstelle existiert schon: ' + k); ifs[k] = v; }
for (const [k, v] of Object.entries(neueRels))  { if (rels[k])  throw new Error('Kantenart existiert schon: ' + k); rels[k] = v; }

/* NPC unter Creature hängen: additiv, ohne einen Artikel anzufassen. */
ifs.NPC.extends = ['Creature'];
/* Beide hiessen „Creature" — der abstrakte Elternteil und NPC, dessen Label
   noch aus der Zeit stammt, als er der einzige Geschöpftyp war. Im Auswahl-
   feld standen sie dann zweimal gleich da. */
ifs.NPC.label = 'NPC';
ifs.NPC.allows = (ifs.NPC.allows ?? []).filter((c) => c !== 'CreatureInfo' && c !== 'Vars');
ifs.NPC.blockTypes = [];

mkdirSync(join(AUS, 'registry'), { recursive: true });
const schreib = (n, o) => writeFileSync(join(AUS, 'registry', `${n}.json`), `${JSON.stringify(o, null, 2)}\n`);
schreib('interfaces', ifs); schreib('components', comps); schreib('relations', rels);
console.log('Schnittstellen:', Object.keys(ifs).length, '· Komponenten:', Object.keys(comps).length, '· Kantenarten:', Object.keys(rels).length);
