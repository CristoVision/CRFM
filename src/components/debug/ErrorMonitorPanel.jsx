import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Copy, Trash2 } from 'lucide-react';

const MAX_ENTRIES = 25;

function ErrorMonitorPanel() {
  const [entries, setEntries] = useState([]);

  const safeId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `err_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  const pushEntry = useCallback((entry) => {
    setEntries((prev) => {
      const next = [{ ...entry, id: safeId() }, ...prev];
      return next.slice(0, MAX_ENTRIES);
    });
  }, []);

  useEffect(() => {
    const handleWindowError = (event) => {
      pushEntry({
        type: 'error',
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
        timestamp: Date.now(),
      });
    };

    const handleRejection = (event) => {
      const reason = event.reason || {};
      pushEntry({
        type: 'unhandledrejection',
        message: reason.message || 'Unhandled promise rejection',
        stack: reason.stack,
        source: 'unhandledrejection',
        context: reason,
        timestamp: Date.now(),
      });
    };

    const handleCustom = (event) => {
      pushEntry({
        type: 'custom',
        ...event.detail,
      });
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('crfm-error', handleCustom);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('crfm-error', handleCustom);
    };
  }, [pushEntry]);

  const latest = entries[0];

  const copyLatest = () => {
    if (!latest) return;
    const serialized = JSON.stringify(latest, null, 2);
    navigator.clipboard?.writeText(serialized);
  };

  const clearEntries = () => setEntries([]);

  if (!latest) return null;

  return (
    <div className="fixed bottom-6 right-3 sm:right-6 z-40 max-w-md w-[calc(100%-1.5rem)] sm:w-96">
      <div className="glass-effect-light border border-red-400/40 rounded-xl shadow-2xl p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-500/20 rounded-lg border border-red-400/40">
              <AlertCircle className="w-5 h-5 text-red-200" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-red-200">Debug</p>
              <p className="text-lg font-semibold text-white leading-tight">
                Último error del navegador
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={copyLatest}
              disabled={!latest}
              className="border-red-300 text-red-100 hover:bg-red-400/10"
            >
              <Copy className="w-4 h-4 mr-1" />
              Copiar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearEntries}
              className="text-red-100 hover:text-yellow-200"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 text-xs text-red-100/90 space-y-1">
          <div className="flex justify-between">
            <span className="font-semibold">Tipo:</span>
            <span>{latest.type}</span>
          </div>
          {latest.message && (
            <div>
              <p className="font-semibold">Mensaje</p>
              <p className="break-words text-red-50">{latest.message}</p>
            </div>
          )}
          {latest.source && (
            <div className="flex justify-between">
              <span className="font-semibold">Fuente</span>
              <span className="truncate max-w-[65%] text-right">{latest.source}</span>
            </div>
          )}
          {latest.stack && (
            <div>
              <p className="font-semibold">Stack</p>
              <pre className="whitespace-pre-wrap break-words bg-black/30 border border-red-400/20 rounded-md p-2 text-[10px] text-red-50">
                {latest.stack}
              </pre>
            </div>
          )}
          {latest.context && (
            <div>
              <p className="font-semibold">Contexto</p>
              <pre className="whitespace-pre-wrap break-words bg-black/30 border border-red-400/20 rounded-md p-2 text-[10px] text-red-50">
                {JSON.stringify(latest.context, null, 2)}
              </pre>
            </div>
          )}
          <p className="text-[10px] text-red-200/80">
            {new Date(latest.timestamp || Date.now()).toLocaleString()}
          </p>
        </div>

        {entries.length > 1 && (
          <div className="mt-3 text-[11px] text-gray-200">
            Mostrando el último error. Total capturados: {entries.length} (máx {MAX_ENTRIES}).
          </div>
        )}
      </div>
    </div>
  );
}

export default ErrorMonitorPanel;
