-- Cognis — esquema inicial.
-- Compatível com Supabase (usa auth.users, auth.uid() e os papéis anon/authenticated).
-- Regra central de segurança: clientes (anon/authenticated) só LEEM os próprios
-- dados. Toda escrita de tentativas, respostas e resultados é feita pelo servidor
-- da aplicação, que calcula a pontuação; o frontend nunca grava escores.

-- ---------------------------------------------------------------- utilidades
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- perfis
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  role text not null default 'user' check (role in ('user', 'admin')),
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, privacy_accepted_at)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), ''),
    case when (new.raw_user_meta_data ->> 'privacy_accepted') = 'true' then now() end
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- conteúdo
create table public.categories (
  id text primary key check (id ~ '^[a-z_]{2,40}$'),
  name text not null,
  description text not null,
  construct text not null,
  practice jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.questions (
  id text primary key check (id ~ '^[a-z]{2,4}-[0-9]{3}$'),
  version integer not null default 1 check (version >= 1),
  locale text not null default 'pt-BR',
  category_id text not null references public.categories (id) on update cascade,
  difficulty smallint not null check (difficulty between 1 and 3),
  format text not null check (format in ('text', 'matrix', 'sequence', 'figure_choice', 'memory')),
  prompt text not null,
  stimulus jsonb,
  figure jsonb,
  answer_option_id text not null,
  explanation text not null,
  rationale text not null,
  recommended_seconds integer not null check (recommended_seconds between 10 and 300),
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'retired')),
  active boolean not null default true,
  tags text[] not null default '{}',
  quality jsonb not null default '{}'::jsonb,
  irt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_category_idx on public.questions (category_id, difficulty) where active;
create trigger questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

create table public.question_options (
  question_id text not null references public.questions (id) on delete cascade,
  option_id text not null check (option_id ~ '^[a-z0-9_-]{1,32}$'),
  position smallint not null,
  text text,
  figure jsonb,
  primary key (question_id, option_id),
  unique (question_id, position),
  check ((text is null) <> (figure is null))
);

-- O gabarito precisa existir entre as alternativas (checado ao fim da transação).
create or replace function public.check_question_answer() returns trigger
language plpgsql set search_path = '' as $$
declare
  -- Funciona para as duas tabelas (questions.id e question_options.question_id) e para DELETE.
  qid text := coalesce(
    to_jsonb(new) ->> 'question_id', to_jsonb(new) ->> 'id',
    to_jsonb(old) ->> 'question_id', to_jsonb(old) ->> 'id');
begin
  if exists (select 1 from public.questions q where q.id = qid)
     and not exists (
       select 1 from public.questions q
       join public.question_options o on o.question_id = q.id and o.option_id = q.answer_option_id
       where q.id = qid) then
    raise exception 'question % has no option matching its answer key', qid;
  end if;
  return null;
end;
$$;
create constraint trigger questions_answer_check after insert or update on public.questions
  deferrable initially deferred for each row execute function public.check_question_answer();
create constraint trigger options_answer_check after insert or update or delete on public.question_options
  deferrable initially deferred for each row execute function public.check_question_answer();

create table public.test_versions (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  time_limit_seconds integer not null check (time_limit_seconds between 300 and 7200),
  blueprint jsonb not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  activated_at timestamptz
);
-- No máximo uma versão ativa por vez.
create unique index test_versions_single_active on public.test_versions (status) where status = 'active';

create table public.scientific_references (
  id text primary key,
  authors text not null,
  year integer not null,
  title text not null,
  source text not null,
  doi text,
  url text not null,
  topic text not null,
  used_for text not null
);

-- Tabelas normativas: vazias até existir estudo de padronização real.
create table public.norm_tables (
  id text primary key,
  test_version_id text not null references public.test_versions (id),
  population text not null,
  sample_size integer not null check (sample_size >= 0),
  collected_from date,
  collected_to date,
  reliability double precision,
  validated boolean not null default false,
  raw_to_standard jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- avaliação
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  anon_session_hash text check (anon_session_hash is null or anon_session_hash ~ '^[0-9a-f]{64}$'),
  test_version_id text not null references public.test_versions (id),
  seed integer not null check (seed > 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'expired', 'abandoned')),
  locale text not null default 'pt-BR',
  consented_at timestamptz not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  share_token_hash text unique check (share_token_hash is null or share_token_hash ~ '^[0-9a-f]{64}$'),
  check (user_id is not null or anon_session_hash is not null),
  check (deadline_at > started_at)
);
create index attempts_user_idx on public.attempts (user_id, started_at desc);
create index attempts_anon_idx on public.attempts (anon_session_hash) where anon_session_hash is not null;
create index attempts_status_idx on public.attempts (status);

create table public.attempt_items (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  position smallint not null check (position >= 0),
  question_id text not null references public.questions (id),
  option_order text[] not null,
  stimulus_shown_at timestamptz,
  primary key (attempt_id, position),
  unique (attempt_id, question_id)
);

create table public.responses (
  attempt_id uuid not null,
  question_id text not null,
  selected_option_id text,
  is_correct boolean,
  time_spent_ms integer not null default 0 check (time_spent_ms >= 0),
  revision integer not null default 1,
  answered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id),
  foreign key (attempt_id, question_id) references public.attempt_items (attempt_id, question_id) on delete cascade
);

create table public.results (
  attempt_id uuid primary key references public.attempts (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  test_version_id text not null references public.test_versions (id),
  scoring_version text not null,
  total_items integer not null check (total_items > 0),
  correct integer not null check (correct >= 0),
  incorrect integer not null check (incorrect >= 0),
  unanswered integer not null check (unanswered >= 0),
  percent_correct double precision not null check (percent_correct between 0 and 100),
  performance_index double precision not null check (performance_index between 0 and 100),
  total_time_ms integer not null check (total_time_ms >= 0),
  mean_time_ms integer not null check (mean_time_ms >= 0),
  by_category jsonb not null,
  by_difficulty jsonb not null,
  ability_estimate jsonb,
  normed_score double precision,
  created_at timestamptz not null default now(),
  check (correct + incorrect + unanswered = total_items)
);
create index results_user_idx on public.results (user_id, created_at desc);

-- Histórico de pontuações (respeita o RLS de quem consulta).
create view public.score_history with (security_invoker = true) as
  select r.attempt_id, r.user_id, a.completed_at, a.status, r.test_version_id,
         r.performance_index, r.correct, r.total_items, r.total_time_ms
  from public.results r
  join public.attempts a on a.id = r.attempt_id;

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.test_versions enable row level security;
alter table public.scientific_references enable row level security;
alter table public.norm_tables enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_items enable row level security;
alter table public.responses enable row level security;
alter table public.results enable row level security;
alter table public.admin_audit_log enable row level security;

-- Conteúdo público (sem gabaritos).
create policy categories_public_read on public.categories
  for select to anon, authenticated using (active);
create policy references_public_read on public.scientific_references
  for select to anon, authenticated using (true);
create policy versions_public_read on public.test_versions
  for select to anon, authenticated using (status = 'active');

-- questions, question_options, norm_tables e admin_audit_log: sem políticas ⇒
-- nenhum acesso via API pública. Gabaritos nunca saem pelo Data API.

-- Dados pessoais: somente o próprio titular, somente leitura.
create policy profiles_self_read on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_self_update on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy attempts_owner_read on public.attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy attempt_items_owner_read on public.attempt_items
  for select to authenticated using (
    exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = (select auth.uid())));
create policy responses_owner_read on public.responses
  for select to authenticated using (
    exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = (select auth.uid())));
create policy results_owner_read on public.results
  for select to authenticated using (user_id = (select auth.uid()));

-- Privilégios explícitos (defesa em profundidade além do RLS).
revoke all on public.questions, public.question_options, public.norm_tables, public.admin_audit_log
  from anon, authenticated;
revoke insert, update, delete, truncate on
  public.attempts, public.attempt_items, public.responses, public.results,
  public.categories, public.test_versions, public.scientific_references
  from anon, authenticated;
revoke all on public.profiles from anon;
revoke insert, update, delete, truncate on public.profiles from authenticated;
-- O titular só pode alterar o próprio nome de exibição (nunca o papel).
grant update (display_name) on public.profiles to authenticated;
revoke all on public.score_history from anon;
grant select on public.score_history to authenticated;
