-- ════════════════════════════════════════════════════════════════════════
--  Hybrid no-cost phone onboarding: capture the mobile number at signup.
--  The number is passed in raw_user_meta_data.phone_number by the signup form
--  and written straight to public.profiles.phone_number by the trigger.
--  No OTP / SMS provider — zero cost, instant signup.
-- ════════════════════════════════════════════════════════════════════════
alter table public.profiles add column if not exists phone_number text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name        text;
  v_ref_code    text;
  v_phone       text;
  v_slug        text;
  v_my_code     text;
  v_referrer_id uuid;
  v_token_id    uuid;
begin
  v_name     := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'New Baller');
  v_ref_code := new.raw_user_meta_data->>'referral_code';
  v_phone    := nullif(trim(new.raw_user_meta_data->>'phone_number'), '');
  v_slug     := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'))
                || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_my_code  := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  if v_ref_code is not null then
    select id into v_referrer_id from public.profiles where referral_code = v_ref_code limit 1;
  end if;

  insert into public.profiles (id, name, phone_number, public_slug, referral_code, referred_by_id, founding_number)
  values (new.id, v_name, v_phone, v_slug, v_my_code, v_referrer_id, nextval('public.founding_seq'));

  insert into public.subscriptions (user_id, state, free_until)
  values (new.id, 'trialing', now() + interval '30 days');

  insert into public.tokens (owner_id, status) values (new.id, 'available') returning id into v_token_id;
  insert into public.token_transactions (token_id, user_id, type, note)
  values (v_token_id, new.id, 'signup_grant', 'Welcome token — your first match is on us');

  if v_referrer_id is not null then
    insert into public.referrals (referrer_id, referred_id, reward_granted)
    values (v_referrer_id, new.id, true);
    update public.subscriptions
       set free_until = greatest(coalesce(free_until, now()), now()) + interval '7 days'
     where user_id = v_referrer_id;
  end if;

  return new;
end;
$$;
