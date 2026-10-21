-- Notizen auf der Karte (T-214, E-070 a).
--
-- Art `Note` (Bereich play): eine Notiz ist ein eigener Artikel mit dem
-- Text als `Description.description` („Text") und ihrer Sichtbarkeit; auf
-- der Karte steht ein Marker, der auf sie zeigt. Als Marker steht sie als
-- Kurzansicht-Karte (`marker_view = 'card'`).
--
-- Wie 095 nur, wo schon ein Register steht. Ergänzt wird nur, was fehlt;
-- nichts wird entfernt, kein Artikel geändert.
-- Nummer beim Hereinmergen nachgesehen.

insert into interface_def (name, label, abstract, extends, area, titles, marker_view)
select 'Note', 'Note', false, array['Identity', 'Description', 'Status', 'Visibility', 'Tags'],
       'play',
       '{"Description.description":"Text"}'::jsonb,
       'card'
where exists (select 1 from interface_def)
on conflict (name) do nothing;
