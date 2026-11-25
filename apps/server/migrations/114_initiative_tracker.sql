-- Der Initiative-Tracker (T-022): `Campaign.combat` schaltet ihn ab,
-- `initNames`, `initHealth`, `initEffects`, `initActions` sagen, was
-- Spielende von der Reihe sehen, `initColumns` und `initQuickActions`,
-- welche Spalten und Knöpfe er hat. Der Seed schreibt nur in eine leere
-- Datenbank, also kommen die Felder hier nach. Geändert wird nur das
-- Register.
--
-- Nichts fällt weg.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties}',
         (schema::jsonb -> 'properties') || '{
           "combat": {"type":"string","title":"Initiative tracker","enum":["on","off"],"default":"on"},
           "initNames": {"type":"string","title":"Unidentified foes shown as","enum":["cover","real"],"default":"cover"},
           "initHealth": {"type":"string","title":"Foes’ health shown to players","enum":["none","coarse","exact"],"default":"coarse"},
           "initEffects": {"type":"string","title":"Effects shown to players","enum":["all","party","none"],"default":"all"},
           "initActions": {"type":"string","title":"Foes’ actions shown to players","enum":["hidden","shown"],"default":"hidden"},
           "initColumns": {"type":"array","title":"Tracker columns","description":"Which columns the initiative tracker shows, for the GM and the players alike.","items":{"type":"string"},"enum":["init","ac","hp","effects","actions"]},
           "initQuickActions": {"type":"array","title":"Tracker quick actions","description":"Which buttons the GM has on each row of the initiative tracker.","items":{"type":"string"},"enum":["damage","heal","effect","delay","reroll","remove"]}
         }'::jsonb
       )::json
 where name = 'Campaign'
   and (schema::jsonb -> 'properties') ? 'ruleGraphs'
   and not (schema::jsonb -> 'properties') ? 'combat';
