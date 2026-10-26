-- Laden kauft und verkauft nach Kanten und Collections (T-425, REQ-439, E-175).
--
-- `sells` zeigt neu auch auf eine Collection: sie steht für ihre Mitglieder,
-- eine einzelne Kante schlägt sie. Neu ist die Kante `buys` (Laden →
-- Gegenstand oder Collection, mit Satz `rate` und Abschlag `mod`), und der
-- Laden trägt seinen Ankaufssatz `Shop.buyRate` (leer 50 %, E-045 b). Ohne
-- `buys`-Kante kauft ein Laden weiter alles zur Hälfte — wie bisher.
--
-- Dieselben Zeilen wie in `packages/registry`. Nur, wo schon ein Register
-- steht. Kein Artikel und keine Kante wird geändert, nichts fällt weg.

update relation_def
   set to_ifaces = '{Item,Collection}'::text[],
       means = 'A shop sells an item — or every item in a collection —, with quantity, its own price and mark-down; the item lists where it is sold.'
 where type = 'sells'
   and not ('Collection' = any(to_ifaces));

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select 'buys', 'buys', 'bought at', '{Shop}'::text[], '{Item,Collection}'::text[], false, 'many', '{"type":"object","properties":{"rate":{"type":"number","min":0,"title":"Buy rate (% of list price)","description":"Empty: the buy rate of the shop, or 50 %."},"mod":{"type":"string","title":"Price modifier (−1 gp, −10 %)"}}}'::jsonb,
       'A shop buys an item, or every item in a collection, at a rate of the list price; without any buys edge it buys everything at its buy rate.'
 where exists (select 1 from relation_def)
on conflict (type) do nothing;

-- Das Feld kommt in die Karte des Ladens; was dort sonst steht, bleibt.
update interface_def
   set schema = jsonb_set(coalesce(schema::jsonb, '{"type":"object"}'::jsonb), '{properties,buyRate}', '{"type":"number","min":0,"title":"Buy rate (% of list price)","description":"What the shop pays when it buys, in per cent of the list price. Empty: 50 %. A buys edge may name its own rate; with buys edges the shop buys only what they name."}'::jsonb, true)
 where name = 'Shop'
   and schema #> '{properties,buyRate}' is null;
