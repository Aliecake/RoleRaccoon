/*
# Tighten profiles RLS — SELECT-only for authenticated clients

## Changes
- Drop INSERT, UPDATE, DELETE policies on profiles.
- Keep SELECT policy (auth.uid() = id) so users can read their own profile.

## Rationale
- No user-editable profile fields exist yet.
- Profile rows are auto-created by the handle_new_user trigger (SECURITY DEFINER),
  which bypasses RLS — dropping the INSERT policy does not affect signup.
- Billing fields (plan, stripe_customer_id, stripe_subscription_id) are protected
  by the protect_billing_fields trigger (also SECURITY DEFINER).
- Profile deletion follows auth.users via ON DELETE CASCADE; direct client
  deletes are unnecessary and potentially harmful.
- When user-editable profile fields are added in the future, an UPDATE policy
  can be re-added at that time.
*/

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
DROP POLICY IF EXISTS "delete_own_profile" ON profiles;