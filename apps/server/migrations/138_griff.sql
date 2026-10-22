-- Der Griff (T-244): `holds.props.grip` — `two` heisst beide Hände
-- (vielseitig mit dem zweiten Würfel, zweihändig zum Angreifen). Auf
-- bestehenden Datenbanken nachziehen, wie 070 — **nur, wo schon ein
-- Register steht**. Ergänzt wird nur, was fehlt; nichts wird entfernt,
-- kein Artikel geändert.

update relation_def
   set props = jsonb_set(
     props,
     '{properties,grip}',
     '{"type":"string","title":"Grip","enum":["one","two"],"description":"Two: held in both hands (versatile damage, or a two-handed weapon ready to attack)."}'::jsonb
   )
 where type = 'holds'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not (props -> 'properties') ? 'grip';
