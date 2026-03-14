import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

const {
  runChildProcessMock,
  ensureOpenCodeModelConfiguredAndAvailableMock,
  hydrateLiteLlmApiKeyMock,
} = vi.hoisted(() => ({
  runChildProcessMock: vi.fn(),
  ensureOpenCodeModelConfiguredAndAvailableMock: vi.fn(),
  hydrateLiteLlmApiKeyMock: vi.fn(async (env: Record<string, string>) => ({
    env,
    source: "existing_litellm_env" as const,
  })),
}));

vi.mock("@paperclipai/adapter-utils/server-utils", async () => {
  const actual = await vi.importActual<typeof import("@paperclipai/adapter-utils/server-utils")>(
    "@paperclipai/adapter-utils/server-utils",
  );
  return {
    ...actual,
    ensureAbsoluteDirectory: vi.fn().mockResolvedValue(undefined),
    ensureCommandResolvable: vi.fn().mockResolvedValue(undefined),
    runChildProcess: runChildProcessMock,
  };
});

vi.mock("./models.js", () => ({
  ensureOpenCodeModelConfiguredAndAvailable: ensureOpenCodeModelConfiguredAndAvailableMock,
}));

vi.mock("./auth.js", async () => {
  const actual = await vi.importActual<typeof import("./auth.js")>("./auth.js");
  return {
    ...actual,
    hydrateLiteLlmApiKey: hydrateLiteLlmApiKeyMock,
  };
});

import { execute } from "./execute.js";

function buildStdout(sessionId: string) {
  return [
    JSON.stringify({
      type: "text",
      sessionID: sessionId,
      part: { text: "completed task" },
    }),
    JSON.stringify({
      type: "step_finish",
      sessionID: sessionId,
      part: {
        cost: 0,
        tokens: {
          input: 12,
          output: 4,
          reasoning: 0,
          cache: { read: 0 },
        },
      },
    }),
  ].join("\n");
}

describe("execute", () => {
  let tempRoot: string;
  let instructionsPath: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-execute-"));
    instructionsPath = path.join(tempRoot, "AGENTS.md");
    await fs.writeFile(instructionsPath, "# Test Agent\n\nFollow the task.\n", "utf8");
    vi.spyOn(os, "homedir").mockReturnValue(tempRoot);
    runChildProcessMock.mockReset();
    ensureOpenCodeModelConfiguredAndAvailableMock.mockReset();
    hydrateLiteLlmApiKeyMock.mockClear();
    ensureOpenCodeModelConfiguredAndAvailableMock.mockResolvedValue(undefined);
    runChildProcessMock.mockResolvedValue({
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: buildStdout("ses_fresh"),
      stderr: "",
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  function createContext(
    overrides: Partial<AdapterExecutionContext> = {},
  ): AdapterExecutionContext {
    return {
      runId: "run-1",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "OpenCode Agent",
        adapterType: "opencode_local",
        adapterConfig: {},
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: {
        command: "opencode",
        cwd: tempRoot,
        model: "litellm/devstral-small-2-24b",
        instructionsFilePath: instructionsPath,
      },
      context: {},
      onLog: vi.fn(async () => {}),
      onMeta: vi.fn(async () => {}),
      authToken: "paperclip-token",
      ...overrides,
    };
  }

  it("passes the Paperclip prompt as the OpenCode run message", async () => {
    const ctx = createContext();

    const result = await execute(ctx);

    expect(runChildProcessMock).toHaveBeenCalledTimes(1);
    const [, , args, options] = runChildProcessMock.mock.calls[0];
    expect(args.slice(0, 5)).toEqual([
      "run",
      "--format",
      "json",
      "--model",
      "litellm/devstral-small-2-24b",
    ]);
    expect(args.at(-1)).toContain("Continue your Paperclip work.");
    expect(args.at(-1)).toContain("The above agent instructions were loaded from");
    expect(options.stdin).toBeUndefined();
    expect(result.sessionParams).toMatchObject({
      sessionId: "ses_fresh",
      cwd: tempRoot,
      promptTransport: "run_message_v1",
    });
  });

  it("does not resume legacy sessions created before run_message_v1", async () => {
    const onLog = vi.fn(async () => {});
    const ctx = createContext({
      runtime: {
        sessionId: "ses_legacy",
        sessionParams: {
          sessionId: "ses_legacy",
          cwd: tempRoot,
        },
        sessionDisplayId: null,
        taskKey: null,
      },
      onLog,
    });

    await execute(ctx);

    const [, , args] = runChildProcessMock.mock.calls[0];
    expect(args).not.toContain("--session");
    expect(onLog).toHaveBeenCalledWith(
      "stderr",
      expect.stringContaining('requires "run_message_v1"'),
    );
  });

  it("resumes compatible sessions that already use run_message_v1", async () => {
    const ctx = createContext({
      runtime: {
        sessionId: "ses_saved",
        sessionParams: {
          sessionId: "ses_saved",
          cwd: tempRoot,
          promptTransport: "run_message_v1",
        },
        sessionDisplayId: null,
        taskKey: null,
      },
    });

    await execute(ctx);

    const [, , args] = runChildProcessMock.mock.calls[0];
    expect(args).toContain("--session");
    expect(args).toContain("ses_saved");
  });
});
