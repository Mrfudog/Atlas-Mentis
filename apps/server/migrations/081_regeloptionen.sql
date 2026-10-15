-- Die Regeloptionen einer Kampagne stehen unter dem Reiter „Rules &
-- options" (T-190), gruppiert und erklärt. Auf dem Artikel selbst standen
-- dieselben Felder noch einmal, ungeordnet in der Feldtabelle. Das neue
-- Layout-Element `rules` nimmt sie dort heraus und verweist auf den
-- Reiter; auf einem Blatt (Druck) stehen sie weiter als Felder.
--
-- Eingefügt vor der Feldtabelle `k-f`, nur wo die Ansicht noch die gesäte
-- ist (`k-f` da, kein `k-rules`) — eine eigene Anordnung der Leitung bleibt.
-- Geändert wird nur das Register. Nichts fällt weg.

update interface_def
   set views = jsonb_set(
         views,
         '{full}',
         (select jsonb_agg(x.el order by x.i, x.j)
            from (
              select el, i, 1 as j from jsonb_array_elements(views->'full') with ordinality as t(el, i)
              union all
              select '{"id":"k-rules","el":"rules","fields":["Campaign"]}'::jsonb, i, 0
                from jsonb_array_elements(views->'full') with ordinality as t(el, i)
               where el->>'id' = 'k-f'
            ) x)
       )
 where name = 'Campaign'
   and jsonb_typeof(views->'full') = 'array'
   and exists (select 1 from jsonb_array_elements(views->'full') el where el->>'id' = 'k-f')
   and not exists (select 1 from jsonb_array_elements(views->'full') el where el->>'id' = 'k-rules');
