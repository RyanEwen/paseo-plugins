import { expect, it } from "vitest";
import { browserStateSchema } from "../shared/browser";
import { type JsonValue, RuntimeLostError } from "./runtime-protocol";
import { RuntimeSupervisor } from "./supervisor";

/** An explicit viewer reconnect replaces a runtime whose private display died, behind a new fence. */
it("recreates a lost runtime only on the next attach and rejects every old attachment", async () => {
  const events: string[] = [];
  let created = 0;
  let lost = false;
  const supervisor = new RuntimeSupervisor({
    owner: {
      create: async () => {
        created += 1;
        events.push(`create:${created}`);
        return { runtimeId: `${"r".repeat(30)}${String(created).padStart(2, "0")}`, id: created };
      },
      request: async (runtime, operation) => {
        events.push(`${operation}:${runtime.id}`);
        if (lost && runtime.id === 1) throw new RuntimeLostError("Private browser display ended");
        if (operation === "identity") return { userAgent: "Fixture Chromium" };
        if (operation === "state")
          return {
            url: "https://fixture.invalid",
            title: "Fixture",
            canGoBack: false,
            canGoForward: false,
            inputGeneration: "0:0",
          };
        return null;
      },
      stop: async (runtime) => {
        events.push(`stop:${runtime.id}`);
      },
    },
  });
  const lease = supervisor.claimBridge("bridge");
  const request = (operation: string, input: unknown) =>
    supervisor.dispatch({
      version: 2,
      id: "request",
      token: "unused-by-direct-fixture",
      bridgeId: "bridge",
      epoch: lease.epoch,
      method: "browser.request",
      operation,
      input: input as JsonValue,
    });
  try {
    const first = (await request("attach", {
      workspaceId: "workspace",
      viewerLabel: "Viewer",
    })) as {
      viewerToken: string;
      state: unknown;
    };
    const control = (await request("acquire-control", { viewerToken: first.viewerToken })) as {
      controlToken: string;
    };
    const before = browserStateSchema.parse(first.state);

    lost = true;
    const failed = (await request("status", { viewerToken: first.viewerToken })) as {
      state: { status: string };
    };
    expect(failed.state.status).toBe("error");
    // Plain polling never restarts the browser.
    expect(created).toBe(1);
    expect(events.filter((event) => event.startsWith("stop"))).toEqual([]);

    const second = (await request("attach", {
      workspaceId: "workspace",
      viewerLabel: "Viewer",
    })) as {
      viewerToken: string;
      state: unknown;
    };
    const after = browserStateSchema.parse(second.state);
    expect(after.status).toBe("ready");
    expect(after.sessionId).not.toBe(before.sessionId);
    expect(after.runtimeId).not.toBe(before.runtimeId);
    expect(events.indexOf("stop:1")).toBeGreaterThan(-1);
    expect(events.indexOf("stop:1")).toBeLessThan(events.indexOf("create:2"));
    expect(events.some((event) => event === "navigate:1" || event.startsWith("mouse"))).toBe(false);

    await expect(request("status", { viewerToken: first.viewerToken })).rejects.toThrow();
    await expect(
      request("input", {
        viewerToken: first.viewerToken,
        controlToken: control.controlToken,
        expected: {
          sessionId: before.sessionId,
          runtimeId: before.runtimeId,
          navigationGeneration: before.navigationGeneration,
          viewportGeneration: before.viewportGeneration,
        },
        event: { kind: "move", point: { x: 1, y: 1 } },
      }),
    ).rejects.toThrow();
    await expect(request("status", { viewerToken: second.viewerToken })).resolves.toBeTruthy();
  } finally {
    await supervisor.stopAll();
  }
});
