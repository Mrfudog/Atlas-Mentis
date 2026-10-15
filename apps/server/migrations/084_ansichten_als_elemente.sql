-- Leseansicht und Übersichten als Elemente der Artikelseite (T-191).
--
-- Die Leitung (15.10.): „Die Leseansicht (Read) sollte eine Ansicht der
-- Artikel sein“ und „Die Klassenübersicht sollte eine View sein“. Die
-- Seiten `/read/:layer`, `/classes/:id`, `/ancestries/:id` und
-- `/backgrounds/:id` werden Elemente in `full` ihrer Art — die Anordnung
-- wohnt am Typ:
--
-- 1. `Layer` `full`: das Element `reader` (das Buch der Ebene).
-- 2. `Class` `full`: `classOverview` unter Bild und Beschreibung.
-- 3. `Ancestry`, `Background` `full`: `originOverview` ebenso.
--
-- Gesetzt wird **nur, wo die Art für `full` noch nichts sagt** — was
-- jemand im Register eingestellt hat, bleibt. Nichts wird entfernt, kein
-- Artikel geändert.

update interface_def i
   set views = jsonb_set(coalesce(i.views, '{}'::jsonb), array[v.ansicht], v.wert)
  from (values
    ('Class', 'full', '{"adjust":{"extra":[{"id":"l-classOverview","el":"classOverview"}],"order":["l-img","l-desc","l-classOverview"]}}'::jsonb),
    ('Ancestry', 'full', '{"adjust":{"extra":[{"id":"l-originOverview","el":"originOverview"}],"order":["l-img","l-desc","l-originOverview"]}}'::jsonb),
    ('Background', 'full', '{"adjust":{"extra":[{"id":"l-originOverview","el":"originOverview"}],"order":["l-img","l-desc","l-originOverview"]}}'::jsonb),
    ('Layer', 'full', '{"adjust":{"extra":[{"id":"l-reader","el":"reader"}]}}'::jsonb)
  ) as v(art, ansicht, wert)
 where i.name = v.art
   and coalesce(i.views, '{}'::jsonb) -> v.ansicht is null;
