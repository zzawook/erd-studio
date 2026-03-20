import { BaseExporter } from './BaseExporter';
import type { DataType } from '../ir/types';

export class PostgreSQLExporter extends BaseExporter {
  readonly dialect = 'PostgreSQL';

  quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  mapDataType(dt: DataType): string {
    switch (dt.name) {
      case 'VARCHAR':
        return dt.precision ? `VARCHAR(${dt.precision})` : 'VARCHAR(255)';
      case 'TEXT':
        return 'TEXT';
      case 'INT':
        return 'INTEGER';
      case 'BIGINT':
        return 'BIGINT';
      case 'SMALLINT':
        return 'SMALLINT';
      case 'NUMERIC':
        if (dt.precision != null) {
          return dt.scale != null
            ? `NUMERIC(${dt.precision},${dt.scale})`
            : `NUMERIC(${dt.precision})`;
        }
        return 'NUMERIC';
      case 'BOOLEAN':
        return 'BOOLEAN';
      case 'DATE':
        return 'DATE';
      case 'TIMESTAMP':
        return 'TIMESTAMP';
      case 'TIMESTAMPTZ':
        return 'TIMESTAMPTZ';
      case 'UUID':
        return 'UUID';
      case 'JSONB':
        return 'JSONB';
      case 'BYTEA':
        return 'BYTEA';
      default:
        return dt.name;
    }
  }
}
