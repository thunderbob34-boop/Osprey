-- 016_delete_account.sql
-- In-app account deletion, required by App Store Guideline 5.1.1(v).
-- Hard-deletes the caller's app data (all tables cascade from users.id)
-- and removes their auth login so the email can be reused.

CREATE OR REPLACE FUNCTION delete_my_account()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Cascades wipe workout logs, plans, races, challenges, reminders, etc.
  DELETE FROM public.users WHERE id = auth.uid();

  -- Remove the login itself (sessions/identities cascade inside auth schema).
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;
