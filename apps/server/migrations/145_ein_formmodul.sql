-- Ein Formmodul, nicht zwei (T-394, D91, Entscheid der Leitung 26.10.).
--
-- Die Vorgabeformen stehen in der Ebene der Mechanik Grid (D90); die
-- Mechanik „Default shapes“ (`ly_rm_shapes`) brachte daneben eine zweite,
-- leere Formebene ins Regelsystem Inventory. Sie fällt aus den Startzeilen
-- (`packages/registry/src/regelsysteme.ts`) und hier aus dem Bestand —
-- mit ihren Kanten (Gruppe, Kompatibilität, Aufschaltungen) und den
-- Rechten und Leseständen daneben.
--
-- Weg geht sie nur leer: trägt ihre Karte Gruppen oder Werte, oder liegt
-- ein Artikel in ihr, zählt die Prüfabfrage, und der Start bricht ohne
-- Freigabe ab (T-076) — dann gehören die Werte erst nach Grid.
-- Nummer beim Hereinmergen nachgesehen: 145.
--
-- verlust: select count(*) from entity e where e.id = 'ly_rm_shapes' and (exists (select 1 from component c where c.entity_id = e.id and c.type = 'ShapeDefaults' and (jsonb_array_length(coalesce(c.payload->'shapeGroups', '[]'::jsonb)) > 0 or jsonb_array_length(coalesce(c.payload->'shapeItems', '[]'::jsonb)) > 0)) or exists (select 1 from relation r where r.to_id = e.id and r.type = 'inLayer'))

delete from app_user_layer where layer_id = 'ly_rm_shapes';
delete from reading_position where layer_id = 'ly_rm_shapes';
delete from app_user_article where entity_id = 'ly_rm_shapes';
delete from entity_creator where entity_id = 'ly_rm_shapes';
delete from entity_ready where entity_id = 'ly_rm_shapes';
delete from relation where to_id = 'ly_rm_shapes' or from_id = 'ly_rm_shapes';
delete from entity where id = 'ly_rm_shapes';
