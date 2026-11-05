-- Erfassungsansichten „Roleplay“ und „Fight“ für Kreaturen (T-462, REQ-461).
--
-- Zwei Ansichten der Gruppe `createFull` mit Geltung: „Roleplay“ für
-- Kreaturen (nach dem Universal Roleplaying Template von The Alexandrian),
-- „Fight“ für Kreaturen und Statblöcke. Dazu die Felder, die „Roleplay“
-- fragt: `Creature.background`, `keyInfo` und `agenda` kommen neu;
-- `personality` heisst jetzt „Roleplaying“ (der Schlüssel bleibt, die
-- Einträge auch); je Feld ein Hilfetext (`description`), der beim Fokus
-- erscheint. Der Seed schreibt nur in eine leere Datenbank, also kommt es
-- hier nach.
--
-- Steht eine gleichnamige Ansicht schon da, bleibt sie. Ein Feld, das es
-- schon gibt, bekommt nur Titel und Hilfetext. Entfernt wird nichts, kein
-- Artikel wird geändert.

insert into view_def (key, label, ord, config)
select 'roleplay', 'Roleplay', 8,
 '{"label":"Roleplay","order":8,"group":"createFull","applies":{"types":["Creature"]},"defaultIn":["world","story","Story","Arc","Scene","Session","Place"],"fields":"none","description":true,"composed":false,"relations":true,"bindings":false,"image":true,"layout":[{"id":"rp-who","el":"section","text":"Who they are","children":[{"id":"rp-img","el":"image"},{"id":"rp-desc","el":"description"},{"id":"rp-f","el":"fields","fields":["Creature.kind","Creature.role","Creature.species","Creature.attitude"]}]},{"id":"rp-play","el":"section","text":"At the table","children":[{"id":"rp-p","el":"prose","fields":["Creature.appearance","Creature.personality","Creature.background","Creature.keyInfo"]},{"id":"rp-agenda","el":"fields","fields":["Creature.agenda"]},{"id":"rp-secrets","el":"prose","fields":["Secrets.secret"]}]},{"id":"rp-ties","el":"section","text":"Relationships","children":[{"id":"rp-stand","el":"standing"},{"id":"rp-r","el":"relations"}]}]}'::jsonb
 where exists (select 1 from interface_def)
on conflict (key) do nothing;

insert into view_def (key, label, ord, config)
select 'fight', 'Fight', 9,
 '{"label":"Fight","order":9,"group":"createFull","applies":{"types":["Creature","Statblock"]},"defaultIn":["play","rules","Encounter","Map","Statblock"],"fields":"none","description":false,"composed":true,"relations":true,"bindings":false,"image":false,"layout":[{"id":"fi-sb","el":"section","text":"Statblock","children":[{"id":"fi-linked","el":"linked","except":["Inventory"]},{"id":"fi-book","el":"statblock"},{"id":"fi-core","el":"fields","fields":["Statblock.size","Statblock.ac","Statblock.hp","Statblock.hpFormula","Statblock.speed","Statblock.cr","Statblock.prof","Abilities","Statblock.senses","Statblock.resistances","Statblock.vulnerabilities","Statblock.immunities","Statblock.conditionImmunities","Statblock.legendaryActions","Statblock.legendaryActionsLair","Statblock.bonuses","Proficiencies"]},{"id":"fi-actions","el":"composed"}]},{"id":"fi-table","el":"section","text":"At the table","children":[{"id":"fi-token","el":"token"},{"id":"fi-state","el":"fields","fields":["Statblock.token","Statblock.combatRole","Vitals.hp","Vitals.hpTemp","Vitals.hitDiceLeft","Vitals.conditions","Vitals.hidden","Creature.kind","Creature.role"]},{"id":"fi-tactics","el":"prose","fields":["Tactics.tactics"]}]},{"id":"fi-loot","el":"section","text":"Loot","children":[{"id":"fi-inv","el":"inventory"}]},{"id":"fi-fights","el":"section","text":"Fights and maps","children":[{"id":"fi-enc","el":"collection","text":"In these fights","path":[{"relation":"participates","dir":"in"}],"types":["Encounter"],"show":"list","sort":{"by":"name"}},{"id":"fi-r","el":"relations"}]}]}'::jsonb
 where exists (select 1 from interface_def)
on conflict (key) do nothing;

-- Die neuen Felder der Kreatur — nur, wo sie noch fehlen.
update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,background}',
         '{"type":"string","format":"long","many":true,"title":"Background","description":"Where they come from and what made them who they are — only as much as the table needs. A player character’s D&D background is an edge, not this field. (After the Universal Roleplaying Template, The Alexandrian.)"}'::jsonb)::json
 where name = 'Creature'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'background');

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,keyInfo}',
         '{"type":"string","format":"long","many":true,"title":"Key info","description":"What the party can learn from or through them: the clues, favours and facts this one holds. One entry per piece, so you see what has been handed out. (After the Universal Roleplaying Template, The Alexandrian.)"}'::jsonb)::json
 where name = 'Creature'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'keyInfo');

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,agenda}',
         '{"type":"string","format":"long","title":"Agenda","description":"What they are after right now, in a sentence — it decides what they do when the party turns up."}'::jsonb)::json
 where name = 'Creature'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'agenda');

-- Titel und Hilfetexte an bestehenden Feldern: `personality` heisst
-- „Roleplaying“; die übrigen bekommen ihren Hilfetext. Nur, wo das Feld
-- steht — ein Feld, das jemand entfernt hat, kommt nicht zurück.
create or replace function pg_temp.feldtext(typ text, feld text, titel text, hilfe text) returns void
language plpgsql as $$
begin
  update interface_def
     set schema = jsonb_set(
           jsonb_set(schema::jsonb, array['properties', feld, 'description'], to_jsonb(hilfe)),
           array['properties', feld, 'title'], to_jsonb(coalesce(titel, schema::jsonb #>> array['properties', feld, 'title'])))::json
   where name = typ
     and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
     and ((schema::jsonb -> 'properties') ? feld);
end $$;

select pg_temp.feldtext('Creature', 'appearance', null, 'What the players notice first: one or two things to see, hear or smell that make this one recognisable at once. (After the Universal Roleplaying Template, The Alexandrian.)');
select pg_temp.feldtext('Creature', 'personality', 'Roleplaying', 'Two or three cues for playing them at the table — a mannerism, how they speak, what they want from a conversation. One cue per entry. (After the Universal Roleplaying Template, The Alexandrian.)');
select pg_temp.feldtext('Creature', 'species', null, 'What they are — human, goblin, owlbear. The list suggests what other creatures use.');
select pg_temp.feldtext('Creature', 'kind', null, 'What sort of creature this is at the table — npc, companion, retainer, pet, summon. Free text; the list suggests what other creatures use.');
select pg_temp.feldtext('Creature', 'role', null, 'What they are in the world: the innkeeper, the guard captain, the fence.');
select pg_temp.feldtext('Creature', 'attitude', null, 'How they meet the party right now. How they regard particular people is a “regards” relation.');
select pg_temp.feldtext('Secrets', 'secret', null, 'What is true and not yet known at the table. One entry per secret; each is withheld from players until you reveal it on its own.');
select pg_temp.feldtext('Tactics', 'tactics', null, 'How this one fights: what it opens with, whom it targets, when it flees. For the GM only.');
select pg_temp.feldtext('Statblock', 'combatRole', null, 'Its job in a fight — brute, skirmisher, controller, leader. Free text; the list suggests what other statblocks use.');
