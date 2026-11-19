import { expect, test } from "bun:test";
import { LoginSchema, PostsSchema, PreferencesSchema } from "../src/schemas";

test("restores preferences saved before page and step fields existed", () => {
  expect(PreferencesSchema.parse({ count: 2, search: "photo", theme: "night" })).toEqual({
    count: 2,
    search: "photo",
    theme: "night",
    postPage: 1,
    step: 1,
  });
  expect(PreferencesSchema.safeParse({ count: 2, search: "", theme: "unknown" }).success).toBe(
    false,
  );
});

test("validates each post and selects its known fields", () => {
  const post = { id: 1, userId: 2, title: "Update", body: "Ready" };
  expect(PostsSchema.parse([{ ...post, extra: true }])).toEqual([post]);
  expect(PostsSchema.safeParse([post, { ...post, id: "invalid" }]).success).toBe(false);
});

test("reports login issues on both invalid fields", () => {
  const result = LoginSchema.safeParse({ email: "invalid", password: "x" });
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.map((issue) => issue.path)).toEqual([["email"], ["password"]]);
  }
  const login = { email: "demo@example.com", password: "demo" };
  expect(LoginSchema.parse({ ...login, _csrf: "token" })).toEqual(login);
});
