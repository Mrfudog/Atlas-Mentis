-- Modulrahmen nach E-100 (T-132 Schritt 2): Systeme erweitern einander
-- oder schliessen einander aus.
--
-- Ein Regelsystem (`RuleSystem`) ist das Modul, eine Regelmechanik
-- (`RuleMechanic`) ein System darin. E-166 kannte nur `compatibleWith`;
-- E-100 verlangt dazu `extends`/`overrides` und `excludes`.
--
-- 1. Register: dieselben Zeilen wie in `packages/registry` — die Kanten
--    `extendsMechanic` (mit `props.mode` extends/overrides) und
--    `excludesMechanic`; an `RuleSystem.sort` die Module aus E-100, die
--    noch fehlten (`partyInventory`, `magic`, `creatures`).
-- 2. Bestand: **Default shapes erweitert Grid und Slots**, statt mit
--    ihnen verträglich zu sein. Als Verträglichkeit hätte die Mechanik im
--    selben Modul Weight verdrängt (sie ist mit Weight nicht verbunden);
--    als Erweiterung liest sie die Verträglichkeiten von Grid mit und
--    gilt nur mit Grid oder Slots — so, wie die Formen gemeint sind. Jede
--    Kante `compatibleWith` von einer Mechanik `shapes` an eine Mechanik
--    `grid` oder `slots` wird `extendsMechanic`; Id und Enden bleiben.
--    Was die Laufzeit zählt, ändert sich nicht: das Inventar liest weiter
--    `Campaign.inventory`.
--
-- Auf einer frischen Datenbank tut Teil 2 nichts: die Startebenen legt der
-- Start schon mit `extendsMechanic` an.
-- Nummer beim Hereinmergen nachgesehen: 166.

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select 'extendsMechanic', 'extends', 'extended by', '{RuleMechanic}'::text[], '{RuleMechanic}'::text[], false, 'many',
       '{"type":"object","properties":{"mode":{"type":"string","title":"How","enum":["extends","overrides"],"description":"Extends adds to the base; overrides also wins where both say something."}}}'::jsonb,
       'A rule mechanic builds on another and only applies together with it, such as default shapes on the grid inventory; with “overrides” it wins where both say something.'
 where exists (select 1 from relation_def)
on conflict (type) do nothing;

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props, means)
select 'excludesMechanic', 'excludes', 'excluded by', '{RuleMechanic}'::text[], '{RuleMechanic}'::text[], false, 'many', '{}'::jsonb,
       'Two rule mechanics never apply together in a campaign; stored once, it reads both ways, and the higher one in the stack wins.'
 where exists (select 1 from relation_def)
on conflict (type) do nothing;

update interface_def
   set schema = '{"type":"object","properties":{"sort":{"type":"string","title":"Rule area","enum":["inventory","partyInventory","items","crafting","abilities","equipment","character","magic","creatures","travel","units","map","combat","table"],"description":"Which area of Rules & options this rule system covers, such as inventory. A rule system is a module; its rule mechanics are the systems a campaign picks from."}}}'::jsonb
 where name = 'RuleSystem';

update relation r
   set type = 'extendsMechanic'
  from component von, component nach
 where r.type = 'compatibleWith'
   and von.entity_id = r.from_id and von.type = 'RuleMechanic' and von.payload->>'method' = 'shapes'
   and nach.entity_id = r.to_id and nach.type = 'RuleMechanic' and nach.payload->>'method' in ('grid', 'slots');
