import {
  AuditInspection,
  CombinedProblemEntry,
  PROBLEM_OPTIONS,
  PhotoEvidence,
  PoleInspection,
  getCombinedPoleProblems,
} from '../types/audit';

export interface ProblemStat {
  problem: string;
  occurrences: number;
  totalQuantity: number;
  polesAffected: number;
  pendingCount: number;
  regularizedCount: number;
}

export interface NeighborhoodStat {
  bairro: string;
  audits: number;
  poles: number;
  occurrences: number;
  totalQuantity: number;
  photos: number;
  complianceRate: number;
}

export interface StatusStat {
  status: string;
  count: number;
  quantity: number;
}

export interface PoleTypeStat {
  type: string;
  count: number;
  occurrences: number;
}

export interface EvidenceRecord {
  auditId: string;
  projeto: string;
  bairro: string;
  dataExecucao: string;
  fiscalObra: string;
  poleNumber: number;
  poleId: string;
  poleType: string;
  poleStatus: string;
  problems: CombinedProblemEntry[];
  shieldingBoxCount: number;
  photos: PhotoEvidence[];
  observation: string;
}

export interface AuditAnalyticsSummary {
  totalAudits: number;
  totalPoles: number;
  conformingPoles: number;
  nonConformingPoles: number;
  complianceRate: number;
  totalOccurrences: number;
  totalProblemQuantity: number;
  totalPhotos: number;
  polesWithPhotos: number;
  evidenceCoverageRate: number;
  avgInspectionMinutes: number | null;
  problemStats: ProblemStat[];
  neighborhoodStats: NeighborhoodStat[];
  statusStats: StatusStat[];
  poleTypeStats: PoleTypeStat[];
  evidenceRecords: EvidenceRecord[];
}

export function parseTimeToMinutes(hhmm: string): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm.trim())) return null;
  const [hStr, mStr] = hhmm.trim().split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function formatMinutesDuration(minutes: number | null): string {
  if (minutes === null || minutes < 0) return '—';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins} min`;
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

export function isPoleConforming(pole: PoleInspection): boolean {
  return getCombinedPoleProblems(pole).length === 0 && pole.status === 'Conforme';
}

export function computeAnalytics(audits: AuditInspection[]): AuditAnalyticsSummary {
  const problemMap = new Map<
    string,
    { occurrences: number; totalQuantity: number; polesSet: Set<string>; pendingCount: number; regularizedCount: number }
  >();

  for (const opt of PROBLEM_OPTIONS) {
    problemMap.set(opt, {
      occurrences: 0,
      totalQuantity: 0,
      polesSet: new Set<string>(),
      pendingCount: 0,
      regularizedCount: 0,
    });
  }

  const bairroMap = new Map<
    string,
    { audits: number; poles: number; conforming: number; occurrences: number; totalQuantity: number; photos: number }
  >();

  const statusMap = new Map<string, { count: number; quantity: number }>();
  const poleTypeMap = new Map<string, { count: number; occurrences: number }>();
  const evidenceRecords: EvidenceRecord[] = [];

  let totalPoles = 0;
  let conformingPoles = 0;
  let totalOccurrences = 0;
  let totalProblemQuantity = 0;
  let totalPhotos = 0;
  let polesWithPhotos = 0;

  let durationSum = 0;
  let durationCount = 0;

  for (const audit of audits) {
    const startMin = parseTimeToMinutes(audit.inicioVistoria);
    const endMin = parseTimeToMinutes(audit.finalVistoria);
    if (startMin !== null && endMin !== null && endMin >= startMin) {
      durationSum += endMin - startMin;
      durationCount += 1;
    }

    const bairroKey = (audit.bairro || 'Não informado').trim() || 'Não informado';
    const bEntry = bairroMap.get(bairroKey) ?? {
      audits: 0,
      poles: 0,
      conforming: 0,
      occurrences: 0,
      totalQuantity: 0,
      photos: 0,
    };
    bEntry.audits += 1;

    for (const pole of audit.poles) {
      totalPoles += 1;
      bEntry.poles += 1;

      const conforming = isPoleConforming(pole);
      if (conforming) {
        conformingPoles += 1;
        bEntry.conforming += 1;
      }

      const allPoleProblems = getCombinedPoleProblems(pole);
      const effectiveStatus = allPoleProblems.length > 0 ? 'Não Conforme' : pole.status;
      const poleStatusKey = effectiveStatus === 'Conforme' ? 'Conforme' : 'Não Conforme';
      const poleQtySum = allPoleProblems.reduce(
        (acc, p) => acc + (Number.isFinite(p.quantity) && p.quantity > 0 ? p.quantity : 1),
        0
      );
      const sEntry = statusMap.get(poleStatusKey) ?? { count: 0, quantity: 0 };
      sEntry.count += 1;
      sEntry.quantity += poleQtySum;
      statusMap.set(poleStatusKey, sEntry);

      const photoCount = pole.photos.length;
      totalPhotos += photoCount;
      bEntry.photos += photoCount;
      if (photoCount > 0) {
        polesWithPhotos += 1;
      }

      const poleTypeKey = (pole.type || 'Não informado').trim() || 'Não informado';
      const ptEntry = poleTypeMap.get(poleTypeKey) ?? { count: 0, occurrences: 0 };
      ptEntry.count += 1;
      ptEntry.occurrences += allPoleProblems.length;
      poleTypeMap.set(poleTypeKey, ptEntry);

      for (const prob of allPoleProblems) {
        totalOccurrences += 1;
        const qty = Number.isFinite(prob.quantity) && prob.quantity > 0 ? prob.quantity : 1;
        totalProblemQuantity += qty;
        bEntry.occurrences += 1;
        bEntry.totalQuantity += qty;

        const pEntry = problemMap.get(prob.problem) ?? {
          occurrences: 0,
          totalQuantity: 0,
          polesSet: new Set<string>(),
          pendingCount: 0,
          regularizedCount: 0,
        };
        pEntry.occurrences += 1;
        pEntry.totalQuantity += qty;
        pEntry.polesSet.add(`${audit.id}_${pole.number}`);
        if (effectiveStatus === 'Conforme') {
          pEntry.regularizedCount += 1;
        } else {
          pEntry.pendingCount += 1;
        }
        problemMap.set(prob.problem, pEntry);
      }

      evidenceRecords.push({
        auditId: audit.id,
        projeto: audit.projeto || 'Sem projeto',
        bairro: bairroKey,
        dataExecucao: audit.dataExecucao || '',
        fiscalObra: audit.fiscalObra || '—',
        poleNumber: pole.number,
        poleId: pole.poleId || `Poste ${String(pole.number).padStart(2, '0')}`,
        poleType: poleTypeKey,
        poleStatus: effectiveStatus,
        problems: allPoleProblems,
        shieldingBoxCount: (pole.shieldingBoxes ?? []).length,
        photos: pole.photos,
        observation: pole.observation,
      });
    }

    bairroMap.set(bairroKey, bEntry);
  }

  const problemStats: ProblemStat[] = Array.from(problemMap.entries())
    .map(([problem, val]) => ({
      problem,
      occurrences: val.occurrences,
      totalQuantity: val.totalQuantity,
      polesAffected: val.polesSet.size,
      pendingCount: val.pendingCount,
      regularizedCount: val.regularizedCount,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity || b.occurrences - a.occurrences);

  const neighborhoodStats: NeighborhoodStat[] = Array.from(bairroMap.entries())
    .map(([bairro, val]) => ({
      bairro,
      audits: val.audits,
      poles: val.poles,
      occurrences: val.occurrences,
      totalQuantity: val.totalQuantity,
      photos: val.photos,
      complianceRate: val.poles > 0 ? Math.round((val.conforming / val.poles) * 100) : 0,
    }))
    .sort((a, b) => b.occurrences - a.occurrences || b.poles - a.poles);

  const statusStats: StatusStat[] = Array.from(statusMap.entries())
    .map(([status, val]) => ({
      status,
      count: val.count,
      quantity: val.quantity,
    }))
    .sort((a, b) => b.count - a.count);

  const poleTypeStats: PoleTypeStat[] = Array.from(poleTypeMap.entries())
    .map(([type, val]) => ({
      type,
      count: val.count,
      occurrences: val.occurrences,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalAudits: audits.length,
    totalPoles,
    conformingPoles,
    nonConformingPoles: totalPoles - conformingPoles,
    complianceRate: totalPoles > 0 ? Math.round((conformingPoles / totalPoles) * 100) : 0,
    totalOccurrences,
    totalProblemQuantity,
    totalPhotos,
    polesWithPhotos,
    evidenceCoverageRate: totalPoles > 0 ? Math.round((polesWithPhotos / totalPoles) * 100) : 0,
    avgInspectionMinutes: durationCount > 0 ? Math.round(durationSum / durationCount) : null,
    problemStats,
    neighborhoodStats,
    statusStats,
    poleTypeStats,
    evidenceRecords,
  };
}
