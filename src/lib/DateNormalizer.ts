import { parseNaturalDate } from "./naturalDateParser";

/**
 * Result of date normalization operation
 */
export interface DateNormalizationResult {
  isValid: boolean;
  normalizedDate?: string; // ISO-8601 string if valid
  error?: string;          // Error message if invalid
}

/**
 * Options for date normalization
 */
export interface DateNormalizationOptions {
  /**
   * Reference date used to resolve relative expressions like
   * "next Friday" or "in 2 hours".
   * Defaults to the current time.
   */
  referenceDate?: Date;
}

/**
 * Utility class for normalizing date inputs into ISO-8601 strings.
 * 
 * Handles:
 * - Natural language dates ("yesterday", "last Friday", "Nov 10")
 * - ISO format strings ("2025-11-27")
 * - Date objects
 * - Undefined/null (defaults to current timestamp)
 * 
 * Returns explicit failure for unparseable strings instead of silent fallbacks.
 */
export class DateNormalizer {
  /**
   * Normalize a date input into an ISO-8601 string.
   * 
   * @param rawDate - Raw date input (string, Date object, or undefined)
   * @param options - Normalization options (reference date, etc.)
   * @returns DateNormalizationResult with success/failure status
   * 
   * @example
   * // Optional date (defaults to now)
   * DateNormalizer.normalize(undefined)
   * // => { isValid: true, normalizedDate: "2025-11-27T14:30:00.000Z" }
   * 
   * @example
   * // Valid natural language
   * DateNormalizer.normalize("yesterday")
   * // => { isValid: true, normalizedDate: "2025-11-26T00:00:00.000Z" }
   * 
   * @example
   * // Unparseable string
   * DateNormalizer.normalize("xyzday")
   * // => { isValid: false, error: "Could not parse date 'xyzday'..." }
   */
  static normalize(
    rawDate?: string | Date | null,
    options?: DateNormalizationOptions
  ): DateNormalizationResult {
    // Handle undefined/null - date is optional, defaults to current timestamp
    if (rawDate === undefined || rawDate === null) {
      return {
        isValid: true,
        normalizedDate: new Date().toISOString(),
      };
    }

    // Handle Date objects - convert directly to ISO string
    if (rawDate instanceof Date) {
      if (isNaN(rawDate.getTime())) {
        return {
          isValid: false,
          error: "Invalid Date object provided.",
        };
      }
      return {
        isValid: true,
        normalizedDate: rawDate.toISOString(),
      };
    }

    // Handle empty string - explicit error (user provided something but it's empty)
    if (rawDate.trim() === "") {
      return {
        isValid: false,
        error: "Date cannot be empty. Please provide a date or leave it blank to use today.",
      };
    }

    // Handle non-empty strings - attempt to parse with chrono-node
    const referenceDate = options?.referenceDate ?? new Date();
    const parsedDate = parseNaturalDate(rawDate, { referenceDate });

    if (parsedDate === null) {
      return {
        isValid: false,
        error: `Could not parse date '${rawDate}'. Please use a clearer format like 'yesterday', 'Nov 27', or '2025-11-27'.`,
      };
    }

    return {
      isValid: true,
      normalizedDate: parsedDate.toISOString(),
    };
  }
}
