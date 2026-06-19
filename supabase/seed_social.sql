-- ════════════════════════════════════════════════════════════════════════
--  ADMIN-ONLY social graph seeder. Run in the Supabase SQL Editor after the
--  cold-start seed. Table is public.follows (follower_id → following_id).
--  Seed accounts identified by seed+N@5sfindr.local.
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  v_anchor uuid;
begin
  select id into v_anchor from public.profiles where name = 'Zoran Miller' limit 1;

  -- A) The Anchor: exactly 23 random seed users follow Zoran.
  if v_anchor is not null then
    insert into public.follows (follower_id, following_id)
    select s.id, v_anchor
    from (
      select p.id
      from public.profiles p
      join auth.users u on u.id = p.id
      where u.email like 'seed+%@5sfindr.local'
      order by random()
      limit 23
    ) s
    on conflict (follower_id, following_id) do nothing;
  else
    raise notice 'Profile "Zoran Miller" not found — skipped the Anchor step.';
  end if;

  -- B) The Network: each seed profile follows 2–8 OTHER seed profiles.
  insert into public.follows (follower_id, following_id)
  select f.id, t.id
  from (
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.email like 'seed+%@5sfindr.local'
  ) f
  cross join lateral (
    select s.id
    from public.profiles s
    join auth.users u2 on u2.id = s.id
    where u2.email like 'seed+%@5sfindr.local'
      and s.id <> f.id
    order by random()
    limit (2 + floor(random() * 7))::int   -- 2..8
  ) t
  on conflict (follower_id, following_id) do nothing;

  raise notice 'Social graph seeded.';
end $$;
