-- Revision je Artikel (T-063, REQ-192).
--
-- Zwei Geräte bearbeiten denselben Artikel: bisher gewann still, wer
-- zuletzt speicherte. Jetzt zählt jeder Artikel seine Schreibvorgänge;
-- wer schreibt, nennt die Revision, die er gelesen hat, und steht
-- inzwischen eine andere da, wird nicht geschrieben (409), sondern
-- zusammengeführt. `updated_at` taugt dafür nicht: `now()` ist die Zeit
-- des Transaktionsbeginns, und zwei Schreiben in derselben Millisekunde
-- sähen gleich aus.
--
-- Verloren geht nichts: jeder bestehende Artikel beginnt bei 1.

alter table entity add column if not exists revision integer not null default 1;
