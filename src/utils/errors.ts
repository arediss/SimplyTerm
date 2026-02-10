/**
 * Extracts a human-readable error message from an unknown error value.
 * Handles strings, Error instances, and other types consistently.
 */
export function getErrorMessage(err: unknown, fallback?: string): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return fallback || String(err);
}
