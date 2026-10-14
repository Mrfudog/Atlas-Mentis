-- Der Laden (T-129): Art `Shop` und die Kanten `sells`, `discount`, `shopkeeper`.
--
-- Ein Laden ist ein Ort (`extends Place`) mit einem Abschlag für alle
-- (`Shop.priceMod`); was er führt, steht an `sells` (Menge, eigener Preis,
-- Abschlag je Ware), wer Rabatt bekommt, an `discount` (vom Laden, der
-- kontrollierenden Fraktion oder dem Ladenhalter an Figur, Gruppe oder
-- Fraktion ab Rang). Gerechnet wird beim Lesen (D8, `shopWares`).
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommen die Zeilen
-- hier nach — **nur, wo schon ein Register steht** (wie 040, 043).
-- Ergänzt wird nur, was fehlt; nichts wird entfernt, kein Artikel geändert.

insert into interface_def (name, label, abstract, extends, schema, area, views)
select 'Shop', 'Shop', false, array['Place'],
       '{"type":"object","properties":{"priceMod":{"type":"string","title":"Price modifier (−10 gp, −10 %)"}}}'::json,
       'world',
       '{"full":{"adjust":{"extra":[{"id":"shop-wares","el":"wares"}],"order":["o-img","o-desc","o-f","shop-wares"]}}}'::jsonb
where exists (select 1 from interface_def)
on conflict (name) do nothing;

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select v.* from (values
  ('sells', 'sells', 'sold at', '{Shop}'::text[], '{Item}'::text[], false, 'many',
   '{"type":"object","properties":{"qty":{"type":"number","min":0,"title":"Quantity"},"price":{"type":"number","min":0,"title":"Price in copper (instead of list price)"},"mod":{"type":"string","title":"Price modifier (−1 gp, −10 %)"},"available":{"type":"boolean","title":"Available","default":true}}}'::jsonb,
   'A shop sells an item, with quantity, its own price and mark-down; the item lists where it is sold.'),
  ('discount', 'discount for', 'discount from', '{Shop,Faction,Creature}'::text[], '{Creature,Party,Faction}'::text[], false, 'many',
   '{"type":"object","properties":{"mod":{"type":"string","title":"Price modifier (−10 gp, −10 %)"},"rank":{"type":"string","title":"From rank (faction)"},"note":{"type":"string","title":"Why"}}}'::jsonb,
   'A shop, a faction or a shopkeeper gives a creature, a party or a faction (from a rank) a price modifier at its shops; the receiver lists who gives it one.'),
  ('shopkeeper', 'shopkeeper', 'keeps shop', '{Shop}'::text[], '{Creature}'::text[], false, 'many',
   '{}'::jsonb,
   'A shop is kept by a creature, whose discounts count at the shop; the creature lists the shops it keeps.')
) as v(type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
where exists (select 1 from relation_def)
on conflict (type) do nothing;
