import { describe, expect, it, vi } from "vitest";
import { findInviteForSignup } from "../auth/better-auth.js";

function makeDb(rows: unknown[]) {
  return {
    select: vi.fn(() => ({
      from: () => ({
        where: () => Promise.resolve(rows),
      }),
    })),
  } as never;
}

describe("findInviteForSignup", () => {
  it("allows sign-up only for active human-capable invites", async () => {
    const invite = {
      id: "invite-1",
      tokenHash: "unused-in-test",
      inviteType: "company_join",
      companyId: "company-1",
      allowedJoinTypes: "both",
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const db = makeDb([invite]);

    const result = await findInviteForSignup(db, "pcp_invite_test");

    expect(result).toBe(invite);
  });

  it("allows bootstrap invite tokens too", async () => {
    const invite = {
      id: "invite-1",
      tokenHash: "unused-in-test",
      inviteType: "bootstrap_ceo",
      companyId: null,
      allowedJoinTypes: "human",
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const db = makeDb([invite]);

    const result = await findInviteForSignup(db, "pcp_bootstrap_test");

    expect(result).toBe(invite);
  });

  it("rejects non-invite and agent-only signup attempts", async () => {
    const agentOnlyInvite = {
      id: "invite-2",
      tokenHash: "unused-in-test",
      inviteType: "company_join",
      companyId: "company-1",
      allowedJoinTypes: "agent",
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const db = makeDb([agentOnlyInvite]);

    await expect(findInviteForSignup(db, "not-an-invite")).resolves.toBeNull();
    await expect(findInviteForSignup(db, "pcp_invite_test")).resolves.toBeNull();
  });
});
