create or replace function delete_my_account()
returns void
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
begin
  delete from workout_logs       where user_id = v_uid;
  delete from water_logs         where user_id = v_uid;
  delete from weight_logs        where user_id = v_uid;
  delete from attendance_logs    where user_id = v_uid;
  delete from user_schedule      where user_id = v_uid;
  delete from coach_nominations  where nominated_user_id = v_uid or nominated_by = v_uid;
  delete from coach_votes        where voter_id = v_uid;
  delete from studio_memberships where user_id = v_uid;
  delete from profiles           where id = v_uid;
  delete from auth.users         where id = v_uid;
end;
$$;
