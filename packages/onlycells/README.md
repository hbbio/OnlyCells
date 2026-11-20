# @onlycells/core

OnlyCells turns TSX into DOM nodes. Cells can update individual text nodes, attributes, and
properties. The package also includes bindings for forms, a router, and helpers for API requests,
caching, and auth.

## TSX setup

Use the automatic JSX transform in your app’s `tsconfig.json`.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "jsxImportSource": "@onlycells/core"
  }
}
```

The strict setup uses `skipLibCheck` for the declarations shipped with Cells 0.4.0. Add
`<div id="app"></div>` to the page for the counter.

```tsx
import { mount } from "@onlycells/core";
import { Sheet } from "@okcontract/cells";

const clicks = new Sheet().new(0);

function Counter() {
  return (
    <button type="button" onClick={() => clicks.update((value) => value + 1)}>
      Clicks: {clicks}
    </button>
  );
}

const unmount = mount("#app", Counter);
```

The examples use Cells 0.4.0. Pass Cells to `bind.attr` and `bind.prop` for direct updates, or
use selectors to read individual fields. Use a `SheetProxy` to group Cells created by a
component and destroy the proxy during cleanup. Auth, resources, and the router expose their
state as `cell`. Pass `sheet` to create it on a shared Sheet, or supply an existing `ValueCell`
with the `cell` option.

## Imports

The package root exports the public API. Use a subpath when you only need a particular module.

```ts
import { mount } from "@onlycells/core/dom";
import { createApi } from "@onlycells/core/api";
import { defineSchema, ValidationError } from "@onlycells/core/schema";
```

The JSX transform uses `@onlycells/core/jsx-runtime` or `@onlycells/core/jsx-dev-runtime`.

## Build from source

The demo imports the core source through TypeScript path aliases. From the repository root, run
`bun install --frozen-lockfile` and `bun run dev` to edit and try both together.

Run `bun pm pack --dry-run` in `packages/onlycells` to check the package. The prepack script builds
the ESM files and declarations in `dist`.

The repository README covers the demo, API examples, and production preview. [OnlyCells README](https://github.com/hbbio/nodiff/blob/main/README.md)
