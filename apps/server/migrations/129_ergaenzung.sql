-- Ergänzungen (T-142, E-125): die Kante `overrides` darf die Felder nennen,
-- die eine Fassung trägt (`props.fields`) — dann ersetzt sie das Original
-- nicht, sondern legt nur diese Felder darüber (`withSupplements`). So
-- gelten die Formen aus Basils System neben den geschätzten Preisen.
--
-- Wie 070 nur, wo schon ein Register steht. Ergänzt wird nur, was fehlt;
-- nichts wird entfernt, kein Artikel geändert.

update relation_def
   set props = jsonb_set(
     props,
     '{properties,fields}',
     '{"type":"array","items":{"type":"string"},"title":"Only these fields","description":"Makes it a supplement: only these fields (Type.field) are laid over the article, which stays in play."}'::jsonb
   )
 where type = 'overrides'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not (props -> 'properties') ? 'fields';
