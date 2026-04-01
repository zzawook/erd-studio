import { useState, useMemo, useEffect, useCallback } from 'react';
import { useERDStore } from '../ir/store';
import { PostgreSQLExporter } from '../exporter/PostgreSQLExporter';
import { MySQLExporter } from '../exporter/MySQLExporter';
import type { Exporter } from '../exporter/types';
import { showToast } from './Toast';

const exporters: Record<string, Exporter> = {
  PostgreSQL: new PostgreSQLExporter(),
  MySQL: new MySQLExporter(),
};

const dialectKeys = Object.keys(exporters);

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

  const ddlLines = useMemo(() => {
    if (!result.ddl) return [];
    return result.ddl.split('\n');
  }, [result.ddl]);

  // Escape key to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
    showToast(`Downloaded schema_${dialect.toLowerCase()}.sql`, 'success');
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      data-testid="export-dialog"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[720px] max-h-[80vh] flex flex-col border border-gray-200"
        style={{ animation: 'modal-enter 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Export DDL</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            aria-label="Close dialog"
            data-testid="export-close-button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="px-5 py-3 flex items-center gap-3 border-b border-gray-100">
          {/* DBMS segmented selector */}
          <span className="text-xs font-medium text-gray-500">DBMS:</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            {dialectKeys.map((d) => (
              <button
                key={d}
                onClick={() => setDialect(d)}
                className={`px-4 py-1.5 text-sm font-medium transition-all duration-200
                  ${dialect === d
                    ? 'bg-primary-600 text-white shadow-inner'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div data-testid="dialect-select" className="hidden" />

          <div className="flex-1" />

          <button
            onClick={handleCopy}
            className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-all flex items-center gap-1.5
              ${copied
                ? 'bg-green-600 text-white'
                : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            style={copied ? { animation: 'copy-flash 0.3s ease' } : undefined}
            data-testid="copy-button"
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              'Copy to Clipboard'
            )}
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 shadow-sm transition-colors flex items-center gap-1.5"
            data-testid="download-button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download .sql
          </button>
        </div>

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 rounded-none" data-testid="export-warnings">
            <div className="flex items-start gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1">Warnings</p>
                <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* DDL output — dark code editor */}
        <div className="flex-1 overflow-auto p-4">
          {ddlLines.length > 0 ? (
            <div
              className="bg-gray-900 rounded-lg border border-gray-700 overflow-auto text-sm font-mono"
              data-testid="ddl-output"
            >
              <table className="w-full">
                <tbody>
                  {ddlLines.map((line, i) => (
                    <tr key={i} className="hover:bg-gray-800/50">
                      <td className="pl-4 pr-3 py-[1px] text-right text-gray-600 select-none w-[1%] whitespace-nowrap border-r border-gray-700/50">
                        {i + 1}
                      </td>
                      <td className="pl-4 pr-4 py-[1px] text-gray-100 whitespace-pre">
                        {line || '\u00A0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg p-6 text-center" data-testid="ddl-output">
              <p className="text-gray-500 font-mono text-sm">-- No entities to export</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
