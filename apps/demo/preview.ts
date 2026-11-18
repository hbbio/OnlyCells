import { join } from "node:path";

const dist = join(import.meta.dir, "dist");

async function serveIndex() {
  // Bun's file validators can match different builds written within the same second.
  try {
    const index = Bun.file(join(dist, "index.html"));
    return new Response(await index.text(), {
      headers: { "Content-Type": index.type, "Cache-Control": "no-store" },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response(null, { status: 404 });
    }
    throw error;
  }
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(Bun.env.PORT ?? 4173),
  routes: { "/": serveIndex, "/index.html": serveIndex, "/*": { dir: dist } },
});
console.log(`Preview available at ${server.url}`);
