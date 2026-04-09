import { program } from "commander";
import { terminal } from "terminal-kit";
import { getEnvName } from "./getEnvName";

export type OutputFormat = "text" | "json";

type CommandOptionsWithOutput = {
  output?: OutputFormat;
};

type EnvOptions = {
  env?: string;
  environment?: string;
};

type ConfirmDangerousActionOptions = {
  yes?: boolean;
  dryRun?: boolean;
  prompt: string;
  expectedText?: string;
};

function ensureTrailingNewline(message: string): string {
  return message.endsWith("\n") ? message : `${message}\n`;
}

export function getEnvOption(options?: EnvOptions): string | undefined {
  return options?.env ?? options?.environment;
}

export function resolveEnvName(cliEnv?: string): string {
  if (cliEnv) return cliEnv;

  const globalEnv = program.opts().env;
  if (globalEnv) return globalEnv;

  return getEnvName();
}

export function isJsonOutput(options?: CommandOptionsWithOutput): boolean {
  return options?.output === "json";
}

export function writeJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function writeInfo(
  message: string,
  options?: CommandOptionsWithOutput
): void {
  const line = ensureTrailingNewline(message);
  if (isJsonOutput(options)) {
    process.stderr.write(line);
    return;
  }

  terminal(line);
}

export function writeSuccess(
  message: string,
  options?: CommandOptionsWithOutput
): void {
  if (isJsonOutput(options)) {
    return;
  }

  terminal.green(ensureTrailingNewline(message));
}

export function writeWarning(
  message: string,
  options?: CommandOptionsWithOutput
): void {
  const line = ensureTrailingNewline(message);
  if (isJsonOutput(options)) {
    process.stderr.write(line);
    return;
  }

  terminal.yellow(line);
}

export function writeError(
  message: string,
  options?: CommandOptionsWithOutput
): void {
  const line = ensureTrailingNewline(message);
  if (isJsonOutput(options)) {
    process.stderr.write(line);
    return;
  }

  terminal.red(line);
}

export async function confirmDangerousAction(
  options: ConfirmDangerousActionOptions
): Promise<void> {
  if (options.dryRun || options.yes) {
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Confirmation required. Re-run with --yes.");
  }

  process.stderr.write(ensureTrailingNewline(options.prompt));
  const input = await new Promise<string>((resolve) => {
    terminal.inputField({}, (_error, value) => {
      resolve((value || "").trim());
    });
  });
  terminal("\n");

  if (options.expectedText) {
    if (input !== options.expectedText) {
      throw new Error(
        `Confirmation mismatch. Re-run and type '${options.expectedText}', or pass --yes.`
      );
    }
    return;
  }

  const normalized = input.toLowerCase();
  if (normalized !== "y" && normalized !== "yes") {
    throw new Error("Aborted. Re-run with --yes to skip confirmation.");
  }
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString("utf8");
}
