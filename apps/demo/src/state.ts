import {
  type AuthState,
  configureSecurityPolicy,
  cookieSessionRequest,
  createApi,
  createAuth,
  createLocalCache,
  createResource,
  readCsrfToken,
  type ResourceState,
  safeErrorMessage,
  type SecurityViolation,
} from "@nodiffjs/core";
import { controllerCell, sheet } from "./cells";
import {
  type LoginValues,
  type Post,
  PostsSchema,
  type PreferencesData,
  PreferencesSchema,
} from "./schemas";

const demoCsrfToken = crypto.randomUUID();

function reportSecurityViolation(violation: SecurityViolation): void {
  console.warn(`[nodiff security] ${violation.type}: ${violation.context ?? violation.message}`);
}

export const securityPolicy = configureSecurityPolicy({
  mode: "strict",
  allowedOrigins: ["self", "https://jsonplaceholder.typicode.com"],
  allowedUrlSchemes: ["http:", "https:"],
  enforceHttps: true,
  cache: {
    requireSchema: true,
    maxTtl: 5 * 60 * 1000,
  },
  csrf: "double-submit-cookie",
  onViolation: reportSecurityViolation,
});

export const appCache = createLocalCache("demo:");
export const apiCache = createLocalCache("demo:http:");

const defaultPreferences: PreferencesData = {
  count: 0,
  search: "",
  postPage: 1,
  theme: "system",
  step: 1,
};

const savedPreferences =
  appCache.get("preferences", PreferencesSchema, { allowStale: true })?.value ?? defaultPreferences;

export const preferences = sheet.new(savedPreferences, undefined, "preferences");

preferences.subscribe((state) => {
  if (state !== savedPreferences) appCache.set("preferences", state, { tags: ["preferences"] });
  applyTheme(state.theme);
});

function applyTheme(theme: PreferencesData["theme"]): void {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }

  document.documentElement.dataset.theme = theme;
}

type DemoUser = { email: string; name: string };
export const session = controllerCell<AuthState<DemoUser>>("session");
export const auth = createAuth<DemoUser>({ cell: session });

export function readDemoCsrfToken(): string | null {
  return readCsrfToken({ token: demoCsrfToken });
}

export const publicApi = createApi({
  baseUrl: "https://jsonplaceholder.typicode.com",
  cache: apiCache,
  security: securityPolicy,
});

export const sessionApi = createApi({
  baseUrl: "/api",
  security: securityPolicy,
  getAuthHeaders: auth.authHeaders,
  csrf: {
    getToken: readDemoCsrfToken,
    required: "state-changing",
  },
  onUnauthorized: () => auth.logout(),
});

export const demoCookieSessionRequest = cookieSessionRequest();

export const postsState = controllerCell<ResourceState<Post[]>>("posts");
export const posts = createResource<Post[]>({
  cell: postsState,
  immediate: true,
  load: (_args, { signal }) =>
    publicApi.get("/posts", {
      auth: false,
      signal,
      schema: PostsSchema,
      cache: {
        key: "posts",
        ttl: 5 * 60 * 1000,
        swr: true,
        tags: ["posts"],
      },
    }),
});

export type PostsVm = {
  status: string;
  loading: boolean;
  stale: boolean;
  updatedAt: number | null;
  error: string | null;
  total: number;
  filtered: number;
  search: string;
  page: number;
  pageSize: number;
  pageCount: number;
  pageStart: number;
  pageEnd: number;
  visible: Post[];
};

export function readPostsVm(resource: ResourceState<Post[]>, prefs: PreferencesData): PostsVm {
  const search = prefs.search.trim().toLowerCase();
  const all = resource.data ?? [];
  const filtered = search
    ? all.filter((post) => `${post.title} ${post.body}`.toLowerCase().includes(search))
    : all;
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(prefs.postPage, pageCount);
  const pageStart = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, filtered.length);
  const visible = filtered.slice(pageStart === 0 ? 0 : pageStart - 1, pageEnd);

  return {
    status: resource.status,
    loading: resource.loading,
    stale: resource.stale,
    updatedAt: resource.updatedAt,
    error: resource.error ? safeErrorMessage(resource.error) : null,
    total: all.length,
    filtered: filtered.length,
    search,
    page,
    pageSize,
    pageCount,
    pageStart,
    pageEnd,
    visible,
  };
}

export async function fakeLogin(values: LoginValues): Promise<void> {
  const name = values.email.split("@")[0] || "demo-user";
  auth.setToken(
    {
      accessToken: btoa(`${values.email}:${Date.now()}`),
      expiresAt: Date.now() + 60 * 60 * 1000,
    },
    { email: values.email, name },
  );
}
