import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { AuditInspection } from '../types/audit';
import { computeAnalytics } from '../utils/analytics';
import { exportAuditToExcel, exportAuditToPdf, exportAuditToWord } from '../utils/exportReports';
import { exportBackupJson, importBackupJson } from '../storage/auditDb';

interface HistoryViewProps {
  audits: AuditInspection[];
  activeAuditId: string;
  onOpenAudit: (id: string) => void;
  onDuplicateAudit: (audit: AuditInspection) => Promise<void>;
  onDeleteAudit: (id: string) => Promise<void>;
  onCreateNew: () => void;
  onRefreshList: () => Promise<void>;
}

export function HistoryView({
  audits,
  activeAuditId,
  onOpenAudit,
  onDuplicateAudit,
  onDeleteAudit,
  onCreateNew,
  onRefreshList,
}: HistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const filteredAudits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return audits;
    return audits.filter((a) => {
      return (
        a.projeto.toLowerCase().includes(q) ||
        a.bairro.toLowerCase().includes(q) ||
        a.fiscalObra.toLowerCase().includes(q) ||
        a.revalidador.toLowerCase().includes(q) ||
        a.dataExecucao.toLowerCase().includes(q)
      );
    });
  }, [audits, searchQuery]);

  const handleImportBackup = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const count = await importBackupJson(files[0]);
      await onRefreshList();
      setStatusNote(`${count} auditoria(s) importada(s) com sucesso para este dispositivo.`);
    } catch {
      setStatusNote('Arquivo de backup inválido. Selecione um JSON exportado por este sistema.');
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  const handleWordDownload = async (audit: AuditInspection) => {
    setBusyId(audit.id);
    try {
      await exportAuditToWord(audit);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
            Histórico de Auditorias Salvas no Dispositivo
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Todas as inspeções e fotos ficam armazenadas localmente no navegador deste dispositivo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void handleImportBackup(e.target.files)}
          />
          <button
            type="button"
            onClick={() => backupInputRef.current?.click()}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Upload className="h-4 w-4 text-slate-600" />
            <span>Importar Backup</span>
          </button>
          <button
            type="button"
            disabled={audits.length === 0}
            onClick={() => void exportBackupJson(audits)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4 text-slate-600" />
            <span>Exportar Backup JSON</span>
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Auditoria</span>
          </button>
        </div>
      </div>

      {statusNote && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <span>{statusNote}</span>
          <button
            type="button"
            onClick={() => setStatusNote(null)}
            className="text-xs font-semibold underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por projeto, bairro, fiscal ou data..."
            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {filteredAudits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="font-display text-base font-semibold text-slate-900">
            {audits.length === 0 ? 'Nenhuma auditoria salva ainda' : 'Nenhuma auditoria encontrada para este filtro'}
          </p>
          <p className="mt-1 max-w-md text-xs text-slate-500">
            {audits.length === 0
              ? 'Crie sua primeira auditoria pós-obra para começar a registrar postes, problemas e evidências fotográficas.'
              : 'Ajuste o termo de busca ou crie uma nova inspeção.'}
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <Plus className="h-4 w-4" />
            <span>Iniciar Nova Auditoria</span>
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">Projeto / Bairro</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Fiscal / Revalidador</th>
                  <th className="px-4 py-3 text-right">Postes</th>
                  <th className="px-4 py-3 text-right">Ocorrências</th>
                  <th className="px-4 py-3 text-right">Fotos</th>
                  <th className="px-4 py-3">Downloads</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAudits.map((item) => {
                  const summary = computeAnalytics([item]);
                  const isCurrent = item.id === activeAuditId;
                  return (
                    <tr key={item.id} className={isCurrent ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900">
                          {item.projeto || 'Projeto sem nome'}
                          {isCurrent && (
                            <span className="ml-2 text-xs font-semibold text-blue-700">· Em edição</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.bairro || 'Bairro não informado'}</p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {item.dataExecucao
                          ? item.dataExecucao.split('-').reverse().join('/')
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        <p className="font-medium text-slate-800">{item.fiscalObra || '—'}</p>
                        <p className="text-slate-500">Revalidador: {item.revalidador || '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        {summary.totalPoles}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        {summary.totalOccurrences}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 tabular-nums">
                        {summary.totalPhotos}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => exportAuditToPdf(item)}
                            className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:border-blue-600 hover:text-blue-700"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => exportAuditToExcel(item)}
                            className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:border-emerald-700 hover:text-emerald-700"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            <span>Excel</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void handleWordDownload(item)}
                            className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:border-slate-900 hover:text-slate-900 disabled:opacity-50"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>{busyId === item.id ? '...' : 'Word'}</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {confirmDeleteId === item.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteAudit(item.id);
                                setConfirmDeleteId(null);
                              }}
                              className="h-8 rounded bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              Excluir
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenAudit(item.id)}
                              className="inline-flex h-8 items-center gap-1 rounded bg-blue-700 px-2.5 text-xs font-semibold text-white hover:bg-blue-800"
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                              <span>Abrir</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDuplicateAudit(item)}
                              title="Duplicar auditoria"
                              className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              title="Excluir auditoria"
                              className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
