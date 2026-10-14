-- Die Ansicht `search` (T-138): das „+" der übergreifenden Suche — Bild,
-- Beschreibung und je Art die Felder, die sie dazunimmt. Ein Ort fragt
-- nach ihr (`PLACE_VIEWS`), also kommt sie auf jede bestehende
-- Installation.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt die Zeile hier
-- nach — **nur, wo schon ein Register steht** (wie 061). Steht schon eine
-- Ansicht `search` da, bleibt sie. Entfernt wird nichts.

insert into view_def (key, label, ord, config)
select 'search', 'Search', 6, '{"label":"Search","order":6,"fields":"none","description":true,"composed":false,"relations":false,"bindings":false,"image":true,"layout":[{"id":"s-img","el":"image"},{"id":"s-desc","el":"description"},{"id":"s-f","el":"fields","fields":[]}]}'::jsonb
 where exists (select 1 from interface_def)
on conflict (key) do nothing;
