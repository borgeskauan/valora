import * as chrono from "chrono-node";

export interface ParseOptions {
  /**
   * Reference date used to resolve relative expressions like
   * "next Friday" or "in 2 hours".
   * Defaults to the current time.
   */
  referenceDate?: Date;

  /**
   * If true, Chrono will prefer future dates for ambiguous phrases
   * like "Friday". See README's `forwardDate` option.
   */
  forwardDate?: boolean;
}

/**
 * Parse a natural-language date/time expression into a Date object.
 * Returns null if parsing fails.
 */
export function parseNaturalDate(
  text: string,
  options: ParseOptions = {}
): Date | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const { referenceDate, forwardDate } = options;

  const ref = referenceDate ?? new Date();
  const parsingOptions =
    forwardDate === undefined ? undefined : { forwardDate };

  // chrono.parseDate returns a JS Date or null/undefined on failure.
  const result = chrono.parseDate(trimmed, ref, parsingOptions);

  console.log(`[naturalDateParser] Parsed "${text}" to`, result);

  return result ?? null;
}
