-- ============================================================
-- 旅遊揪團 App · Supabase 資料表
-- 在 Supabase 專案的 SQL Editor 貼上並執行即可。
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists trips (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name       text not null,
  created_at timestamptz default now()
);

create table if not exists members (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  nickname   text not null,
  created_at timestamptz default now(),
  unique (trip_id, nickname)
);

create table if not exists availability (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  date       date not null,
  unique (trip_id, member_id, date)
);

create table if not exists destinations (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  name       text not null,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists preferences (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips(id) on delete cascade,
  member_id      uuid not null references members(id) on delete cascade,
  destination_id uuid not null references destinations(id) on delete cascade,
  rank           int not null,
  unique (trip_id, member_id, destination_id)
);

create index if not exists idx_members_trip on members(trip_id);
create index if not exists idx_avail_trip on availability(trip_id);
create index if not exists idx_dest_trip on destinations(trip_id);
create index if not exists idx_pref_trip on preferences(trip_id);

-- ------------------------------------------------------------
-- RLS：這個 App 沒有帳號登入，改用「知道邀請碼即可存取」模式。
-- 因此開放 anon 角色讀寫（等同：任何拿到邀請碼的人都能操作該揪團）。
-- 這是朋友間小工具的合理取捨；若日後要更嚴謹，可改為登入 + 依 trip 成員限制。
-- ------------------------------------------------------------
alter table trips        enable row level security;
alter table members      enable row level security;
alter table availability enable row level security;
alter table destinations enable row level security;
alter table preferences  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['trips','members','availability','destinations','preferences']
  loop
    execute format('drop policy if exists "public_all" on %I;', t);
    execute format(
      'create policy "public_all" on %I for all to anon, authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;
