import { defineSchema, ValidationError, type ValidationIssue } from "@nodiffjs/core";

export const themeOptions = [
  "system",
  "light",
  "dark",
  "cupcake",
  "corporate",
  "emerald",
  "synthwave",
  "retro",
  "cyberpunk",
  "night",
  "nord",
  "sunset",
  "silk",
] as const;

export type PreferencesData = {
  count: number;
  search: string;
  postPage: number;
  theme: (typeof themeOptions)[number];
  step: number;
};

export type Post = { userId: number; id: number; title: string; body: string };
export type LoginValues = { email: string; password: string };

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

function invalid(message: string, path: readonly PropertyKey[] = []): never {
  throw new ValidationError([{ path, message }]);
}

function isTheme(input: unknown): input is PreferencesData["theme"] {
  return themeOptions.some((theme) => theme === input);
}

function isIntegerAtLeast(input: unknown, minimum: number): input is number {
  return typeof input === "number" && Number.isSafeInteger(input) && input >= minimum;
}

export const PreferencesSchema = defineSchema((input): PreferencesData => {
  if (!isRecord(input)) invalid("Expected preferences.");
  const { count, search, postPage = 1, theme, step = 1 } = input;
  if (!isIntegerAtLeast(count, 0)) invalid("Expected a nonnegative count.", ["count"]);
  if (typeof search !== "string") invalid("Expected a search string.", ["search"]);
  if (!isIntegerAtLeast(postPage, 1)) invalid("Expected a positive page number.", ["postPage"]);
  if (!isTheme(theme)) invalid("Select a supported theme.", ["theme"]);
  if (!isIntegerAtLeast(step, 1) || step > 10) invalid("Enter a step from 1 to 10.", ["step"]);
  return { count, search, postPage, theme, step };
});

function isNumber(input: unknown): input is number {
  return typeof input === "number" && Number.isFinite(input);
}

export const PostsSchema = defineSchema((input): Post[] => {
  if (!Array.isArray(input)) invalid("Expected a list of posts.");
  return Array.from(input, (post: unknown, index) => {
    if (!isRecord(post)) invalid("Expected a post.", [index]);
    const { userId, id, title, body } = post;
    if (!isNumber(userId)) invalid("Expected a user ID.", [index, "userId"]);
    if (!isNumber(id)) invalid("Expected a post ID.", [index, "id"]);
    if (typeof title !== "string") invalid("Expected a post title.", [index, "title"]);
    if (typeof body !== "string") invalid("Expected a post body.", [index, "body"]);
    return { userId, id, title, body };
  });
});

const emailPattern =
  /^[A-Za-z0-9_+'-]+(?:\.[A-Za-z0-9_+'-]+)*@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

export const LoginSchema = defineSchema((input): LoginValues => {
  if (!isRecord(input)) invalid("Expected login fields.");
  const { email, password } = input;
  const validEmail = typeof email === "string" && emailPattern.test(email);
  const validPassword = typeof password === "string" && password.length >= 4;
  if (!validEmail || !validPassword) {
    const issues: ValidationIssue[] = [];
    if (!validEmail) issues.push({ path: ["email"], message: "Enter a valid email address." });
    if (!validPassword) {
      issues.push({ path: ["password"], message: "Enter at least four characters." });
    }
    throw new ValidationError(issues);
  }
  return { email, password };
});
