import type { Cardinality } from '../ir/types';

/** Returns true if the cardinality's max allows more than one (many side). */
export function isMany(cardinality: Cardinality): boolean {
  return cardinality.max === '*' || (typeof cardinality.max === 'number' && cardinality.max > 1);
}

/** Generate a FK column name from the referenced entity and attribute names. */
export function fkColumnName(entityName: string, attrName: string): string {
  return `${entityName.toLowerCase()}_${attrName}`;
}
