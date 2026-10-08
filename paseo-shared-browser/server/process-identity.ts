import { readFile } from "node:fs/promises";

/** Proof that a PID is a process launched by this runtime and has not been replaced since. */
export interface ProcessIdentity {
  pid: number;
  /** Kernel start time in clock ticks; a recycled PID has a different value. */
  startTicks: string;
}

/** Environment variable carrying the per-runtime ownership nonce through the launch chain. */
export const RUNTIME_OWNER_VARIABLE = "PASEO_SHARED_BROWSER_RUNTIME_OWNER";

/**
 * Returns the identity of `pid` only if its environment carries this runtime's private
 * nonce, i.e. it descends from this runtime's own launch (JS launcher, native CLI, daemon)
 * rather than merely being a process that runs some executable. Null means the process is
 * absent, is not owned, or identity cannot be established (no /proc). Null is never proof
 * of exit and never authorises a signal.
 */
export async function readProcessIdentity(
  pid: number,
  nonce: string,
): Promise<ProcessIdentity | null> {
  if (process.platform !== "linux" || !Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    const [stat, environment] = await Promise.all([
      readFile(`/proc/${pid}/stat`, "utf8"),
      readFile(`/proc/${pid}/environ`, "utf8"),
    ]);
    if (!environment.split("\0").includes(`${RUNTIME_OWNER_VARIABLE}=${nonce}`)) return null;
    // Fields after the parenthesised command name; starttime is field 22 overall.
    const startTicks = stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
    return startTicks && /^\d+$/.test(startTicks) ? { pid, startTicks } : null;
  } catch {
    return null;
  }
}

/** Signal-0 probe: observes liveness without delivering a signal. EPERM means still alive. */
export function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}
