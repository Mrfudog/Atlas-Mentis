-- Die Erfassungsmasken (T-425, REQ-432, E-169): zwei Ortsansichten, `create`
-- (der schnelle Dialog, auch aus einer Auswahl) und `createFull` (die
-- Artikelseite im Bearbeiten nach „New article“). Ein Ort fragt nach ihnen
-- (`PLACE_VIEWS`), also kommen sie auf jede bestehende Installation — nur,
-- wo schon ein Register steht. Leer gestaltet: ohne eigene Gestaltung einer
-- Art gilt das Heutige. Steht eine gleichnamige Ansicht schon da, bleibt sie.
-- Entfernt wird nichts.

insert into view_def (key, label, ord, config)
select 'create', 'Create', 6, '{"label":"Create","order":6,"fields":"none","description":false,"composed":false,"relations":false,"bindings":false,"image":false,"layout":[{"id":"cr-f","el":"fields","fields":[]}]}'::jsonb
 where exists (select 1 from interface_def)
on conflict (key) do nothing;

insert into view_def (key, label, ord, config)
select 'createFull', 'Create (full)', 7, '{"label":"Create (full)","order":7,"fields":"none","description":true,"composed":false,"relations":false,"bindings":false,"image":false,"layout":[{"id":"cf-f","el":"fields","fields":[]}]}'::jsonb
 where exists (select 1 from interface_def)
on conflict (key) do nothing;
