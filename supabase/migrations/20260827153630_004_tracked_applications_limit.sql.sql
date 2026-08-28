/*
# Free-plan limit: tracked (non-archived) applications

Replaces the previous "active statuses" limit with a "non-archived" limit.
All statuses count toward the limit except archived.
Rejected and withdrawn applications still count until explicitly archived.
Archiving frees a slot; restoring an archived application at the limit is rejected.

Idempotent: CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS.
*/

CREATE OR REPLACE FUNCTION enforce_free_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_tracked_count integer;
  v_story_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  SELECT plan INTO v_plan FROM profiles WHERE id = NEW.user_id;

  -- Pro users and missing profiles are unrestricted
  IF v_plan IS NULL OR v_plan = 'pro' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'applications' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status <> 'archived' THEN
        SELECT count(*) INTO v_tracked_count FROM applications
        WHERE user_id = NEW.user_id AND status <> 'archived';
        IF v_tracked_count >= 4 THEN
          RAISE EXCEPTION 'Free plan limit reached: you can have at most 4 tracked applications. Upgrade to Pro for unlimited.';
        END IF;
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Only check when transitioning from archived to non-archived.
      -- Editing an already non-archived row is not counted.
      IF NEW.status <> 'archived' AND OLD.status = 'archived' THEN
        SELECT count(*) INTO v_tracked_count FROM applications
        WHERE user_id = NEW.user_id
          AND status <> 'archived'
          AND id <> NEW.id;
        IF v_tracked_count >= 4 THEN
          RAISE EXCEPTION 'Free plan limit reached: you can have at most 4 tracked applications. Upgrade to Pro for unlimited.';
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
