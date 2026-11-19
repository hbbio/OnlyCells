import { defineSchema, ValidationError, type ValidationIssue } from "@nodiffjs/core";

export type Post = { userId: number; id: number; title: string; body: string };
export type LoginValues = { email: string; password: string };

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

function invalid(message: string, path: readonly PropertyKey[] = []): never {
  throw new ValidationError([{ path, message }]);
}

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
