// src/lib/dateUtils.ts

/**
 * Formats a date string or Date object to DD/MM/YYYY format.
 * Prioritizes parsing YYYY-MM-DD and DD/MM/YYYY string formats.
 * Returns 'N/A' for null/undefined input.
 * Returns 'Invalid Date' if the input cannot be parsed into a valid date.
 */
export function formatDateToDDMMYYYY(dateInput: string | Date | null | undefined): string {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return 'N/A';
  }

  let date: Date;
  let useUtcGetters = false; // Flag to determine if UTC getters should be used

  if (typeof dateInput === 'string') {
    // 1. Try YYYY-MM-DD (allows optional time component)
    const isoMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (isoMatch) {
      date = new Date(Date.UTC(
        parseInt(isoMatch[1], 10),
        parseInt(isoMatch[2], 10) - 1, // Month is 0-indexed for Date.UTC
        parseInt(isoMatch[3], 10)
      ));
      useUtcGetters = true;
    } else {
      // 2. Try DD/MM/YYYY
      const euroMatch = dateInput.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (euroMatch) {
        const dayPart = parseInt(euroMatch[1], 10);
        const monthPart = parseInt(euroMatch[2], 10);
        const yearPart = parseInt(euroMatch[3], 10);

        // Basic validation for day and month parts from regex match
        if (monthPart >= 1 && monthPart <= 12 && dayPart >= 1 && dayPart <= 31) {
            date = new Date(Date.UTC(yearPart, monthPart - 1, dayPart));
            // Check if the constructed date is valid and matches the input parts
            // (e.g., new Date(Date.UTC(2023, 1, 30)) would become March 2nd, 2023)
            if (date.getUTCFullYear() === yearPart &&
                date.getUTCMonth() === monthPart - 1 &&
                date.getUTCDate() === dayPart) {
                useUtcGetters = true;
            } else {
                // Invalid date parts (e.g., 30/02/2023 led to date rollover)
                date = new Date(NaN); // Mark as invalid
            }
        } else {
            // Invalid month/day numbers (e.g. 15/13/2023)
            date = new Date(NaN);
        }
      } else {
        // 3. Fallback to new Date() for other formats (e.g., "MMM d, yyyy", or potentially MM/DD/YYYY)
        // This parsing can be locale-dependent and ambiguous.
        date = new Date(dateInput);
        // For `new Date(string)`, components are usually local, so useUtcGetters remains false.
      }
    }
  } else {
    date = dateInput; // It's already a Date object
    // For existing Date objects, assume local getters are appropriate (useUtcGetters remains false).
  }

  if (isNaN(date.getTime())) {
    // This catches explicitly set new Date(NaN) or if new Date(dateInput) parsing failed
    return 'Invalid Date';
  }

  let dayValue: number;
  let monthValue: number; // 1-indexed month
  let yearValue: number;

  if (useUtcGetters) {
    dayValue = date.getUTCDate();
    monthValue = date.getUTCMonth() + 1; // getUTCMonth is 0-indexed
    yearValue = date.getUTCFullYear();
  } else {
    dayValue = date.getDate();
    monthValue = date.getMonth() + 1; // getMonth is 0-indexed
    yearValue = date.getFullYear();
  }
  
  const dayStr = String(dayValue).padStart(2, '0');
  const monthStr = String(monthValue).padStart(2, '0');
  const yearStr = String(yearValue); // getFullYear returns a number, String() converts

  return `${dayStr}/${monthStr}/${yearStr}`;
}
/**
 * Formats a date string or Date object to YYYY-MM-DD format.
 * Returns an empty string for null/undefined/invalid input, suitable for date input value.
 */
export function formatDateToYYYYMMDD(dateInput: string | Date | null | undefined): string {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return ''; // Return empty string for date inputs
  }

  let date: Date;
  let useUtcGetters = false;

  if (typeof dateInput === 'string') {
    const isoMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (isoMatch) {
      date = new Date(Date.UTC(
        parseInt(isoMatch[1], 10),
        parseInt(isoMatch[2], 10) - 1,
        parseInt(isoMatch[3], 10)
      ));
      useUtcGetters = true;
    } else {
      const euroMatch = dateInput.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (euroMatch) {
        const dayPart = parseInt(euroMatch[1], 10);
        const monthPart = parseInt(euroMatch[2], 10);
        const yearPart = parseInt(euroMatch[3], 10);
        if (monthPart >= 1 && monthPart <= 12 && dayPart >= 1 && dayPart <= 31) {
            date = new Date(Date.UTC(yearPart, monthPart - 1, dayPart));
            if (date.getUTCFullYear() === yearPart && date.getUTCMonth() === monthPart - 1 && date.getUTCDate() === dayPart) {
                useUtcGetters = true;
            } else {
                date = new Date(NaN); 
            }
        } else {
            date = new Date(NaN);
        }
      } else {
        date = new Date(dateInput);
      }
    }
  } else {
    date = dateInput;
  }

  if (isNaN(date.getTime())) {
    return ''; // Return empty string for invalid dates
  }

  let dayValue: number;
  let monthValue: number; // 1-indexed month
  let yearValue: number;

  if (useUtcGetters) {
    dayValue = date.getUTCDate();
    monthValue = date.getUTCMonth() + 1;
    yearValue = date.getUTCFullYear();
  } else {
    dayValue = date.getDate();
    monthValue = date.getMonth() + 1;
    yearValue = date.getFullYear();
  }
  
  const dayStr = String(dayValue).padStart(2, '0');
  const monthStr = String(monthValue).padStart(2, '0');
  
  return `${yearValue}-${monthStr}-${dayStr}`;
}