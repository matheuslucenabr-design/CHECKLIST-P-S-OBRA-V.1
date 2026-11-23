import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearActiveAuditId,
  deleteAudit,
  getActiveAuditId,
  getAllAudits,
  saveAudit,
  setActiveAuditId,
} from './storage/auditDb';
import {
  AuditInspection,
  createEmptyAudit,
  createId,
  normalizePole,
} from './types/audit';
import { AuditFormView } from './components/AuditFormView';
import { HistoryView } from './components/HistoryView';
import { AnalyticsView } from './components/AnalyticsView';
import { EvidenceView } from './components/EvidenceView';

type AppTab = 'checklist' | 'history' | 'analytics' | 'evidence';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('checklist');
  const [audits, setAudits] = useState<AuditInspection[]>([]);
  const [currentAudit, setCurrentAudit] = useState<AuditInspection>(() => createEmptyAudit());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const currentAuditRef = useRef<AuditInspection>(currentAudit);
  currentAuditRef.current = currentAudit;

  const loadFromDevice = useCallback(async () => {
    setIsLoading(true);
    try {
      const rawStored = await getAllAudits();
      const stored = rawStored.map((a) => ({
        ...a,
        poles: (a.poles ?? []).map((p) => normalizePole(p)),
      }));
      setAudits(stored);
      const activeId = getActiveAuditId();
      if (activeId) {
        const match = stored.find((a) => a.id === activeId);
        if (match) {
          setCurrentAudit(match);
          setIsLoading(false);
          return;
        }
      }
      if (stored.length > 0) {
        setCurrentAudit(stored[0]);
        setActiveAuditId(stored[0].id);
      } else {
        const fresh = createEmptyAudit();
        setCurrentAudit(fresh);
        setActiveAuditId(fresh.id);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFromDevice();
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [loadFromDevice]);

  const persistAudit = useCallback(async (target: AuditInspection) => {
    setIsSaving(true);
    try {
      const saved = await saveAudit(target);
      setAudits((prev) => {
        const without = prev.filter((item) => item.id !== saved.id);
        return [saved, ...without].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
      setLastSavedAt(new Date().toLocaleTimeString('pt-BR'));
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleAuditChange = useCallback(
    (updated: AuditInspection) => {
      setCurrentAudit(updated);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void persistAudit(updated);
      }, 450);
    },
    [persistAudit]
  );

  const handleSaveNow = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persistAudit(currentAuditRef.current);
  }, [persistAudit]);

  const handleCreateNew = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const fresh = createEmptyAudit();
    setCurrentAudit(fresh);
    setActiveAuditId(fresh.id);
    setLastSavedAt(null);
    setActiveTab('checklist');
  }, []);

  const handleOpenAudit = useCallback(
    (id: string) => {
      const found = audits.find((a) => a.id === id);
      if (!found) return;
      setCurrentAudit(found);
      setActiveAuditId(found.id);
      setActiveTab('checklist');
    },
    [audits]
  );

  const handleDuplicateAudit = useCallback(
    async (source: AuditInspection) => {
      const nowIso = new Date().toISOString();
      const copy: AuditInspection = {
        ...source,
        id: createId('aud'),
        createdAt: nowIso,
        updatedAt: nowIso,
        projeto: source.projeto ? `${source.projeto} (Cópia)` : 'Cópia de Auditoria',
      };
      await persistAudit(copy);
      setCurrentAudit(copy);
      setActiveAuditId(copy.id);
      setActiveTab('checklist');
    },
    [persistAudit]
  );

  const handleDeleteAudit = useCallback(
    async (id: string) => {
      await deleteAudit(id);
      const remaining = audits.filter((a) => a.id !== id);
      setAudits(remaining);
      if (currentAuditRef.current.id === id) {
        if (remaining.length > 0) {
          setCurrentAudit(remaining[0]);
          setActiveAuditId(remaining[0].id);
        } else {
          clearActiveAuditId();
          const fresh = createEmptyAudit();
          setCurrentAudit(fresh);
          setActiveAuditId(fresh.id);
        }
      }
    },
    [audits]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3 sm:px-6">
          {/* Zone 1: Single-line Wordmark + Version Counter */}
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className="flex items-baseline gap-2 font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 sm:text-lg"
          >
            <span className="font-mono text-[11px] font-medium lowercase text-slate-400">v.2</span>
            <span>Blindagem Audit</span>
          </button>

          {/* Zone 2: Clean single-line navigation links */}
          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex"
          >
            <button
              type="button"
              onClick={() => setActiveTab('checklist')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'checklist'
                  ? 'border-blue-700 font-semibold text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Checklist Ativo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'history'
                  ? 'border-blue-700 font-semibold text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Histórico Salvo ({audits.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'analytics'
                  ? 'border-blue-700 font-semibold text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Dados e Indicadores
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('evidence')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'evidence'
                  ? 'border-blue-700 font-semibold text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Evidências
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleCreateNew}
              className="h-9 rounded-md bg-blue-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              Nova Auditoria
            </button>
          </div>
        </div>

        {/* Mobile Secondary Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-1.5 md:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              activeTab === 'checklist' ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
            }`}
          >
            Checklist
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              activeTab === 'history' ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
            }`}
          >
            Histórico ({audits.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              activeTab === 'analytics' ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
            }`}
          >
            Dados
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evidence')}
            className={`rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              activeTab === 'evidence' ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
            }`}
          >
            Evidências
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white" />
            <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" />
          </div>
        ) : activeTab === 'checklist' ? (
          <AuditFormView
            audit={currentAudit}
            onChange={handleAuditChange}
            onSaveNow={handleSaveNow}
            onCreateNew={handleCreateNew}
            lastSavedAt={lastSavedAt}
            isSaving={isSaving}
          />
        ) : activeTab === 'history' ? (
          <HistoryView
            audits={audits}
            activeAuditId={currentAudit.id}
            onOpenAudit={handleOpenAudit}
            onDuplicateAudit={handleDuplicateAudit}
            onDeleteAudit={handleDeleteAudit}
            onCreateNew={handleCreateNew}
            onRefreshList={loadFromDevice}
          />
        ) : activeTab === 'analytics' ? (
          <AnalyticsView audits={audits} />
        ) : (
          <EvidenceView audits={audits} onOpenAudit={handleOpenAudit} />
        )}
      </main>
    </div>
  );
}
