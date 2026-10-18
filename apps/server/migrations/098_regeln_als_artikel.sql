-- Regeln als Artikel (T-270, zu E-102 a): Rules & options und der
-- Regel-Builder lesen ihre Auswahl aus Regelartikeln statt aus einer Liste
-- im Code.
--
--  1. `RuleKind` kennt `system`: ein Artikel steht für ein System (Inventar,
--     Handwerk …), eine Regel darin (`rule`) oder eine Option (`option`).
--  2. `Rule` bekommt `key` (welches System, welche Regel, welche Option der
--     Laufzeit) und `graph` (der Knotengraph des Regel-Builders).
--  3. `partOf` darf von Regel zu Regel gehen: die Option an ihre Regel, die
--     Regel an ihr System.
--
-- Wie 096 nur, wo schon ein Register steht. Ergänzt wird nur, was fehlt;
-- kein Artikel und keine Kante wird geändert oder entfernt.

update enum_def
   set config = jsonb_set(config, '{values}', (config -> 'values') || '["system"]'::jsonb)
 where name = 'RuleKind'
   and not (config -> 'values') ? 'system';

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,key}', '{"type":"string","title":"Runtime key","facet":false,"description":"Which system, rule or option of the app this article stands for, such as inventory, craftFailure or materialsLost. Rules & options and the rule builder find the article by it; the name may change."}'::jsonb)::json
 where name = 'Rule'
   and (schema::jsonb #> '{properties,key}') is null;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,graph}', '{"type":"object","title":"Rule graph","facet":false,"description":"The nodes and connections of this rule in the rule builder: triggers, conditions and outcomes."}'::jsonb)::json
 where name = 'Rule'
   and (schema::jsonb #> '{properties,graph}') is null;

update relation_def set from_ifaces = array_append(from_ifaces, 'Rule')
 where type = 'partOf' and not ('Rule' = any(from_ifaces));
update relation_def set to_ifaces = array_append(to_ifaces, 'Rule')
 where type = 'partOf' and not ('Rule' = any(to_ifaces));
