-- Regelsysteme und Regelmechaniken als Ebenen (T-394, E-166, E-078, E-100).
--
-- 1. **Das Register:** die Arten `RuleSystem` (Feld `sort`) und
--    `RuleMechanic` (Feld `method`), beide erben von `Layer`; die Karte
--    `ShapeDefaults` (Vorgabeformen, T-394, E-165) an der Mechanik; die
--    Kante `compatibleWith` zwischen Mechaniken. Dieselben Zeilen wie in
--    `packages/registry` (`register-abgleich.mjs`).
-- 2. Die Ebenen selbst (Inventory mit Weight, Slots, Grid, Default shapes)
--    legt der Start an, wo sie fehlen (`regelsystemeNachziehen`, aus
--    `packages/registry/src/regelsysteme.ts`) — auch in einer frischen
--    Datenbank, in der diese Migration nichts tut.
--
-- Nur, wo schon ein Register steht (wie 043). Ergänzt wird nur, was fehlt;
-- nichts wird entfernt, kein Artikel geändert.
-- Nummer beim Hereinmergen nachgesehen: 140.

insert into interface_def (name, label, abstract, extends, schema)
select 'ShapeDefaults', 'Default shapes', true, array[]::text[],
       '{"type":"object","properties":{"shapeGroups":{"type":"array","many":true,"editOnly":true,"facet":false,"title":"Shape groups","description":"Groups of items that share a shape and stack size, unless an item says otherwise.","items":{"type":"object"},"entry":{"type":"object","required":["id","name"],"properties":{"id":{"type":"string","title":"Key"},"name":{"type":"string","title":"Name"},"section":{"type":"string","title":"Section"},"rows":{"type":"array","format":"grid","title":"Shape","items":{"type":"string"}},"stackSize":{"type":"number","min":1,"title":"Stack size"},"carryable":{"type":"boolean","title":"Carried in the inventory","default":true},"ref":{"type":"string","format":"link","title":"Reference item","target":{"interfaces":["Item"]}},"rule":{"type":"string","title":"Which items"},"note":{"type":"string","title":"Note"},"rank":{"type":"number","title":"Order"},"shapes":{"type":"array","title":"Shapes by price","items":{"type":"object"}},"tiers":{"type":"array","title":"Price tiers (gp)","items":{"type":"number"}}}}},"shapeItems":{"type":"array","many":true,"editOnly":true,"facet":false,"title":"Item shapes","description":"Per item: its group, its reference item, its own shape or stack size.","items":{"type":"object"},"entry":{"type":"object","required":["id"],"properties":{"id":{"type":"string","format":"link","title":"Item","target":{"interfaces":["Item"]}},"group":{"type":"string","title":"Group"},"ref":{"type":"string","format":"link","title":"Reference item","target":{"interfaces":["Item"]}},"rows":{"type":"array","format":"grid","title":"Shape","items":{"type":"string"}},"stackSize":{"type":"number","min":1,"title":"Stack size"}}}}}}'::json
 where exists (select 1 from interface_def)
on conflict (name) do nothing;

insert into interface_def (name, label, abstract, extends, schema)
select 'RuleSystem', 'Rule system', false, array['Layer']::text[],
       '{"type":"object","properties":{"sort":{"type":"string","title":"Rule area","enum":["inventory","items","crafting","abilities","equipment","character","travel","units","map","combat","table"],"description":"Which area of Rules & options this rule system covers, such as inventory."}}}'::json
 where exists (select 1 from interface_def)
on conflict (name) do nothing;

insert into interface_def (name, label, abstract, extends, schema)
select 'RuleMechanic', 'Rule mechanic', false, array['Layer','ShapeDefaults']::text[],
       '{"type":"object","properties":{"method":{"type":"string","title":"Mechanic","enum":["weight","slots","grid","shapes"],"description":"What the app runs for this mechanic: weight, slots, the grid, or default shapes for items."}}}'::json
 where exists (select 1 from interface_def)
on conflict (name) do nothing;

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select 'compatibleWith', 'compatible with', 'also works with', '{RuleMechanic}'::text[], '{RuleMechanic}'::text[], false, 'many', '{}'::jsonb,
       'Two rule mechanics can apply together in a campaign, such as the grid inventory with weight; stored once, it reads both ways.'
 where exists (select 1 from relation_def)
on conflict (type) do nothing;
