import {
  configureSecurityPolicy,
  cookieSessionRequest,
  createApi,
  createAuth,
  createCellStore,
  createLocalCache,
  createResource,
  derivedStore,
  readCsrfToken,
  safeErrorMessage,
  type SecurityViolation,
} from "@nodiffjs/core";
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

export type PreferencesState = PreferencesData & {
  increment(): void;
  resetCount(): void;
  setSearch(search: string): void;
  setPostPage(page: number): void;
  setTheme(theme: PreferencesData["theme"]): void;
  setStep(step: number): void;
};

const defaultPreferences: PreferencesData = {
  count: 0,
  search: "",
  postPage: 1,
  theme: "system",
  step: 1,
};

const savedPreferences =
  appCache.get("preferences", PreferencesSchema, { allowStale: true })?.value ?? defaultPreferences;

export const preferences = createCellStore<PreferencesState>((set) => ({
  ...savedPreferences,
  increment: () => set((state) => ({ count: state.count + state.step })),
  resetCount: () => set({ count: 0 }),
  setSearch: (search) => set({ search, postPage: 1 }),
  setPostPage: (postPage) => set({ postPage: Math.max(1, Math.trunc(postPage)) }),
  setTheme: (theme) => set({ theme }),
  setStep: (step) => set({ step }),
}));

function preferenceSnapshot(state: PreferencesState): PreferencesData {
  return {
    count: state.count,
    search: state.search,
    postPage: state.postPage,
    theme: state.theme,
    step: state.step,
  };
}

preferences.subscribe((state) => {
  appCache.set("preferences", preferenceSnapshot(state), { tags: ["preferences"] });
  applyTheme(state.theme);
});

function applyTheme(theme: PreferencesData["theme"]): void {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }

  document.documentElement.dataset.theme = theme;
}

applyTheme(preferences.getState().theme);

export const auth = createAuth<{ email: string; name: string }>();

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

export const posts = createResource<Post[]>({
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

export function readPostsVm(): PostsVm {
  const resource = posts.store.getState();
  const prefs = preferences.getState();
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

export const postsVm = derivedStore([posts.store, preferences], readPostsVm);

export const cacheInspector = createCellStore(() => ({ version: 0 }));
export const refreshCacheInspector = () =>
  cacheInspector.setState((state) => ({ version: state.version + 1 }));

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
