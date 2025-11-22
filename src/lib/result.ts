/**
 * Result type for error handling without exceptions
 * 
 * All async operations should return Result<T> instead of throwing errors
 */

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

export const Err = <E = Error>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

/**
 * Helper to convert a thrown error into a Result
 */
export async function tryAsync<T>(
  fn: () => Promise<T>,
): Promise<Result<T, Error>> {
  try {
    const value = await fn();
    return Ok(value);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

