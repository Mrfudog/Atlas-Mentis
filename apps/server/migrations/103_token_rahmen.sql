-- Tokens: fertige Rundtokens und Ausschnitt am Bild (T-297).
--
-- 1. `Asset.round` — das Bild ist schon ein rundes Token mit eigenem Ring
--    und Schatten (wie die aus 5e.tools): gezeigt, wie es ist.
-- 2. `Asset.frame` — wo der Kreis eines Tokens auf dem Bild sitzt (Mitte
--    in Prozent, Zoom).
-- 3. Das Element `token` in der Vollansicht von Statblock (nach dem Bild)
--    und Kreatur (Reiter Overview, nach dem Bild): das Token, wie es auf
--    der Karte steht, mit „Adjust token".
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Eingefügt wird nur, wo die Anordnung noch kein Token hat; nichts fällt
-- weg, kein Artikel wird geändert (welche Bilder Rundtokens sind, setzt
-- eine Massenänderung mit Vorschau, nicht der Start).

update interface_def
   set schema = jsonb_set(
         jsonb_set(
           schema::jsonb,
           '{properties,round}',
           '{"type":"boolean","title":"Ready-made token","description":"Already a round token with its own frame: shown as it is, not cut into a circle."}'::jsonb
         ),
         '{properties,frame}',
         '{"type":"object","title":"Token frame","description":"Where the circle of a token sits on this image: centre x and y in percent, and zoom. Set with “Adjust token”."}'::jsonb
       )::json
 where name = 'Asset'
   and not (schema::jsonb -> 'properties') ? 'round';

-- Statblock: nach dem Bild, sonst obenan.
update interface_def
   set views = jsonb_set(
         views,
         '{full}',
         (select coalesce(jsonb_agg(x order by i), '[]'::jsonb)
            from (
              select e as x, (n * 2)::int as i from jsonb_array_elements(views -> 'full') with ordinality t(e, n)
              union all
              select '{"id":"s-token","el":"token"}'::jsonb,
                     coalesce((select (n * 2 + 1)::int from jsonb_array_elements(views -> 'full') with ordinality t(e, n) where e ->> 'el' = 'image' limit 1), 1)
            ) s)
       )
 where name = 'Statblock'
   and jsonb_typeof(views -> 'full') = 'array'
   and views::text not like '%"el": "token"%';

-- Kreatur: im Reiter `about` der Reiterleiste, nach dem Bild.
do $$
declare
  v jsonb;
  ti int;
  ri int;
  lay jsonb;
  bild int;
begin
  select views into v from interface_def where name = 'Creature';
  if v is null or jsonb_typeof(v -> 'full') <> 'array' or v::text like '%"el": "token"%' then
    return;
  end if;
  select (n - 1)::int into ti from jsonb_array_elements(v -> 'full') with ordinality t(e, n) where e ->> 'el' = 'tabs' limit 1;
  if ti is null then
    return;
  end if;
  select (n - 1)::int into ri from jsonb_array_elements(v -> 'full' -> ti -> 'tabs') with ordinality t(e, n) where e ->> 'id' = 'about' limit 1;
  if ri is null then
    return;
  end if;
  lay := v -> 'full' -> ti -> 'tabs' -> ri -> 'layout';
  select (n - 1)::int into bild from jsonb_array_elements(lay) with ordinality t(e, n) where e ->> 'el' = 'image' limit 1;
  lay := jsonb_insert(lay, array[coalesce(bild, -1)::text], '{"id":"c-token","el":"token"}'::jsonb, bild is not null);
  if bild is null then
    lay := '[{"id":"c-token","el":"token"}]'::jsonb || (v -> 'full' -> ti -> 'tabs' -> ri -> 'layout');
  end if;
  update interface_def set views = jsonb_set(v, array['full', ti::text, 'tabs', ri::text, 'layout'], lay) where name = 'Creature';
end
$$;
