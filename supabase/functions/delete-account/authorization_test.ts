import { authorizeAccountDeletion } from "./authorization.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const input = (overrides: Record<string, unknown> = {}) => ({
  actorId: "actor-1",
  actorRole: "pro" as const,
  targetId: "target-1",
  targetRole: "patient" as const,
  isAssignedToActor: true,
  targetIsSuperAdmin: false,
  isSuperAdmin: false,
  activeSuperAdminCount: 1,
  hasAssignedPatientRecords: false,
  ...overrides,
});

Deno.test("super admin can delete any account except the last super admin", () => {
  assertEquals(authorizeAccountDeletion(input({ isSuperAdmin: true, targetRole: "pro" })), {
    allowed: true,
    scope: "global",
  });
  assertEquals(
    authorizeAccountDeletion(
      input({
        isSuperAdmin: true,
        targetIsSuperAdmin: true,
        activeSuperAdminCount: 1,
      }),
    ),
    { allowed: false, reason: "LAST_SUPER_ADMIN" },
  );
});

Deno.test("professional can delete only an assigned patient/subscriber", () => {
  assertEquals(authorizeAccountDeletion(input()), { allowed: true, scope: "own-patient" });
  assertEquals(authorizeAccountDeletion(input({ isAssignedToActor: false })), {
    allowed: false,
    reason: "TARGET_OUTSIDE_PRO_SCOPE",
  });
  assertEquals(authorizeAccountDeletion(input({ targetRole: "pro" })), {
    allowed: false,
    reason: "ROLE_CANNOT_DELETE_TARGET",
  });
});

Deno.test("professional deletion is blocked while patient records remain attached", () => {
  assertEquals(
    authorizeAccountDeletion(
      input({
        isSuperAdmin: true,
        targetRole: "pro",
        hasAssignedPatientRecords: true,
      }),
    ),
    { allowed: false, reason: "PRO_HAS_PATIENTS" },
  );
});

Deno.test("patient and subscriber can request only their own account", () => {
  assertEquals(
    authorizeAccountDeletion(
      input({
        actorId: "same",
        targetId: "same",
        actorRole: "patient",
        targetRole: "patient",
        isAssignedToActor: false,
      }),
    ),
    { allowed: true, scope: "own-account" },
  );
  assertEquals(
    authorizeAccountDeletion(
      input({
        actorId: "same",
        targetId: "same",
        actorRole: "subscriber",
        targetRole: "subscriber",
      }),
    ),
    { allowed: true, scope: "own-account" },
  );
  assertEquals(authorizeAccountDeletion(input({ actorRole: "patient" })), {
    allowed: false,
    reason: "ROLE_CANNOT_DELETE_TARGET",
  });
});

Deno.test("missing caller or target is denied", () => {
  assertEquals(authorizeAccountDeletion(input({ actorId: "" })), {
    allowed: false,
    reason: "UNAUTHENTICATED",
  });
  assertEquals(authorizeAccountDeletion(input({ targetRole: null })), {
    allowed: false,
    reason: "TARGET_NOT_FOUND",
  });
});
