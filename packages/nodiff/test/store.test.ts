import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { jsx, mount } from "../src/dom";
import { createCellStore, derivedStore, effect, list, when } from "../src/store";
import { installDom } from "./test-dom";

describe("store view helpers", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    document.body.innerHTML = '<main id="app"></main>';
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("reads cell writes synchronously and reports only changed snapshots", () => {
    const store = createCellStore(() => ({ count: 0, label: "count" }));
    const updates: number[][] = [];
    const unsubscribe = store.subscribe((now, before) => updates.push([before.count, now.count]));

    store.setState((state) => ({ count: state.count + 1 }));
    store.setState((state) => state);
    expect(store.getState()).toEqual({ count: 1, label: "count" });
    expect(updates).toEqual([[0, 1]]);

    unsubscribe();
    store.setState({ count: 2, label: "total" }, true);
    expect(store.getState()).toEqual({ count: 2, label: "total" });
    expect(store.getInitialState()).toEqual({ count: 0, label: "count" });
    expect(updates).toEqual([[0, 1]]);
  });

  test("runs effects and renders conditional and list views", () => {
    const store = createCellStore(() => ({
      enabled: true,
      count: 1,
      items: ["a"],
    }));
    const effects: string[] = [];

    const unmount = mount(
      "#app",
      jsx("section", {
        use: effect(
          store,
          (state) => state.count,
          (count, previous, state) => {
            effects.push(`${previous ?? "none"}:${count}:${state.enabled}`);
          },
        ),
        children: [
          when(
            store,
            (state) => state.enabled,
            (state) => `On:${state.count};`,
            (state) => `Off:${state.count};`,
          ),
          list(
            store,
            (state) => state.items,
            (item, index, items) => jsx("span", { children: `${index}/${items.length}:${item};` }),
          ),
        ],
      }),
    );

    expect(document.querySelector("#app")?.textContent).toBe("On:1;0/1:a;");
    expect(effects).toEqual(["none:1:true"]);

    store.setState({
      enabled: false,
      count: 2,
      items: ["b", "c"],
    });

    expect(document.querySelector("#app")?.textContent).toBe("Off:2;0/2:b;1/2:c;");
    expect(effects).toEqual(["none:1:true", "1:2:false"]);

    unmount();
    store.setState({ count: 3 });

    expect(effects).toEqual(["none:1:true", "1:2:false"]);
  });

  test("renders an empty conditional branch when no fallback is provided", () => {
    const store = createCellStore(() => ({ enabled: false }));

    const unmount = mount(
      "#app",
      when(
        store,
        (state) => state.enabled,
        () => "Visible",
      ),
    );

    expect(document.querySelector("#app")?.textContent).toBe("");

    store.setState({ enabled: true });
    expect(document.querySelector("#app")?.textContent).toBe("Visible");

    unmount();
  });

  test("derives readable stores from explicit dependencies", () => {
    const count = createCellStore(() => ({ value: 1 }));
    const label = createCellStore(() => ({ value: "a" }));
    const derived = derivedStore(
      [count, label],
      (countState, labelState) => `${labelState.value}:${countState.value}`,
    );
    const updates: string[] = [];

    expect(derived.getState()).toBe("a:1");

    const unsubscribe = derived.subscribe((state, previousState) => {
      updates.push(`${previousState}->${state}`);
    });

    count.setState({ value: 2 });
    expect(derived.getState()).toBe("a:2");
    expect(updates).toEqual(["a:1->a:2"]);

    count.setState({ value: 2 });
    expect(updates).toEqual(["a:1->a:2"]);

    label.setState({ value: "b" });
    expect(derived.getState()).toBe("b:2");
    expect(updates).toEqual(["a:1->a:2", "a:2->b:2"]);

    unsubscribe();
    label.setState({ value: "c" });

    expect(updates).toEqual(["a:1->a:2", "a:2->b:2"]);
    expect(derived.getState()).toBe("c:2");
  });

  test("supports equality for derived store updates", () => {
    const source = createCellStore(() => ({ count: 1, label: "first" }));
    const derived = derivedStore([source], (state) => ({ bucket: Math.floor(state.count / 10) }), {
      equality: (left, right) => left.bucket === right.bucket,
    });
    const updates: number[] = [];

    const unsubscribe = derived.subscribe((state) => {
      updates.push(state.bucket);
    });

    source.setState({ count: 2, label: "second" });
    source.setState({ count: 11 });

    expect(updates).toEqual([1]);
    expect(derived.getState()).toEqual({ bucket: 1 });

    unsubscribe();
  });
});
