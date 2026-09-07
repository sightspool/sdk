export type Identity = { userId?: string };

/** Clearing identity is an explicit logout signal, not a skipped update. */
export function researchUserId(identity: Identity | null | undefined): string | null {
  return typeof identity?.userId === "string" && identity.userId.trim() ? identity.userId : null;
}
