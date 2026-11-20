export type Cleanup = () => void;

type CleanupEntry = { node: Node; cleanup: Cleanup };

const cleanupMap = new WeakMap<Node, CleanupEntry[]>();
let renderCleanups: CleanupEntry[] | undefined;

export function addCleanup(node: Node, cleanup: void | Cleanup | null | undefined): void {
  if (typeof cleanup !== "function") return;
  const entry = { node, cleanup };
  const existing = cleanupMap.get(node);
  if (existing) {
    existing.push(entry);
  } else {
    cleanupMap.set(node, [entry]);
  }
  renderCleanups?.push(entry);
}

function runCleanup(cleanup: Cleanup): void {
  try {
    cleanup();
  } catch (error) {
    queueMicrotask(() => {
      throw error;
    });
  }
}

/** Runs cleanups registered during a synchronous render if that render throws. */
export function withRenderCleanup<T>(render: () => T): T {
  const outer = renderCleanups;
  const entries = outer ?? [];
  const start = entries.length;
  renderCleanups = entries;

  let complete = false;
  try {
    const result = render();
    complete = true;
    return result;
  } finally {
    renderCleanups = outer;
    if (!complete) {
      for (const entry of entries.splice(start).reverse()) {
        const own = cleanupMap.get(entry.node);
        const index = own?.indexOf(entry) ?? -1;
        if (!own || index === -1) continue;
        own.splice(index, 1);
        if (own.length === 0) cleanupMap.delete(entry.node);
        runCleanup(entry.cleanup);
      }
    }
  }
}

export function cleanupNode(node: Node): void {
  const own = cleanupMap.get(node);
  if (own) {
    cleanupMap.delete(node);
    for (const entry of own.reverse()) runCleanup(entry.cleanup);
  }

  for (const child of Array.from(node.childNodes)) {
    cleanupNode(child);
  }
}

export function removeNode(node: Node): void {
  cleanupNode(node);
  node.parentNode?.removeChild(node);
}

export function replaceChildrenClean(parent: Node, children: Node[]): void {
  for (const child of Array.from(parent.childNodes)) {
    cleanupNode(child);
    parent.removeChild(child);
  }
  for (const child of children) parent.appendChild(child);
}

export function clearBetween(start: Node, end: Node): void {
  let cursor = start.nextSibling;
  while (cursor && cursor !== end) {
    const next = cursor.nextSibling;
    removeNode(cursor);
    cursor = next;
  }
}
