/*
# Pin search_path on update_updated_at_column

The timestamp trigger function was created without `SET search_path`, so the
names in its body resolve against the caller's search_path. Its two siblings in
the same original migration both pin it; this brings it in line.

Behaviour is unchanged: the body still only assigns now() to updated_at.
The existing triggers keep pointing at this function, so nothing needs
recreating.
*/

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
