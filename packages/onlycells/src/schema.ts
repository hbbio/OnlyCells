export type ValidationIssue = {
  readonly path: readonly PropertyKey[];
  readonly message: string;
};

export class ValidationError extends Error {
  constructor(public readonly issues: readonly ValidationIssue[]) {
    super("Validation failed.");
    this.name = "ValidationError";
  }
}

export type ValidationResult<T, TError extends ValidationError = ValidationError> =
  { success: true; data: T } | { success: false; error: TError };

export interface Schema<T, TError extends ValidationError = ValidationError> {
  parse(input: unknown): T;
  safeParse(input: unknown): ValidationResult<T, TError>;
}

export function defineSchema<T>(parse: (input: unknown) => T): Schema<T> {
  return {
    parse,
    safeParse(input) {
      try {
        return { success: true, data: parse(input) };
      } catch (error) {
        if (error instanceof ValidationError) return { success: false, error };
        throw error;
      }
    },
  };
}
