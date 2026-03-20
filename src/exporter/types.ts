import type { ERDModel } from '../ir/types';

export interface ExportResult {
  ddl: string;
  warnings: string[];
}

export interface Exporter {
  readonly dialect: string;
  export(model: ERDModel): ExportResult;
}
