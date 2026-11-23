export const MAX_POLES = 25;
export const MAX_PHOTOS_PER_POLE = 4;

export const PROBLEM_OPTIONS = [
  '1. RAMAL SEM PRENSA CABO',
  '2. PRENSA CABO INSTALADO INCORRETAMENTE',
  '3. AMARRAÇÃO DE CONCENTRICO PENDENTE',
  '4. AUSENCIA DE 5S',
  '5. CAIXAS ALARMANDO',
  '6. FERRAMENTA ESQUECIDA EM OBRA',
  '7. LUMINÁRIA NÃO RELIGADA',
  '8. RABIXO NÃO DISPONIBILIZADO',
  '9. REINSTALAÇÃO DE LUMINÁRIA INCORRETA',
  '10. ATERRAMENTO FORA DO PADRÃO',
  '11. AUSENCIA DE BLINDAGEM DO TRAFO',
  '12. SEALTUBO DANIFICADO OU INCORRETO',
  '13. CAIXA DE BLINDAGEM ABERTA',
  '14. EMCABECAMENTO DE REDE INCORRETO OU FORA DO PADRÃO',
  '15. ESTRUTURA OU POSTE DANIFICADO',
  '16. RAMAL DE CLIENTE INADEQUADO OU LIGAÇÃO EM RABIXO',
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

export interface PoleInspection {
  number: number; // 1 to 25
  poleId: string;
  type: string;
  status: PoleStatus;
  problems: PoleProblem[];
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

export function createEmptyPole(number: number): PoleInspection {
  return {
    number,
    poleId: '',
    type: 'DUPLO T',
    status: 'Conforme',
    problems: [],
    photos: [],
    observation: '',
  };
}

export function createEmptyProblem(problem: string = PROBLEM_OPTIONS[0]): PoleProblem {
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

export function derivePoleStatus(problems: PoleProblem[]): PoleStatus {
  return problems.length > 0 ? 'Não Conforme' : 'Conforme';
}

export function normalizeProblemLabel(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return PROBLEM_OPTIONS[0];
  if ((PROBLEM_OPTIONS as readonly string[]).includes(trimmed)) return trimmed;
  const withoutPrefix = trimmed.replace(/^\d+\.\s*/, '');
  const matched = PROBLEM_OPTIONS.find(
    (opt) => opt.replace(/^\d+\.\s*/, '').toUpperCase() === withoutPrefix.toUpperCase()
  );
  return matched ?? trimmed;
}
