-- Regeln wirken am Tisch, Teil 1 (T-275).
--
-- 1. Wirkungen: die Art `limit` (deckelt — ein gepacktes Ziel hat Tempo
--    höchstens 0) kommt in die Liste von `Effects.effects[].op`.
-- 2. Ein Zustand wirkt wie ein Gegenstand: `Condition` nimmt `Effects`
--    dazu (gepackt, geblendet …), `effectsAt` liest `Vitals.conditions`
--    und die Einträge der Initiative.
-- 3. Ein Übungsbonus: die Formel am Spielercharakter heisst
--    `profBonus(hasClass.level)` statt `2+(…-1)/4` — dieselbe Regel wie
--    `proficiencyBonus` im Modell, nicht ein zweites Mal hingeschrieben.
-- 4. Passive Wahrnehmung mit Übung und Expertise:
--    `10+check(wis.Perception)` statt `10+mod(wis)`.
-- 5. `equips` wird gelesen (die Wirkungen der geführten Gegenstände) und
--    verliert `intended`; Waffen als Angriffe sind eine Folgeaufgabe.
--
-- Nur, wo noch steht, was das Register gebracht hat — jede Zeile wird mit
-- ihrem alten Wert verglichen; was jemand im Register geändert hat, bleibt.
-- Kein Artikel wird geändert, entfernt wird nichts.
-- Die Nummer ist beim Hereinmergen nachgesehen (130).

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,effects,entry,properties,op,enum}',
         '["add","set","grant","limit"]'::jsonb
       )::json
 where name = 'Effects'
   and schema::jsonb #> '{properties,effects,entry,properties,op,enum}' = '["add","set","grant"]'::jsonb;

update interface_def
   set extends = extends || array['Effects']
 where name = 'Condition' and not ('Effects' = any(extends))
   and exists (select 1 from interface_def where name = 'Effects');

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,proficiency,derived}', '"profBonus(hasClass.level)"'::jsonb)::json
 where name = 'PlayerCharacter'
   and schema::jsonb #>> '{properties,proficiency,derived}' = '2+(sum(hasClass.level)-1)/4';

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,passivePerception,derived}', '"10+check(wis.Perception)"'::jsonb)::json
 where name = 'Abilities'
   and schema::jsonb #>> '{properties,passivePerception,derived}' = '10+mod(wis)';

update relation_def
   set intended = null
 where type = 'equips'
   and intended = 'Count equipped items: armour and shields should set AC, weapons should become attacks on the statblock.';
