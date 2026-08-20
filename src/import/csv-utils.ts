/**
 * @module import/csv-utils
 * Helper function for parsing CSV strings.
 */

/**
 * Basic CSV parser supporting quotes.
 */
export function parseCSV(csv: string, delimiter = ','): string[][] {
  const result: string[][] = [];
  let currentLine: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentLine.push(currentField);
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      currentLine.push(currentField);
      result.push(currentLine);
      currentLine = [];
      currentField = '';
    } else if (char === '\r' && !inQuotes) {
      // Ignore \r
    } else {
      currentField += char;
    }
  }

  // Push the last field and line if not empty
  if (currentField !== '' || currentLine.length > 0) {
    currentLine.push(currentField);
    result.push(currentLine);
  }

  return result;
}

/**
 * Normalizes number formats (comma/dot)
 */
export function parseNumber(value: string): number {
  if (!value) return 0;
  // If it's a format like 1.234,56
  if (value.includes(',') && value.indexOf(',') > value.lastIndexOf('.')) {
    return parseFloat(value.replace(/\./g, '').replace(',', '.'));
  }
  // If it's a format like 1,234.56
  if (value.includes(',') && value.indexOf(',') < value.lastIndexOf('.')) {
    return parseFloat(value.replace(/,/g, ''));
  }
  // Generic fallback, just replace , with . if there's no dot
  if (value.includes(',') && !value.includes('.')) {
    return parseFloat(value.replace(',', '.'));
  }
  return parseFloat(value);
}
