-- Ein Licht ohne Artikel (T-320): die Kante `marker` kennt die Art `light`.
-- Eine Fackel an der Wand, ein Lichtschacht — der Marker zeigt wie ein
-- Übergang auf seine eigene Karte. Nur das Register wird nachgezogen;
-- nichts wird entfernt, kein Artikel geändert. Die Nummer wird beim
-- Hereinmergen nachgesehen.

update relation_def
   set props = jsonb_set(props, '{properties,kind,enum}', '["static","scenery","party","quest","play","passage","light"]'::jsonb)
 where type = 'marker'
   and jsonb_typeof(props #> '{properties,kind,enum}') = 'array'
   and not ((props #> '{properties,kind,enum}') ? 'light');
