import { BaseExporter } from './BaseExporter';
import type { DataType } from '../ir/types';

export class MySQLExporter extends BaseExporter {
  readonly dialect = 'MySQL';

  quoteIdentifier(name: string): string {
    return `\`${name.replace(/`/g, '``')}\``;
  }

  mapDataType(dt: DataType): string {
    switch (dt.name) {
      case 'VARCHAR':
        return dt.precision ? `VARCHAR(${dt.precision})` : 'VARCHAR(255)';
      case 'TEXT':
        return 'TEXT';
      case 'INT':
        return 'INT';
      case 'BIGINT':
        return 'BIGINT';
      case 'SMALLINT':
        return 'SMALLINT';
      case 'NUMERIC':
        if (dt.precision != null) {
          return dt.scale != null
            ? `DECIMAL(${dt.precision},${dt.scale})`
            : `DECIMAL(${dt.precision})`;
        }
        return 'DECIMAL';
      case 'BOOLEAN':
        return 'TINYINT(1)';
      case 'DATE':
        return 'DATE';
      case 'TIMESTAMP':
        return 'TIMESTAMP';
      case 'TIMESTAMPTZ':
        return 'TIMESTAMP';
      case 'UUID':
        return 'CHAR(36)';
      case 'JSONB':
        return 'JSON';
      case 'BYTEA':
        return 'BLOB';
      default:
        return dt.name;
    }
  }
}
