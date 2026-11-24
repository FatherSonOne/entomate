-- The workspace policy API and recording-retention sweep both key settings by tenant ID.
create table public.workspace_settings (
  workspace_id uuid primary key references public.tenant_organizations(id) on delete cascade,
  integrations_json jsonb not null default '{}'::jsonb,
  security_json jsonb not null default '{}'::jsonb,
  data_controls_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_settings enable row level security;
revoke all on table public.workspace_settings from public, anon, authenticated;
grant select, insert, update on table public.workspace_settings to service_role;
