/**
 * Validates cardinality inputs.
 * Returns an error string if invalid, or empty string if valid.
 */
export function validateCardinality(minStr: string, maxStr: string): string {
  // Validate min
  const min = Number(minStr);
  if (minStr.trim() === '' || isNaN(min) || !Number.isInteger(min) || min < 0) {
    return 'min must be a non-negative integer';
  }

  // Validate max
  if (maxStr.trim() === '*') {
    return ''; // * is always valid with any min
  }

  const max = Number(maxStr);
  if (maxStr.trim() === '' || isNaN(max) || !Number.isInteger(max) || max < 1) {
    return 'max must be a positive integer or *';
  }

  // min <= max
  if (min > max) {
    return 'min cannot exceed max';
  }

  return '';
}
