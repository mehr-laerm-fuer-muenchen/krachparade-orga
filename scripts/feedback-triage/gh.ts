// Spec 022: calls the GitHub CLI without a shell (execFile). The token comes
// from GH_TOKEN (read by `gh` itself). Texts always go in via --body-file.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export const OUT_DIR = "triage-out";

export class GhError extends Error {
  constructor(command: string, detail: string) {
    super(`gh ${command} fehlgeschlagen${detail ? `: ${detail}` : ""}`);
    this.name = "GhError";
  }
}

/** Runs `gh <args>` and returns stdout. Errors name only the subcommand. */
export async function gh(args: string[]): Promise<string> {
  try {
    const { stdout } = await run("gh", args, { maxBuffer: 50 * 1024 * 1024, env: process.env });
    return stdout;
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    const detail = typeof stderr === "string" ? stderr.trim().split("\n")[0]?.slice(0, 200) ?? "" : "";
    throw new GhError(args.slice(0, 2).join(" "), detail);
  }
}

export async function ghJson<T>(args: string[]): Promise<T> {
  return JSON.parse(await gh(args)) as T;
}

export function fail(message: string): never {
  console.error(`Abbruch: ${message}`);
  process.exit(1);
}
