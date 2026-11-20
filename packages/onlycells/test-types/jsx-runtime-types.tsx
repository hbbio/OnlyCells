import { Sheet } from "@okcontract/cells";
import type { Child } from "../src/dom";
import { bind } from "../src/store";

const validTree: Child = (
  <section class="panel" data-id="home">
    <button
      disabled={false}
      onClick={(event) => {
        event.currentTarget.disabled = true;
      }}
    >
      Save
    </button>
    <svg viewBox="0 0 24 24">
      <path d="M4 6h16" stroke-linecap="round" stroke-width={2} />
    </svg>
    <my-widget custom-prop="1" />
  </section>
);
void validTree;

const count = new Sheet().new(1);
const caption = count.map((value) => `Count: ${value}`);
const liveTree: Child = <output use={bind.attr("data-count", count)}>{caption}</output>;
void liveTree;

// @ts-expect-error catches common event-name typos in TSX.
const badEvent = <button onClik={() => undefined}>Bad</button>;
void badEvent;

// @ts-expect-error href belongs on anchors, not buttons.
const badElementProp = <button href="/bad">Bad</button>;
void badElementProp;

// @ts-expect-error raw HTML is intentionally forced through unsafeHTML.
const badHtml = <div innerHTML="<strong>bad</strong>" />;
void badHtml;
