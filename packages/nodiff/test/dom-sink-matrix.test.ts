import { Sheet } from "@okcontract/cells";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { jsx } from "../src/dom";
import { configureSecurityPolicy, type SecurityViolation } from "../src/security";
import { bind, type PropsBinding } from "../src/store";
import { installDom } from "./test-dom";

type SinkCase = {
  name: string;
  tag: string;
  prop: string;
  value: unknown;
  error: string | RegExp;
};

type WritePath = {
  name: string;
  write(sink: SinkCase): void;
};

const sinkCases: SinkCase[] = [
  {
    name: "innerHTML",
    tag: "div",
    prop: "innerHTML",
    value: "<img src=x onerror=alert(1)>",
    error: "not supported",
  },
  {
    name: "outerHTML",
    tag: "div",
    prop: "outerHTML",
    value: "<img src=x onerror=alert(1)>",
    error: "Raw HTML DOM sink",
  },
  {
    name: "outerHTML with a boolean value",
    tag: "div",
    prop: "outerHTML",
    value: true,
    error: "Raw HTML DOM sink",
  },
  {
    name: "srcdoc",
    tag: "iframe-preview",
    prop: "srcdoc",
    value: "<script>alert(1)</script>",
    error: "Raw HTML DOM sink",
  },
  {
    name: "href",
    tag: "a",
    prop: "href",
    value: "javascript:alert(1)",
    error: "disallowed scheme",
  },
  {
    name: "xlinkHref",
    tag: "use",
    prop: "xlinkHref",
    value: "javascript:alert(1)",
    error: "disallowed scheme",
  },
  {
    name: "srcset",
    tag: "img",
    prop: "srcset",
    value: "/safe.png 1x, javascript:alert(1) 2x",
    error: "disallowed scheme",
  },
  {
    name: "style",
    tag: "div",
    prop: "style",
    value: "background-image: url(javascript:alert(1))",
    error: "unsafe CSS",
  },
  {
    name: "event handler",
    tag: "button",
    prop: "onClick",
    value: "alert(1)",
    error: /Event handler attributes|must be a function/,
  },
];

function render(tag: string, props: Record<string, unknown>): void {
  void jsx(tag, props);
}

const writePaths: WritePath[] = [
  {
    name: "JSX prop",
    write(sink) {
      render(sink.tag, { [sink.prop]: sink.value });
    },
  },
  {
    name: "bind.attr",
    write(sink) {
      const cell = new Sheet().new(sink.value);
      render(sink.tag, {
        use: bind.attr(sink.prop, cell, (value) => value),
      });
    },
  },
  {
    name: "bind.prop",
    write(sink) {
      const cell = new Sheet().new(sink.value);
      render(sink.tag, {
        use: bind.prop(sink.prop, cell, (value) => value),
      });
    },
  },
  {
    name: "bind.props direct",
    write(sink) {
      const cell = new Sheet().new<PropsBinding>({ [sink.prop]: sink.value });
      render(sink.tag, {
        use: bind.props(cell, (props) => props),
      });
    },
  },
  {
    name: "bind.props attributes",
    write(sink) {
      const cell = new Sheet().new<PropsBinding>({
        attributes: { [sink.prop]: sink.value },
      });
      render(sink.tag, {
        use: bind.props(cell, (props) => props),
      });
    },
  },
];

describe("DOM sink matrix", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installDom();
    configureSecurityPolicy({});
  });

  afterEach(() => {
    configureSecurityPolicy({});
    cleanupDom?.();
    cleanupDom = undefined;
  });

  for (const writePath of writePaths) {
    for (const sink of sinkCases) {
      test(`blocks ${sink.name} through ${writePath.name}`, () => {
        expect(() => writePath.write(sink)).toThrow(sink.error);
      });
    }
  }

  test("validates coerced URL properties on Cell updates", () => {
    const violations: SecurityViolation[] = [];
    configureSecurityPolicy({
      mode: "strict",
      allowedOrigins: ["https://example.test"],
      onViolation: (violation) => violations.push(violation),
    });
    const href = new Sheet().new<string | URL>("https://example.test/initial");
    const link = jsx("a", {
      use: bind.prop("href", href, (value) => value),
    }) as HTMLAnchorElement;

    href.set(new URL("https://example.test/updated"));
    expect(link.href).toBe("https://example.test/updated");

    expect(() => href.set(new URL("https://other.example.test/blocked"))).toThrow(
      "disallowed origin",
    );
    expect(violations).toHaveLength(1);
    expect(link.href).toBe("https://example.test/updated");
  });
});
