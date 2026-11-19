import { addCleanup, type Child, fragment, withRenderCleanup } from "@nodiffjs/core";
import { Sheet, SheetProxy } from "@okcontract/cells";

export const sheet = new Sheet(Object.is);

let collectionScheduled = false;

function destroy(proxy: SheetProxy): void {
  proxy.destroy();
  if (collectionScheduled) return;
  collectionScheduled = true;
  // Cells 0.4 collects marked cells after a graph update. An unmount may be the last operation.
  queueMicrotask(() => {
    collectionScheduled = false;
    sheet.collection();
  });
}

export function component<P extends object = object>(
  name: string,
  render: (proxy: SheetProxy, props: P) => Child,
) {
  return (props: P): Child =>
    withRenderCleanup(() => {
      const end = document.createComment(`${name}:cells`);
      const proxy = new SheetProxy(sheet, name);
      addCleanup(end, () => destroy(proxy));
      const output = fragment(render(proxy, props));
      // Child subscriptions and proxies are disposed before the cells they depend on.
      output.append(end);
      return output;
    });
}
