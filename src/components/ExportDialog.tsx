import { useState, useMemo } from 'react';
import { useERDStore } from '../ir/store';
import { PostgreSQLExporter } from '../exporter/PostgreSQLExporter';
import { MySQLExporter } from '../exporter/MySQLExporter';
import type { Exporter } from '../exporter/types';

const exporters: Record<string, Exporter> = {
  PostgreSQL: new PostgreSQLExporter(),
  MySQL: new MySQLExporter(),
};

interface Props {
  onClose: () => void;
}

export function ExportDialog({ onClose }: Props) {
  const model = useERDStore((s) => s.model);
  const [dialect, setDialect] = useState<string>('PostgreSQL');
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    const exporter = exporters[dialect];
    if (!exporter) return { ddl: '', warnings: ['Unknown dialect'] };
    return exporter.export(model);
  }, [model, dialect]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.ddl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = result.ddl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([result.ddl], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema_${dialect.toLowerCase()}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" data-testid="export-dialog">
      <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-bold text-gray-800">Export DDL</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg"
            data-testid="export-close-button"
          >
            &times;
          </button>
        </div>

        {/* Controls */}
        <div className="px-4 py-2 flex items-center gap-3 border-b border-gray-100">
          <label className="text-xs text-gray-600">DBMS:</label>
          <select
            value={dialect}
            onChange={(e) => setDialect(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded"
            data-testid="dialect-select"
          >
            {Object.keys(exporters).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <div className="flex-1" />

          <button
            onClick={handleCopy}
            className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
            data-testid="copy-button"
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1 text-xs font-medium bg-gray-600 text-white rounded hover:bg-gray-700"
            data-testid="download-button"
          >
            Download .sql
          </button>
        </div>

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200" data-testid="export-warnings">
            <p className="text-xs font-bold text-yellow-700 mb-1">Warnings:</p>
            <ul className="text-xs text-yellow-700 list-disc list-inside">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* DDL output */}
        <div className="flex-1 overflow-auto p-4">
          <pre
            className="text-xs font-mono bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap"
            data-testid="ddl-output"
          >
            {result.ddl || '-- No entities to export'}
          </pre>
        </div>
      </div>
    </div>
  );
}
