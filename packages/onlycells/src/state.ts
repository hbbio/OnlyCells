import { type AnyCell, Sheet, type ValueCell } from "@okcontract/cells";

export type ControllerOptions<T> = {
  sheet?: Sheet;
  cell?: ValueCell<T>;
};

export function createControllerCell<T>(
  initial: T,
  { sheet, cell }: ControllerOptions<T>,
  name: string,
): ValueCell<T> {
  if (!cell) return (sheet ?? new Sheet(Object.is)).new(initial, undefined, name);
  cell.set(initial);
  return cell;
}

export function readCell<T>(cell: AnyCell<T, boolean, boolean>): T {
  const value = cell.value;
  if (value === undefined) throw new Error("Expected an initialized cell.");
  if (value instanceof Error) throw value;
  return value;
}

export function patchCell<T extends object>(cell: ValueCell<T>, patch: Partial<T>): void {
  cell.set({ ...readCell(cell), ...patch });
}
