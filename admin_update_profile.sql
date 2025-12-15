-- Admin can update profile flags securely (bypasses RLS with admin check)
create or replace function public.admin_update_profile_fields(
  p_admin_id uuid,
  p_target_user_id uuid,
  p_is_admin boolean default null,
  p_is_verified_creator boolean default null,
  p_is_public boolean default null
) returns void
language plpgsql
security definer
as $$
begin
  if not is_admin_uid(p_admin_id) then
    raise exception 'not allowed' using errcode='42501';
  end if;

  update public.profiles
    set is_admin = coalesce(p_is_admin, is_admin),
        is_verified_creator = coalesce(p_is_verified_creator, is_verified_creator),
        is_public = coalesce(p_is_public, is_public),
        updated_at = now()
  where id = p_target_user_id;

  insert into public.admin_audit_logs(admin_user_id, target_user_id, action, details)
  values (p_admin_id, p_target_user_id, 'update_profile_flags',
          jsonb_build_object('is_admin', p_is_admin, 'is_verified_creator', p_is_verified_creator, 'is_public', p_is_public));
end;
$$;
