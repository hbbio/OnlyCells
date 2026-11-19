import { Sheet } from "@okcontract/cells";
import type { Child } from "../src/dom";
import { bind, type PropsBinding } from "../src/store";

const sheet = new Sheet();
const count = sheet.new(1);
const label = sheet.new("posts");

const vm = sheet.map([count, label], (value, label) => ({ label, doubled: value * 2 }));

const countText: Child = count.map((value) => String(value));
void countText;
bind.prop("value", count);

bind.props(vm, (state) => ({
  disabled: state.doubled > 1,
  aria: { label: state.label },
  class: { active: state.doubled > 1 },
  title: state.label,
}));

// @ts-expect-error derived state preserves the selected property types.
bind.props(vm, (state) => ({ title: state.doubled.toUpperCase() }));

const readCount = (value: number) => value;
const parseCount = (value: number | null) => value ?? 0;
bind.number(count, readCount, parseCount);
// @ts-expect-error a two-way binding needs a ValueCell.
bind.number(count.map(readCount), readCount, parseCount);

const props = {
  disabled: true,
  dataset: { id: "posts" },
  style: { color: "red" },
} satisfies PropsBinding;
void props;
