-- D0: three generic storage tables plus the registry as rows. Postgres, no Directus.
-- Adding a kind of thing is an INSERT into `interface`, never a migration.

create table if not exists component_def (
  name   text primary key,
  label  text,
  engine text,
  schema jsonb not null
);

create table if not exists interface_def (
  name        text primary key,
  label       text,
  abstract    boolean not null default false,
  extends     text[]  not null default '{}',
  requires    text[]  not null default '{}',
  allows      text[]  not null default '{}',
  block_types text[]  not null default '{}'
);

create table if not exists relation_def (
  type          text primary key,
  label         text not null,
  inverse_label text not null,
  from_ifaces   text[] not null default '{*}',
  to_ifaces     text[] not null default '{*}',
  owned         boolean not null default false,
  cardinality   text not null default 'many',
  section       text,
  props         jsonb not null default '{}'
);

create table if not exists view_def (
  key    text primary key,
  label  text not null,
  ord    int  not null default 99,
  config jsonb not null
);

-- Campaign-wide {VAR} register: the last scope variable resolution falls back to.
create table if not exists var_def (
  name  text primary key,
  value text not null
);

-- ---------------------------------------------------------------- storage

-- peg: an opaque id and nothing else (D15 / REQ-163)
create table if not exists entity (
  id         uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- card: at most one payload per type per entity, absent when unused
create table if not exists component (
  entity_id uuid not null references entity(id) on delete cascade,
  type      text not null references component_def(name),
  payload   jsonb not null,
  primary key (entity_id, type)
);
create index if not exists component_payload_idx on component using gin (payload jsonb_path_ops);
create index if not exists component_type_idx on component (type);

-- string: a typed, directed edge that may carry its own props.
-- Stored once, in one direction; the reverse is the to_id index below.
create table if not exists relation (
  id        uuid primary key,
  from_id   uuid not null references entity(id) on delete cascade,
  to_id     uuid not null references entity(id) on delete cascade,
  type      text not null references relation_def(type),
  props     jsonb not null default '{}',
  ord       int
);
create index if not exists relation_from_idx on relation (from_id, type);
create index if not exists relation_to_idx   on relation (to_id, type);

-- REQ-003: the change chain. Append-only, so a single mis-edit is recoverable
-- without restoring a whole dump.
create table if not exists event_log (
  id      uuid primary key,
  name    text not null,
  actor   uuid,
  subject uuid,
  payload jsonb not null default '{}',
  at      timestamptz not null default now()
);
create index if not exists event_log_subject_idx on event_log (subject, at desc);
