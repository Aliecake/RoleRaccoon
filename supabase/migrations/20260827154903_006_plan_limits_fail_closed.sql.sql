/*
# Make the Free-plan limit check fail closed

Previously the guard read:
  IF v_plan IS NULL OR v_plan = 'pro' THEN RETURN NEW; END IF;
which treated "no profile row" identically to "paying customer" and skipped
both the application and story limits entirely.

Now only a positively confirmed 'pro' plan skips the checks; a missing or
unrecognised plan is treated as the free tier.

Limit semantics are otherwise unchanged from migration 004: all statuses count
toward the 4-application limit except 'archived', and archiving frees a slot.
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

  -- Only a confirmed 'pro' plan is unrestricted. A missing profile row or any
  -- unrecognised value falls through to the free-tier limits (fail closed).
  IF v_plan = 'pro' THEN
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
