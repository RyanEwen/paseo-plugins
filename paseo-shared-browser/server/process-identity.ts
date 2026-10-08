import { readFile, readlink, realpath } from "node:fs/promises";

/** Stable proof that a PID still names the same OS process the runtime recorded. */
export interface ProcessIdentity {
  pid: number;
  /** Kernel start time in clock ticks; a recycled PID has a different value. */
  startTicks: string;
}

/**
 * Reads the identity of `pid` only if it is an executable-matching instance of `executable`.
 * Returns null when the process is absent, is a different program, or identity cannot be
 * established on this platform (no /proc). Null never authorises a signal.
 */
export async function readProcessIdentity(
  pid: number,
  executable: string,
): Promise<ProcessIdentity | null> {
  if (process.platform !== "linux" || !Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    // Fields after the parenthesised command name; starttime is field 22 overall.
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    const startTicks = fields[19];
    if (!startTicks || !/^\d+$/.test(startTicks)) return null;
    const [actual, expected] = await Promise.all([
      readlink(`/proc/${pid}/exe`).then(realpath),
      realpath(executable),
    ]);
    return actual === expected ? { pid, startTicks } : null;
  } catch {
    return null;
  }
}
