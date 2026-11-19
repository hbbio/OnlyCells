import { cleanupNode, jsx, type mount, text } from "@nodiffjs/core";
import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { installDom } from "../../../packages/nodiff/test/test-dom";
import { component, sheet } from "../src/cells";

test("releases nested cells and shared-cell bindings when a component render fails", async () => {
  const cleanup = installDom();
  const shared = sheet.new(1);
  const initial = sheet.stats.size;
  let detachedText: Text | undefined;
  const Child = component("Child", (proxy) =>
    jsx("span", { children: text(proxy.new(1), String) }),
  );
  const Broken = component("Broken", (proxy) => {
    proxy.new(0);
    detachedText = text(shared, String);
    Child({});
    throw new Error("Render failed");
  });

  try {
    expect(() => Broken({})).toThrow("Render failed");
    await Promise.resolve();
    expect(sheet.stats.size).toBe(initial);
    expect(detachedText?.data).toBe("1");
    shared.set(2);
    expect(detachedText?.data).toBe("1");
  } finally {
    if (detachedText) cleanupNode(detachedText);
    sheet.delete(shared);
    cleanup();
  }
});

test("uses shared app cells and frees component cells on route changes and unmount", async () => {
  const cleanup = installDom();
  const originalFetch = globalThis.fetch;
  let unmount: (() => void) | undefined;
  globalThis.fetch = async () =>
    Response.json([{ id: 1, userId: 1, title: "Sample post", body: "Fixture body" }]);

  try {
    window.location.href = "http://127.0.0.1:4173/";
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.setItem(
      "demo:preferences",
      JSON.stringify({
        value: { count: 2, search: "", theme: "night" },
        updatedAt: 1,
        expiresAt: null,
        tags: [],
      }),
    );

    const { outputs } = await Bun.build({
      entrypoints: [fileURLToPath(new URL("../src/app.tsx", import.meta.url))],
      target: "browser",
      plugins: [
        {
          name: "demo lifecycle test",
          setup(build) {
            build.onLoad({ filter: /\/src\/app\.tsx$/ }, async ({ path }) => ({
              loader: "tsx",
              contents: `${await Bun.file(path).text()}
export { mount } from "@nodiffjs/core";
export { postsState, preferences, session } from "./state";`,
            }));
          },
        },
      ],
    });
    const bundle = Buffer.from(await outputs[0]!.arrayBuffer()).toString("base64");
    const {
      App,
      router,
      routeState,
      mount: mountDemo,
      postsState,
      preferences,
      session,
    }: typeof import("../src/app") & { mount: typeof mount } & Pick<
        typeof import("../src/state"),
        "postsState" | "preferences" | "session"
      > = await import(`data:text/javascript;base64,${bundle}`);
    const appSheet = routeState.sheet;
    for (const cell of [postsState, preferences, session]) expect(cell.sheet).toBe(appSheet);
    const appCells = appSheet.stats.size;
    unmount = mountDemo("#app", App);
    const homeCells = appSheet.stats.size;
    expect(homeCells).toBeGreaterThan(appCells);
    expect(document.documentElement.dataset.theme).toBe("night");
    expect(document.querySelector(".counter-value")?.textContent).toBe("2");
    expect(JSON.parse(window.localStorage.getItem("demo:preferences")!)).toEqual({
      count: 2,
      search: "",
      postPage: 1,
      theme: "night",
      step: 1,
    });
    document.querySelector<HTMLButtonElement>(".counter-card .button-primary")?.click();
    expect(document.querySelector(".counter-value")?.textContent).toBe("3");
    expect(JSON.parse(window.localStorage.getItem("demo:preferences")!).count).toBe(3);

    const swatch = document.querySelector<HTMLButtonElement>(
      'button.theme-swatch[data-theme="nord"]',
    )!;
    const themeSelect = swatch.closest("article")!.querySelector("select")!;
    let selectChanges = 0;
    themeSelect.addEventListener("change", () => {
      selectChanges += 1;
    });
    expect(swatch.getAttribute("aria-pressed")).toBe("false");
    swatch.click();
    expect(document.documentElement.dataset.theme).toBe("nord");
    expect(themeSelect.value).toBe("nord");
    expect(swatch.getAttribute("aria-pressed")).toBe("true");
    expect(JSON.parse(window.localStorage.getItem("demo:preferences")!).theme).toBe("nord");
    expect(selectChanges).toBe(0);

    for (let attempt = 0; attempt < 3; attempt++) {
      router.navigate("/posts");
      expect(routeState.value?.path).toBe("/posts");
      for (let i = 0; i < 20 && !document.querySelector(".post-list h3"); i++) await Bun.sleep(5);
      expect(document.querySelector(".post-list h3")?.textContent).toBe("Sample post");
      const search = document.querySelector<HTMLInputElement>('input[type="search"]')!;
      search.value = "no matching post";
      search.dispatchEvent(new InputEvent("input"));
      expect(preferences.value?.search).toBe("no matching post");
      expect(document.querySelector(".post-list .notice")?.textContent).toBe(
        "No posts match this filter.",
      );
      search.value = "";
      search.dispatchEvent(new InputEvent("input"));
      expect(document.querySelector(".post-list h3")?.textContent).toBe("Sample post");
      router.navigate("/auth");
      if (attempt === 0) {
        document.querySelector("form")?.dispatchEvent(
          new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true,
          }),
        );
      }
      expect(session.value?.status).toBe("authenticated");
      expect(document.querySelector(".code-block")?.textContent).toContain("Authorization");
      router.navigate("/cache");
      expect(document.querySelector(".cache-keys")?.textContent).toContain("demo:preferences");
      if (attempt === 0) {
        const inventory = document.querySelector(".cache-keys");
        const counts = () =>
          Array.from(document.querySelectorAll(".app-main .metric-value")).map((element) =>
            Number(element.textContent),
          );
        const before = counts();
        window.localStorage.setItem(
          "demo:http:fixture",
          JSON.stringify({ value: [], tags: [], expiresAt: null, updatedAt: 1 }),
        );
        expect(inventory?.textContent).not.toContain("demo:http:fixture");
        document
          .querySelector<HTMLButtonElement>(".app-main .page-header .button-group button")
          ?.click();
        expect(document.querySelector(".cache-keys")?.textContent).toContain("demo:http:fixture");
        expect(counts()).toEqual(before.map((count) => count + 1));

        const row = Array.from(document.querySelectorAll(".cache-keys li")).find(
          (item) => item.querySelector("code")?.textContent === "demo:http:fixture",
        );
        row?.querySelector<HTMLButtonElement>("button")?.click();
        expect(window.localStorage.getItem("demo:http:fixture")).toBeNull();
        expect(counts()).toEqual(before);
      }
      router.navigate("/");
      await Promise.resolve();
      expect(appSheet.stats.size).toBe(homeCells);
      expect(document.querySelector(".counter-value")?.textContent).toBe("3");
    }

    unmount();
    unmount = undefined;
    await Promise.resolve();
    expect(appSheet.stats.size).toBe(appCells);
  } finally {
    unmount?.();
    globalThis.fetch = originalFetch;
    cleanup();
  }
});
