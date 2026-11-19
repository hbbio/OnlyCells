import { sheet } from "./cells";

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

export type Theme = (typeof themeOptions)[number];
export type PostFilters = {
  search: string;
  postPage: number;
};

export const count = sheet.new(0, undefined, "count", { _storageKey: "demo:count" });
export const step = sheet.new(1, undefined, "step", { _storageKey: "demo:step" });
export const theme = sheet.new<Theme>("system", undefined, "theme", { _storageKey: "demo:theme" });
export const postFilters = sheet.new<PostFilters>(
  { search: "", postPage: 1 },
  undefined,
  "post-filters",
  {
    _storageKey: "demo:post-filters",
  },
);
