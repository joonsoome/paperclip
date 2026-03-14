import { afterEach, describe, expect, it, vi } from "vitest";
import { printStartupBanner } from "../startup-banner.js";

const ORIGINAL_ENV = { ...process.env };

describe("startup banner", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("reports BETTER_AUTH_SECRET fallback as satisfying local agent jwt auth", () => {
    process.env = {
      ...ORIGINAL_ENV,
      BETTER_AUTH_SECRET: "better-auth-secret",
    };
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    printStartupBanner({
      host: "127.0.0.1",
      deploymentMode: "authenticated",
      deploymentExposure: "private",
      authReady: true,
      requestedPort: 3100,
      listenPort: 3100,
      uiMode: "static",
      db: {
        mode: "embedded-postgres",
        dataDir: "/tmp/paperclip-db",
        port: 55432,
      },
      migrationSummary: "applied",
      heartbeatSchedulerEnabled: true,
      heartbeatSchedulerIntervalMs: 30000,
      databaseBackupEnabled: true,
      databaseBackupIntervalMinutes: 60,
      databaseBackupRetentionDays: 30,
      databaseBackupDir: "/tmp/paperclip-backups",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toContain("using BETTER_AUTH_SECRET fallback");
    expect(logSpy.mock.calls[0]?.[0]).not.toContain("missing (run `pnpm paperclipai onboard`)");
  });
});
