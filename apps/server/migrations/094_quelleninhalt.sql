-- Der Inhalt einer Quelle als Element ihrer Seite (T-189).
--
-- Die Leitung (15.10.): „im Artikel möchte ich Links sehen zu allen
-- Artikeln, die hinzugefügt werden. Darin möchte ich auch die Wahl
-- widerspiegeln inkl. Subelemente bis hin zu einzelnen Artikeln.“ Die
-- Ebene bekommt in `full` das Element `contents` vor der Leseansicht.
--
-- Gesetzt wird **nur, wo `full` der Ebene leer ist oder noch steht, wie
-- Migration 084 es schrieb** — was jemand im Register eingestellt hat,
-- bleibt. Nichts wird entfernt, kein Artikel geändert.

update interface_def i
   set views = jsonb_set(coalesce(i.views, '{}'::jsonb), array[v.ansicht], v.wert)
  from (values
    ('Layer', 'full', '{"adjust":{"extra":[{"id":"l-contents","el":"contents"},{"id":"l-reader","el":"reader"}]}}'::jsonb)
  ) as v(art, ansicht, wert)
 where i.name = v.art
   and (coalesce(i.views, '{}'::jsonb) -> v.ansicht is null
        or coalesce(i.views, '{}'::jsonb) -> v.ansicht = '{"adjust":{"extra":[{"id":"l-reader","el":"reader"}]}}'::jsonb);
