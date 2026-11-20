import { readdir } from "node:fs/promises";
import { join } from "node:path";

const output = join(import.meta.dir, "dist");

// Use a package import of the same length so the emitted source maps stay valid.
for (const file of await readdir(output)) {
  if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
  const path = join(output, file);
  const text = await Bun.file(path).text();
  const linked = text.replace(
    /(\b(?:from\s+|import[\s(]+))(["'])@okcontract\/cells\2/g,
    "$1$2#okcontract/cells$2",
  );
  if (linked !== text) await Bun.write(path, linked);
}
