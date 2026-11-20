// The Bun and Node APIs used by the repository's build and preview scripts.
interface ImportMeta {
  readonly dir: string;
}

declare module "node:fs/promises" {
  export function cp(from: string, to: string, options?: { recursive?: boolean }): Promise<void>;
  export function mkdir(path: string, options: { recursive: true }): Promise<string | undefined>;
  export function readdir(path: string): Promise<string[]>;
  export function rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
}

declare module "node:path" {
  export function join(...parts: string[]): string;
}

declare const Bun: {
  readonly env: Record<string, string | undefined>;
  build(options: {
    entrypoints: string[];
    target: "browser";
    format?: "esm";
    sourcemap?: "none";
    minify?: boolean;
    define?: Record<string, string>;
    outdir?: string;
    naming?: string;
    tsconfig?: string;
  }): Promise<{ outputs: (Blob & { readonly path: string })[] }>;
  file(path: string): Blob;
  write(path: string, data: string | Blob): Promise<number>;
  serve(options: {
    hostname: string;
    port: number;
    routes: Record<string, (() => Response | Promise<Response>) | { dir: string }>;
  }): { readonly url: URL };
};
