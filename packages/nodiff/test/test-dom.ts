// Test doubles for the browser operations exercised by the suite.
// Bun supplies HTML parsing, EventTarget, and FormData storage.
const htmlNamespace = "http://www.w3.org/1999/xhtml";
const NativeFormData = globalThis.FormData;

class Node extends EventTarget {
  readonly childNodes: Node[] = [];
  parentNode: Node | null = null;

  get firstChild(): Node | null {
    return this.childNodes[0] ?? null;
  }

  get nextSibling(): Node | null {
    const siblings = this.parentNode?.childNodes;
    return siblings?.[siblings.indexOf(this) + 1] ?? null;
  }

  get parentElement(): Element | null {
    return this.parentNode instanceof Element ? this.parentNode : null;
  }

  get children(): Element[] {
    return this.childNodes.filter((node): node is Element => node instanceof Element);
  }

  get textContent(): string {
    return this.childNodes
      .map((node) => (node instanceof Comment ? "" : node.textContent))
      .join("");
  }

  set textContent(value: string) {
    this.replaceChildren(...(value ? [new Text(value)] : []));
  }

  insertBefore<T extends Node>(node: T, before: Node | null): T {
    if (before && before.parentNode !== this) throw new Error("Reference node is not a child.");
    if (node === before) return node;
    if (node instanceof DocumentFragment) {
      for (const child of [...node.childNodes]) this.insertBefore(child, before);
    } else {
      node.remove();
      const index = before ? this.childNodes.indexOf(before) : this.childNodes.length;
      this.childNodes.splice(index, 0, node);
      node.parentNode = this;
    }
    return node;
  }

  appendChild<T extends Node>(node: T): T {
    return this.insertBefore(node, null);
  }

  append(...nodes: Node[]): void {
    for (const node of nodes) this.appendChild(node);
  }

  removeChild<T extends Node>(node: T): T {
    if (node.parentNode !== this) throw new Error("Node is not a child.");
    this.childNodes.splice(this.childNodes.indexOf(node), 1);
    node.parentNode = null;
    return node;
  }

  remove(): void {
    this.parentNode?.removeChild(this);
  }

  replaceChildren(...nodes: Node[]): void {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes.length = 0;
    this.append(...nodes);
  }

  querySelectorAll(selector: string): Element[] {
    const matches = matchSelector(selector);
    const find = (node: Node): Element[] =>
      node.children.flatMap((child) => (matches(child) ? [child, ...find(child)] : find(child)));
    return find(this);
  }

  querySelector(selector: string): Element | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class Text extends Node {
  constructor(public data: string) {
    super();
  }

  override get textContent(): string {
    return this.data;
  }

  override set textContent(value: string) {
    this.data = value;
  }
}

class Comment extends Text {}
class DocumentFragment extends Node {}

function matchSelector(selector: string): (element: Element) => boolean {
  const parts = selector.trim().split(/\s+/).reverse();
  const tests = parts.map((part) => {
    const match =
      /^(?:([\w-]+|\*))?(?:([.#])([\w-]+))?(?:\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'))?\])?$/.exec(
        part,
      );
    if (!part || !match) throw new Error("Unsupported test selector: " + selector);
    const [, tag, prefix, name, attribute, doubleQuoted, singleQuoted] = match;
    const value = doubleQuoted ?? singleQuoted;
    return (element: Element) =>
      (!tag || tag === "*" || element.localName === tag) &&
      (prefix !== "#" || element.getAttribute("id") === name) &&
      (prefix !== "." || element.classList.contains(name!)) &&
      (!attribute ||
        (value === undefined
          ? element.hasAttribute(attribute)
          : element.getAttribute(attribute) === value));
  });
  const [match, ...ancestors] = tests;
  return (element) => {
    if (!match!(element)) return false;
    let current: Element | null = element.parentElement;
    for (const test of ancestors) {
      while (current && !test(current)) current = current.parentElement;
      if (!current) return false;
      current = current.parentElement;
    }
    return true;
  };
}

function kebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
}

function inlineStyle() {
  const properties = new Map<string, string>();
  return new Proxy(
    {
      set cssText(value: string) {
        properties.clear();
        for (const declaration of value.split(";")) {
          const colon = declaration.indexOf(":");
          if (colon < 0) continue;
          properties.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
        }
      },
      setProperty(name: string, value: string) {
        properties.set(name, value);
      },
      removeProperty(name: string) {
        properties.delete(name);
      },
    },
    {
      get(target, key) {
        return Reflect.has(target, key)
          ? Reflect.get(target, key)
          : (properties.get(kebabCase(String(key))) ?? "");
      },
    },
  );
}

class Element extends Node {
  #attributes = new Map<string, string>();
  readonly style = inlineStyle();
  readonly dataset = new Proxy<Record<string, string>>(
    {},
    {
      get: (_target, key) => this.getAttribute("data-" + kebabCase(String(key))) ?? undefined,
      set: (_target, key, value) => {
        this.setAttribute("data-" + kebabCase(String(key)), value);
        return true;
      },
      deleteProperty: (_target, key) => {
        this.removeAttribute("data-" + kebabCase(String(key)));
        return true;
      },
    },
  );
  readonly classList = {
    contains: (name: string) => this.#classes().has(name),
    toggle: (name: string, enabled = !this.#classes().has(name)) => {
      const classes = this.#classes();
      if (enabled) classes.add(name);
      else classes.delete(name);
      this.setAttribute("class", [...classes].join(" "));
      return enabled;
    },
    add: (name: string): void => {
      this.classList.toggle(name, true);
    },
    remove: (name: string): void => {
      this.classList.toggle(name, false);
    },
  };

  constructor(
    readonly ownerDocument: Document,
    readonly localName: string,
    readonly namespaceURI = htmlNamespace,
  ) {
    super();
  }

  get tagName(): string {
    return this.namespaceURI === htmlNamespace ? this.localName.toUpperCase() : this.localName;
  }

  get attributes() {
    return Array.from(this.#attributes, ([name, value]) => ({ name, value }));
  }

  getAttribute(name: string): string | null {
    return this.#attributes.get(this.#attributeName(name)) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.#attributes.has(this.#attributeName(name));
  }

  setAttribute(name: string, value: string): void {
    this.#attributes.set(this.#attributeName(name), String(value));
  }

  removeAttribute(name: string): void {
    this.#attributes.delete(this.#attributeName(name));
  }

  #attributeName(name: string): string {
    return this.namespaceURI === htmlNamespace ? name.toLowerCase() : name;
  }

  #classes(): Set<string> {
    return new Set((this.getAttribute("class") ?? "").split(/\s+/).filter(Boolean));
  }

  closest(selector: string): Element | null {
    const matches = matchSelector(selector);
    for (let element: Element | null = this; element; element = element.parentElement) {
      if (matches(element)) return element;
    }
    return null;
  }

  get innerHTML(): string {
    const root = this instanceof HTMLTemplateElement ? this.content : this;
    return root.childNodes.map(serialize).join("");
  }

  set innerHTML(value: string) {
    const root = this instanceof HTMLTemplateElement ? this.content : this;
    root.replaceChildren();
    parseHTML(this.ownerDocument, root, value);
  }
}

class MouseEvent extends Event {
  readonly button = 0;
}

class HTMLElement extends Element {
  click(): void {
    if (!this.hasAttribute("disabled")) {
      this.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }
  }
}

class HTMLAnchorElement extends HTMLElement {
  get href(): string {
    const href = this.getAttribute("href");
    if (href === null) return "";
    return URL.parse(href, this.ownerDocument.defaultView.location)?.href ?? href;
  }

  set href(value: string) {
    this.setAttribute("href", value);
  }
}

class HTMLButtonElement extends HTMLElement {}

class FormControl extends HTMLElement {
  declare name: string;
  declare disabled: boolean;
  validationMessage = "";

  get value(): string {
    return this.getAttribute("value") ?? "";
  }

  set value(value: string) {
    this.setAttribute("value", value);
  }

  setCustomValidity(message: string): void {
    this.validationMessage = message;
  }

  reportValidity(): boolean {
    return !this.validationMessage;
  }
}

class HTMLInputElement extends FormControl {
  declare type: string;
  declare checked: boolean;
  files: FileList | null = null;
}

class HTMLOptionElement extends HTMLElement {
  declare selected: boolean;

  get value(): string {
    return this.getAttribute("value") ?? this.textContent;
  }

  set value(value: string) {
    this.setAttribute("value", value);
  }
}

class HTMLSelectElement extends FormControl {
  get options(): HTMLOptionElement[] {
    return this.querySelectorAll("option") as HTMLOptionElement[];
  }

  override get value(): string {
    return this.options.find((option) => option.selected)?.value ?? "";
  }

  override set value(value: string) {
    for (const option of this.options) option.selected = option.value === String(value);
  }
}

class HTMLFormElement extends HTMLElement {
  get elements() {
    const controls = this.querySelectorAll("[name]").filter(
      (element): element is FormControl => element instanceof FormControl,
    );
    return Object.assign(controls, {
      namedItem: (name: string) => controls.find((control) => control.name === name) ?? null,
    });
  }

  reportValidity(): boolean {
    return this.elements.every((control) => control.reportValidity());
  }
}

class HTMLTemplateElement extends HTMLElement {
  readonly content = new DocumentFragment();
}

function reflect(prototype: Element, properties: Record<string, string | true>): void {
  for (const [property, attribute] of Object.entries(properties)) {
    const name = attribute === true ? property : attribute;
    Object.defineProperty(prototype, property, {
      get(this: Element) {
        return attribute === true ? this.hasAttribute(name) : (this.getAttribute(name) ?? "");
      },
      set(this: Element, value: unknown) {
        if (attribute === true && !value) this.removeAttribute(name);
        else this.setAttribute(name, attribute === true ? "" : String(value));
      },
    });
  }
}

reflect(Element.prototype, { className: "class", id: "id" });
reflect(HTMLElement.prototype, { hidden: true, title: "title" });
reflect(HTMLAnchorElement.prototype, { rel: "rel", target: "target" });
reflect(HTMLButtonElement.prototype, { disabled: true });
reflect(FormControl.prototype, { name: "name", disabled: true });
reflect(HTMLInputElement.prototype, { checked: true, type: "type" });
reflect(HTMLOptionElement.prototype, { selected: true });

class FormData extends NativeFormData {
  constructor(form?: HTMLFormElement) {
    super();
    for (const control of form?.elements ?? []) {
      if (control.name && !control.disabled) this.append(control.name, control.value);
    }
  }
}

const elementTypes = {
  a: HTMLAnchorElement,
  button: HTMLButtonElement,
  form: HTMLFormElement,
  input: HTMLInputElement,
  option: HTMLOptionElement,
  select: HTMLSelectElement,
  template: HTMLTemplateElement,
};

class Document extends Node {
  readonly documentElement: Element;
  readonly head: Element;
  readonly body: Element;
  cookie = "";
  title = "";

  constructor(readonly defaultView: TestWindow) {
    super();
    this.documentElement = this.createElement("html");
    this.head = this.createElement("head");
    this.body = this.createElement("body");
    this.appendChild(this.documentElement);
    this.documentElement.append(this.head, this.body);
  }

  createElement(name: string): Element {
    return this.createElementNS(htmlNamespace, name.toLowerCase());
  }

  createElementNS(namespace: string, name: string): Element {
    const Type =
      namespace === htmlNamespace ? (this.defaultView.elements.get(name) ?? HTMLElement) : Element;
    return new Type(this, name, namespace);
  }

  createDocumentFragment(): DocumentFragment {
    return new DocumentFragment();
  }

  createTextNode(data: string): Text {
    return new Text(data);
  }

  createComment(data: string): Comment {
    return new Comment(data);
  }
}

const htmlEntities = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };

function decodeHTML(value: string): string {
  return value.replace(/&(amp|apos|gt|lt|quot|#\d+|#[xX][\da-fA-F]+);/g, (_, reference: string) => {
    if (!reference.startsWith("#")) return htmlEntities[reference as keyof typeof htmlEntities];
    const hexadecimal = reference[1]?.toLowerCase() === "x";
    const codePoint = hexadecimal
      ? Number.parseInt(reference.slice(2), 16)
      : Number(reference.slice(1));
    const valid =
      codePoint > 0 && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff);
    return valid ? String.fromCodePoint(codePoint) : "\uFFFD";
  });
}

function parseHTML(document: Document, root: Node, html: string): void {
  const parents = [root];
  const parent = () => parents.at(-1)!;
  new HTMLRewriter()
    .on("*", {
      element(tag) {
        const element = document.createElementNS(tag.namespaceURI, tag.tagName);
        for (const [name, value] of tag.attributes) element.setAttribute(name, decodeHTML(value));
        parent().appendChild(element);
        if (tag.canHaveContent) {
          parents.push(element);
          tag.onEndTag(() => {
            parents.pop();
          });
        }
      },
    })
    .onDocument({
      text(chunk) {
        if (chunk.text) parent().appendChild(new Text(decodeHTML(chunk.text)));
      },
      comments(comment) {
        parent().appendChild(new Comment(comment.text));
      },
    })
    .transform(html);
}

function serialize(node: Node): string {
  if (node instanceof Comment) return "<!--" + node.data + "-->";
  if (!(node instanceof Element)) return Bun.escapeHTML(node.textContent);
  const tag = node.localName;
  const attributes = node.attributes
    .map(({ name, value }) => " " + name + '="' + Bun.escapeHTML(value) + '"')
    .join("");
  const start = "<" + tag + attributes + ">";
  return /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag)
    ? start
    : start + node.innerHTML + "</" + tag + ">";
}

class Storage {
  get length(): number {
    return Object.keys(this).length;
  }

  key(index: number): string | null {
    return Object.keys(this)[index] ?? null;
  }

  getItem(key: string): string | null {
    const value = Object.getOwnPropertyDescriptor(this, key)?.value;
    return typeof value === "string" ? value : null;
  }

  setItem(key: string, value: string): void {
    Object.defineProperty(this, key, {
      configurable: true,
      enumerable: true,
      value: String(value),
    });
  }

  removeItem(key: string): void {
    Reflect.deleteProperty(this, key);
  }
}

class TestWindow extends EventTarget {
  readonly location = new URL("about:blank");
  readonly localStorage = new Storage();
  readonly elements = new Map<string, typeof HTMLElement>(Object.entries(elementTypes));
  readonly customElements = {
    define: (name: string, type: typeof HTMLElement) => this.elements.set(name, type),
  };
  #navigate = (_data: unknown, _title: string, url?: string | URL | null) => {
    if (url != null) this.location.href = new URL(url, this.location).href;
  };
  readonly history = { pushState: this.#navigate, replaceState: this.#navigate };
  readonly document = new Document(this);
}

export function installDom(): () => void {
  const constructors = {
    Node,
    Element,
    HTMLElement,
    HTMLAnchorElement,
    HTMLInputElement,
    DocumentFragment,
    FormData,
    MouseEvent,
    InputEvent: Event,
    SubmitEvent: Event,
  };
  const window = Object.assign(new TestWindow(), constructors);
  const globals = {
    ...constructors,
    window,
    document: window.document,
    localStorage: window.localStorage,
  };
  const previous = Object.entries(globals).map(([key, value]) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    return [key, descriptor] as const;
  });
  return () => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  };
}
