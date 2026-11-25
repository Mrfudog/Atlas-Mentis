-- Der Stand der letzten Übernahme (T-130, REQ-155).
--
-- Eine Übernahme zwischen zwei Installationen (dev ↔ prod) vergleicht wie
-- git mit einer Basis: dem Stand, auf dem beide Seiten zuletzt gleich
-- standen. Er steht hier, auf der Installation, die die Übernahme auslöst,
-- je Gegenstelle (`peer`, ihr Name) und Schlüssel (Peg-Id eines Artikels
-- oder `registry:<teil>:<name>`). Neben dem Bestand und nicht im Artikel:
-- eine Ausfuhr nimmt sie nicht mit, und ein Überklonen setzt sie neu.
-- Neu angelegt, nichts entfernt.
create table if not exists transfer_base (
  peer  text not null,
  key   text not null,
  value jsonb not null,
  at    timestamptz not null default now(),
  primary key (peer, key)
);
