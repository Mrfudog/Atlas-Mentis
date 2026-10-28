-- Partner-Bücher sind Official (E-193, 28.10.2026; T-094). D&D Beyond führt
-- die Bücher mit Critical Role, Rick and Morty, LEGO … seit Dez. 2025 als
-- „Official", und die Leitung will es ebenso. Erkennbar bleiben sie:
--
-- 1. Jede Ebene unter „Partnered" (`e5_publisher_partnered`), die an keiner
--    anderen Herausgeber-Gruppe hängt, bekommt `partOf` auf „Official".
-- 2. „Partnered" ordnet nicht mehr nach Herausgeber (`groupBy` fällt weg):
--    eine Kategorie wie „Comedy", unter derselben Id, mit denselben
--    Mitgliedern. Der Herausgeber wird gerechnet (`publisherOf`) und heisst
--    für diese Bücher jetzt Official.
--
-- Nicht berührt: die Gruppe „D&D 5e (2014)" — Partner-Bücher kommen nicht
-- hinein, sonst stünden sie in jeder Kampagne, die sie aufschaltet. Entfernt
-- wird nichts: eine Kante kommt dazu, ein Schlüssel einer Gruppe geht.

insert into relation(id, from_id, to_id, type, props, ord)
select b.from_id || '~partOf-e5_publisher_official',
       b.from_id,
       'e5_publisher_official',
       'partOf',
       '{}'::jsonb,
       coalesce((select max(x.ord) from relation x where x.from_id = b.from_id), 0) + 1
  from relation b
 where b.type = 'partOf'
   and b.to_id = 'e5_publisher_partnered'
   and exists (select 1 from entity o where o.id = 'e5_publisher_official')
   and not exists (
     select 1 from relation r
       join component l on l.entity_id = r.to_id and l.type = 'Layer'
      where r.from_id = b.from_id and r.type = 'partOf' and r.to_id <> 'e5_publisher_partnered'
        and l.payload->>'groupBy' = 'publisher')
   and not exists (select 1 from relation r where r.id = b.from_id || '~partOf-e5_publisher_official');

update component
   set payload = payload - 'groupBy'
 where entity_id = 'e5_publisher_partnered'
   and type = 'Layer'
   and payload ? 'groupBy';

update component
   set payload = jsonb_set(payload, '{description}', to_jsonb('Made with a partner of Wizards of the Coast (Critical Role, Rick and Morty, LEGO …); published as official D&D.'::text))
 where entity_id = 'e5_publisher_partnered'
   and type = 'Description';
