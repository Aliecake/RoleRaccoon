/*
# Free-plan usage limits — server-side enforcement

## Overview
Adds a SECURITY DEFINER trigger function that enforces Free-plan limits:
- Max 4 active applications (status IN saved/applied/interviewing/offer)
- Max 3 STAR stories
Pro users (profiles.plan = 'pro') have no limit.

## Enforcement logic
### applications BEFORE INSERT OR UPDATE
- INSERT: if NEW.status is active and user is Free, count existing active
  applications for that user. If count >= 4, reject.
- UPDATE: only when transitioning from inactive to active
  (NEW.status active AND OLD.status inactive), count active applications
  EXCLUDING the current row. If count >= 4, reject.
  Editing an already-active application does not trigger a count check,
  so it is never double-counted or falsely rejected.

### star_stories BEFORE INSERT
- If user is Free, count existing stories. If count >= 3, reject.
- UPDATE is not limited (editing does not create a new story).
- DELETE is never limited.

## Security
- Function is SECURITY DEFINER with search_path = public, so it can read
  profiles.plan and count rows accurately regardless of the caller's RLS.
- It never writes to profiles.plan; billing-field protection is untouched.
- If the profile row is missing, the operation is allowed (permissive default).

## Idempotent
- CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS.
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
  SELECT plan INTO v_plan FROM profiles WHERE id = NEW.user_id;

  -- Pro users and missing profiles are unrestricted
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
      -- Only check when transitioning from inactive to active.
      -- Editing an already-active row (active -> active) is not counted.
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
