create table if not exists public.print_form_templates (
  id uuid primary key,
  code varchar(128),
  name text not null,
  name_eng text not null,
  description text,
  template_pdf bytea not null,
  data_sql text not null,
  field_mapping jsonb not null default '[]'::jsonb,
  overlay_settings jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_print_form_templates_code
  on public.print_form_templates(code)
  where deleted = false and code is not null;

create index if not exists ix_print_form_templates_deleted
  on public.print_form_templates(deleted);
