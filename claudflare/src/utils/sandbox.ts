import { getSandbox } from "@cloudflare/sandbox";

export type SandboxType = Awaited<ReturnType<typeof getSandbox>>;

export interface CmdResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCmd(
  sandbox: SandboxType,
  cmd: string,
  label: string,
): Promise<CmdResult> {
  try {
    console.log(`[${label}] ${cmd.substring(0, 80)}...`);
    const result = await sandbox.exec(cmd);
    if (result.exitCode !== 0) {
      console.log(
        `[${label}] exit=${result.exitCode} stderr=${result.stderr.substring(
          0,
          100,
        )}`,
      );
    }
    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[${label}] ERROR: ${msg}`);
    return { success: false, stdout: "", stderr: msg, exitCode: -1 };
  }
}
