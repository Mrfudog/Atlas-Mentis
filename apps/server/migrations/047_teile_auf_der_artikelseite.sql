-- Die Teile eines Kapitels auf seiner Artikelseite (T-108, E14).
--
-- Ein Kapitel, eine Szene oder ein Arc besteht seit T-108 aus Teilen mit
-- Rang (`partOf.rank`). Die Grundanordnung der Artikelseite (`full`)
-- bekommt dafür das Element `parts` hinter der Prosa — es zeichnet die
-- Teile wie im Buch und nichts, wo keine hängen. Der Seed schreibt nur in
-- eine leere Datenbank; hier kommt es in eine bestehende, **nur dort, wo
-- die Anordnung noch die Prosa `l-b` hat** und `parts` noch fehlt. Eine
-- Anordnung, die jemand umgebaut hat, bleibt, wie sie ist. Entfernt wird
-- nichts.

update view_def v
   set config = jsonb_insert(v.config, array['layout', (x.i - 1)::text], '{"id":"l-parts","el":"parts"}'::jsonb, true)
  from (
    select vd.key, min(e.i) as i
      from view_def vd
      cross join lateral jsonb_array_elements(vd.config->'layout') with ordinality as e(el, i)
     where vd.key = 'full' and e.el->>'id' = 'l-b'
     group by vd.key
  ) x
 where v.key = x.key
   and not exists (
     select 1 from jsonb_array_elements(v.config->'layout') y where y->>'el' = 'parts'
   );
