# OnlyCells

OnlyCells is a small TypeScript runtime for browser apps that uses only system installs of bun + TypeScript, and [@okcontract/cells](https://github.com/okcontract/cells). TSX creates DOM nodes, and Cells update the text, properties, and regions that depend on them.

In the LLM era, you do not need a fat web framework for every browser app, especially when your project grows. You often want a lean runtime that lives in the same monorepo as your app and evolves with it.

That shape is easier for people and coding agents to integrate, inspect, change, and reason about. Fewer hidden layers means fewer bugs, faster feedback, and less time spent reverse-engineering framework behavior.

Fork the repo to edit the framework and the demo in the same checkout.

## Run it

Put Bun and the system TypeScript compiler (`tsc`) on your `PATH`. This checkout has been tested
with Bun 1.4 and TypeScript 7.

```sh
bun install --frozen-lockfile
bun run dev
```

Open the local URL printed by Bun. The demo points its imports at `packages/onlycells/src` through
TypeScript path aliases, so app and framework edits use the same dev server. [Demo TSX configuration](apps/demo/tsconfig.json)

## A counter in TSX

Add a host such as `<div id="app"></div>` to your HTML. For a new app, set
`jsxImportSource` to `@onlycells/core` and use the automatic JSX transform. [TSX setup](packages/onlycells/README.md#tsx-setup)

```tsx
import { mount } from "@onlycells/core";
import { Sheet } from "@okcontract/cells";

const sheet = new Sheet();
const count = sheet.new(0);

function Counter() {
  return (
    <button type="button" onClick={() => count.update((value) => value + 1)}>
      Count: {count}
    </button>
  );
}

const unmount = mount("#app", Counter);
```

The button keeps the same DOM node as the count changes. The Cell updates one text node, and
`unmount()` removes the listener and the subscription.

## The demo app

| Route    | What to try                                                                 |
| -------- | --------------------------------------------------------------------------- |
| `/`      | Change the count, pick a theme from the select, or click a theme preview.   |
| `/posts` | Search and page through schema-checked posts from JSONPlaceholder.          |
| `/auth`  | Submit the demo login form and inspect the bearer header.                   |
| `/cache` | Inspect and remove localStorage entries for preferences and HTTP responses. |

One `Sheet` holds preferences, session, route, and resource state. The demo’s `component` helper
gives each component a `SheetProxy` for local and derived Cells. It ties the proxy’s lifetime to
the rendered nodes and releases subscriptions if rendering throws. [Component helper](apps/demo/src/cells.ts) · [Demo entry point](apps/demo/src/main.tsx)

## Cell bindings

The lockfile uses Cells 0.4.0. `cell.map(fn)` derives a value from that Cell. With
`proxy.map([cells], fn)`, each dependency is a Cell and the proxy owns the result. Capture fixed
values in the callback.

```ts
const suffix = " posts";
const label = proxy.map([postCount], (count) => count + suffix, "post count label");
```

### Text and props

Pass a Cell holding a string or number as a child or through a component’s `Child` prop. It updates
the same text node. Unmounting, redrawing a region, or calling `removeNode` releases the
subscription. Use `text(preferences, (state) => state.count)` to select or format a value at the
call site.

Use `bind.prop("value", selectedTheme)` to keep a select in sync with a Cell. `bind.attr(name, cell)`
works the same way for attributes. Both also accept a selector, and `bind.props` updates several
properties, classes, or attributes together. Bindings read from initialized Cells. Two-way
bindings write to a `ValueCell`. [Binding signatures](packages/onlycells/src/store.ts)

### Form controls and actions

An action in the `use` prop receives the element after its children are appended. It can return a
cleanup function for a listener, subscription, or observer. This is also how `bind.value` connects
an input to a field.

```tsx
import { bind } from "@onlycells/core";
import { Sheet } from "@okcontract/cells";

const preferences = new Sheet().new({ search: "", page: 1 });

const searchInput = (
  <input
    type="search"
    aria-label="Search"
    use={bind.value(
      preferences,
      (state) => state.search,
      (search) => ({ search, page: 1 }),
    )}
  />
);
```

Two-way bindings merge plain record patches and replace other values, including arrays. The
`bind` object also covers numbers, checked inputs, radio groups, selects, and files. Use `effect`
when an element should own a side effect, and `removeNode` when removing a node with OnlyCells
subscriptions yourself. [Lifecycle helpers](packages/onlycells/src/lifecycle.ts)

### Conditional content and lists

`view(source, selector, render)` redraws the region between two comment markers when the selected
value changes. `Show` and `when` handle conditional content, and `For` handles keyed rows.

```tsx
<For
  store={postsVm}
  each={(state) => state.visible}
  by={(post) => post.id}
  fallback={<p>No posts match this filter.</p>}
>
  {(post) => <article>{post.title}</article>}
</For>
```

Give each item a unique key. `For` moves a row in place when its key and item identity stay the
same. A new item for the same key replaces the row and cleans up its bindings. [Posts page](apps/demo/src/pages/PostsPage.tsx)

### Saved preferences

Give a Cell an `_storageKey` to save and restore its value as JSON in localStorage.

```ts
const theme = sheet.new("system", undefined, "theme", { _storageKey: "app:theme" });
```

The demo gives count, step, and theme their own stored Cells. Search and page share a Cell so a
new search can reset the page in one update. [Demo preferences](apps/demo/src/preferences.ts)

## API and cache

`createApi` wraps `fetch`. Pass a schema to parse the response before using it. `defineSchema`
takes a synchronous parser that returns typed data or throws a `ValidationError` with field paths
and messages.

This example uses the demo’s `PostsSchema`. [Demo schemas](apps/demo/src/schemas.ts)

```ts
import { createApi, createLocalCache } from "@onlycells/core";
import { PostsSchema } from "./schemas";

const cache = createLocalCache("demo:http:");
const api = createApi({ baseUrl: "https://jsonplaceholder.typicode.com", cache });

const posts = await api.get("/posts", {
  schema: PostsSchema,
  cache: { key: "posts", ttl: 300_000, swr: true, tags: ["posts"] },
});
```

Cached GET responses carry a timestamp, optional expiry, and tags. TTL is in milliseconds. When
you pass a schema, cache hits are validated again on read. With `swr: true`, an expired hit returns
immediately and starts a background fetch. A successful fetch updates the cache for later reads. Use
`cache.get(key, schema, { allowStale: true })` to inspect an expired entry and `cache.clearTag(tag)`
to remove a group of entries.

The client also supports query parameters, request headers, abort signals, and timeouts.
`api.get`, `post`, `put`, `patch`, and `delete` delegate to `api.request`. Failed HTTP responses
throw `ApiError` after any configured auth retry. [API and request options](packages/onlycells/src/api.ts) · [Cache methods](packages/onlycells/src/cache.ts)

## Resources

A resource tracks the data, error, and loading state of an async function. Give the loader’s
`signal` to the request so it can be aborted.

```tsx
const feed = createResource({
  immediate: true,
  load: (_args, { signal }) =>
    api.get("/posts", {
      signal,
      schema: PostsSchema,
      cache: { key: "posts", ttl: 300_000, tags: ["posts"] },
    }),
});

const feedRegion = (
  <ResourceView
    resource={feed.cell}
    pending={<p>Loading posts…</p>}
    error={<p role="alert">Could not load posts.</p>}
  >
    {(posts) => <p>{posts.length} posts</p>}
  </ResourceView>
);
```

`ResourceView` keeps showing available data during a refresh. It uses the pending, error, and empty
slots when data is unavailable. Call `refresh()` to reuse the most recent `load()` arguments or
`initialArgs` before the first load. With neither available, `refresh()` resolves to `undefined`.
Supply `initialArgs` when an immediate loader requires arguments. [Resource options](packages/onlycells/src/resource.ts) · [Demo resource](apps/demo/src/state.ts)

## Auth

`createAuth` holds the app’s token and user in memory. After your login flow succeeds, call
`auth.setToken(token, user)`. The API client can read bearer headers from the controller and call
`auth.logout()` when a request ends in a 401.

```ts
const auth = createAuth<{ email: string }>();
const sessionApi = createApi({
  baseUrl: "/api",
  getAuthHeaders: auth.authHeaders,
  onUnauthorized: () => auth.logout(),
});

auth.setToken(token, user);
const profile = await sessionApi.get("/me", { auth: "required", schema: ProfileSchema });
```

`auth: "required"` checks for an Authorization header before sending the request. The client adds
managed auth headers on its configured origin. Token persistence is opt-in with `persist: true`
and an optional `storageKey`. Saving refresh tokens takes the separate
`allowRefreshTokenPersistence` option.

Pass `{ sheet }` to auth, resources, or the router to create their state on your shared Sheet.
Use the returned `cell` in bindings or maps, such as `proxy.map([auth.cell], ({ user }) => user)`.
The `cell` option lets you supply an existing `ValueCell`. [Auth controller](packages/onlycells/src/auth.ts) · [Demo state](apps/demo/src/state.ts)

## Router

Define routes with static segments, params like `/posts/:id`, or a wildcard such as `/docs/*`.
Route components receive params, query values, and the router. Call `router.start()` as an action
to tie the navigation listeners to a mounted element.

```tsx
import { createRouter, mount } from "@onlycells/core";

const router = createRouter(
  [
    { path: "/", title: "Home", component: () => <h1>Home</h1> },
    {
      path: "/posts/:id",
      component: ({ params }) => <h1>Post {params.id}</h1>,
    },
  ],
  { mode: "hash" },
);

mount("#app", () => (
  <main use={router.start}>
    <nav>
      <router.Link to="/" exact activeClass="active">
        Home
      </router.Link>
      <router.Link to="/posts/1">Post 1</router.Link>
    </nav>
    {router.outlet()}
  </main>
));
```

Use `router.navigate(to, { replace: true })` for programmatic navigation. If you choose history
mode, configure the server to return `index.html` for app routes. [Router options](packages/onlycells/src/router.ts) · [Demo routes](apps/demo/src/app.tsx)

## Forms

`validatedSubmit` reads the form, checks it against the schema, and calls the handler with typed
values. Validation issues whose paths match input names show up through native form validity.
Parse numbers in the schema, since ordinary input values arrive as strings.

```tsx
<form use={validatedSubmit(LoginSchema, login)}>
  <label>
    Email
    <input name="email" type="email" autocomplete="email" />
  </label>
  <label>
    Password
    <input name="password" type="password" autocomplete="current-password" />
  </label>
  <button type="submit">Sign in</button>
</form>
```

Set `resetOnSuccess` to clear the form after the handler finishes. The action also accepts a
`csrf` option for forms that send a token. [Form options](packages/onlycells/src/forms.ts) · [Demo login](apps/demo/src/pages/AuthPage.tsx)

## Security defaults

- Text children become text nodes, including values delivered by Cells. Explicit HTML goes
  through `unsafeHTML` with `sanitizeHTML(...)` or caller-reviewed `trustedHTML(...)`.
- JSX and bindings share checks for raw HTML, URLs, styles, and inline event attributes.
  `DOM_SINK_POLICY` lists the blocked tags and the names those checks cover.
  [DOM rules](packages/onlycells/src/dom.ts)
- The default policy is permissive about origins and checks URL schemes. Use
  `configureSecurityPolicy` for strict origin checks, HTTPS requirements on API requests, cache
  rules, CSRF, and violation reporting. Strict API clients need a `baseUrl` and a response schema
  for cached requests. [Security policy](packages/onlycells/src/security.ts)
- `catchRender({ render: App })` catches errors while the callback runs. It and the router show
  redacted errors by default, with hooks for reporting and a custom fallback.

The demo opts into strict mode. It configures a public client for JSONPlaceholder reads and a
separate first-party client as an auth example. The build copies a `_headers` file for static
hosts that support it. Use `securityHeaders({ policy })` to generate a header map for a server
you control. [Demo policy](apps/demo/src/state.ts) · [Deployment headers](apps/demo/public/_headers)

## Build and preview

```sh
bun run check
bun run build
bun run --cwd apps/demo preview
```

`bun run check` typechecks both workspaces, checks formatting, and runs tests.
`bun run security:check` also runs the dependency audit and production build.

GitHub Actions runs `bun run check` and `bun run build` on pull requests and pushes to `main`.
[CI workflow](.github/workflows/ci.yml)

The build emits the core package into `packages/onlycells/dist` and the demo into `apps/demo/dist`.
Preview serves the demo on `http://127.0.0.1:4173` by default. Refresh the page after a rebuild to
load the latest assets. The repo targets ES2022 and the demo uses native CSS features such as
`light-dark()`. [TypeScript settings](tsconfig.base.json)

## Publishing notes

The core workspace is named `@onlycells/core`. It ships ESM, type declarations, source, and the
JSX runtime entries. TypeScript rewrites the internal `.ts` imports to `.js` in the build. From
`packages/onlycells`, run `bun pm pack --dry-run` to see what would ship. [Package README](packages/onlycells/README.md)
