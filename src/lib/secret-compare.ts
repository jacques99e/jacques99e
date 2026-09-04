import { timingSafeEqual } from "crypto";

/** Compare two secrets in constant time. Length mismatch is not equal. */
export function secretsEqual(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
