import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import { createSecurityPolicy, securityHeaders } from "../src/security";

type PackageManifest = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const root = fileURLToPath(new URL("../../..", import.meta.url));

function readRepoFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function readPackage(path: string): PackageManifest {
  return JSON.parse(readRepoFile(path)) as PackageManifest;
}

describe("security baseline", () => {
  test("checks and builds with pinned submodules and zero registry dependencies", () => {
    const securityCheck = readPackage("package.json").scripts?.["security:check"];
    expect(securityCheck).toContain("bun run check");
    expect(securityCheck).toContain("bun run build");

    for (const path of [
      "package.json",
      "apps/demo/package.json",
      "packages/onlycells/package.json",
    ]) {
      const { dependencies, devDependencies, optionalDependencies, peerDependencies } =
        readPackage(path);
      expect({
        ...dependencies,
        ...devDependencies,
        ...optionalDependencies,
        ...peerDependencies,
      }).toEqual({});
    }
    expect(existsSync(join(root, "bun.lock"))).toBe(false);
    const submodules = readRepoFile(".gitmodules");
    expect(submodules).toContain("path = packages/cells");
    expect(submodules).toContain("path = packages/graph");
    expect(readRepoFile("bunfig.toml")).toContain('auto = "disable"');

    const workflow = readRepoFile(".github/workflows/ci.yml");
    expect(workflow).toMatch(/uses: actions\/checkout@[a-f0-9]{40}\b/);
    expect(workflow).toContain("submodules: true");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).not.toMatch(/\b(?:npm|bun) (?:install|add|audit)\b/);
  });

  test("keeps local secrets ignored", () => {
    const ignored = readRepoFile(".gitignore").split(/\r?\n/);

    expect(ignored).toContain(".env");
    expect(ignored).toContain(".env.*");
  });

  test("keeps the demo wired to strict security defaults", () => {
    const state = readRepoFile("apps/demo/src/state.ts");
    const app = readRepoFile("apps/demo/src/app.tsx");
    const main = readRepoFile("apps/demo/src/main.tsx");

    expect(state).toContain("configureSecurityPolicy");
    expect(state).toContain('mode: "strict"');
    expect(state).toContain('allowedOrigins: ["self", "https://jsonplaceholder.typicode.com"]');
    expect(state).toContain("enforceHttps: true");
    expect(state).toContain('csrf: "double-submit-cookie"');
    expect(state).toContain("security: securityPolicy");
    expect(state).toContain("readDemoCsrfToken");
    expect(app).toContain("error: RouteError");
    expect(main).toContain("catchRender");
  });

  test("keeps public API reads isolated from demo auth headers", () => {
    const state = readRepoFile("apps/demo/src/state.ts");
    const publicApi = state.match(/const publicApi = createApi\(\{[\s\S]*?\n\}\);/)?.[0];
    const sessionApi = state.match(/export const sessionApi = createApi\(\{[\s\S]*?\n\}\);/)?.[0];

    expect(publicApi).toContain('baseUrl: "https://jsonplaceholder.typicode.com"');
    expect(publicApi).not.toContain("getAuthHeaders");
    expect(state).toContain("publicApi.get");
    expect(state).toContain("auth: false");
    expect(sessionApi).toContain('baseUrl: "/api"');
    expect(sessionApi).toContain("getAuthHeaders: auth.authHeaders");
    expect(sessionApi).toContain("getToken: readDemoCsrfToken");
  });

  test("keeps visible demo errors redacted", () => {
    const postsPage = readRepoFile("apps/demo/src/pages/PostsPage.tsx");

    expect(postsPage).toContain("safeErrorMessage(resource.error)");
    expect(postsPage).toContain("safeErrorMessage(error)");
    expect(postsPage).not.toContain("error.message");
  });

  test("publishes deployment security headers from framework defaults", () => {
    const headers = readRepoFile("apps/demo/public/_headers");
    const expected = securityHeaders({
      policy: createSecurityPolicy({
        mode: "strict",
        allowedOrigins: ["self", "https://jsonplaceholder.typicode.com"],
        allowedUrlSchemes: ["http:", "https:"],
        enforceHttps: true,
      }),
      hsts: true,
    });

    for (const [name, value] of Object.entries(expected)) {
      expect(headers).toContain(`${name}: ${value}`);
    }
  });

  test("keeps the demo away from common production footguns", () => {
    const state = readRepoFile("apps/demo/src/state.ts");
    const authPage = readRepoFile("apps/demo/src/pages/AuthPage.tsx");
    const build = readRepoFile("apps/demo/build.ts");
    const html = readRepoFile("apps/demo/index.html");

    expect(state).not.toContain("persist: true");
    expect(state).not.toContain("allowRefreshTokenPersistence: true");
    expect(authPage).toContain("csrf:");
    expect(authPage).toContain("getToken: readDemoCsrfToken");
    expect(build).toContain('sourcemap: "none"');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });
});
