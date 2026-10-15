-- Filtergruppen ohne Ebenenteil (T-186): die Seiten World, Story, Rules und
-- Compendium haben keinen eigenen Ebenenfilter mehr — welche Ebenen gelten,
-- sagt der globale Stand unter der Kampagne in der Kopfleiste, und dort
-- lassen sich Auswahlen jetzt benannt speichern. Eine Gruppe hält darum nur
-- noch Arten, Marken, Stand, Suche und Facetten.
--
-- Was eine Gruppe an Ebenen trug (`layer`: nur diese, `nolayer`: ohne
-- diese), geht nicht still verloren: es steht danach in
-- `list_filter_ebenen_alt`, je Gruppe eine Zeile, und wird gezählt. Die
-- Leitung kann daraus eine gespeicherte Ebenenauswahl machen; gelesen wird
-- die Tabelle vom Server nicht.
create table if not exists list_filter_ebenen_alt (
  id         text primary key,
  page       text not null,
  name       text not null,
  campaign_id text,
  user_id    text,
  layer      jsonb,
  nolayer    jsonb,
  moved_at   timestamptz not null default now()
);

do $$
declare
  n integer;
  namen text;
begin
  insert into list_filter_ebenen_alt (id, page, name, campaign_id, user_id, layer, nolayer)
  select id, page, name, campaign_id, user_id, filter -> 'layer', filter -> 'nolayer'
    from list_filter
   where filter ? 'layer' or filter ? 'nolayer'
  on conflict (id) do nothing;

  select count(*), string_agg(page || ' › ' || name, ', ')
    into n, namen
    from list_filter
   where filter ? 'layer' or filter ? 'nolayer';

  update list_filter
     set filter = filter - 'layer' - 'nolayer',
         updated_at = now()
   where filter ? 'layer' or filter ? 'nolayer';

  if n > 0 then
    raise notice 'Filtergruppen ohne Ebenenteil: % Gruppe(n), Angaben in list_filter_ebenen_alt: %', n, namen;
  end if;
end $$;
