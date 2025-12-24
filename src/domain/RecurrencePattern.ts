import {
  Frequency,
  isValidFrequency,
  isValidDayOfWeek,
  isValidDayOfMonth,
  isValidMonthOfYear,
  calculateNextDueDate,
  getFrequencyDescription,
} from '../config/frequencies';

/**
 * Value object representing a recurrence pattern
 * Encapsulates frequency logic with self-validation
 * Immutable after creation
 */
export class RecurrencePattern {
  readonly frequency: Frequency;
  readonly interval: number;
  readonly dayOfWeek?: number;
  readonly dayOfMonth?: number;
  readonly monthOfYear?: number;

  private constructor(
    frequency: Frequency,
    interval: number,
    dayOfWeek?: number,
    dayOfMonth?: number,
    monthOfYear?: number
  ) {
    this.frequency = frequency;
    this.interval = interval;
    this.dayOfWeek = dayOfWeek;
    this.dayOfMonth = dayOfMonth;
    this.monthOfYear = monthOfYear;
  }

  /**
   * Create a RecurrencePattern with validation and defaults
   * Uses current date for defaulting day fields when not provided
   * 
   * @param frequency - The recurrence frequency
   * @param interval - The interval (default: 1)
   * @param dayOfWeek - Day of week for weekly recurrence (0-6)
   * @param dayOfMonth - Day of month for monthly recurrence (1-31)
   * @param monthOfYear - Month of year for yearly recurrence (0-11)
   * @returns New RecurrencePattern instance
   * @throws Error if validation fails
   */
  static create(
    frequency: string,
    interval?: number,
    dayOfWeek?: number,
    dayOfMonth?: number,
    monthOfYear?: number
  ): RecurrencePattern {
    // Use current date for defaulting day fields
    const now = new Date();
    
    // Validate frequency
    if (!isValidFrequency(frequency)) {
      throw new Error(
        `Invalid frequency. Must be one of: daily, weekly, monthly, yearly`
      );
    }

    // Validate and default interval
    const validInterval = interval ?? 1;
    if (validInterval < 1) {
      throw new Error('Interval must be at least 1');
    }

    let validDayOfWeek: number | undefined = dayOfWeek;
    let validDayOfMonth: number | undefined = dayOfMonth;
    let validMonthOfYear: number | undefined = monthOfYear;

    // Validate and apply defaults for frequency-specific fields
    if (frequency === 'weekly') {
      // Default dayOfWeek to current day of week if not provided
      if (validDayOfWeek === undefined) {
        validDayOfWeek = now.getDay(); // 0-6 (Sunday-Saturday)
        console.log(
          `dayOfWeek not provided for weekly frequency, defaulting to ${validDayOfWeek} (${now.toLocaleDateString('en-US', { weekday: 'long' })})`
        );
      }
      if (!isValidDayOfWeek(validDayOfWeek)) {
        throw new Error('dayOfWeek must be between 0 (Sunday) and 6 (Saturday)');
      }
    }

    if (frequency === 'monthly') {
      // Default dayOfMonth to current day of month if not provided
      if (validDayOfMonth === undefined) {
        validDayOfMonth = now.getDate(); // 1-31
        console.log(
          `dayOfMonth not provided for monthly frequency, defaulting to ${validDayOfMonth}`
        );
      }
      if (!isValidDayOfMonth(validDayOfMonth)) {
        throw new Error('dayOfMonth must be between 1 and 31');
      }
    }

    if (frequency === 'yearly') {
      // Default monthOfYear to current month if not provided
      if (validMonthOfYear === undefined) {
        validMonthOfYear = now.getMonth(); // 0-11 (January-December)
        console.log(
          `monthOfYear not provided for yearly frequency, defaulting to ${validMonthOfYear} (${now.toLocaleDateString('en-US', { month: 'long' })})`
        );
      }
      if (!isValidMonthOfYear(validMonthOfYear)) {
        throw new Error('monthOfYear must be between 0 (January) and 11 (December)');
      }
    }

    return new RecurrencePattern(
      frequency,
      validInterval,
      validDayOfWeek,
      validDayOfMonth,
      validMonthOfYear
    );
  }

  /**
   * Calculate the next due date based on this recurrence pattern
   * Uses current date as the starting point
   * 
   * @returns The next due date
   */
  calculateNextDueDate(): string {
    // Use current date for calculation
    const now = new Date();
    
    const nextDue = calculateNextDueDate(
      now,
      this.frequency,
      this.interval,
      this.dayOfWeek,
      this.dayOfMonth,
      this.monthOfYear
    );
    
    // Return as full ISO-8601 string (with time)
    return nextDue.toISOString(); // 2025-11-08T00:00:00.000Z
  }

  /**
   * Get a human-readable description of this recurrence pattern
   * 
   * @returns Description string (e.g., "every 2 weeks on Monday")
   */
  getDescription(): string {
    return getFrequencyDescription(
      this.frequency,
      this.interval,
      this.dayOfWeek,
      this.dayOfMonth,
      this.monthOfYear
    );
  }

  /**
   * Convert to plain object for database storage
   */
  toJSON(): {
    frequency: string;
    interval: number;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    monthOfYear: number | null;
  } {
    return {
      frequency: this.frequency,
      interval: this.interval,
      dayOfWeek: this.dayOfWeek ?? null,
      dayOfMonth: this.dayOfMonth ?? null,
      monthOfYear: this.monthOfYear ?? null,
    };
  }

  /**
   * Create RecurrencePattern from database record
   */
  static fromJSON(data: {
    frequency: string;
    interval: number;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    monthOfYear: number | null;
  }): RecurrencePattern {
    if (!isValidFrequency(data.frequency)) {
      throw new Error(`Invalid frequency in data: ${data.frequency}`);
    }

    return new RecurrencePattern(
      data.frequency as Frequency,
      data.interval,
      data.dayOfWeek ?? undefined,
      data.dayOfMonth ?? undefined,
      data.monthOfYear ?? undefined
    );
  }
}
