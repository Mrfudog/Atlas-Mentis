-- Enhancements an Gegenständen (T-300, E-107).
--
-- 1. `Item.namePrefix`, `Item.nameSuffix`, `Item.priceAdd`, `Item.priceMult`:
--    ein Gegenstand mit `appliesTo` („+1 Weapon", „Silvered") ist ein
--    Enhancement; hier stehen Namensteile und Aufpreis.
-- 2. `Campaign.itemPricing` (combined · base · none) und
--    `Campaign.enhancementsBy` (gm · players): Preisregel und wer anhängt.
-- 3. Die Kante `enchantedWith` (Stück → Enhancement).
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo es noch fehlt; nichts wird entfernt, kein Artikel geändert.
-- Name, Preis und Boni eines Stücks werden beim Lesen gerechnet (D8).

update interface_def
   set schema = jsonb_set(
           jsonb_set(
           jsonb_set(
           jsonb_set(
           schema::jsonb,
           '{properties,namePrefix}',
           '{"type":"string","title":"Name prefix","description":"Put in front of the base item''s name on a piece with this enhancement, such as \"+1 \" or \"Silvered \"."}'::jsonb
         ),
           '{properties,nameSuffix}',
           '{"type":"string","title":"Name suffix","description":"Put after the base item''s name on a piece with this enhancement, such as \" of Warning\"."}'::jsonb
         ),
           '{properties,priceAdd}',
           '{"type":"number","min":0,"title":"Surcharge in copper","description":"What this enhancement adds to the base item''s price, in copper. Without a surcharge or factor, its own price is the surcharge."}'::jsonb
         ),
           '{properties,priceMult}',
           '{"type":"number","min":0,"title":"Price factor","description":"Multiplies the base item''s price, before surcharges are added (2 doubles it)."}'::jsonb
         )::json
 where name = 'Item'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'namePrefix');

update interface_def
   set schema = jsonb_set(
           jsonb_set(
           schema::jsonb,
           '{properties,itemPricing}',
           '{"type":"string","title":"Item prices","description":"How the price of a piece with enhancements (+1, silvered …) is worked out: base price plus surcharges, base price only, or not calculated.","enum":["combined","base","none"],"default":"combined"}'::jsonb
         ),
           '{properties,enhancementsBy}',
           '{"type":"string","title":"Enhancements added by","description":"Who may put an enhancement on a piece. Players only once crafting offers it; until then, the GM.","enum":["gm","players"],"default":"gm"}'::jsonb
         )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'itemPricing');

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select 'enchantedWith', 'enhanced with', 'enhances', '{Item}'::text[], '{Item}'::text[], false, 'many', '{}'::jsonb,
       'A piece of an item carries an enhancement such as +1 Weapon or Silvered; its name, price and bonuses are worked out from both.'
where exists (select 1 from relation_def)
on conflict (type) do nothing;
