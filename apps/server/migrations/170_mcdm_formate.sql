-- MCDM-Formate im Register (T-497): Gefolge, Begleiter, Reittiere,
-- Villain Actions, Minions und Quellenangaben an der Geschichte.
--
-- Was beim Einlesen von Arcadia #1 fehlte und für Flee, Mortals! und
-- Strongholds & Followers gebraucht wird — dieselben Zeilen wie in
-- `packages/registry`:
--
-- 1. `Source` an `Story` (und damit an Arc, Szene, Sitzung) und an
--    `Encounter`: Buch und Seite eines eingelesenen Abenteuers.
-- 2. Am Statblock: `saveProf` (eigener Übungsbonus für Rettungswürfe),
--    `minion`, `primaryAbility`, `pbFrom`, `addPb`, `hpPerLevel`,
--    `tempHpPerLevel` — gerechnet wird beim Lesen (D8, `followerNumbers`).
-- 3. An der Aktion: `saveDc`, `saveAbility`, `round` (Villain Actions);
--    `ability` kennt `primary`.
-- 4. An `composedOf`: `saveDc` und `level` (ab welcher Stufe ein
--    Gefolgsmann die Aktion hat); `ability` kennt `primary`.
-- 5. Die Kante `follows` (Kreatur → Kreatur, mit Stufe und Sorte).
-- 6. An der Kampagne: `overkill` (off/on, Vorgabe off).
--
-- Nur hinzugefügt: kein Feld fällt weg, kein Artikel ändert sich. Alles nur,
-- wo schon ein Register steht (wie 104 und 138) — eine leere Datenbank
-- bekommt die Zeilen vom Seed.

update interface_def
   set extends = extends || array['Source']::text[]
 where name in ('Story', 'Encounter')
   and not ('Source' = any(extends));

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties}', (schema::jsonb -> 'properties') || '{"saveProf":{"type":"number","title":"Saving throw proficiency","format":"signed","description":"Added to proficient saving throws instead of the proficiency bonus, when the statblock names a different one. Empty: the proficiency bonus.","glossary":"Saving throw"},"minion":{"type":"boolean","title":"Minion","description":"Dies to any damage from an attack or failed save, and takes its turn together with the other minions of its kind.","glossary":"Minion"},"primaryAbility":{"type":"string","title":"Primary ability","enumRef":"Ability","description":"The ability a retainer is built around; attacks with the ability “primary” use it."},"pbFrom":{"type":"string","title":"Proficiency bonus from","enum":["leader","level"],"description":"Where the proficiency bonus comes from, instead of the number above: the leader it follows (a mount or companion), or its own level on the “follows” edge (a retainer).","glossary":"Proficiency bonus"},"addPb":{"type":"array","title":"Adds the proficiency bonus to","items":{"type":"string"},"enum":["ac","damage","dc","hp"],"description":"Values written as “+ PB” in the book: armour class, the damage of its attacks, the save DCs of its actions, its hit points."},"hpPerLevel":{"type":"number","min":0,"title":"Hit points per level","description":"Added once per level of the follower to the hit points above."},"tempHpPerLevel":{"type":"number","min":0,"title":"Temporary hit points per level","description":"Temporary hit points it gains, per level of the follower — say in the text when.","glossary":"Temporary hit points"}}'::jsonb)::json
 where name = 'Statblock'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object';

update interface_def
   set schema = jsonb_set(
         jsonb_set(schema::jsonb, '{properties}', (schema::jsonb -> 'properties') || '{"saveDc":{"type":"number","min":1,"title":"Save DC","description":"The DC of the saving throw this action asks for, as the book prints it."},"saveAbility":{"type":"string","title":"Save ability","enumRef":"Ability"},"round":{"type":"number","min":1,"max":10,"title":"Round","description":"For actions used once in a set round, such as villain actions: the round (1, 2, 3 …). The statblock lists them in this order.","glossary":"Villain action"}}'::jsonb),
         '{properties,ability,enum}',
         (schema::jsonb #> '{properties,ability,enum}') || '["primary"]'::jsonb
       )::json
 where name = 'Action'
   and jsonb_typeof(schema::jsonb #> '{properties,ability,enum}') = 'array'
   and not (schema::jsonb #> '{properties,ability,enum}') ? 'primary';

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,overkill}', '{"type":"string","title":"Overkill","enum":["off","on"],"default":"off"}'::jsonb)::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object';

update relation_def
   set props = jsonb_set(
         jsonb_set(props, '{properties}', (props -> 'properties') || '{"saveDc":{"type":"number","min":1,"title":"Save DC (here)"},"level":{"type":"number","min":1,"max":20,"title":"From level","description":"A follower can use this from that level on; its level stands on its “follows” edge."}}'::jsonb),
         '{properties,ability,enum}',
         (props #> '{properties,ability,enum}') || '["primary"]'::jsonb
       )
 where type = 'composedOf'
   and jsonb_typeof(props #> '{properties,ability,enum}') = 'array'
   and not (props #> '{properties,ability,enum}') ? 'primary';

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select 'follows', 'follows', 'followed by', '{Creature}'::text[], '{Creature}'::text[], false, 'one',
       '{"type":"object","properties":{"as":{"type":"string","title":"As","suggest":true,"description":"retainer, companion, mount, follower — free text."},"level":{"type":"number","min":1,"max":20,"title":"Level","description":"The follower’s level: it unlocks actions and hit points per level."}}}'::jsonb,
       'A retainer, companion or mount follows a character — its mentor, rider or owner; the edge says its level, and its statblock may grow with the leader’s proficiency bonus.'
 where exists (select 1 from relation_def)
on conflict (type) do nothing;
