-- Ein Rüstungsplatz und die Grenze der Einstimmung (T-365, E-153 V5).
--
-- `holds.props.slot` bekommt `armor` dazu: die Kleidung einzeln (Kopf,
-- Torso, Handschuhe, Stiefel) kommt mit T-388, bis dahin gibt es einen
-- Platz für die Rüstung. Die alten Werte bleiben in der Liste — was dort
-- liegt, behält seinen Platz, kein Artikel wird geändert.
--
-- `slotDraw` wird nur ersetzt, wo noch die alte Vorgabe steht; hat die
-- Leitung die Plätze unter Rules & options geändert, bleibt ihre Fassung
-- und bekommt nur `armor:-` dazu. `attunementLimit` kommt mit 3, wie in 5e.
-- Alles nur, wo schon ein Register steht (wie 104 und 138).

update relation_def
   set props = jsonb_set(
     props,
     '{properties,slot,enum}',
     (props #> '{properties,slot,enum}') || '["armor"]'::jsonb
   )
 where type = 'holds'
   and jsonb_typeof(props #> '{properties,slot,enum}') = 'array'
   and not (props #> '{properties,slot,enum}') ? 'armor';

update setting_def
   set value = 'mainHand:free action, offHand:free action, holster1:free action, holster2:free action, '
            || 'belt:free action, shoulders:bonus action, armor:-, '
            || 'legs:action, ringR1:action, ringR2:action, ringR3:action, ringR4:action, '
            || 'ringL1:action, ringL2:action, ringL3:action, ringL4:action, '
            || 'neck1:action, neck2:action, neck3:action, neck4:action'
 where key = 'slotDraw'
   and value = 'mainHand:free action, offHand:free action, holster1:free action, holster2:free action, '
            || 'belt:free action, shoulders:bonus action, head:action, torso:action, hands:action, '
            || 'legs:action, feet:action, ringR1:action, ringR2:action, ringR3:action, ringR4:action, '
            || 'ringL1:action, ringL2:action, ringL3:action, ringL4:action, '
            || 'neck1:action, neck2:action, neck3:action, neck4:action';

update setting_def
   set value = value || ', armor:-'
 where key = 'slotDraw'
   and value !~ '(^|,)\s*armor:';

insert into setting_def (key, value)
select 'attunementLimit', '3'
 where exists (select 1 from setting_def)
on conflict (key) do nothing;
