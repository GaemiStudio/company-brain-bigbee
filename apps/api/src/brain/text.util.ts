/** Small helpers for writing alert and report sentences. */

/** Remove duplicates and blanks: ["Chrome", null, "Chrome"] → ["Chrome"]. */
export const unique = <T>(values: readonly (T | null)[]): T[] =>
  [...new Set(values)].filter((value): value is T => value !== null);

/** ["Chrome", "Edge"] → "Chrome or Edge"; [] → the fallback. */
export const joinWithOr = (values: readonly string[], fallback = 'unknown'): string =>
  values.length <= 1
    ? (values[0] ?? fallback)
    : `${values.slice(0, -1).join(', ')} or ${values.at(-1)}`;
