import { describe, expect, it, vi } from "vitest";
import { AgentBrowserRuntime } from "./agent-browser-runtime";

const cdp = vi.hoisted(() => ({ replacement: null as unknown }));
vi.mock("./cdp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./cdp")>()),
  listPageTargets: async () => [{ targetId: "page-1" }],
  attachToTarget: async () => cdp.replacement,
}));

/** Screencast reattach detaches the original CDP session; a held press must be released on it first. */
describe("screencast reattach with held input", () => {
  it("releases the held mouse at its last point on the original session before detaching it", async () => {
    const order: string[] = [];
    const original = {
      targetId: "page-1",
      send: async (method: string, params: Record<string, unknown> = {}) => {
        if (method === "Input.dispatchMouseEvent")
          order.push(`${String(params.type)}@${String(params.x)},${String(params.y)}`);
        return {};
      },
      detach: async () => {
        order.push("detach");
      },
    };
    cdp.replacement = { targetId: "page-1", send: async () => ({}), detach: async () => {} };
    const runtime = new AgentBrowserRuntime({
      binaryPath: "/tmp/unlaunched-browser",
      executablePath: "/tmp/unlaunched-chromium",
      profilePath: "/tmp/uncreated-profile",
      ipcDirectory: "/tmp/uncreated-ipc",
      session: "test",
    });
    const internals = runtime as unknown as Record<string, unknown> & {
      reattachPageForScreencast(previous: unknown): Promise<unknown>;
    };
    Object.assign(runtime, {
      page: original,
      connection: { isOpen: true, send: async () => ({}) },
      emulationAppliedPage: original,
      viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false, touch: false },
    });
    internals.bindPageEvents = async () => {};
    internals.restoreConfiguredEmulation = async () => {};
    const control = runtime as unknown as {
      attachmentGeneration: number;
      documentGeneration: number;
    };
    await runtime.beginLiveInput(
      "owned",
      `${control.attachmentGeneration}:${control.documentGeneration}`,
    );
    await runtime.mouseDown(10, 20, "left", 1, "owned");
    await runtime.mouseMove(300, 410, "owned");

    await internals.reattachPageForScreencast(original);

    expect(order.filter((entry) => entry.startsWith("mouseReleased"))).toEqual([
      "mouseReleased@300,410",
    ]);
    expect(order.indexOf("mouseReleased@300,410")).toBeLessThan(order.indexOf("detach"));
    await expect(runtime.assertLiveInput("owned")).rejects.toThrow();
  });
});
