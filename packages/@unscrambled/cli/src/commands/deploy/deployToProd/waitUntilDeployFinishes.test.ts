import { beforeEach, describe, expect, it, vi } from "vitest";

const terminalMock = vi.hoisted(() => {
  const fn = vi.fn();
  return Object.assign(fn, {
    green: vi.fn(),
    red: vi.fn(),
  });
});

vi.mock("terminal-kit", () => ({
  terminal: terminalMock,
}));

vi.mock("commander", () => ({
  program: {
    error: vi.fn(),
  },
}));

vi.mock("./fetchDeployLogs", () => ({
  default: vi.fn(),
}));

vi.mock("./fetchDeployStatus", () => ({
  default: vi.fn(),
}));

import { program } from "commander";
import { terminal } from "terminal-kit";
import fetchDeployLogs from "./fetchDeployLogs";
import fetchDeployStatus from "./fetchDeployStatus";
import waitUntilDeployFinishes from "./waitUntilDeployFinishes";

describe("waitUntilDeployFinishes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchDeployLogs).mockResolvedValue({
      data: {
        logs: [],
        pagination: {},
      },
    } as any);
    vi.mocked(fetchDeployStatus).mockResolvedValue({
      status: "FAILED",
    } as any);
  });

  it("does not print a duplicate failed banner before exiting", async () => {
    const exitError = new Error("Deploy failed");
    vi.mocked(program.error).mockImplementation(() => {
      throw exitError;
    });

    await expect(waitUntilDeployFinishes("deploy-123")).rejects.toThrow(exitError);

    expect(terminal.red).not.toHaveBeenCalled();
    expect(program.error).toHaveBeenCalledWith("Deploy failed", {
      exitCode: 1,
    });
  });
});
