// undefined|null checker and type guard all-in-wonder.
// Why is this not in Typescript?
export function isDefined<T>(value: T | undefined | null): value is NonNullable<T> {
    return value !== undefined && value !== null;
}

export function isEmpty(valid: unknown[]) {
  return !valid || valid.length === 0;
}

