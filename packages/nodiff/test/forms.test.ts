import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { jsx, mount } from "../src/dom";
import { CsrfError } from "../src/csrf";
import { applyFormValidity, formValues, validatedSubmit } from "../src/forms";
import { defineSchema, ValidationError } from "../src/schema";
import { installDom } from "./test-dom";

const emailSchema = defineSchema((input) => {
  if (
    !input ||
    typeof input !== "object" ||
    !("email" in input) ||
    typeof input.email !== "string" ||
    !input.email.includes("@")
  ) {
    throw new ValidationError([{ path: ["email"], message: "Use a valid email address." }]);
  }
  return { email: input.email };
});

describe("forms", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    document.body.innerHTML = '<main id="app"></main>';
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  test("adds CSRF fields and submits parsed form values", async () => {
    let submitted: { email: string } | null = null;
    const unmount = mount(
      "#app",
      jsx("form", {
        use: validatedSubmit(
          emailSchema,
          (values) => {
            submitted = values;
          },
          {
            csrf: {
              token: "csrf-token",
              fieldName: "_token",
            },
          },
        ),
        children: jsx("input", {
          name: "email",
          value: "demo@example.test",
        }),
      }),
    );

    const form = document.querySelector("form") as HTMLFormElement;
    expect((form.elements.namedItem("_token") as HTMLInputElement | null)?.value).toBe(
      "csrf-token",
    );

    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    expect(submitted).toEqual({ email: "demo@example.test" });

    unmount();
  });

  test("collects repeated field names and reports schema validation errors", async () => {
    let submitted = false;
    let errors = 0;
    const unmount = mount(
      "#app",
      jsx("form", {
        use: validatedSubmit(
          emailSchema,
          () => {
            submitted = true;
          },
          {
            onError: () => {
              errors += 1;
            },
          },
        ),
        children: [
          jsx("input", { name: "email", value: "not-an-email" }),
          jsx("input", { name: "tag", value: "one" }),
          jsx("input", { name: "tag", value: "two" }),
          jsx("input", { name: "tag", value: "three" }),
        ],
      }),
    );

    const form = document.querySelector("form") as HTMLFormElement;
    expect(formValues(form)).toEqual({
      email: "not-an-email",
      tag: ["one", "two", "three"],
    });

    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(submitted).toBe(false);
    expect(errors).toBe(1);
    const email = form.elements.namedItem("email") as HTMLInputElement;
    expect(email.validationMessage).toBe("Use a valid email address.");

    applyFormValidity(form, new ValidationError([{ path: [], message: "Invalid form." }]));
    expect(email.validationMessage).toBe("");

    unmount();
  });

  test("rejects required CSRF forms without a token", async () => {
    let submitted = false;
    let csrfError: CsrfError | null = null;
    const unmount = mount(
      "#app",
      jsx("form", {
        use: validatedSubmit(
          emailSchema,
          () => {
            submitted = true;
          },
          {
            csrf: { required: true },
            onCsrfError: (error) => {
              csrfError = error;
            },
          },
        ),
        children: jsx("input", {
          name: "email",
          value: "demo@example.test",
        }),
      }),
    );

    const form = document.querySelector("form") as HTMLFormElement;
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(submitted).toBe(false);
    expect(csrfError).toBeInstanceOf(CsrfError);

    unmount();
  });
});
