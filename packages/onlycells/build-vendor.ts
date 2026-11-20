import { cp, readdir } from "node:fs/promises";
import { join } from "node:path";

const output = join(import.meta.dir, "dist", "vendor");

await Bun.build({
  entrypoints: [join(import.meta.dir, "..", "cells", "src", "index.ts")],
  outdir: output,
  naming: "cells.js",
  target: "browser",
  format: "esm",
  tsconfig: join(import.meta.dir, "tsconfig.vendor.json"),
});

for (const name of ["cells", "graph"]) {
  const directory = join(output, name, "src");
  for (const file of await readdir(directory)) {
    if (!file.endsWith(".d.ts")) continue;
    const path = join(directory, file);
    const text = await Bun.file(path).text();
    // The vendored declarations travel with the package and resolve by relative paths.
    const linked = text
      .replaceAll('"@okcontract/graph"', '"../../graph/src/index.js"')
      .replace(/(\bfrom\s+"|import\(")(\.\/[\w-]+)"/g, '$1$2.js"');
    if (linked !== text) await Bun.write(path, linked);
  }
  await cp(join(import.meta.dir, "..", name, "LICENSE"), join(output, name + ".LICENSE"));
}
