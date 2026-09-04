// Role checks for admin endpoints — docs/API.md §4, docs/SECURITY.md §5. `SUPER_ADMIN` is a
// superset of every other role; `VERIFIER`/`CONTENT_EDITOR` are siblings with disjoint duties,
// per docs/DATABASE.md §9 Open Decision #6's role split.
import type { AdminRole } from "@1crore-pixels/db";

/** True if `actual` satisfies an endpoint declaring `minimum` as its required role ("X+"). */
export function hasRole(actual: AdminRole, minimum: AdminRole): boolean {
  return actual === "SUPER_ADMIN" || actual === minimum;
}
