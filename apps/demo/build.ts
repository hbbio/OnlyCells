import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const outdir = join(import.meta.dir, "dist");
const { outputs } = await Bun.build({
  entrypoints: [join(import.meta.dir, "index.html")],
  target: "browser",
  sourcemap: "none",
  minify: true,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});

// Bun's preview route holds an open handle to the output directory across builds.
await mkdir(outdir, { recursive: true });
await Promise.all(
  (await readdir(outdir)).map((name) => rm(join(outdir, name), { recursive: true, force: true })),
);
await Promise.all(outputs.map((output) => Bun.write(join(outdir, output.path), output)));
await cp(join(import.meta.dir, "public"), outdir, { recursive: true });
