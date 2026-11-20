import {
  configureSecurityPolicy,
  createApi,
  createAuth,
  createLocalCache,
  createResource,
  type SecurityViolation,
} from "@onlycells/core";
import { sheet } from "./cells";
import { PostsSchema } from "./schemas";

const demoCsrfToken = crypto.randomUUID();

function reportSecurityViolation(violation: SecurityViolation): void {
  console.warn(`[onlycells security] ${violation.type}: ${violation.context ?? violation.message}`);
}

const securityPolicy = configureSecurityPolicy({
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

type DemoUser = { email: string; name: string };
const auth = createAuth<DemoUser>({ sheet });
export const session = auth.cell;
export const authHeaders = auth.authHeaders;

export function readDemoCsrfToken(): string {
  return demoCsrfToken;
}

export const httpCachePrefix = "demo:http:";

const publicApi = createApi({
  baseUrl: "https://jsonplaceholder.typicode.com",
  cache: createLocalCache(httpCachePrefix),
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

const postsCacheKey = "posts";
const postsResource = createResource({
  sheet,
  immediate: true,
  load: (_args, { signal }) =>
    publicApi.get("/posts", {
      auth: false,
      signal,
      schema: PostsSchema,
      cache: {
        key: postsCacheKey,
        ttl: 5 * 60 * 1000,
        swr: true,
        tags: ["posts"],
      },
    }),
});

export const posts = postsResource.cell;
export const refreshPosts = postsResource.refresh;

export function bustPostsCache() {
  publicApi.cache.remove(postsCacheKey);
  return refreshPosts();
}
