export type AccountRole = "pro" | "patient" | "subscriber";

export type DeleteDecisionInput = {
  actorId: string;
  actorRole: AccountRole | null;
  targetId: string;
  targetRole: AccountRole | null;
  isAssignedToActor: boolean;
  targetIsSuperAdmin: boolean;
  isSuperAdmin: boolean;
  activeSuperAdminCount: number;
  hasAssignedPatientRecords: boolean;
};

export type DeleteDecision =
  | { allowed: true; scope: "global" | "own-patient" | "own-account" }
  | {
      allowed: false;
      reason:
        | "UNAUTHENTICATED"
        | "TARGET_NOT_FOUND"
        | "LAST_SUPER_ADMIN"
        | "PRO_HAS_PATIENTS"
        | "TARGET_OUTSIDE_PRO_SCOPE"
        | "ROLE_CANNOT_DELETE_TARGET";
    };

/** Pure authorization rule. All role and relationship fields must come from Supabase server reads. */
export function authorizeAccountDeletion(input: DeleteDecisionInput): DeleteDecision {
  if (!input.actorId) return { allowed: false, reason: "UNAUTHENTICATED" };
  if (!input.targetRole) return { allowed: false, reason: "TARGET_NOT_FOUND" };

  if (input.isSuperAdmin) {
    if (input.targetIsSuperAdmin && input.activeSuperAdminCount <= 1) {
      return { allowed: false, reason: "LAST_SUPER_ADMIN" };
    }
    if (input.targetRole === "pro" && input.hasAssignedPatientRecords) {
      return { allowed: false, reason: "PRO_HAS_PATIENTS" };
    }
    return { allowed: true, scope: "global" };
  }

  if (input.actorId === input.targetId) {
    if (input.actorRole === "patient" || input.actorRole === "subscriber") {
      return { allowed: true, scope: "own-account" };
    }
    return { allowed: false, reason: "ROLE_CANNOT_DELETE_TARGET" };
  }

  if (input.actorRole !== "pro") {
    return { allowed: false, reason: "ROLE_CANNOT_DELETE_TARGET" };
  }

  if (input.targetRole !== "patient" && input.targetRole !== "subscriber") {
    return { allowed: false, reason: "ROLE_CANNOT_DELETE_TARGET" };
  }

  if (!input.isAssignedToActor) {
    return { allowed: false, reason: "TARGET_OUTSIDE_PRO_SCOPE" };
  }

  return { allowed: true, scope: "own-patient" };
}
