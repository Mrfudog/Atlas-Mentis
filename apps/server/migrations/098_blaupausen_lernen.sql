-- Wie Blaupausen gelernt werden (T-280, REQ-349): `Campaign.craftLearning`
-- (all · taught · rarity) und `Campaign.craftLearnRarity` (bis zu welcher
-- Seltenheit). Der Seed schreibt nur in eine leere Datenbank, also kommen
-- die Felder hier nach. Geändert wird nur das Register; ohne Angabe gilt
-- `taught`, wie bisher.
--
-- Nichts fällt weg.

update interface_def
   set schema = jsonb_set(
         jsonb_set(
           schema::jsonb,
           '{properties,craftLearning}',
           '{"type":"string","title":"Crafting: known blueprints","enum":["all","taught","rarity"],"default":"taught"}'::jsonb
         ),
         '{properties,craftLearnRarity}',
         '{"type":"string","title":"Crafting: blueprints up to","enum":["none","common","uncommon","rare","very rare","legendary"],"default":"common"}'::jsonb
       )::json
 where name = 'Campaign'
   and (schema::jsonb -> 'properties') ? 'craftConfirm'
   and not (schema::jsonb -> 'properties') ? 'craftLearning';
