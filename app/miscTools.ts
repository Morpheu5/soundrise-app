// undefined|null checker and type guard all-in-wonder.
// Why is this not in Typescript?
export function isDefined<T>(value: T | undefined | null): value is NonNullable<T> {
    return <T>value !== undefined && <T>value !== null;
}