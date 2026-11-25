-- Board-Kacheln mit der Ansicht `search` zeigen `quick` (vor 127, T-346).
--
-- 127 entfernt die Ansicht `search` und stellte als letzte Anweisung die
-- Kacheln, die sie nennen, auf `quick` um. Ihre Prüfabfrage zählte genau
-- diese Kacheln aber schon vor dem Lauf und hielt den Start auf dev an
-- (eine Kachel auf einem Testboard, 21.10.) — umgestellt worden wäre sie
-- ja erst danach. Darum läuft die Umstellung hier zuerst; die Prüfabfrage
-- in 127 bleibt und zählt dann, was wirklich noch `search` nennt.
--
-- Nur, wo die Ansicht `search` noch die aus dem Register ist (127 löscht
-- genau diese). Hat jemand sie im Designer geändert, bleibt sie, und ihre
-- Kacheln behalten sie.

update relation
   set props = jsonb_set(props, '{view}', '"quick"')
 where type = 'placed'
   and props->>'view' = 'search'
   and not exists (
     select 1 from view_def
      where key = 'search'
        and config <> '{"label":"Search","order":6,"fields":"none","description":true,"composed":false,"relations":false,"bindings":false,"image":true,"layout":[{"id":"s-img","el":"image"},{"id":"s-desc","el":"description"},{"id":"s-f","el":"fields","fields":[]}]}'::jsonb
   );
