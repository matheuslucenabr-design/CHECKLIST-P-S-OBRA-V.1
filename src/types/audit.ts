export const MAX_POLES = 25;
export const MAX_PHOTOS_PER_POLE = 4;
export const MAX_SHIELDING_BOXES_PER_POLE = 6;

export const SHIELDING_BOX_PROBLEM_OPTIONS = [
  '1.1. RAMAL SEM PRENSA CABO',
  '1.2. PRENSA CABO INSTALADO INCORRETAMENTE',
  '1.3. PRENSA CABO SOBRESALENTE',
  '1.4. CAIXAS ALARMANDO',
  '1.5. LUMINÁRIA NÃO RELIGADA',
  '1.6. RABIXO NÃO DISPONIBILIZADO',
  '1.7. CAIXA DE BLINDAGEM ABERTA',
  '1.8. RAMAL DE CLIENTE INADEQUADO',
  '1.9. LIGAÇÃO EM RABIXO',
] as const;

export const POLE_PROBLEM_OPTIONS = [
  '2.1. AMARRAÇÃO DE CONCENTRICO PENDENTE',
  '2.2. AUSENCIA DE 5S POR VÃO',
  '2.3. FERRAMENTA/MATERIAL ESQUECIDA EM OBRA',
  '2.4. REINSTALAÇÃO DE LUMINÁRIA INCORRETA',
  '2.5. ATERRAMENTO FORA DO PADRÃO',
  '2.6. AUSENCIA DE BLINDAGEM DO TRAFO',
  '2.7. SEALTUBO DANIFICADO OU INCORRETO',
  '2.8. ENCABECAMENTO DE REDE INCORRETO OU FORA DO PADRÃO',
  '2.9. ESTRUTURA OU POSTE DANIFICADO',
] as const;

export const PROBLEM_OPTIONS = [
  ...SHIELDING_BOX_PROBLEM_OPTIONS,
  ...POLE_PROBLEM_OPTIONS,
] as const;

export type ProblemType = (typeof PROBLEM_OPTIONS)[number];

export const POLE_TYPE_OPTIONS = [
  'DUPLO T',
  'CIRCULAR',
  'FIBRA',
] as const;

export const PROBLEM_STATUS_OPTIONS = [
  'Não Conforme',
  'Pendente',
  'Em Análise',
  'Regularizado',
] as const;

export type ProblemStatus = (typeof PROBLEM_STATUS_OPTIONS)[number];

export const POLE_STATUS_OPTIONS = [
  'Conforme',
  'Não Conforme',
] as const;

export type PoleStatus = (typeof POLE_STATUS_OPTIONS)[number];

export interface PhotoEvidence {
  id: string;
  dataUrl: string;
  name: string;
  capturedAt: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface PoleProblem {
  id: string;
  problem: string;
  quantity: number;
  status?: ProblemStatus;
  note?: string;
}

export interface ShieldingBoxInspection {
  id: string;
  number: number; // 1 to 6
  problems: PoleProblem[];
}

export interface PoleInspection {
  number: number; // 1 to 25
  poleId: string;
  type: string;
  status: PoleStatus;
  problems: PoleProblem[];
  shieldingBoxes?: ShieldingBoxInspection[];
  photos: PhotoEvidence[];
  observation: string;
}

export interface AuditInspection {
  id: string;
  createdAt: string;
  updatedAt: string;
  projeto: string;
  bairro: string;
  dataExecucao: string;
  fiscalObra: string;
  revalidador: string;
  chegada: string;
  revisaoProjetoInicio: string;
  revisaoProjetoFim: string;
  desembarque: string;
  inicioVistoria: string;
  finalVistoria: string;
  embarqueSaida: string;
  observacao: string;
  poles: PoleInspection[];
}

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyShieldingBox(number: number): ShieldingBoxInspection {
  return {
    id: createId('caixa'),
    number,
    problems: [],
  };
}

export function createEmptyPole(number: number): PoleInspection {
  return {
    number,
    poleId: '',
    type: 'DUPLO T',
    status: 'Conforme',
    problems: [],
    shieldingBoxes: [],
    photos: [],
    observation: '',
  };
}

export function createEmptyProblem(problem: string = POLE_PROBLEM_OPTIONS[0]): PoleProblem {
  return {
    id: createId('prob'),
    problem,
    quantity: 1,
    status: 'Não Conforme',
    note: '',
  };
}

export function createEmptyAudit(): AuditInspection {
  const nowIso = new Date().toISOString();
  const todayLocal = new Date().toISOString().slice(0, 10);
  return {
    id: createId('aud'),
    createdAt: nowIso,
    updatedAt: nowIso,
    projeto: '',
    bairro: '',
    dataExecucao: todayLocal,
    fiscalObra: '',
    revalidador: '',
    chegada: '',
    revisaoProjetoInicio: '',
    revisaoProjetoFim: '',
    desembarque: '',
    inicioVistoria: '',
    finalVistoria: '',
    embarqueSaida: '',
    observacao: '',
    poles: [createEmptyPole(1)],
  };
}

export function formatPoleNumber(n: number): string {
  return String(n).padStart(2, '0');
}

export function derivePoleStatus(
  problems: PoleProblem[],
  shieldingBoxes: ShieldingBoxInspection[] = []
): PoleStatus {
  const hasBoxProblem = shieldingBoxes.some((box) => box.problems.length > 0);
  return problems.length > 0 || hasBoxProblem ? 'Não Conforme' : 'Conforme';
}

export interface CombinedProblemEntry {
  id: string;
  source: 'poste' | 'caixa';
  boxNumber?: number;
  sourceLabel: string;
  problem: string;
  quantity: number;
  note?: string;
}

export function getCombinedPoleProblems(
  pole: Pick<PoleInspection, 'problems' | 'shieldingBoxes'>
): CombinedProblemEntry[] {
  const result: CombinedProblemEntry[] = [];
  for (const pr of pole.problems ?? []) {
    result.push({
      id: pr.id,
      source: 'poste',
      sourceLabel: 'Poste',
      problem: pr.problem,
      quantity: pr.quantity,
      note: pr.note,
    });
  }
  for (const box of pole.shieldingBoxes ?? []) {
    const boxLabel = `Caixa ${formatPoleNumber(box.number)}`;
    for (const pr of box.problems ?? []) {
      result.push({
        id: pr.id,
        source: 'caixa',
        boxNumber: box.number,
        sourceLabel: boxLabel,
        problem: pr.problem,
        quantity: pr.quantity,
        note: pr.note,
      });
    }
  }
  return result;
}

const LEGACY_PROBLEM_ALIAS_MAP: Record<string, string> = {
  'AUSENCIA DE 5S': '2.2. AUSENCIA DE 5S POR VÃO',
  'FERRAMENTA ESQUECIDA EM OBRA': '2.3. FERRAMENTA/MATERIAL ESQUECIDA EM OBRA',
  'EMCABECAMENTO DE REDE INCORRETO OU FORA DO PADRÃO': '2.8. ENCABECAMENTO DE REDE INCORRETO OU FORA DO PADRÃO',
};

export function normalizeProblemLabel(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return PROBLEM_OPTIONS[0];
  if ((PROBLEM_OPTIONS as readonly string[]).includes(trimmed)) return trimmed;
  const withoutPrefix = trimmed.replace(/^(?:\d+(?:\.\d+)?)\.\s*/, '').toUpperCase();
  if (LEGACY_PROBLEM_ALIAS_MAP[withoutPrefix]) {
    return LEGACY_PROBLEM_ALIAS_MAP[withoutPrefix];
  }
  const matched = PROBLEM_OPTIONS.find(
    (opt) => opt.replace(/^(?:\d+(?:\.\d+)?)\.\s*/, '').toUpperCase() === withoutPrefix
  );
  return matched ?? trimmed;
}

export function normalizePole(pole: PoleInspection): PoleInspection {
  const normalizedProblems = (pole.problems ?? []).map((pr) => ({
    ...pr,
    problem: normalizeProblemLabel(pr.problem),
  }));
  const normalizedBoxes = (pole.shieldingBoxes ?? [])
    .slice(0, MAX_SHIELDING_BOXES_PER_POLE)
    .map((box, idx) => ({
      ...box,
      id: box.id || createId('caixa'),
      number: idx + 1,
      problems: (box.problems ?? []).map((pr) => ({
        ...pr,
        problem: normalizeProblemLabel(pr.problem),
      })),
    }));
  return {
    ...pole,
    problems: normalizedProblems,
    shieldingBoxes: normalizedBoxes,
    status: derivePoleStatus(normalizedProblems, normalizedBoxes),
  };
}

