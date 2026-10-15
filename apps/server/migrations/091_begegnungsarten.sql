-- Begegnungen Teil 2: Felder und Anzeige je Art (T-184, REQ-085). Folge
-- von 077 (`Encounter.kind`).
--
--  1. Vier Felder an `Encounter`: `solution` und `hint` (Rätsel),
--     `goal` (Gespräch), `check` (Ressource, Erkundung, Falle).
--  2. Die Anordnung `full` der Begegnung zeigt die Initiative nur bei
--     einem Kampf, bei Teilnehmenden oder ohne Art, die übrigen Gruppen nur
--     bei ihrer Art (`when`) — nur, wo die Anordnung noch die alte ist; eine
--     eigene bleibt.
--  3. `features` geht auch von einer Begegnung aus und darf auf eine
--     Gefahr (`Hazard`) zeigen.
--  4. `gmFields` nimmt Lösung und Hinweise dazu — nur, wo die Einstellung
--     sie nicht schon nennt.
--
-- Nur, wo schon ein Register steht; ergänzt wird nur, was fehlt. Nichts
-- wird entfernt, kein Artikel geändert.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties}',
         (schema::jsonb -> 'properties') || jsonb_build_object(
           'solution', '{"type":"string","format":"long","title":"Solution","description":"How the puzzle is solved. Only the GM sees it."}'::jsonb,
           'hint', '{"type":"string","format":"long","many":true,"title":"Hints","description":"One clue per entry; each can be revealed on its own through an information."}'::jsonb,
           'goal', '{"type":"string","format":"long","title":"Goal","description":"What the other side wants, or what the party can achieve."}'::jsonb,
           'check', '{"type":"string","title":"Check","description":"The check that decides the yield, e.g. DC 13 Survival."}'::jsonb
         ) || (schema::jsonb -> 'properties')
       )::json
 where name = 'Encounter'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and (schema::jsonb -> 'properties') ? 'kind';

update interface_def
   set views = views || jsonb_build_object('full', '[
     {"id":"e-init","el":"initiative","when":{"field":"Encounter.kind","has":["combat"],"empty":true,"relation":"participates"}},
     {"id":"e-desc","el":"description"},
     {"id":"e-read","el":"prose","fields":["ReadAloud.readaloud"],"when":{"field":"Encounter.kind","has":["story","social","exploration"]}},
     {"id":"e-puzzle","el":"fields","fields":["Encounter.solution"],"when":{"field":"Encounter.kind","has":["puzzle"]}},
     {"id":"e-hints","el":"prose","fields":["Encounter.hint"],"when":{"field":"Encounter.kind","has":["puzzle"]}},
     {"id":"e-social","el":"fields","fields":["Encounter.goal"],"when":{"field":"Encounter.kind","has":["social"]}},
     {"id":"e-yield","el":"fields","fields":["Encounter.check"],"when":{"field":"Encounter.kind","has":["resource","exploration","hazard","trap"]}},
     {"id":"e-f","el":"fields","fields":"all"},
     {"id":"e-b","el":"prose","fields":"all"}
   ]'::jsonb)
 where name = 'Encounter'
   and views -> 'full' = '[
     {"id":"e-init","el":"initiative"},
     {"id":"e-desc","el":"description"},
     {"id":"e-f","el":"fields","fields":"all"},
     {"id":"e-b","el":"prose","fields":"all"}
   ]'::jsonb;

update relation_def
   set from_ifaces = case when 'Encounter' = any(from_ifaces) then from_ifaces else from_ifaces || '{Encounter}'::text[] end,
       to_ifaces = case when 'Hazard' = any(to_ifaces) then to_ifaces else to_ifaces || '{Hazard}'::text[] end,
       means = 'A story or encounter features a creature, statblock, faction or hazard; they list where they appear.'
 where type = 'features'
   and not ('*' = any(from_ifaces));

update setting_def
   set value = value || ',Encounter.solution,Encounter.hint'
 where key = 'gmFields'
   and value not like '%Encounter.solution%';
