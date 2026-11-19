# @nodiffjs/core

NoDiff is a small TypeScript package for rich-client apps that use TSX as browser syntax. It creates real DOM nodes, keeps updates explicit through Cells-backed stores, and includes helpers for schema-checked API data, localStorage caching, token auth, forms, routing, and security defaults.

This package is designed for a fork-first monorepo workflow. In this repository, the demo app aliases `@nodiffjs/core` directly to `packages/nodiff/src`, so Bun picks up framework and app edits together. The package build emits a `dist` artifact for consumers, fixtures, and optional publishing.

## TSX Setup

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@nodiffjs/core"
  }
}
```

```tsx
import { catchRender, createCellStore, mount, text } from "@nodiffjs/core";

const counter = createCellStore(() => ({ count: 0 }));

function App() {
  return (
    <button onClick={() => counter.setState((state) => ({ count: state.count + 1 }))}>
      Count: {text(counter, (state) => state.count)}
    </button>
  );
}

mount("#app", catchRender({ render: App }));
```

## Package Entries

The root entry exports the public surface:

```ts
import { createApi, createRouter, mount, view } from "@nodiffjs/core";
```

Focused subpath entries are also available:

```ts
import { mount } from "@nodiffjs/core/dom";
import { createApi } from "@nodiffjs/core/api";
import { defineSchema, ValidationError } from "@nodiffjs/core/schema";
```

Automatic JSX runtime entries are exported at `@nodiffjs/core/jsx-runtime` and `@nodiffjs/core/jsx-dev-runtime`.

## Local Development

With Bun 1.4.4 or later and TypeScript 7 on your `PATH`, run these commands from the repository root.

```sh
bun install --frozen-lockfile
bun run dev
```

The demo consumes source through the path aliases in `apps/demo/tsconfig.json`. Edit
`packages/nodiff/src` and `apps/demo/src` together while the Bun dev server is running.

From `packages/nodiff`, verify the package contents with Bun. The pack command builds the package.

```sh
bun pm pack --dry-run
```
