-- Zonen und Gebiete auf der Karte (T-219, REQ-193): die Seite zeichnet sie
-- jetzt, aufs Gitter gerastert. Dafür nennen die Kanten, was `shapeOf`
-- schon las und das Schema nicht sagte, und gehören wie ein Marker einer
-- Ebene (`floor`; leer: das Erdgeschoss):
--
-- 1. `zone` bekommt `r` (Kreis), `pts` (Vieleck) und `floor`.
-- 2. `territory` bekommt `floor` und verliert `intended`, wie `zone` in 160.
--
-- Nur, wo noch steht, was das Register gebracht hat; was jemand im Register
-- geändert hat, bleibt. Kein Artikel wird geändert: eine Fläche ohne
-- `floor` lag bisher auf jeder Ebene und liegt jetzt im Erdgeschoss — auf
-- dev fand die Suche nach Zonenarten am 28.10. keine (T-219).
-- Die Nummer ist beim Hereinmergen nachgesehen (164).

update relation_def
   set props = jsonb_set(
         props,
         '{properties}',
         (props -> 'properties')
           || jsonb_build_object(
                'r', '{"type":"number","title":"Radius (0–1)"}'::jsonb,
                'pts', '{"type":"array","title":"Points"}'::jsonb,
                'floor', '{"type":"string","title":"Floor"}'::jsonb
              )
       )
 where type = 'zone'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'floor');

update relation_def
   set props = jsonb_set(
         props,
         '{properties}',
         (props -> 'properties') || jsonb_build_object('floor', '{"type":"string","title":"Floor"}'::jsonb)
       )
 where type = 'territory'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'floor');

update relation_def
   set intended = null
 where type = 'territory'
   and intended = 'Draw on the map screen: the shape in its colour over the map.';
