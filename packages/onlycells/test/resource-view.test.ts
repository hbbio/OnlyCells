import { Sheet } from "@okcontract/cells";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { jsx, mount } from "../src/dom";
import { createResource, type ResourceState } from "../src/resource";
import { Await, ResourceView } from "../src/store";
import { installDom } from "./test-dom";

type User = {
  id: number;
  name: string;
};

function state(partial: Partial<ResourceState<User>> = {}): ResourceState<User> {
  return {
    status: "idle",
    data: null,
    error: null,
    updatedAt: null,
    loading: false,
    stale: false,
    ...partial,
  };
}

describe("ResourceView", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    document.body.innerHTML = '<main id="app"></main>';
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("renders empty, pending, success, stale data, and error branches", () => {
    const resource = new Sheet(Object.is).new(state());
    const errors: string[] = [];

    const unmount = mount(
      "#app",
      ResourceView({
        resource,
        empty: (current) => `Empty:${current.status}`,
        pending: (current) => `Pending:${current.status}`,
        error: (error, current) => {
          errors.push(`${error.message}:${current.status}`);
          return `Error:${error.message}`;
        },
        children: (user, current) => `User:${user.name}:${current.loading}:${current.stale}`,
      }),
    );

    expect(document.querySelector("#app")?.textContent).toBe("Empty:idle");

    resource.set(state({ status: "loading", loading: true }));
    expect(document.querySelector("#app")?.textContent).toBe("Pending:loading");

    resource.set(
      state({
        status: "success",
        data: { id: 1, name: "Ada" },
        updatedAt: Date.now(),
      }),
    );
    expect(document.querySelector("#app")?.textContent).toBe("User:Ada:false:false");

    resource.set(
      state({
        status: "success",
        data: { id: 1, name: "Ada" },
        loading: true,
        stale: true,
        updatedAt: Date.now(),
      }),
    );
    expect(document.querySelector("#app")?.textContent).toBe("User:Ada:true:true");

    resource.set(
      state({
        status: "error",
        error: new Error("Denied"),
      }),
    );
    expect(document.querySelector("#app")?.textContent).toBe("Error:Denied");
    expect(errors).toEqual(["Denied:error"]);

    unmount();
  });

  test("passes a resource Cell to the Await alias", () => {
    const resource = createResource<User>({
      initialData: { id: 1, name: "Ada" },
      load: async () => ({ id: 2, name: "Grace" }),
    });

    const unmount = mount(
      "#app",
      Await({
        resource: resource.cell,
        children: (user) => jsx("span", { children: user.name }),
      }),
    );

    expect(document.querySelector("#app")?.textContent).toBe("Ada");

    resource.mutate({ id: 2, name: "Grace" });
    expect(document.querySelector("#app")?.textContent).toBe("Grace");

    unmount();
  });

  test("cleans replaced branches and unsubscribes on unmount", () => {
    const resource = new Sheet(Object.is).new(state({ status: "loading", loading: true }));
    let cleanups = 0;

    const unmount = mount(
      "#app",
      ResourceView({
        resource,
        pending: () =>
          jsx("span", {
            use: () => () => {
              cleanups += 1;
            },
            children: "Pending",
          }),
        error: () =>
          jsx("span", {
            use: () => () => {
              cleanups += 1;
            },
            children: "Error",
          }),
        children: (user) =>
          jsx("span", {
            use: () => () => {
              cleanups += 1;
            },
            children: user.name,
          }),
      }),
    );

    resource.set(
      state({
        status: "success",
        data: { id: 1, name: "Ada" },
      }),
    );

    expect(cleanups).toBe(1);
    expect(document.querySelector("#app")?.textContent).toBe("Ada");

    resource.set(
      state({
        status: "error",
        error: new Error("Nope"),
      }),
    );

    expect(cleanups).toBe(2);
    expect(document.querySelector("#app")?.textContent).toBe("Error");

    unmount();
    expect(cleanups).toBe(3);

    resource.set(
      state({
        status: "success",
        data: { id: 2, name: "Grace" },
      }),
    );
    expect(document.querySelector("#app")?.textContent).toBe("");
    expect(cleanups).toBe(3);
  });

  test("honors equality for whole resource states", () => {
    const resource = new Sheet(Object.is).new(
      state({
        status: "success",
        data: { id: 1, name: "Ada" },
      }),
    );
    let renders = 0;

    const unmount = mount(
      "#app",
      ResourceView({
        resource,
        equality: (left, right) => left.updatedAt === right.updatedAt,
        children: (user) => {
          renders += 1;
          return user.name;
        },
      }),
    );

    expect(document.querySelector("#app")?.textContent).toBe("Ada");
    expect(renders).toBe(1);

    resource.set(
      state({
        status: "success",
        data: { id: 1, name: "Ada changed" },
      }),
    );
    expect(document.querySelector("#app")?.textContent).toBe("Ada");
    expect(renders).toBe(1);

    resource.set(
      state({
        status: "success",
        data: { id: 1, name: "Ada changed" },
        updatedAt: Date.now(),
      }),
    );
    expect(document.querySelector("#app")?.textContent).toBe("Ada changed");
    expect(renders).toBe(2);

    unmount();
  });
});
