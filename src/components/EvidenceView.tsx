import React, { useMemo, useState } from 'react';
import { CameraOff, Maximize2, Search } from 'lucide-react';
import { AuditInspection, PROBLEM_OPTIONS, PhotoEvidence, formatPoleNumber } from '../types/audit';
import { computeAnalytics } from '../utils/analytics';
import { PhotoLightbox } from './PhotoLightbox';
import { StatusText } from './StatusText';

interface EvidenceViewProps {
  audits: AuditInspection[];
  onOpenAudit: (id: string) => void;
}

export function EvidenceView({ audits, onOpenAudit }: EvidenceViewProps) {
  const [search, setSearch] = useState('');
  const [problemFilter, setProblemFilter] = useState('ALL');
  const [photoFilter, setPhotoFilter] = useState<'ALL' | 'WITH_PHOTOS' | 'NO_PHOTOS'>('ALL');
  const [lightbox, setLightbox] = useState<{ photo: PhotoEvidence; caption: string } | null>(null);

  const summary = useMemo(() => computeAnalytics(audits), [audits]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summary.evidenceRecords.filter((rec) => {
      if (photoFilter === 'WITH_PHOTOS' && rec.photos.length === 0) return false;
      if (photoFilter === 'NO_PHOTOS' && rec.photos.length > 0) return false;
      if (
        problemFilter !== 'ALL' &&
        !rec.problems.some((pr) => pr.problem === problemFilter)
      ) {
        return false;
      }
      if (q) {
        const matchText =
          rec.projeto.toLowerCase().includes(q) ||
          rec.bairro.toLowerCase().includes(q) ||
          rec.poleId.toLowerCase().includes(q) ||
          rec.fiscalObra.toLowerCase().includes(q) ||
          rec.problems.some((pr) => pr.problem.toLowerCase().includes(q));
        if (!matchText) return false;
      }
      return true;
    });
  }, [summary.evidenceRecords, search, problemFilter, photoFilter]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
          Matriz de Evidências Fotográficas
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Rastreabilidade completa entre cada poste inspecionado, os problemas registrados e suas fotos comprobatórias.
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID do poste, projeto, bairro..."
            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <select
          value={problemFilter}
          onChange={(e) => setProblemFilter(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
        >
          <option value="ALL">Todos os problemas</option>
          {PROBLEM_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setPhotoFilter('ALL')}
            className={`flex-1 rounded py-1.5 text-xs font-semibold transition-colors ${
              photoFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({summary.evidenceRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setPhotoFilter('WITH_PHOTOS')}
            className={`flex-1 rounded py-1.5 text-xs font-semibold transition-colors ${
              photoFilter === 'WITH_PHOTOS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Com Fotos
          </button>
          <button
            type="button"
            onClick={() => setPhotoFilter('NO_PHOTOS')}
            className={`flex-1 rounded py-1.5 text-xs font-semibold transition-colors ${
              photoFilter === 'NO_PHOTOS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sem Fotos
          </button>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">Nenhum registro de evidência encontrado.</p>
          <p className="mt-1 text-xs text-slate-500">
            Ajuste os filtros acima ou anexe fotos nos postes durante o checklist de campo.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((rec) => (
            <article
              key={`${rec.auditId}_${rec.poleNumber}`}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Poste {formatPoleNumber(rec.poleNumber)} — {rec.poleId}
                    </h2>
                    <span className="text-slate-300" aria-hidden="true">|</span>
                    <StatusText status={rec.poleStatus} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Projeto: {rec.projeto} · Bairro: {rec.bairro} · Tipo: {rec.poleType} · Caixas: {rec.shieldingBoxCount} · Fiscal: {rec.fiscalObra}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenAudit(rec.auditId)}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  Abrir Inspeção
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <h3 className="mb-2 text-xs font-semibold text-slate-700">
                    Problemas Registrados ({rec.problems.length})
                  </h3>
                  {rec.problems.length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhuma irregularidade apontada neste poste.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                      {rec.problems.map((pr, prIdx) => (
                        <li key={`${pr.id}_${prIdx}`} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                          <span className="font-medium text-slate-800">
                            {pr.source === 'caixa' && (
                              <span className="mr-1.5 font-mono text-[11px] font-semibold text-blue-700">
                                [{pr.sourceLabel}]
                              </span>
                            )}
                            {pr.problem}
                            {pr.note ? <span className="text-slate-500"> — {pr.note}</span> : null}
                          </span>
                          <span className="font-mono font-semibold text-slate-700 tabular-nums shrink-0">
                            Qtd: {pr.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {rec.observation && (
                    <p className="mt-2.5 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Obs:</span> {rec.observation}
                    </p>
                  )}
                </div>

                <div className="lg:col-span-7">
                  <h3 className="mb-2 font-mono text-xs font-semibold text-slate-700 tabular-nums">
                    Evidências ({rec.photos.length}/4 fotos)
                  </h3>
                  {rec.photos.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-xs text-slate-500">
                      <CameraOff className="h-4 w-4 text-slate-400" />
                      <span>Nenhuma foto anexada a este poste até o momento.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {rec.photos.map((photo, idx) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() =>
                            setLightbox({
                              photo,
                              caption: `${rec.projeto} · Poste ${formatPoleNumber(rec.poleNumber)} (${rec.poleId}) — Foto ${idx + 1}`,
                            })
                          }
                          className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-100 text-left"
                        >
                          <div className="aspect-[4/3] w-full overflow-hidden">
                            <img
                              src={photo.dataUrl}
                              alt={`Evidência ${idx + 1} do Poste ${formatPoleNumber(rec.poleNumber)}`}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          </div>
                          <div className="flex items-center justify-between bg-white px-2 py-1.5 text-[11px] font-mono text-slate-600">
                            <span>Foto {idx + 1}</span>
                            <Maximize2 className="h-3 w-3 text-slate-400 group-hover:text-blue-700" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <PhotoLightbox
        photo={lightbox?.photo ?? null}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
