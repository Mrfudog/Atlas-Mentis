-- Reise an der Gruppe (T-350, REQ-170).
--
-- Die Anordnung `full` der Gruppe (`Party`) bekommt nach `p-desc` das
-- Element `p-travel` (`travel`): Tag, Wache, wann Rationen und Licht
-- fällig sind, und die Schritte „Wait a watch" und „Next node". Die
-- Zähler stehen weiter in der Feldtabelle.
--
-- Nur, wo die Anordnung ein Array mit `p-desc` ist und `p-travel` noch
-- fehlt — eine eigene Anordnung ohne `p-desc` bleibt, wie sie ist.
-- Kein Artikel wird geändert.

update interface_def d
   set views = jsonb_set(
         d.views::jsonb,
         '{full}',
         (
           select jsonb_agg(el order by ord, sub)
             from (
               select e.el, e.ord, 0 as sub
                 from jsonb_array_elements(d.views::jsonb -> 'full') with ordinality as e(el, ord)
               union all
               select '{"id":"p-travel","el":"travel"}'::jsonb, s.ord, 1
                 from (
                   select e.ord
                     from jsonb_array_elements(d.views::jsonb -> 'full') with ordinality as e(el, ord)
                    where e.el ->> 'id' = 'p-desc'
                    limit 1
                 ) s
             ) alle
         )
       )
 where d.name = 'Party'
   and jsonb_typeof(d.views::jsonb -> 'full') = 'array'
   and exists (select 1 from jsonb_array_elements(d.views::jsonb -> 'full') e where e ->> 'id' = 'p-desc')
   and not exists (select 1 from jsonb_array_elements(d.views::jsonb -> 'full') e where e ->> 'id' = 'p-travel');
