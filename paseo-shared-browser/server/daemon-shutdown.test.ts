/** The session daemon is signalled only while it is still the exact process this runtime launched. */
import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentBrowserRuntime } from "./agent-browser-runtime";

const cli = vi.hoisted(() => ({ onClose: null as null | (() => void), closes: 0 }));
vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  execFile: (
    _file: string,
    args: string[],
    _options: unknown,
    callback: (error: null, result: { stdout: string }) => void,
  ) => {
    if (args.includes("close")) {
      cli.closes += 1;
      cli.onClose?.();
    }
    callback(null, { stdout: args.includes("--version") ? "0.37.1\n" : "{}\n" });
  },
}));

const children: ChildProcess[] = [];
const directories: string[] = [];
afterEach(async () => {
  for (const child of children.splice(0)) child.kill("SIGKILL");
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
  cli.onClose = null;
  cli.closes = 0;
  vi.restoreAllMocks();
});

/** A harmless process this test owns; the runtime's binary is this same executable. */
async function ownChild(): Promise<ChildProcess> {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  children.push(child);
  await new Promise((resolve) => child.once("spawn", resolve));
  return child;
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const exited = (child: ChildProcess) =>
  child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve()
    : new Promise((resolve) => child.once("exit", resolve));

async function fixture(waitMs = 400) {
  const directory = await mkdtemp(join(tmpdir(), "shared-browser-daemon-"));
  directories.push(directory);
  const ipc = join(directory, "ipc");
  const profile = join(directory, "profile");
  await mkdir(ipc, { recursive: true });
  const runtime = new AgentBrowserRuntime({
    binaryPath: process.execPath,
    executablePath: join(directory, "unlaunched-chromium"),
    profilePath: profile,
    ipcDirectory: ipc,
    session: "owned",
    daemonExitWaitMs: waitMs,
  });
  const native = runtime as unknown as {
    captureDaemon(): Promise<void>;
    daemon: { pid: number; startTicks: string } | null;
  };
  const recordPid = async (pid: number) => {
    await mkdir(profile, { recursive: true });
    await writeFile(join(ipc, "owned.pid"), String(pid));
    await writeFile(join(ipc, "owned.sock"), "");
    await native.captureDaemon();
  };
  return { runtime, native, recordPid, ipc, profile };
}

describe.skipIf(process.platform !== "linux")("owned daemon shutdown", () => {
  it("waits for the acknowledged close to finish the daemon without signalling it, preserving the profile", async () => {
    const f = await fixture();
    const daemon = await ownChild();
    await f.recordPid(daemon.pid as number);
    expect(f.native.daemon?.pid).toBe(daemon.pid);
    const kill = vi.spyOn(process, "kill");
    cli.onClose = () => void setTimeout(() => daemon.kill("SIGTERM"), 100);
    await f.runtime.shutdown();
    await exited(daemon);
    expect(kill).not.toHaveBeenCalledWith(daemon.pid, "SIGKILL");
    await expect(readFile(join(f.ipc, "owned.sock"))).rejects.toThrow();
    await expect(readFile(join(f.profile, "."))).rejects.toMatchObject({ code: "EISDIR" });
  });

  it("force-terminates a daemon that outlives the bounded wait and confirms exit before returning", async () => {
    const f = await fixture(200);
    const daemon = await ownChild();
    await f.recordPid(daemon.pid as number);
    await f.runtime.shutdown();
    // exit was confirmed before shutdown returned; the OS only has to deliver the status
    await exited(daemon);
    expect(daemon.signalCode).toBe("SIGKILL");
    expect(cli.closes).toBe(1);
    await expect(readFile(join(f.ipc, "owned.pid"))).rejects.toThrow();
  });

  it("fails shutdown instead of reporting success when a signalled daemon does not exit", async () => {
    const f = await fixture(200);
    const daemon = await ownChild();
    await f.recordPid(daemon.pid as number);
    const kill = vi.spyOn(process, "kill").mockImplementation(() => true);
    await expect(f.runtime.shutdown(true)).rejects.toThrow("did not exit");
    expect(kill).toHaveBeenCalledWith(daemon.pid, "SIGKILL");
    expect(daemon.pid && alive(daemon.pid)).toBe(true);
  });

  it("never signals a process whose identity no longer matches the recorded daemon", async () => {
    const f = await fixture(200);
    const recorded = await ownChild();
    await f.recordPid(recorded.pid as number);
    // The recorded daemon is gone and its PID now names an unrelated live process.
    const bystander = await ownChild();
    await writeFile(join(f.ipc, "owned.pid"), String(bystander.pid));
    f.native.daemon = { pid: bystander.pid as number, startTicks: "1" };
    const kill = vi.spyOn(process, "kill");
    await f.runtime.shutdown(true);
    expect(kill).not.toHaveBeenCalledWith(bystander.pid, "SIGKILL");
    expect(bystander.pid && alive(bystander.pid)).toBe(true);
  });

  it("does not take authority from a PID file when no daemon identity was captured", async () => {
    const f = await fixture(200);
    const bystander = await ownChild();
    // Missing PID file at capture time, then a file naming a live unrelated process.
    await f.native.captureDaemon();
    expect(f.native.daemon).toBeNull();
    await writeFile(join(f.ipc, "owned.pid"), String(bystander.pid));
    const kill = vi.spyOn(process, "kill");
    await f.runtime.shutdown(true);
    expect(kill).not.toHaveBeenCalledWith(bystander.pid, "SIGKILL");
    expect(bystander.pid && alive(bystander.pid)).toBe(true);
  });

  it("refuses to capture a PID whose executable is not the owned binary", async () => {
    const f = await fixture();
    await mkdir(f.ipc, { recursive: true });
    await writeFile(join(f.ipc, "owned.pid"), "1");
    await f.native.captureDaemon();
    expect(f.native.daemon).toBeNull();
  });
});
