-- X / Twitter OAuth: resolve display name + avatar from GoTrue metadata shapes.
-- Prefer full_name/name, then X username fields when email is absent.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_avatar_url text;
  v_workspace_id uuid;
begin
  v_display_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username',
    new.raw_user_meta_data ->> 'screen_name',
    new.raw_user_meta_data ->> 'username',
    split_part(coalesce(new.email, ''), '@', 1),
    'User'
  )), '');

  if left(v_display_name, 1) = '@' then
    v_display_name := substr(v_display_name, 2);
  end if;

  v_avatar_url := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    new.raw_user_meta_data ->> 'profile_image_url_https',
    new.raw_user_meta_data ->> 'profile_image_url'
  )), '');

  insert into public.profiles (id, email, display_name, avatar_url, locale, timezone)
  values (new.id, new.email, v_display_name, v_avatar_url, 'en', 'UTC')
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  insert into public.user_settings (
    user_id, email, display_name, avatar_url, settings, chat_model_id, response_style
  )
  values (
    new.id,
    new.email,
    v_display_name,
    v_avatar_url,
    '{}'::jsonb,
    'moonshotai/kimi-k2.6',
    'balanced'
  )
  on conflict (user_id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_balances (user_id, tokens_total, tokens_consumed, tokens_remaining, status)
  values (new.id, 5000, 0, 5000, 'trial')
  on conflict (user_id) do nothing;

  if not exists (select 1 from public.workspace_members where user_id = new.id) then
    v_workspace_id := public.create_default_workspace_for_user(new.id, new.email, v_display_name);
  end if;

  insert into public.audit_logs (user_id, workspace_id, actor_type, action, target_type, target_id, metadata)
  values (
    new.id,
    v_workspace_id,
    'system',
    'auth.user_created',
    'user',
    new.id::text,
    jsonb_build_object(
      'email', new.email,
      'providers', coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb)
    )
  );

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Auth.users AFTER INSERT: profile/settings/trial/workspace; supports X OAuth username metadata.';
