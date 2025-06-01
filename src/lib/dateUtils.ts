// src/lib/dateUtils.ts

/**
 * Formats a date string or Date object to DD/MM/YYYY format.
 * Returns 'N/A' for null/undefined input.
 * Returns 'Invalid Date' if the input cannot be parsed into a valid date.
 */
export function formatDateToDDMMYYYY(dateInput: string | Date | null | undefined): string {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return 'N/A';
  }

  let date: Date;

  if (typeof dateInput === 'string') {
    // Try to handle YYYY-MM-DD, or common US/Euro formats that Date constructor might parse
    // Standardize by trying to parse it robustly
    const isoMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/); // YYYY-MM-DD
    if (isoMatch) {
      date = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    } else {
      // For other string formats, new Date() can be unreliable across browsers/locales
      // Attempting a more direct parse for DD/MM/YYYY or MM/DD/YYYY like structures
      const parts = dateInput.match(/(\d{1,2})[/\.-](\d{1,2})[/\.-](\d{4})/);
      if (parts) {
        // Assuming DD/MM/YYYY for European context if ambiguous, but this is risky.
        // A more robust solution would require knowing the input string's format.
        // For now, let's try to be somewhat smart. If first part > 12, assume it's day.
        let day, month, year;
        const part1 = parseInt(parts[1], 10);
        const part2 = parseInt(parts[2], 10);
        year = parseInt(parts[3], 10);

        if (part1 > 12) { // Likely DD/MM/YYYY
          day = part1;
          month = part2;
        } else if (part2 > 12) { // Likely MM/DD/YYYY
          day = part2;
          month = part1;
        } else {
            // Ambiguous (e.g., 01/02/2023). Default to MM/DD if navigator.language suggests US, else DD/MM.
            // This is a heuristic. For true robustness, input format should be known.
            // Forcing DD/MM/YYYY as per request.
            day = part1;
            month = part2;
        }
        date = new Date(year, month - 1, day);

      } else {
        date = new Date(dateInput); // Fallback to direct constructor
      }
    }
  } else {
    date = dateInput; // It's already a Date object
  }

  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}