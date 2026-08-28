/**
 * Error text helpers.
 *
 * Database and API error objects carry internal detail (table names, constraint
 * names, policy structure). None of that belongs in the interface, so every
 * failure branch renders a fixed message chosen by the caller instead.
 *
 * The one exception is the Free-plan limit, which is raised deliberately by a
 * database trigger as a message meant for the user. That case is recognised and
 * translated into friendly copy so the feature keeps explaining itself.
 */

const PLAN_LIMIT_MARKER = 'free plan limit';

export const PLAN_LIMIT_APPLICATIONS =
  "You've reached the Free-plan limit of tracked applications. Archive one to free up space, or upgrade to Pro.";

export const PLAN_LIMIT_STORIES =
  "You've reached the Free-plan limit of STAR stories. Delete one to free up space, or upgrade to Pro.";

export function isPlanLimitError(error: unknown): boolean {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';
  return message.toLowerCase().includes(PLAN_LIMIT_MARKER);
}

/**
 * Returns safe, user-facing text for a failed operation.
 *
 * @param error      the raw error from Supabase / PostgREST — never rendered
 * @param fallback   the message shown for any ordinary failure
 * @param planLimit  optional message shown when the failure is a plan limit
 */
export function safeErrorMessage(
  error: unknown,
  fallback: string,
  planLimit?: string,
): string {
  if (planLimit && isPlanLimitError(error)) {
    return planLimit;
  }
  return fallback;
}
