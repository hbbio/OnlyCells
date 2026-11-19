import { Sheet } from "@okcontract/cells";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createAuth } from "../src/auth";
import { jsx, mount } from "../src/dom";
import { createResource } from "../src/resource";
import { createRouter, type RouterState } from "../src/router";
import { effect, list, subscribeSelector, when } from "../src/store";
import { installDom } from "./test-dom";

describe("Cell view helpers", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    document.body.innerHTML = '<main id="app"></main>';
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("derives from initialized controller cells on a shared sheet", () => {
    window.location.href = "http://localhost/";
    const sheet = new Sheet(Object.is);
    const auth = createAuth<{ name: string }>({ sheet });
    const resource = createResource({ sheet, initialData: 1, load: async () => 2 });
    const router = createRouter([{ path: "/", component: () => "Home" }], { sheet });
    const summary = sheet.map([auth.cell, resource.cell, router.cell], (session, result, route) => [
      session.user?.name ?? "guest",
      result.data,
      route.path,
    ]);

    expect(summary.value).toEqual(["guest", 1, "/"]);
    for (const cell of [auth.cell, resource.cell, router.cell]) expect(cell.sheet).toBe(sheet);

    auth.setToken({ accessToken: "test" }, { name: "Ada" });
    resource.mutate(3);
    router.navigate("/posts");
    expect(summary.value).toEqual(["Ada", 3, "/posts"]);
  });

  test("initializes and uses an injected writable cell", () => {
    window.location.href = "http://localhost/";
    const cell = new Sheet().new<RouterState>({
      path: "/old",
      pathname: "/old",
      query: new URLSearchParams(),
      match: null,
    });
    const router = createRouter([{ path: "/", component: () => "Home" }], { cell });

    expect(router.cell).toBe(cell);
    expect(cell.value?.path).toBe("/");
    router.navigate("/posts");
    expect(cell.value?.path).toBe("/posts");
  });

  test("reports the previous Cell snapshot when the selected field changes", () => {
    const cell = new Sheet(Object.is).new({ count: 0, label: "count" });
    const updates: [number, number, string][] = [];
    const unsubscribe = subscribeSelector(
      cell,
      (state) => state.count,
      (now, before, _state, previous) => updates.push([before, now, previous.label]),
    );

    cell.set({ count: 0, label: "total" });
    cell.update((state) => ({ ...state, count: state.count + 1 }));
    cell.update((state) => state);
    expect(cell.value).toEqual({ count: 1, label: "total" });
    expect(updates).toEqual([[0, 1, "total"]]);

    unsubscribe();
    cell.set({ count: 2, label: "total" });
    expect(updates).toEqual([[0, 1, "total"]]);
  });

  test("runs effects and renders conditional and list views", () => {
    const cell = new Sheet(Object.is).new({
      enabled: true,
      count: 1,
      items: ["a"],
    });
    const effects: string[] = [];

    const unmount = mount(
      "#app",
      jsx("section", {
        use: effect(
          cell,
          (state) => state.count,
          (count, previous, state) => {
            effects.push(`${previous ?? "none"}:${count}:${state.enabled}`);
          },
        ),
        children: [
          when(
            cell,
            (state) => state.enabled,
            (state) => `On:${state.count};`,
            (state) => `Off:${state.count};`,
          ),
          list(
            cell,
            (state) => state.items,
            (item, index, items) => jsx("span", { children: `${index}/${items.length}:${item};` }),
          ),
        ],
      }),
    );

    expect(document.querySelector("#app")?.textContent).toBe("On:1;0/1:a;");
    expect(effects).toEqual(["none:1:true"]);

    cell.set({
      enabled: false,
      count: 2,
      items: ["b", "c"],
    });

    expect(document.querySelector("#app")?.textContent).toBe("Off:2;0/2:b;1/2:c;");
    expect(effects).toEqual(["none:1:true", "1:2:false"]);

    unmount();
    cell.update((state) => ({ ...state, count: 3 }));

    expect(effects).toEqual(["none:1:true", "1:2:false"]);
  });

  test("renders an empty conditional branch when no fallback is provided", () => {
    const cell = new Sheet(Object.is).new({ enabled: false });

    const unmount = mount(
      "#app",
      when(
        cell,
        (state) => state.enabled,
        () => "Visible",
      ),
    );

    expect(document.querySelector("#app")?.textContent).toBe("");

    cell.set({ enabled: true });
    expect(document.querySelector("#app")?.textContent).toBe("Visible");

    unmount();
  });
});
