/*
# RoleRaccoon Foundation — Schema, RLS, and Profile Bootstrap

## Overview
Creates the core data model for RoleRaccoon, a technical job-search tracker.
This migration establishes four tables (profiles, applications, star_stories,
application_stories), enables Row Level Security on all of them, defines
per-user ownership policies, and sets up automatic profile creation on signup.

## New Tables

### profiles
- id (uuid, PK, = auth.users.id) — one row per authenticated user
- email (text, not null) — cached for display
- plan (text, not null, default 'free') — 'free' | 'pro'
- stripe_customer_id (text, nullable) — Stripe customer reference (future)
- stripe_subscription_id (text, nullable) — Stripe subscription reference (future)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

### applications
- id (uuid, PK)
- user_id (uuid, not null, default auth.uid(), FK -> auth.users ON DELETE CASCADE)
- company (text, not null)
- role (text, not null)
- job_url (text, nullable)
- job_description (text, nullable) — raw posting stored for future AI use
- status (text, not null, default 'saved') — one of:
    saved | applied | interviewing | offer | rejected | withdrawn | archived
- salary_min (numeric, nullable)
- salary_max (numeric, nullable)
- salary_currency (char(3), not null, default 'USD')
- location (text, nullable)
- remote_policy (text, nullable) — remote | hybrid | onsite
- application_date (date, nullable)
- next_action (text, nullable)
- next_action_date (date, nullable)
- notes (text, nullable)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

### star_stories
- id (uuid, PK)
- user_id (uuid, not null, default auth.uid(), FK -> auth.users ON DELETE CASCADE)
- title (text, not null)
- situation (text, not null)
- task (text, not null)
- action (text, not null)
- result (text, not null)
- tags (text[], default '{}')
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

### application_stories (join table — many-to-many)
- application_id (uuid, FK -> applications ON DELETE CASCADE)
- story_id (uuid, FK -> star_stories ON DELETE CASCADE)
- created_at (timestamptz, default now())
- PK (application_id, story_id)
- No user_id column — ownership enforced via EXISTS checks against parents.

## Security Changes

### RLS enabled on all four tables.

### profiles policies
- SELECT: user can read their own profile (auth.uid() = id)
- INSERT: user can insert their own profile (auth.uid() = id)
- UPDATE: user can update their own profile (auth.uid() = id)
  The WITH CHECK only verifies row ownership; a trigger (protect_billing_fields)
  separately blocks writes to plan/stripe_customer_id/stripe_subscription_id
  from the authenticated role, so a browser client cannot grant itself Pro.
- DELETE: user can delete their own profile (auth.uid() = id)

### applications policies
- Four standard owner-scoped CRUD policies keyed on auth.uid() = user_id.
- user_id defaults to auth.uid() so client inserts omitting user_id succeed.

### star_stories policies
- Four standard owner-scoped CRUD policies keyed on auth.uid() = user_id.
- user_id defaults to auth.uid() so client inserts omitting user_id succeed.

### application_stories policies
- No user_id column. Each policy uses EXISTS subqueries to verify the
  authenticated user owns BOTH the referenced application and the referenced
  story. This prevents creating relationships involving another user's data.
- SELECT: USING dual-ownership EXISTS
- INSERT: WITH CHECK dual-ownership EXISTS
- UPDATE: USING + WITH CHECK dual-ownership EXISTS
- DELETE: USING dual-ownership EXISTS

### protect_billing_fields trigger
- BEFORE INSERT/UPDATE on profiles.
- If the current role is NOT 'service_role' (i.e. a browser/authenticated client),
  blocks any attempt to set plan, stripe_customer_id, or stripe_subscription_id.
- On INSERT, only blocks if the value differs from the default ('free' / null).
- On UPDATE, blocks any change to these three columns.
- The service_role (future Stripe webhook / edge function) bypasses this trigger.

### handle_new_user trigger
- AFTER INSERT on auth.users.
- Inserts a profiles row with id = new auth user id, email = new user email,
  plan = 'free'. This auto-creates a profile on every signup.

## Important Notes
1. Free-plan limits (4 active applications, 3 STAR stories) are NOT enforced
   in this migration. The schema supports future enforcement via:
   - Client-side counting (status-based for applications, row count for stories)
   - Server-side enforcement via a SECURITY DEFINER function or trigger when
     the subscription feature is implemented.
2. "Active" applications are determined by status IN ('saved','applied',
   'interviewing','offer'). No is_active column is used.
3. Email confirmation remains OFF (Supabase default).
4. All migrations are idempotent (IF NOT EXISTS, DROP POLICY IF EXISTS).
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ============================================================
-- APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  company text NOT NULL,
  role text NOT NULL,
  job_url text,
  job_description text,
  status text NOT NULL DEFAULT 'saved' CHECK (
    status IN ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn', 'archived')
  ),
  salary_min numeric,
  salary_max numeric,
  salary_currency char(3) NOT NULL DEFAULT 'USD',
  location text,
  remote_policy text CHECK (remote_policy IS NULL OR remote_policy IN ('remote', 'hybrid', 'onsite')),
  application_date date,
  next_action text,
  next_action_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_applications" ON applications;
CREATE POLICY "select_own_applications" ON applications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_applications" ON applications;
CREATE POLICY "insert_own_applications" ON applications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_applications" ON applications;
CREATE POLICY "update_own_applications" ON applications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_applications" ON applications;
CREATE POLICY "delete_own_applications" ON applications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Index for filtering/sorting by user
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- ============================================================
-- STAR STORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS star_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  situation text NOT NULL,
  task text NOT NULL,
  action text NOT NULL,
  result text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE star_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_stories" ON star_stories;
CREATE POLICY "select_own_stories" ON star_stories FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_stories" ON star_stories;
CREATE POLICY "insert_own_stories" ON star_stories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_stories" ON star_stories;
CREATE POLICY "update_own_stories" ON star_stories FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_stories" ON star_stories;
CREATE POLICY "delete_own_stories" ON star_stories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_star_stories_user_id ON star_stories(user_id);

-- ============================================================
-- APPLICATION_STORIES (join table — many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS application_stories (
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES star_stories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id, story_id)
);

ALTER TABLE application_stories ENABLE ROW LEVEL SECURITY;

-- Ownership is verified through both parent tables via EXISTS.
-- No user_id column is stored on the join table.

DROP POLICY IF EXISTS "select_own_links" ON application_stories;
CREATE POLICY "select_own_links" ON application_stories FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_stories.application_id
        AND a.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM star_stories s
      WHERE s.id = application_stories.story_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_links" ON application_stories;
CREATE POLICY "insert_own_links" ON application_stories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_stories.application_id
        AND a.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM star_stories s
      WHERE s.id = application_stories.story_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_links" ON application_stories;
CREATE POLICY "update_own_links" ON application_stories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_stories.application_id
        AND a.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM star_stories s
      WHERE s.id = application_stories.story_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_stories.application_id
        AND a.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM star_stories s
      WHERE s.id = application_stories.story_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_links" ON application_stories;
CREATE POLICY "delete_own_links" ON application_stories FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_stories.application_id
        AND a.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM star_stories s
      WHERE s.id = application_stories.story_id
        AND s.user_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGER: protect_billing_fields on profiles
-- Blocks authenticated (browser) clients from writing plan,
-- stripe_customer_id, or stripe_subscription_id. Only the
-- service_role (future Stripe webhook) may set these.
-- ============================================================
CREATE OR REPLACE FUNCTION protect_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses this protection (privileged server-side path)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Block non-default plan on insert (only service_role can set 'pro')
    IF NEW.plan IS DISTINCT FROM 'free' THEN
      RAISE EXCEPTION 'You are not allowed to set the plan field';
    END IF;
    IF NEW.stripe_customer_id IS NOT NULL THEN
      RAISE EXCEPTION 'You are not allowed to set stripe_customer_id';
    END IF;
    IF NEW.stripe_subscription_id IS NOT NULL THEN
      RAISE EXCEPTION 'You are not allowed to set stripe_subscription_id';
    END IF;
  ELSE
    -- UPDATE: block any change to billing fields
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      RAISE EXCEPTION 'You are not allowed to change the plan field';
    END IF;
    IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
      RAISE EXCEPTION 'You are not allowed to change stripe_customer_id';
    END IF;
    IF NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
      RAISE EXCEPTION 'You are not allowed to change stripe_subscription_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_billing_fields ON profiles;
CREATE TRIGGER trg_protect_billing_fields
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_billing_fields();

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- updated_at auto-maintenance function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;
CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_star_stories_updated_at ON star_stories;
CREATE TRIGGER trg_star_stories_updated_at
  BEFORE UPDATE ON star_stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();