-- Zauberwirken aus den Quellen der Figur (T-309).
--
-- 1. `casts.props.ability`: mit welchem Attribut eine Quelle ihren Zauber
--    wirkt — das Regelwerk sagt es je Quelle (der Tiefling mit CHA, auch
--    als Magier). Ohne Angabe gilt das Attribut der Quelle.
-- 2. `Choices.choices[].ability` und `.mode`: dasselbe für einen gewählten
--    Zauber (Zaubertrick der Hochelfen: INT) und wie er gilt.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.

update relation_def
   set props = jsonb_set(
         props,
         '{properties,ability}',
         '{"type":"string","title":"Spellcasting ability","enumRef":"Ability"}'::jsonb
       )
 where type = 'casts'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'ability');

update interface_def
   set schema = jsonb_set(
         jsonb_set(
           schema::jsonb,
           '{properties,choices,entry,properties,ability}',
           '{"type":"string","title":"Spellcasting ability","enumRef":"Ability"}'::jsonb
         ),
         '{properties,choices,entry,properties,mode}',
         '{"type":"string","title":"How it is cast","enum":["prepared","known","innate"]}'::jsonb
       )::json
 where name = 'Choices'
   and jsonb_typeof(schema::jsonb #> '{properties,choices,entry,properties}') = 'object'
   and not ((schema::jsonb #> '{properties,choices,entry,properties}') ? 'ability');
