-- `always_edit` am Typ fällt weg — es steht am Feld.
--
-- Gestern war es beides. Am Typ traf es aber zwanzig Felder auf einmal: an
-- `Vitals` sind die Trefferpunkte ein Stand, die Zustandsliste dagegen ein
-- Satz Häkchen und die Trefferwürfel Punkte, die der Bogen ohnehin
-- anklickbar zeichnet. Ein Schalter, der die Ausnahme mitnimmt, ist keine
-- Angabe, sondern eine Behauptung über alle.
--
-- Am Feld steht es weiter, und das liegt als JSON in `schema` — diese
-- Spalte trug nichts, was nicht auch dort steht.

alter table interface_def drop column if exists always_edit;
