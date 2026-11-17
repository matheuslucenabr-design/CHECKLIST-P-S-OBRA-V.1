import React, { useRef, useState } from 'react';
import {
  Camera,
  Check,
  Clock,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  ListChecks,
  Maximize2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AuditInspection,
  MAX_PHOTOS_PER_POLE,
  MAX_POLES,
  POLE_STATUS_OPTIONS,
  POLE_TYPE_OPTIONS,
  PROBLEM_OPTIONS,
  PhotoEvidence,
  PoleInspection,
  PoleProblem,
  PoleStatus,
  createEmptyPole,
  createEmptyProblem,
  formatPoleNumber,
} from '../types/audit';
import { compressImageFile } from '../storage/auditDb';
import { formatMinutesDuration, parseTimeToMinutes } from '../utils/analytics';
import { exportAuditToExcel, exportAuditToPdf, exportAuditToWord } from '../utils/exportReports';
import { PhotoLightbox } from './PhotoLightbox';
import { StatusText } from './StatusText';

interface AuditFormViewProps {
  audit: AuditInspection;
  onChange: (updated: AuditInspection) => void;
  onSaveNow: () => Promise<void>;
  onCreateNew: () => void;
  lastSavedAt: string | null;
  isSaving: boolean;
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function AuditFormView({
  audit,
  onChange,
  onSaveNow,
  onCreateNew,
  lastSavedAt,
  isSaving,
}: AuditFormViewProps) {
  const [activePoleIndex, setActivePoleIndex] = useState(0);
  const [multiSelectOpen, setMultiSelectOpen] = useState(false);
  const [selectedBatchProblems, setSelectedBatchProblems] = useState<string[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ photo: PhotoEvidence; caption: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const [exportBusy, setExportBusy] = useState<'pdf' | 'excel' | 'word' | null>(null);
  const [confirmRemovePoleIdx, setConfirmRemovePoleIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const safePoleIndex = Math.min(activePoleIndex, Math.max(0, audit.poles.length - 1));
  const activePole: PoleInspection = audit.poles[safePoleIndex] ?? createEmptyPole(1);

  const updateField = <K extends keyof AuditInspection>(field: K, value: AuditInspection[K]) => {
    onChange({
      ...audit,
      [field]: value,
    });
  };

  const updatePole = (index: number, updater: (pole: PoleInspection) => PoleInspection) => {
    const nextPoles = audit.poles.map((p, idx) => (idx === index ? updater(p) : p));
    onChange({
      ...audit,
      poles: nextPoles,
    });
  };

  const handleAddPole = () => {
    if (audit.poles.length >= MAX_POLES) {
      setFeedbackMsg({
        type: 'error',
        text: `Limite máximo atingido: cada inspeção suporta até ${MAX_POLES} postes.`,
      });
      return;
    }
    const nextNumber = audit.poles.length + 1;
    const nextPoles = [...audit.poles, createEmptyPole(nextNumber)];
    onChange({ ...audit, poles: nextPoles });
    setActivePoleIndex(nextPoles.length - 1);
    setConfirmRemovePoleIdx(null);
    setFeedbackMsg(null);
  };

  const handleRemovePole = (idxToRemove: number) => {
    if (audit.poles.length <= 1) {
      const resetPoles = [createEmptyPole(1)];
      onChange({ ...audit, poles: resetPoles });
      setActivePoleIndex(0);
      setConfirmRemovePoleIdx(null);
      return;
    }
    const filtered = audit.poles
      .filter((_, idx) => idx !== idxToRemove)
      .map((p, idx) => ({ ...p, number: idx + 1 }));
    onChange({ ...audit, poles: filtered });
    setActivePoleIndex(Math.max(0, Math.min(safePoleIndex, filtered.length - 1)));
    setConfirmRemovePoleIdx(null);
  };

  const handleAddProblemRow = () => {
    updatePole(safePoleIndex, (pole) => {
      const usedSet = new Set(pole.problems.map((p) => p.problem));
      const nextDefault = PROBLEM_OPTIONS.find((opt) => !usedSet.has(opt)) ?? PROBLEM_OPTIONS[0];
      const nextProblems = [...pole.problems, createEmptyProblem(nextDefault)];
      const nextStatus: PoleStatus = pole.status === 'Conforme' ? 'Não Conforme' : pole.status;
      return {
        ...pole,
        status: nextStatus,
        problems: nextProblems,
      };
    });
  };

  const handleApplyBatchProblems = () => {
    if (selectedBatchProblems.length === 0) {
      setMultiSelectOpen(false);
      return;
    }
    updatePole(safePoleIndex, (pole) => {
      const existingNames = new Set(pole.problems.map((p) => p.problem));
      const additions = selectedBatchProblems
        .filter((name) => !existingNames.has(name))
        .map((name) => createEmptyProblem(name));
      const nextProblems = [...pole.problems, ...additions];
      return {
        ...pole,
        status: nextProblems.length > 0 && pole.status === 'Conforme' ? 'Não Conforme' : pole.status,
        problems: nextProblems,
      };
    });
    setSelectedBatchProblems([]);
    setMultiSelectOpen(false);
  };

  const handleUpdateProblem = (problemId: string, patch: Partial<PoleProblem>) => {
    updatePole(safePoleIndex, (pole) => {
      const nextProblems = pole.problems.map((pr) => (pr.id === problemId ? { ...pr, ...patch } : pr));
      return {
        ...pole,
        problems: nextProblems,
      };
    });
  };

  const handleRemoveProblem = (problemId: string) => {
    updatePole(safePoleIndex, (pole) => {
      const nextProblems = pole.problems.filter((pr) => pr.id !== problemId);
      const nextStatus: PoleStatus =
        nextProblems.length === 0 && pole.status === 'Não Conforme' ? 'Conforme' : pole.status;
      return {
        ...pole,
        status: nextStatus,
        problems: nextProblems,
      };
    });
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = MAX_PHOTOS_PER_POLE - activePole.photos.length;
    if (remainingSlots <= 0) {
      setFeedbackMsg({
        type: 'error',
        text: `Este poste já possui o limite de ${MAX_PHOTOS_PER_POLE} fotos.`,
      });
      return;
    }

    const fileArray = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setFeedbackMsg({
        type: 'info',
        text: `Apenas ${remainingSlots} foto(s) adicionada(s) para respeitar o máximo de ${MAX_PHOTOS_PER_POLE} fotos por poste.`,
      });
    } else {
      setFeedbackMsg(null);
    }

    setPhotoBusy(true);
    try {
      const compressed: PhotoEvidence[] = [];
      for (const file of fileArray) {
        if (!file.type.startsWith('image/')) continue;
        const item = await compressImageFile(file);
        compressed.push(item);
      }
      if (compressed.length > 0) {
        updatePole(safePoleIndex, (pole) => ({
          ...pole,
          photos: [...pole.photos, ...compressed].slice(0, MAX_PHOTOS_PER_POLE),
        }));
      }
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'Não foi possível processar uma das imagens selecionadas.',
      });
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    updatePole(safePoleIndex, (pole) => ({
      ...pole,
      photos: pole.photos.filter((ph) => ph.id !== photoId),
    }));
  };

  const handleExport = async (format: 'pdf' | 'excel' | 'word') => {
    setExportBusy(format);
    setFeedbackMsg(null);
    try {
      await onSaveNow();
      if (format === 'pdf') {
        exportAuditToPdf(audit);
      } else if (format === 'excel') {
        exportAuditToExcel(audit);
      } else {
        await exportAuditToWord(audit);
      }
      setFeedbackMsg({
        type: 'info',
        text: `Relatório em ${format.toUpperCase()} gerado e iniciado o download.`,
      });
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: `Erro ao gerar relatório em ${format.toUpperCase()}. Verifique os dados preenchidos e tente novamente.`,
      });
    } finally {
      setExportBusy(null);
    }
  };

  const startMin = parseTimeToMinutes(audit.inicioVistoria);
  const endMin = parseTimeToMinutes(audit.finalVistoria);
  const vistoriaDuration =
    startMin !== null && endMin !== null && endMin >= startMin ? formatMinutesDuration(endMin - startMin) : '—';

  const totalProblemsCount = audit.poles.reduce((acc, p) => acc + p.problems.length, 0);
  const totalPhotosCount = audit.poles.reduce((acc, p) => acc + p.photos.length, 0);

  return (
    <div className="space-y-6">
      {/* Top Action & Export Strip */}
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
            Auditoria Pós-Obra Blindagem de Rede
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
            <span className="font-mono tabular-nums">{audit.poles.length}/{MAX_POLES} postes</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{totalProblemsCount} ocorrências</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{totalPhotosCount} fotos</span>
            <span aria-hidden="true">·</span>
            <span>
              {isSaving
                ? 'Salvando no navegador...'
                : lastSavedAt
                  ? `Salvo no dispositivo às ${lastSavedAt}`
                  : 'Armazenamento local ativo'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onSaveNow()}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Save className="h-4 w-4 text-slate-600" />
            <span>Salvar Rascunho</span>
          </button>

          <button
            type="button"
            onClick={() => void handleExport('pdf')}
            disabled={exportBusy !== null}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <FileText className="h-4 w-4" />
            <span>{exportBusy === 'pdf' ? 'Gerando PDF...' : 'Baixar PDF'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleExport('excel')}
            disabled={exportBusy !== null}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-700 bg-emerald-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{exportBusy === 'excel' ? 'Gerando Excel...' : 'Baixar Excel'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleExport('word')}
            disabled={exportBusy !== null}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <FileText className="h-4 w-4" />
            <span>{exportBusy === 'word' ? 'Gerando Word...' : 'Baixar Word'}</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            feedbackMsg.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-blue-200 bg-blue-50 text-blue-900'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-semibold underline hover:no-underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Section 1: Project Identification & Timestamps */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            01. Identificação da Obra e Cronologia de Campo
          </h2>
        </div>

        <div className="space-y-6 p-5">
          {/* Primary Identification Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Projeto</span>
              <input
                type="text"
                value={audit.projeto}
                onChange={(e) => updateField('projeto', e.target.value)}
                placeholder="Ex: RDU-26-0000"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Bairro</span>
              <input
                type="text"
                value={audit.bairro}
                onChange={(e) => updateField('bairro', e.target.value)}
                placeholder="Ex: JAPIIM"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Data de Execução</span>
              <input
                type="date"
                value={audit.dataExecucao}
                onChange={(e) => updateField('dataExecucao', e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Fiscal da Obra</span>
              <input
                type="text"
                value={audit.fiscalObra}
                onChange={(e) => updateField('fiscalObra', e.target.value)}
                placeholder="Nome do fiscal"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Revalidador</span>
              <input
                type="text"
                value={audit.revalidador}
                onChange={(e) => updateField('revalidador', e.target.value)}
                placeholder="Nome do revalidador"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </label>
          </div>

          {/* Operational Timestamps */}
          <div className="border-t border-slate-100 pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-700">Horários da Auditoria</h3>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                Duração da vistoria: {vistoriaDuration}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Chegada</span>
                <div className="flex gap-1.5">
                  <input
                    type="time"
                    value={audit.chegada}
                    onChange={(e) => updateField('chegada', e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateField('chegada', getCurrentTimeHHMM())}
                    title="Preencher com horário atual"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Revisão Projeto (Início às Fim)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={audit.revisaoProjetoInicio}
                    onChange={(e) => updateField('revisaoProjetoInicio', e.target.value)}
                    aria-label="Início da revisão de projeto"
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                  <span className="text-xs font-medium text-slate-500">às</span>
                  <input
                    type="time"
                    value={audit.revisaoProjetoFim}
                    onChange={(e) => updateField('revisaoProjetoFim', e.target.value)}
                    aria-label="Fim da revisão de projeto"
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Desembarque</span>
                <div className="flex gap-1.5">
                  <input
                    type="time"
                    value={audit.desembarque}
                    onChange={(e) => updateField('desembarque', e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateField('desembarque', getCurrentTimeHHMM())}
                    title="Preencher com horário atual"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Início de Vistoria</span>
                <div className="flex gap-1.5">
                  <input
                    type="time"
                    value={audit.inicioVistoria}
                    onChange={(e) => updateField('inicioVistoria', e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateField('inicioVistoria', getCurrentTimeHHMM())}
                    title="Preencher com horário atual"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Final de Vistoria</span>
                <div className="flex gap-1.5">
                  <input
                    type="time"
                    value={audit.finalVistoria}
                    onChange={(e) => updateField('finalVistoria', e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateField('finalVistoria', getCurrentTimeHHMM())}
                    title="Preencher com horário atual"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-6">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Embarque Saída</span>
                <div className="flex gap-1.5">
                  <input
                    type="time"
                    value={audit.embarqueSaida}
                    onChange={(e) => updateField('embarqueSaida', e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateField('embarqueSaida', getCurrentTimeHHMM())}
                    title="Preencher com horário atual"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <label className="block lg:col-span-5">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Observação Geral</span>
                <textarea
                  rows={2}
                  value={audit.observacao}
                  onChange={(e) => updateField('observacao', e.target.value)}
                  placeholder="Anotações gerais da vistoria, condições climáticas, trechos impedidos ou orientações à equipe..."
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Pole Navigator & Active Pole Checklist */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              02. Vistoria de Postes e Checklist de Problemas
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Adicione até {MAX_POLES} postes por inspeção, com múltiplos problemas e até {MAX_PHOTOS_PER_POLE} fotos de evidência em cada poste.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddPole}
            disabled={audit.poles.length >= MAX_POLES}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar Poste ({audit.poles.length}/{MAX_POLES})</span>
          </button>
        </div>

        {/* Pole Selector Tabs (01 to 25) */}
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {audit.poles.map((pole, idx) => {
              const isActive = idx === safePoleIndex;
              const hasIssues = pole.problems.length > 0;
              return (
                <button
                  key={pole.number}
                  type="button"
                  onClick={() => {
                    setActivePoleIndex(idx);
                    setConfirmRemovePoleIdx(null);
                  }}
                  className={`flex min-h-[42px] items-center gap-2 rounded-md border px-3 py-1.5 text-left transition-colors ${
                    isActive
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-mono text-xs font-semibold tabular-nums">
                    Poste {formatPoleNumber(pole.number)}
                  </span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isActive ? 'text-blue-100' : hasIssues ? 'text-red-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {pole.problems.length}p · {pole.photos.length}/{MAX_PHOTOS_PER_POLE}f
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Pole Workspace */}
        <div className="space-y-6 p-5">
          {/* Pole Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-lg font-bold text-slate-900 tabular-nums">
                Poste {formatPoleNumber(activePole.number)}
              </h3>
              <span className="text-slate-300" aria-hidden="true">|</span>
              <StatusText status={activePole.status} />
              {activePole.poleId && (
                <>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="font-mono text-xs text-slate-600">ID: {activePole.poleId}</span>
                </>
              )}
            </div>

            {confirmRemovePoleIdx === safePoleIndex ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-700">Remover este poste?</span>
                <button
                  type="button"
                  onClick={() => handleRemovePole(safePoleIndex)}
                  className="h-9 rounded-md bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemovePoleIdx(null)}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemovePoleIdx(safePoleIndex)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{audit.poles.length === 1 ? 'Limpar Poste 01' : `Remover Poste ${formatPoleNumber(activePole.number)}`}</span>
              </button>
            )}
          </div>

          {/* Pole Attributes: ID, Tipo, Status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">ID do Poste</span>
              <input
                type="text"
                value={activePole.poleId}
                onChange={(e) =>
                  updatePole(safePoleIndex, (p) => ({ ...p, poleId: e.target.value }))
                }
                placeholder="Ex: ID: 0415"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Tipo</span>
              <select
                value={POLE_TYPE_OPTIONS.includes(activePole.type as (typeof POLE_TYPE_OPTIONS)[number]) ? activePole.type : POLE_TYPE_OPTIONS[0]}
                onChange={(e) =>
                  updatePole(safePoleIndex, (p) => ({ ...p, type: e.target.value }))
                }
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {POLE_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Status do Poste</span>
              <select
                value={activePole.status}
                onChange={(e) =>
                  updatePole(safePoleIndex, (p) => ({ ...p, status: e.target.value as PoleStatus }))
                }
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {POLE_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Checklist of Problems for this Pole */}
          <div className="space-y-3 border-t border-slate-100 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Checklist de Problemas do Poste {formatPoleNumber(activePole.number)}
                </h4>
                <p className="text-xs text-slate-500">
                  Informe um ou mais problemas encontrados neste poste com quantidade e detalhe opcional.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMultiSelectOpen((prev) => !prev);
                    setSelectedBatchProblems([]);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  <ListChecks className="h-4 w-4 text-blue-700" />
                  <span>{multiSelectOpen ? 'Fechar Seleção Múltipla' : 'Marcar Vários Problemas'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddProblemRow}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  <span>Adicionar Problema</span>
                </button>
              </div>
            </div>

            {/* Quick Multi-Select Checklist Panel */}
            {multiSelectOpen && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-800">
                    Selecione os problemas identificados neste poste para adicionar de uma vez:
                  </p>
                  <button
                    type="button"
                    onClick={handleApplyBatchProblems}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    <Check className="h-4 w-4" />
                    <span>Aplicar Selecionados ({selectedBatchProblems.length})</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {PROBLEM_OPTIONS.map((opt) => {
                    const alreadyAdded = activePole.problems.some((p) => p.problem === opt);
                    const checked = selectedBatchProblems.includes(opt);
                    return (
                      <label
                        key={opt}
                        className={`flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-xs transition-colors ${
                          alreadyAdded
                            ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                            : checked
                              ? 'border-blue-600 bg-white font-semibold text-blue-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={alreadyAdded}
                          checked={alreadyAdded || checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBatchProblems((prev) => [...prev, opt]);
                            } else {
                              setSelectedBatchProblems((prev) => prev.filter((item) => item !== opt));
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                        />
                        <span className="leading-tight">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Problem Rows List */}
            {activePole.problems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Nenhum problema registrado para o Poste {formatPoleNumber(activePole.number)}.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Caso o poste esteja conforme o padrão, mantenha sem problemas ou adicione uma não conformidade acima.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {activePole.problems.map((prob, pIdx) => (
                  <div
                    key={prob.id}
                    className="grid grid-cols-1 gap-3 bg-white p-3.5 lg:grid-cols-12 lg:items-end"
                  >
                    <div className="lg:col-span-6">
                      <label className="block">
                        <span className="mb-1 block font-mono text-[11px] font-semibold text-slate-500">
                          PROBLEMA #{String(pIdx + 1).padStart(2, '0')}
                        </span>
                        <select
                          value={prob.problem}
                          onChange={(e) => handleUpdateProblem(prob.id, { problem: e.target.value })}
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                        >
                          {PROBLEM_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="lg:col-span-2">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                        QUANTIDADE
                      </span>
                      <div className="flex h-10 items-center overflow-hidden rounded-md border border-slate-300">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateProblem(prob.id, {
                              quantity: Math.max(1, prob.quantity - 1),
                            })
                          }
                          className="flex h-full w-9 items-center justify-center bg-slate-50 text-sm font-bold text-slate-700 hover:bg-slate-100"
                          aria-label="Diminuir quantidade"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={prob.quantity}
                          onChange={(e) =>
                            handleUpdateProblem(prob.id, {
                              quantity: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="h-full w-full border-x border-slate-200 bg-white text-center font-mono text-sm font-semibold text-slate-900 tabular-nums focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateProblem(prob.id, { quantity: prob.quantity + 1 })
                          }
                          className="flex h-full w-9 items-center justify-center bg-slate-50 text-sm font-bold text-slate-700 hover:bg-slate-100"
                          aria-label="Aumentar quantidade"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="lg:col-span-3">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                          DETALHE (OPCIONAL)
                        </span>
                        <input
                          type="text"
                          value={prob.note ?? ''}
                          onChange={(e) => handleUpdateProblem(prob.id, { note: e.target.value })}
                          placeholder="Ex: instalado de forma incorreta"
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                        />
                      </label>
                    </div>

                    <div className="flex justify-end lg:col-span-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveProblem(prob.id)}
                        title="Remover problema"
                        className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pole Specific Observation */}
          <div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                Observação do Poste {formatPoleNumber(activePole.number)}
              </span>
              <input
                type="text"
                value={activePole.observation}
                onChange={(e) =>
                  updatePole(safePoleIndex, (p) => ({ ...p, observation: e.target.value }))
                }
                placeholder="Detalhes específicos deste poste, localização ou referência..."
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </label>
          </div>

          {/* Photographic Evidence (Up to 4 photos per pole) */}
          <div className="space-y-3 border-t border-slate-100 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Evidências Fotográficas — Poste {formatPoleNumber(activePole.number)}
                </h4>
                <p className="font-mono text-xs text-slate-500 tabular-nums">
                  {activePole.photos.length} de {MAX_PHOTOS_PER_POLE} fotos anexadas
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleFilesSelected(e.target.files)}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void handleFilesSelected(e.target.files)}
                />

                <button
                  type="button"
                  disabled={photoBusy || activePole.photos.length >= MAX_PHOTOS_PER_POLE}
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Camera className="h-4 w-4 text-blue-700" />
                  <span>Tirar Foto</span>
                </button>

                <button
                  type="button"
                  disabled={photoBusy || activePole.photos.length >= MAX_PHOTOS_PER_POLE}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-700 px-3.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Upload className="h-4 w-4" />
                  <span>{photoBusy ? 'Processando...' : 'Enviar Fotos'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {activePole.photos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200">
                    <img
                      src={photo.dataUrl}
                      alt={`Evidência ${idx + 1} do Poste ${formatPoleNumber(activePole.number)}`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-slate-800">
                        Foto {idx + 1}/{MAX_PHOTOS_PER_POLE}
                      </p>
                      <p className="truncate font-mono text-[11px] text-slate-500 tabular-nums">
                        {new Date(photo.capturedAt).toLocaleTimeString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxPhoto({
                            photo,
                            caption: `Poste ${formatPoleNumber(activePole.number)} (${activePole.poleId || 'Sem ID'}) — Foto ${idx + 1}`,
                          })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        aria-label="Ampliar foto"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(photo.id)}
                        className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                        aria-label="Excluir foto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {Array.from({ length: Math.max(0, MAX_PHOTOS_PER_POLE - activePole.photos.length) }).map(
                (_, slotIdx) => (
                  <button
                    key={`empty-slot-${slotIdx}`}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoBusy}
                    className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-500 transition-colors hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-700"
                  >
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-xs font-medium">
                      Adicionar Foto {activePole.photos.length + slotIdx + 1}/{MAX_PHOTOS_PER_POLE}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Summary Table of All Poles in Current Inspection */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              03. Resumo dos Postes Nesta Inspeção
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Clique em qualquer linha para editar o poste correspondente ou gere os relatórios para download.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Iniciar Nova Inspeção em Branco</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Poste</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Problemas Apontados</th>
                <th className="px-4 py-3 text-right">Qtd. Total</th>
                <th className="px-4 py-3 text-right">Fotos</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {audit.poles.map((pole, idx) => {
                const totalQty = pole.problems.reduce((sum, p) => sum + p.quantity, 0);
                const isSelected = idx === safePoleIndex;
                return (
                  <tr
                    key={pole.number}
                    onClick={() => setActivePoleIndex(idx)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      Poste {formatPoleNumber(pole.number)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {pole.poleId || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                      {pole.type || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {pole.problems.length === 0
                        ? 'Sem não conformidades'
                        : pole.problems.map((pr) => `${pr.problem} (${pr.quantity})`).join(' · ')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {totalQty}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {pole.photos.length}/{MAX_PHOTOS_PER_POLE}
                    </td>
                    <td className="px-4 py-3">
                      <StatusText status={pole.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <PhotoLightbox
        photo={lightboxPhoto?.photo ?? null}
        caption={lightboxPhoto?.caption}
        onClose={() => setLightboxPhoto(null)}
      />
    </div>
  );
}
