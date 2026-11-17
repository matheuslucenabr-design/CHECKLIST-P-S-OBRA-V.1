import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Filter } from 'lucide-react';
import { AuditInspection } from '../types/audit';
import { computeAnalytics, formatMinutesDuration } from '../utils/analytics';
import { exportConsolidatedExcel } from '../utils/exportReports';
import { StatusText } from './StatusText';

interface AnalyticsViewProps {
  audits: AuditInspection[];
}

export function AnalyticsView({ audits }: AnalyticsViewProps) {
  const [filterProjeto, setFilterProjeto] = useState<string>('ALL');
  const [filterBairro, setFilterBairro] = useState<string>('ALL');
  const [filterFiscal, setFilterFiscal] = useState<string>('ALL');

  const projetos = useMemo(
    () => Array.from(new Set(audits.map((a) => a.projeto.trim()).filter(Boolean))).sort(),
    [audits]
  );
  const bairros = useMemo(
    () => Array.from(new Set(audits.map((a) => a.bairro.trim()).filter(Boolean))).sort(),
    [audits]
  );
  const fiscais = useMemo(
    () => Array.from(new Set(audits.map((a) => a.fiscalObra.trim()).filter(Boolean))).sort(),
    [audits]
  );

  const filteredAudits = useMemo(() => {
    return audits.filter((a) => {
      if (filterProjeto !== 'ALL' && a.projeto.trim() !== filterProjeto) return false;
      if (filterBairro !== 'ALL' && a.bairro.trim() !== filterBairro) return false;
      if (filterFiscal !== 'ALL' && a.fiscalObra.trim() !== filterFiscal) return false;
      return true;
    });
  }, [audits, filterProjeto, filterBairro, filterFiscal]);

  const stats = useMemo(() => computeAnalytics(filteredAudits), [filteredAudits]);
  const maxProblemQty = Math.max(1, ...stats.problemStats.map((p) => p.totalQuantity));

  return (
    <div className="space-y-6">
      {/* Header & Export */}
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
            Dados e Indicadores das Inspeções
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Consolidação estatística gerada automaticamente a partir dos checklists salvos neste dispositivo.
          </p>
        </div>

        <button
          type="button"
          disabled={filteredAudits.length === 0}
          onClick={() => exportConsolidatedExcel(filteredAudits)}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Exportar Dados Consolidados (Excel)</span>
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 pb-2.5">
            <Filter className="h-4 w-4 text-slate-500" />
            <span>Filtros:</span>
          </div>

          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Projeto</span>
            <select
              value={filterProjeto}
              onChange={(e) => setFilterProjeto(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="ALL">Todos os projetos</option>
              {projetos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Bairro</span>
            <select
              value={filterBairro}
              onChange={(e) => setFilterBairro(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="ALL">Todos os bairros</option>
              {bairros.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Fiscal da Obra</span>
            <select
              value={filterFiscal}
              onChange={(e) => setFilterFiscal(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="ALL">Todos os fiscais</option>
              {fiscais.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          {(filterProjeto !== 'ALL' || filterBairro !== 'ALL' || filterFiscal !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setFilterProjeto('ALL');
                setFilterBairro('ALL');
                setFilterFiscal('ALL');
              }}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Auditorias Realizadas</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {stats.totalAudits}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            Tempo médio: {formatMinutesDuration(stats.avgInspectionMinutes)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Postes Inspecionados</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {stats.totalPoles}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            {stats.conformingPoles} conformes · {stats.nonConformingPoles} c/ pendência
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Ocorrências Registradas</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {stats.totalOccurrences}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            Qtd. acumulada de itens: {stats.totalProblemQuantity}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Taxa de Conformidade</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {stats.complianceRate}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Postes sem não conformidades abertas
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Evidências Fotográficas</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {stats.totalPhotos}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            {stats.evidenceCoverageRate}% dos postes com foto
          </p>
        </div>
      </div>

      {/* Pareto / Ranking of the 15 Problem Types */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Ranking de Problemas Identificados (Lista Padrão)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Frequência e quantidade total apontada por categoria de falha na blindagem de rede.
          </p>
        </div>

        <div className="divide-y divide-slate-100 p-5">
          {stats.problemStats.map((item) => {
            const pct = stats.totalProblemQuantity > 0 ? Math.round((item.totalQuantity / maxProblemQty) * 100) : 0;
            return (
              <div key={item.problem} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-900">{item.problem}</span>
                  <div className="flex items-center gap-3 font-mono text-slate-600 tabular-nums">
                    <span>{item.occurrences} reg.</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.polesAffected} poste(s)</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-slate-900">Qtd: {item.totalQuantity}</span>
                  </div>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-sm bg-slate-100">
                  <div
                    className="h-full bg-blue-700 transition-all duration-300"
                    style={{ width: `${item.totalQuantity === 0 ? 0 : Math.max(2, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Breakdown Tables: Neighborhood & Status + Pole Types */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Consolidado por Bairro
            </h2>
          </div>
          {stats.neighborhoodStats.length === 0 ? (
            <p className="p-5 text-xs text-slate-500">Sem dados disponíveis para os filtros selecionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="px-4 py-3">Bairro</th>
                    <th className="px-4 py-3 text-right">Auditorias</th>
                    <th className="px-4 py-3 text-right">Postes</th>
                    <th className="px-4 py-3 text-right">Ocorrências</th>
                    <th className="px-4 py-3 text-right">Conformidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {stats.neighborhoodStats.map((row) => (
                    <tr key={row.bairro} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{row.bairro}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{row.audits}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{row.poles}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {row.occurrences}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                        {row.complianceRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Situação dos Apontamentos e Tipos de Poste
            </h2>
          </div>

          <div className="divide-y divide-slate-200">
            <div className="p-5">
              <h3 className="mb-3 text-xs font-semibold text-slate-700">Status dos Postes</h3>
              {stats.statusStats.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum poste registrado.</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.statusStats.map((st) => (
                    <div key={st.status} className="flex items-center justify-between text-xs">
                      <StatusText status={st.status} />
                      <span className="font-mono text-slate-700 tabular-nums">
                        {st.count} poste(s) · Qtd. problemas: {st.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5">
              <h3 className="mb-3 text-xs font-semibold text-slate-700">Distribuição por Tipo de Poste</h3>
              {stats.poleTypeStats.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum poste registrado.</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.poleTypeStats.map((pt) => (
                    <div key={pt.type} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{pt.type}</span>
                      <span className="font-mono text-slate-600 tabular-nums">
                        {pt.count} poste(s) · {pt.occurrences} problema(s)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
