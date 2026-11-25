-- Collection als Artikel (T-425, REQ-438, E-174).
--
-- Eine Gruppe von Artikeln des Regelwerks — Simple Melee Weapons, Damage
-- Types, Creature Types — ist ein Artikel der Art `Collection` (unter Rule):
-- Mitglieder nach Regel (Arten, Marken, Feldbedingungen) und von Hand über
-- die Kante `inCollection`, mit `exclude` zum Ausnehmen. Die Materialgruppe
-- wird ein Untertyp (`extends` Collection statt Rule): ihre Karte
-- `MaterialGroup` bleibt, wie sie ist, sie erbt Rule weiter über Collection.
--
-- Dieselben Zeilen wie in `packages/registry`. Nur, wo schon ein Register
-- steht; ergänzt wird, was fehlt. Kein Artikel wird geändert, nichts fällt weg.

insert into interface_def (name, label, abstract, extends, schema, area, views)
select 'Collection', 'Collection', false, array['Rule']::text[], '{"type":"object","properties":{"types":{"type":"array","title":"Of the types","items":{"type":"string"},"description":"Every visible article of these types and their subtypes belongs to the collection, if the other conditions hold too. Empty with no other condition: only what is added by hand."},"tags":{"type":"array","title":"Tagged","items":{"type":"string"},"description":"Only articles with all of these tags."},"fields":{"type":"array","title":"Field conditions","items":{"type":"string"},"description":"Type.field:value|value or Type.field:1..3, as in the compendium filter — e.g. Weapon.category:simple melee."}}}'::jsonb, 'rules', '{"full":{"adjust":{"extra":[{"id":"col-members","el":"collection","text":"Members","source":"members","show":"list","groupBy":"type","sort":{"by":"name"},"pos":25}]}}}'::jsonb
 where exists (select 1 from interface_def)
on conflict (name) do nothing;

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select 'inCollection', 'in collection', 'members (by hand)', '{*}'::text[], '{Collection}'::text[], false, 'many', '{"type":"object","properties":{"exclude":{"type":"boolean","title":"Exclude","description":"Takes the article out of the collection, even where its rule would take it (T-425, E-174)."}}}'::jsonb,
       'An article belongs to a collection by hand, next to what its rule takes; with Exclude it is taken out even where the rule would take it.'
 where exists (select 1 from relation_def)
on conflict (type) do nothing;

update interface_def
   set extends = array['Collection']::text[]
 where name = 'MaterialGroup'
   and extends = array['Rule']::text[];
