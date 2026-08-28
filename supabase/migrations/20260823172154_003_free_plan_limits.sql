/*
# Free-plan usage limits — server-side enforcement

1. Modified Tables
- `applications`: adds a trigger that limits Free users to 4 active rows.
- `star_stories`: adds a trigger that limits Free users to 3 rows.
- No columns, existing rows, authentication objects, profiles fields, or RLS policies are changed.

2. Enforcement
- Active applications are statuses saved, applied, interviewing, and offer.
- Creating an inactive application is allowed at the active limit.
- Returning an inactive application to an active status is checked.
- Editing an already-active application is not counted twice.
- Pro users are unlimited.
- Deletes remain unrestricted.

3. Security
- A SECURITY DEFINER function reads the authoritative profiles.plan value and counts owned rows server-side.
- The function never writes billing fields or profiles.plan.
- A transaction advisory lock serializes limit checks per user to prevent concurrent requests from exceeding a limit.

4. Important Notes
- The client may show usage and disable obvious creation controls, but database triggers remain authoritative.
- The migration is idempotent and safe to re-apply.
*/

CREATE OR REPLACE FUNCTION enforce_free_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_active_count integer;
  v_story_count integer;
  v_active_statuses text[] := ARRAY['saved','applied','interviewing','offer'];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  SELECT plan INTO v_plan FROM profiles WHERE id = NEW.user_id;

  IF v_plan IS NULL OR v_plan = 'pro' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'applications' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status = ANY(v_active_statuses) THEN
        SELECT count(*) INTO v_active_count FROM applications
        WHERE user_id = NEW.user_id AND status = ANY(v_active_statuses);
        IF v_active_count >= 4 THEN
          RAISE EXCEPTION 'Free plan limit reached: you can have at most 4 active applications. Upgrade to Pro for unlimited.';
        END IF;
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.status = ANY(v_active_statuses)
         AND NOT (OLD.status = ANY(v_active_statuses)) THEN
        SELECT count(*) INTO v_active_count FROM applications
        WHERE user_id = NEW.user_id
          AND status = ANY(v_active_statuses)
          AND id <> NEW.id;
        IF v_active_count >= 4 THEN
          RAISE EXCEPTION 'Free plan limit reached: you can have at most 4 active applications. Upgrade to Pro for unlimited.';
        END IF;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'star_stories' THEN
    IF TG_OP = 'INSERT' THEN
      SELECT count(*) INTO v_story_count FROM star_stories
      WHERE user_id = NEW.user_id;
      IF v_story_count >= 3 THEN
        RAISE EXCEPTION 'Free plan limit reached: you can have at most 3 STAR stories. Upgrade to Pro for unlimited.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_applications_free_limit ON applications;
CREATE TRIGGER trg_applications_free_limit
  BEFORE INSERT OR UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION enforce_free_plan_limits();

DROP TRIGGER IF EXISTS trg_star_stories_free_limit ON star_stories;
CREATE TRIGGER trg_star_stories_free_limit
  BEFORE INSERT ON star_stories
  FOR EACH ROW EXECUTE FUNCTION enforce_free_plan_limits();
