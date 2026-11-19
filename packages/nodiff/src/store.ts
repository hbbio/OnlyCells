import { type AnyCell, isObject, type ValueCell } from "@okcontract/cells";
import { addCleanup, clearBetween, removeNode } from "./lifecycle.ts";
import {
  assertSafeCssValue,
  setDomAttribute,
  setDomProperty,
  type Action,
  type Child,
  toNodes,
} from "./dom.ts";
import type { ResourceState } from "./resource.ts";
import { readCell } from "./state.ts";

export type Equality<T> = (a: T, b: T) => boolean;
export type Selector<TState, TValue> = (state: TState) => TValue;
export type StyleBinding = string | Record<string, string | number | null | undefined>;
export type ClassBinding = string | readonly string[] | Record<string, boolean | null | undefined>;
export type AttributeBinding = Record<string, unknown>;
export type NamedValueBinding = Record<string, string | number | boolean | null | undefined>;
export type PropsBinding = AttributeBinding & {
  class?: ClassBinding | false | null | undefined;
  className?: ClassBinding | false | null | undefined;
  style?: StyleBinding | null | undefined;
  dataset?: NamedValueBinding | null | undefined;
  aria?: NamedValueBinding | null | undefined;
  attributes?: AttributeBinding | null | undefined;
  textContent?: string | number | boolean | null | undefined;
};

export function subscribeSelector<TState, TValue>(
  cell: AnyCell<TState, boolean, boolean>,
  selector: Selector<TState, TValue>,
  listener: (value: TValue, previousValue: TValue, state: TState, previousState: TState) => void,
  equality: Equality<TValue> = Object.is,
): () => void {
  let previousState = readCell(cell);
  let current = selector(previousState);
  // Cells replay their current value when the subscription starts.
  let subscribing = true;
  const unsubscribe = cell.subscribe((state) => {
    if (state instanceof Error || (subscribing && Object.is(previousState, state))) return;
    const oldState = previousState;
    previousState = state;
    const next = selector(state);
    if (equality(current, next)) return;
    const previous = current;
    current = next;
    listener(next, previous, state, oldState);
  });
  subscribing = false;
  return unsubscribe;
}

function writeCell<T>(cell: ValueCell<T>, patch: Partial<T> | T): void {
  const current = readCell(cell);
  cell.set(isObject(current) && isObject(patch) ? { ...current, ...patch } : (patch as T));
}

export function effect<TState, TValue>(
  cell: AnyCell<TState, boolean, boolean>,
  selector: Selector<TState, TValue>,
  run: (value: TValue, previousValue: TValue | undefined, state: TState) => void,
  equality?: Equality<TValue>,
): Action {
  return () => {
    const initial = selector(readCell(cell));
    run(initial, undefined, readCell(cell));

    return subscribeSelector(
      cell,
      selector,
      (value, previous, state) => run(value, previous, state),
      equality,
    );
  };
}

export function text<TState, TValue>(
  cell: AnyCell<TState, boolean, boolean>,
  selector: Selector<TState, TValue>,
  format: (value: TValue) => string = (value) =>
    value === null || value === undefined ? "" : String(value),
  equality?: Equality<TValue>,
): Text {
  const node = document.createTextNode(format(selector(readCell(cell))));
  const unsubscribe = subscribeSelector(
    cell,
    selector,
    (value) => {
      node.data = format(value);
    },
    equality,
  );
  addCleanup(node, unsubscribe);
  return node;
}

export function view<TState, TValue>(
  cell: AnyCell<TState, boolean, boolean>,
  selector: Selector<TState, TValue>,
  render: (value: TValue, state: TState) => Child,
  options: { equality?: Equality<TValue> } = {},
): DocumentFragment {
  const start = document.createComment("view:start");
  const end = document.createComment("view:end");
  const frag = document.createDocumentFragment();
  frag.append(start, end);

  const draw = (value: TValue, state: TState) => {
    if (!end.parentNode) return;
    clearBetween(start, end);
    for (const node of toNodes(render(value, state))) {
      end.parentNode.insertBefore(node, end);
    }
  };

  draw(selector(readCell(cell)), readCell(cell));

  const unsubscribe = subscribeSelector(
    cell,
    selector,
    (value, _oldValue, state) => draw(value, state),
    options.equality,
  );

  addCleanup(start, () => {
    unsubscribe();
    clearBetween(start, end);
  });

  return frag;
}

export function when<TState>(
  cell: AnyCell<TState, boolean, boolean>,
  predicate: Selector<TState, boolean>,
  yes: (state: TState) => Child,
  no?: (state: TState) => Child,
): DocumentFragment {
  return view(cell, predicate, (enabled, state) => (enabled ? yes(state) : (no?.(state) ?? null)));
}

export type ShowProps<TState, TValue> = {
  store: AnyCell<TState, boolean, boolean>;
  when: Selector<TState, TValue>;
  children: Child | ((value: NonNullable<TValue>, state: TState) => Child);
  fallback?: Child | ((state: TState, value: TValue) => Child);
  equality?: Equality<TValue>;
};

function renderShowChild<TState, TValue>(
  child: ShowProps<TState, TValue>["children"],
  value: NonNullable<TValue>,
  state: TState,
): Child {
  return typeof child === "function" ? child(value, state) : child;
}

function renderShowFallback<TState, TValue>(
  fallback: ShowProps<TState, TValue>["fallback"],
  state: TState,
  value: TValue,
): Child {
  if (fallback === undefined) return null;
  return typeof fallback === "function" ? fallback(state, value) : fallback;
}

export function Show<TState, TValue>(props: ShowProps<TState, TValue>): DocumentFragment {
  const options = props.equality ? { equality: props.equality } : {};
  return view(
    props.store,
    props.when,
    (value, state) =>
      value
        ? renderShowChild(props.children, value as NonNullable<TValue>, state)
        : renderShowFallback(props.fallback, state, value),
    options,
  );
}

export type ResourceViewProps<T> = {
  resource: AnyCell<ResourceState<T>, boolean, boolean>;
  children: (data: T, state: ResourceState<T>) => Child;
  pending?: Child | ((state: ResourceState<T>) => Child);
  error?: Child | ((error: Error, state: ResourceState<T>) => Child);
  empty?: Child | ((state: ResourceState<T>) => Child);
  equality?: Equality<ResourceState<T>>;
};

function renderResourceSlot<T>(
  slot: Child | ((state: ResourceState<T>) => Child) | undefined,
  state: ResourceState<T>,
): Child {
  if (slot === undefined) return null;
  return typeof slot === "function" ? slot(state) : slot;
}

function renderResourceError<T>(
  slot: Child | ((error: Error, state: ResourceState<T>) => Child) | undefined,
  error: Error,
  state: ResourceState<T>,
): Child {
  if (slot === undefined) return null;
  return typeof slot === "function" ? slot(error, state) : slot;
}

export function ResourceView<T>(props: ResourceViewProps<T>): DocumentFragment {
  return view(
    props.resource,
    (state) => state,
    (state) => {
      if (state.data !== null) return props.children(state.data, state);
      if (state.error) return renderResourceError(props.error, state.error, state);
      if (state.loading || state.status === "loading")
        return renderResourceSlot(props.pending, state);
      return renderResourceSlot(props.empty ?? props.pending, state);
    },
    props.equality ? { equality: props.equality } : {},
  );
}

export function Await<T>(props: ResourceViewProps<T>): DocumentFragment {
  return ResourceView(props);
}

export function list<TState, TItem>(
  cell: AnyCell<TState, boolean, boolean>,
  selector: Selector<TState, readonly TItem[]>,
  render: (item: TItem, index: number, items: readonly TItem[]) => Child,
  options: { equality?: Equality<readonly TItem[]> } = {},
): DocumentFragment {
  return view(
    cell,
    selector,
    (items) => items.map((item, index) => render(item, index, items)),
    options,
  );
}

export type ForProps<TState, TItem, TKey = unknown> = {
  store: AnyCell<TState, boolean, boolean>;
  each: Selector<TState, readonly TItem[]>;
  by: (item: TItem, index: number, items: readonly TItem[]) => TKey;
  children: (item: TItem, index: number, items: readonly TItem[]) => Child;
  fallback?: Child | ((state: TState) => Child);
  equality?: Equality<readonly TItem[]>;
};

type ForRow<TItem> = {
  item: TItem;
  nodes: Node[];
};

function concreteNodes(value: Child): Node[] {
  return toNodes(value).flatMap((node) => {
    if (typeof DocumentFragment !== "undefined" && node instanceof DocumentFragment) {
      return Array.from(node.childNodes);
    }
    return [node];
  });
}

function removeNodes(nodes: Node[]): void {
  for (const node of nodes) removeNode(node);
}

function keyLabel(key: unknown): string {
  if (typeof key === "symbol") return key.toString();
  try {
    return JSON.stringify(key) ?? String(key);
  } catch {
    return String(key);
  }
}

export function For<TState, TItem, TKey = unknown>(
  props: ForProps<TState, TItem, TKey>,
): DocumentFragment {
  const start = document.createComment("for:start");
  const end = document.createComment("for:end");
  const frag = document.createDocumentFragment();
  frag.append(start, end);

  let rows = new Map<TKey, ForRow<TItem>>();
  let fallbackNodes: Node[] = [];

  const clearFallback = () => {
    removeNodes(fallbackNodes);
    fallbackNodes = [];
  };

  const renderFallback = (state: TState): Node[] => {
    const fallback = props.fallback;
    if (fallback === undefined) return [];
    return concreteNodes(typeof fallback === "function" ? fallback(state) : fallback);
  };

  const renderRow = (item: TItem, index: number, items: readonly TItem[]): Node[] =>
    concreteNodes(props.children(item, index, items));

  const draw = (items: readonly TItem[], state: TState) => {
    if (!end.parentNode) return;
    const parent = end.parentNode;
    const records = items.map((item, index) => ({
      item,
      index,
      key: props.by(item, index, items),
    }));
    const nextKeys = new Set<TKey>();

    for (const record of records) {
      if (nextKeys.has(record.key)) {
        throw new Error(`Duplicate key in For: ${keyLabel(record.key)}`);
      }
      nextKeys.add(record.key);
    }

    if (records.length === 0) {
      for (const row of rows.values()) removeNodes(row.nodes);
      rows = new Map();
      clearFallback();
      fallbackNodes = renderFallback(state);
      for (const node of fallbackNodes) parent.insertBefore(node, end);
      return;
    }

    clearFallback();

    for (const [key, row] of rows) {
      if (!nextKeys.has(key)) removeNodes(row.nodes);
    }

    const nextRows = new Map<TKey, ForRow<TItem>>();
    for (const record of records) {
      let row = rows.get(record.key);

      if (!row) {
        row = {
          item: record.item,
          nodes: renderRow(record.item, record.index, items),
        };
      } else if (!Object.is(row.item, record.item)) {
        removeNodes(row.nodes);
        row = {
          item: record.item,
          nodes: renderRow(record.item, record.index, items),
        };
      }

      for (const node of row.nodes) parent.insertBefore(node, end);
      nextRows.set(record.key, row);
    }

    rows = nextRows;
  };

  draw(props.each(readCell(props.store)), readCell(props.store));

  const unsubscribe = subscribeSelector(
    props.store,
    props.each,
    (items, _oldItems, state) => draw(items, state),
    props.equality,
  );

  addCleanup(start, () => {
    unsubscribe();
    for (const row of rows.values()) removeNodes(row.nodes);
    rows = new Map();
    clearFallback();
  });

  return frag;
}

function cssName(name: string): string {
  return name.includes("-") ? name : name.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function classSet(value: ClassBinding): Set<string> {
  if (typeof value === "string") return new Set(value.split(/\s+/).filter(Boolean));
  if (Array.isArray(value)) return new Set(value.filter(Boolean));
  return new Set(
    Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([name]) => name),
  );
}

function setDatasetValue(
  element: HTMLElement,
  name: string,
  value: string | number | boolean | null | undefined,
): void {
  if (name.includes("-")) {
    setDomAttribute(element, `data-${name}`, value === true ? "true" : value);
    return;
  }
  if (value === null || value === undefined || value === false) {
    delete element.dataset[name];
  } else {
    element.dataset[name] = String(value);
  }
}

function setAriaValue(
  element: Element,
  name: string,
  value: string | number | boolean | null | undefined,
): void {
  const attr = name.startsWith("aria-") ? name : `aria-${name}`;
  setDomAttribute(element, attr, value === true ? "true" : value);
}

function applyClassBinding(
  element: Element,
  previous: Set<string>,
  value: PropsBinding["class"],
): Set<string> {
  const next =
    value === false || value === null || value === undefined ? new Set<string>() : classSet(value);
  for (const name of previous) {
    if (!next.has(name)) element.classList.remove(name);
  }
  for (const name of next) element.classList.add(name);
  return next;
}

function createStyleBinding(
  element: HTMLElement | SVGElement,
): (value: StyleBinding | null | undefined) => void {
  let previous = new Set<string>();
  let previousWasString = false;

  return (value) => {
    if (value === null || value === undefined) {
      if (previousWasString) element.style.cssText = "";
      else for (const name of previous) element.style.removeProperty(name);
      previous = new Set();
      previousWasString = false;
      return;
    }

    if (typeof value === "string") {
      assertSafeCssValue(value);
      element.style.cssText = value;
      previous = new Set();
      previousWasString = true;
      return;
    }

    if (previousWasString) {
      element.style.cssText = "";
      previousWasString = false;
    }

    const next = new Set<string>();
    for (const [rawName, rawValue] of Object.entries(value)) {
      const name = cssName(rawName);
      next.add(name);
      if (rawValue === null || rawValue === undefined) {
        element.style.removeProperty(name);
      } else {
        const nextValue = typeof rawValue === "number" ? String(rawValue) : rawValue;
        assertSafeCssValue(nextValue, name);
        element.style.setProperty(name, nextValue);
      }
    }
    for (const name of previous) {
      if (!next.has(name)) element.style.removeProperty(name);
    }
    previous = next;
  };
}

function recordEntries(value: Record<string, unknown> | null | undefined): [string, unknown][] {
  return value && typeof value === "object" ? Object.entries(value) : [];
}

function syncNamedValues<TValue>(
  previous: Set<string>,
  value: Record<string, TValue> | null | undefined,
  set: (name: string, value: TValue | null) => void,
): Set<string> {
  const next = new Set<string>();
  for (const [name, item] of recordEntries(value as Record<string, unknown> | null | undefined)) {
    next.add(name);
    set(name, item as TValue);
  }
  for (const name of previous) {
    if (!next.has(name)) set(name, null);
  }
  return next;
}

function createPropsBinding(element: Element): (value: PropsBinding) => void {
  let previousClasses = new Set<string>();
  let previousDataset = new Set<string>();
  let previousAria = new Set<string>();
  let previousAttributes = new Set<string>();
  let previousProperties = new Set<string>();
  const syncStyle = createStyleBinding(element as HTMLElement | SVGElement);

  return (value) => {
    previousClasses = applyClassBinding(
      element,
      previousClasses,
      value.className === undefined ? value.class : value.className,
    );
    syncStyle(value.style);

    previousDataset = syncNamedValues(previousDataset, value.dataset, (name, item) =>
      setDatasetValue(element as HTMLElement, name, item),
    );
    previousAria = syncNamedValues(previousAria, value.aria, (name, item) =>
      setAriaValue(element, name, item),
    );
    previousAttributes = syncNamedValues(previousAttributes, value.attributes, (name, item) =>
      setDomAttribute(element, name, item),
    );

    const seenProperties = new Set<string>();
    for (const [name, item] of Object.entries(value)) {
      if (
        name === "aria" ||
        name === "attributes" ||
        name === "class" ||
        name === "className" ||
        name === "dataset" ||
        name === "style"
      ) {
        continue;
      }

      seenProperties.add(name);
      if (name === "textContent") {
        const text = item as PropsBinding["textContent"];
        element.textContent =
          text === null || text === undefined || text === false ? "" : String(text);
      } else {
        setDomProperty(element, name, item);
      }
    }

    for (const name of previousProperties) {
      if (seenProperties.has(name)) continue;
      if (name === "textContent") element.textContent = "";
      else setDomProperty(element, name, undefined);
    }
    previousProperties = seenProperties;
  };
}

function bindDomValue(write: (element: Element, name: string, value: unknown) => void) {
  function binding<TState>(name: string, cell: AnyCell<TState, boolean, boolean>): Action;
  function binding<TState, TValue, TElement extends Element = Element>(
    name: string,
    cell: AnyCell<TState, boolean, boolean>,
    selector: Selector<TState, TValue>,
    equality?: Equality<TValue>,
  ): Action<TElement>;
  function binding<TState, TValue, TElement extends Element>(
    name: string,
    cell: AnyCell<TState, boolean, boolean>,
    selector?: Selector<TState, TValue>,
    equality?: Equality<TValue>,
  ): Action<TElement> {
    const select = selector ?? ((value: TState) => value as unknown as TValue);
    return (element) => {
      const sync = (value: TValue) => write(element, name, value);
      sync(select(readCell(cell)));
      return subscribeSelector(cell, select, sync, equality);
    };
  }
  return binding;
}

export const bind = {
  text<TState, TValue>(
    cell: AnyCell<TState, boolean, boolean>,
    selector: Selector<TState, TValue>,
    format: (value: TValue) => string = (value) =>
      value === null || value === undefined ? "" : String(value),
    equality?: Equality<TValue>,
  ): Action<HTMLElement> {
    return (element) => {
      const sync = (value: TValue) => {
        element.textContent = format(value);
      };
      sync(selector(readCell(cell)));
      return subscribeSelector(cell, selector, sync, equality);
    };
  },

  attr: bindDomValue(setDomAttribute),

  class<TState>(
    name: string,
    cell: AnyCell<TState, boolean, boolean>,
    selector: Selector<TState, boolean>,
    equality?: Equality<boolean>,
  ): Action<Element> {
    return (element) => {
      const sync = (enabled: boolean) => element.classList.toggle(name, enabled);
      sync(selector(readCell(cell)));
      return subscribeSelector(cell, selector, sync, equality);
    };
  },

  classes<TState>(
    cell: AnyCell<TState, boolean, boolean>,
    selector: Selector<TState, ClassBinding>,
    equality?: Equality<ClassBinding>,
  ): Action<Element> {
    return (element) => {
      let previous = new Set<string>();
      const sync = (value: ClassBinding) => {
        previous = applyClassBinding(element, previous, value);
      };
      sync(selector(readCell(cell)));
      return subscribeSelector(cell, selector, sync, equality);
    };
  },

  style<TState>(
    cell: AnyCell<TState, boolean, boolean>,
    selector: Selector<TState, StyleBinding>,
    equality?: Equality<StyleBinding>,
  ): Action<HTMLElement | SVGElement> {
    return (element) => {
      const sync = createStyleBinding(element);
      sync(selector(readCell(cell)));
      return subscribeSelector(cell, selector, sync, equality);
    };
  },

  prop: bindDomValue(setDomProperty),

  props<TState, TValue extends PropsBinding, TElement extends Element = Element>(
    cell: AnyCell<TState, boolean, boolean>,
    selector: Selector<TState, TValue>,
    equality?: Equality<TValue>,
  ): Action<TElement> {
    return (element) => {
      const sync = createPropsBinding(element);
      sync(selector(readCell(cell)));
      return subscribeSelector(cell, selector, sync, equality);
    };
  },

  dataset<TState>(
    name: string,
    cell: AnyCell<TState, boolean, boolean>,
    selector: Selector<TState, string | number | boolean | null | undefined>,
    equality?: Equality<string | number | boolean | null | undefined>,
  ): Action<HTMLElement> {
    return (element) => {
      const sync = (value: string | number | boolean | null | undefined) =>
        setDatasetValue(element, name, value);
      sync(selector(readCell(cell)));
      return subscribeSelector(cell, selector, sync, equality);
    };
  },

  aria<TState>(
    name: string,
    cell: AnyCell<TState, boolean, boolean>,
    selector: Selector<TState, string | number | boolean | null | undefined>,
    equality?: Equality<string | number | boolean | null | undefined>,
  ): Action<Element> {
    return (element) => {
      const sync = (value: string | number | boolean | null | undefined) =>
        setAriaValue(element, name, value);
      sync(selector(readCell(cell)));
      return subscribeSelector(cell, selector, sync, equality);
    };
  },

  value<TState, TValue>(
    cell: ValueCell<TState>,
    selector: Selector<TState, TValue>,
    commit: (value: string, state: TState) => Partial<TState> | TState | void,
    options: {
      event?: "input" | "change";
      format?: (value: TValue) => string;
      equality?: Equality<TValue>;
    } = {},
  ): Action<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
    return (element) => {
      const format =
        options.format ??
        ((value: TValue) => (value === null || value === undefined ? "" : String(value)));
      const sync = (value: TValue) => {
        const next = format(value);
        if (element.value !== next) element.value = next;
      };
      sync(selector(readCell(cell)));
      const unsubscribe = subscribeSelector(cell, selector, sync, options.equality);
      const eventName = options.event ?? "input";
      const handler = () => {
        const patch = commit(element.value, readCell(cell));
        if (patch !== undefined) writeCell(cell, patch);
      };
      element.addEventListener(eventName, handler);
      return () => {
        unsubscribe();
        element.removeEventListener(eventName, handler);
      };
    };
  },

  checked<TState>(
    cell: ValueCell<TState>,
    selector: Selector<TState, boolean>,
    commit: (checked: boolean, state: TState) => Partial<TState> | TState | void,
    equality?: Equality<boolean>,
  ): Action<HTMLInputElement> {
    return (element) => {
      const sync = (checked: boolean) => {
        if (element.checked !== checked) element.checked = checked;
      };
      sync(selector(readCell(cell)));
      const unsubscribe = subscribeSelector(cell, selector, sync, equality);
      const handler = () => {
        const patch = commit(element.checked, readCell(cell));
        if (patch !== undefined) writeCell(cell, patch);
      };
      element.addEventListener("change", handler);
      return () => {
        unsubscribe();
        element.removeEventListener("change", handler);
      };
    };
  },

  number<TState, TValue>(
    cell: ValueCell<TState>,
    selector: Selector<TState, TValue>,
    commit: (value: number | null, state: TState) => Partial<TState> | TState | void,
    options: {
      event?: "input" | "change";
      format?: (value: TValue) => string;
      equality?: Equality<TValue>;
    } = {},
  ): Action<HTMLInputElement> {
    return (element) => {
      const format =
        options.format ??
        ((value: TValue) => (value === null || value === undefined ? "" : String(value)));
      const sync = (value: TValue) => {
        const next = format(value);
        if (element.value !== next) element.value = next;
      };
      sync(selector(readCell(cell)));
      const unsubscribe = subscribeSelector(cell, selector, sync, options.equality);
      const eventName = options.event ?? "input";
      const handler = () => {
        const raw = element.value.trim();
        const next = raw === "" ? null : Number(raw);
        const patch = commit(Number.isNaN(next) ? null : next, readCell(cell));
        if (patch !== undefined) writeCell(cell, patch);
      };
      element.addEventListener(eventName, handler);
      return () => {
        unsubscribe();
        element.removeEventListener(eventName, handler);
      };
    };
  },

  checkedGroup<TState, TValue extends string = string>(
    cell: ValueCell<TState>,
    selector: Selector<TState, readonly TValue[]>,
    commit: (values: TValue[], state: TState) => Partial<TState> | TState | void,
    options: {
      value?: TValue;
      equality?: Equality<readonly TValue[]>;
    } = {},
  ): Action<HTMLInputElement> {
    return (element) => {
      const readValue = () => options.value ?? (element.value as TValue);
      const sync = (values: readonly TValue[]) => {
        element.checked = values.includes(readValue());
      };
      sync(selector(readCell(cell)));
      const unsubscribe = subscribeSelector(cell, selector, sync, options.equality);
      const handler = () => {
        const selected = new Set(selector(readCell(cell)));
        const value = readValue();
        if (element.checked) selected.add(value);
        else selected.delete(value);
        const patch = commit(Array.from(selected), readCell(cell));
        if (patch !== undefined) writeCell(cell, patch);
      };
      element.addEventListener("change", handler);
      return () => {
        unsubscribe();
        element.removeEventListener("change", handler);
      };
    };
  },

  radio<TState, TValue extends string | number | boolean = string>(
    cell: ValueCell<TState>,
    selector: Selector<TState, TValue>,
    commit: (value: TValue, state: TState) => Partial<TState> | TState | void,
    options: {
      value?: TValue;
      equality?: Equality<TValue>;
    } = {},
  ): Action<HTMLInputElement> {
    return (element) => {
      const readValue = () => options.value ?? (element.value as TValue);
      const sync = (value: TValue) => {
        element.checked = Object.is(value, readValue());
      };
      sync(selector(readCell(cell)));
      const unsubscribe = subscribeSelector(cell, selector, sync, options.equality);
      const handler = () => {
        if (!element.checked) return;
        const patch = commit(readValue(), readCell(cell));
        if (patch !== undefined) writeCell(cell, patch);
      };
      element.addEventListener("change", handler);
      return () => {
        unsubscribe();
        element.removeEventListener("change", handler);
      };
    };
  },

  selected<TState, TValue extends string = string>(
    cell: ValueCell<TState>,
    selector: Selector<TState, readonly TValue[]>,
    commit: (values: TValue[], state: TState) => Partial<TState> | TState | void,
    equality?: Equality<readonly TValue[]>,
  ): Action<HTMLSelectElement> {
    return (element) => {
      const sync = (values: readonly TValue[]) => {
        const selected = new Set<string>(values.map(String));
        for (const option of Array.from(element.options)) {
          option.selected = selected.has(option.value);
        }
      };
      sync(selector(readCell(cell)));
      const unsubscribe = subscribeSelector(cell, selector, sync, equality);
      const handler = () => {
        const values = Array.from(element.options)
          .filter((option) => option.selected)
          .map((option) => option.value as TValue);
        const patch = commit(values, readCell(cell));
        if (patch !== undefined) writeCell(cell, patch);
      };
      element.addEventListener("change", handler);
      return () => {
        unsubscribe();
        element.removeEventListener("change", handler);
      };
    };
  },

  files<TState>(
    cell: ValueCell<TState>,
    commit: (files: FileList | null, state: TState) => Partial<TState> | TState | void,
  ): Action<HTMLInputElement> {
    return (element) => {
      const handler = () => {
        const patch = commit(element.files, readCell(cell));
        if (patch !== undefined) writeCell(cell, patch);
      };
      element.addEventListener("change", handler);
      return () => element.removeEventListener("change", handler);
    };
  },
};
