-- Handwerk: Proben als Kreise, die Regeln nur an der Kampagne (T-165).
--
--  1. `Recipe.onFailure` ist keine Einstellung mehr, sondern der Text der
--     Quelle („Source: on a failure") und gilt nicht. Die gespeicherten
--     Auswahlwerte werden zu Sätzen; nichts fällt weg.
--  2. `Campaign.craftFailure` verliert `recipe` (Vorgabe jetzt `halfLost`,
--     die alte Vorgabe eines Rezepts ohne Angabe). Eine Kampagne, die dem
--     Rezept folgte, bekommt die Regel ihrer Rezepte; die abweichenden
--     werden aufgezählt — die Kampagne entscheidet, nicht das Rezept.
--  3. `CraftingOrder.rolls` wird `CraftingOrder.checks` (je Probe ein
--     Kreis); `progress` heisst „Days worked" und zählt nur noch Tage —
--     der Fortschritt in Proben wird gerechnet (D8).
--
-- Abgelehnte Proben (`rejected`) waren nie geschehen und werden kein Kreis:
-- verlust: select count(*) from component c, jsonb_array_elements(c.payload->'rolls') r where c.type = 'CraftingOrder' and jsonb_typeof(c.payload->'rolls') = 'array' and r->>'result' = 'rejected'

-- 1. Register: Rezept, Auftrag, Kampagne, Kante — nur, wo schon ein Register steht.
update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,onFailure}', '{"type":"string","title":"Source: on a failure"}'::jsonb)::json
 where name = 'Recipe'
   and (schema::jsonb -> 'properties') ? 'onFailure';

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties}',
         ((schema::jsonb -> 'properties') - 'rolls')
           || jsonb_build_object('progress', (schema::jsonb #> '{properties,progress}') || '{"title":"Days worked"}'::jsonb)
           || '{"checks":{"type":"array","title":"Checks","items":{"type":"object"},"readOnly":true}}'::jsonb
       )::json
 where name = 'CraftingOrder'
   and (schema::jsonb -> 'properties') ? 'progress';

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,craftFailure}',
         '{"type":"string","title":"Crafting: on a failed check","enum":["noProgress","progressLost","materialsLost","halfLost","nothingLost","custom"],"default":"halfLost"}'::jsonb
       )::json
 where name = 'Campaign'
   and (schema::jsonb -> 'properties') ? 'craftFailure';

update relation_def
   set means = 'A creature or party works on a crafting order (an instance of a recipe, with progress and checks); the order lists who works on it.'
 where type = 'crafting';

-- 2. Kampagnen ohne eigene Regel (oder mit `recipe`) folgten bisher dem
--    Rezept. Damit am Tisch nichts still anders gilt, bekommen sie die
--    Regel, die bei ihren Rezepten am häufigsten stand (sonst `halfLost`,
--    die alte Vorgabe). Rezepte, die davon abwichen, werden aufgezählt —
--    ab jetzt gilt für sie die Kampagne.
do $$
declare
  regel text;
  n int;
  liste text;
begin
  if not exists (
    select 1 from component k
     where k.type = 'Campaign' and coalesce(k.payload->>'craftFailure', 'recipe') = 'recipe'
  ) then
    return;
  end if;
  select r.payload->>'onFailure' into regel
    from component r
   where r.type = 'Recipe' and r.payload->>'onFailure' in ('materialsLost', 'halfLost', 'nothingLost')
   group by 1
   order by count(*) desc, 1
   limit 1;
  regel := coalesce(regel, 'halfLost');
  update component
     set payload = jsonb_set(payload, '{craftFailure}', to_jsonb(regel))
   where type = 'Campaign' and coalesce(payload->>'craftFailure', 'recipe') = 'recipe';
  raise notice 'T-165: Kampagnen ohne eigene Handwerksregel bekommen craftFailure = %', regel;
  select count(*), string_agg(coalesce(i.payload->>'name', r.entity_id::text) || ' (' || (r.payload->>'onFailure') || ')', ', ' order by i.payload->>'name')
    into n, liste
    from component r
    left join component i on i.entity_id = r.entity_id and i.type = 'Identity'
   where r.type = 'Recipe'
     and r.payload->>'onFailure' in ('materialsLost', 'halfLost', 'nothingLost')
     and r.payload->>'onFailure' <> regel;
  if n > 0 then
    raise notice 'T-165: % Rezept(e) galten bisher anders, jetzt gilt % : %', n, regel, liste;
  end if;
end $$;

update component
   set payload = jsonb_set(payload, '{onFailure}', to_jsonb(case payload->>'onFailure'
         when 'materialsLost' then 'The materials are lost.'
         when 'halfLost' then 'Half the materials are lost.'
         when 'nothingLost' then 'The materials come back.'
       end))
 where type = 'Recipe' and payload->>'onFailure' in ('materialsLost', 'halfLost', 'nothingLost');

-- 3. Proben → Kreise. `pending` behält, was sie ergäbe (`would`).
update component c
   set payload = (c.payload - 'rolls') || jsonb_build_object('checks', coalesce((
         select jsonb_agg(
                  jsonb_strip_nulls(jsonb_build_object(
                    'mark', case when r->>'result' = 'pending' then r->>'would' else r->>'result' end,
                    'by', r->'by', 'at', r->'at', 'total', r->'total', 'nat', r->'nat', 'dc', r->'dc',
                    'pending', case when r->>'result' = 'pending' then true end
                  )) order by o)
           from jsonb_array_elements(c.payload->'rolls') with ordinality as x(r, o)
          where r->>'result' in ('critSuccess', 'success', 'failure', 'critFailure')
             or (r->>'result' = 'pending' and r->>'would' in ('critSuccess', 'success', 'failure', 'critFailure'))
       ), '[]'::jsonb))
 where c.type = 'CraftingOrder' and jsonb_typeof(c.payload->'rolls') = 'array';
