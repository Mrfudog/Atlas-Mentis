-- Materialien erst beim Start wählen; Ersatzmaterialien (T-197).
--
--  1. Art `MaterialGroup` — ein Material nach Eigenschaft (Materialart,
--     Seltenheit, Marken, Namen): ein Rezept nennt sie über `needs` statt
--     eines festen Gegenstands; welches Stück, wird beim Start gewählt.
--  2. Art `Substitution` — eine Ersatzregel („Pflanzen statt Reagenzien"),
--     gewählt an der Kampagne über die neue Kante `allowsSubstitution`.
--  3. `needs` zeigt auch auf eine Materialgruppe.
--  4. `holds.props.forNeed`: für welchen Bestandteil ein Stück reserviert ist.
--
-- Wie 087 nur, wo schon ein Register steht. Ergänzt wird nur, was fehlt;
-- nichts wird entfernt, kein Artikel geändert.

insert into interface_def (name, label, abstract, extends, schema, area)
select 'MaterialGroup', 'Material group', false, array['Rule'],
       '{"type":"object","properties":{"materialTypes":{"type":"array","title":"Material types","items":{"type":"string"},"description":"Any of these material types fits (Material › Material type), e.g. reagent. Empty: any."},"rarityMin":{"type":"string","title":"Rarity at least","enumRef":"Item.rarity","description":"The least rarity a piece must have."},"rarityMax":{"type":"string","title":"Rarity at most","enumRef":"Item.rarity","description":"The highest rarity a piece may have."},"tags":{"type":"array","title":"Tagged","items":{"type":"string"},"description":"A piece must carry one of these tags. Empty: no tag needed."},"items":{"type":"array","title":"Or one of these items","items":{"type":"string"},"enumRef":"Item","description":"Items that always fit, by name — next to whatever the properties above admit."}}}'::json,
       'rules'
where exists (select 1 from interface_def)
on conflict (name) do nothing;

insert into interface_def (name, label, abstract, extends, schema, area)
select 'Substitution', 'Material substitution', false, array['Rule'],
       '{"type":"object","properties":{"replaces":{"type":"array","title":"Stands in for","items":{"type":"string"},"description":"The material types this rule replaces (Material › Material type), e.g. reagent."},"with":{"type":"array","title":"Material types that may stand in","items":{"type":"string"},"description":"Pieces of these material types may be used instead, e.g. plant."},"withTags":{"type":"array","title":"Or items tagged","items":{"type":"string"},"description":"Pieces with one of these tags may be used instead, too."},"rarity":{"type":"string","title":"Rarity","enum":["same","atLeast","any"],"default":"same","description":"same: the substitute has the rarity the recipe asks for; atLeast: that or rarer; any: rarity does not matter."},"ratio":{"type":"number","title":"Pieces per material","min":1,"default":1,"description":"How many substitutes replace one of the original."}}}'::json,
       'rules'
where exists (select 1 from interface_def)
on conflict (name) do nothing;

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select 'allowsSubstitution', 'allows substitution', 'allowed in', '{Campaign}'::text[], '{Substitution}'::text[], false, 'many', '{}'::jsonb,
       'A campaign plays by a material substitution rule; the rule lists the campaigns that allow it.'
where exists (select 1 from relation_def)
on conflict (type) do nothing;

update relation_def
   set to_ifaces = to_ifaces || '{MaterialGroup}'::text[],
       means = 'A recipe needs an item — or any piece of a material group — in a quantity; the item lists the recipes that use it.'
 where type = 'needs'
   and not ('MaterialGroup' = any(to_ifaces));

update relation_def
   set props = jsonb_set(
         coalesce(props, '{"type":"object"}'::jsonb),
         '{properties}',
         coalesce(props -> 'properties', '{}'::jsonb)
           || '{"forNeed":{"type":"string","title":"For the recipe’s material"}}'::jsonb)
 where type = 'holds'
   and not (coalesce(props -> 'properties', '{}'::jsonb) ? 'forNeed');
