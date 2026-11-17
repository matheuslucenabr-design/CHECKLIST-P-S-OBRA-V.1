export const MAX_POLES = 25;
export const MAX_PHOTOS_PER_POLE = 4;

export const PROBLEM_OPTIONS = [
  'RAMAL SEM PRENSA CABO',
  'PRENSA CABO INSTALADO INCORRETAMENTE',
  'AMARRAÇÃO DE CONCENTRICO PENDENTE',
  'AUSENCIA DE 5S',
  'CAIXAS ALARMANDO',
  'FERRAMENTA ESQUECIDA EM OBRA',
  'LUMINÁRIA NÃO RELIGADA',
  'RABIXO NÃO DISPONIBILIZADO',
  'REINSTALAÇÃO DE LUMINÁRIA INCORRETA',
  'ATERRAMENTO FORA DO PADRÃO',
  'AUSENCIA DE BLINDAGEM DO TRAFO',
  'SEALTUBO DANIFICADO OU INCORRETO',
  'CAIXA DE BLINDAGEM ABERTA',
  'EMCABECAMENTO DE REDE INCORRETO OU FORA DO PADRÃO',
  'ESTRUTURA OU POSTE DANIFICADO',
] as const;

export type ProblemType = (typeof PROBLEM_OPTIONS)[number];

export const POLE_TYPE_OPTIONS = [
  'Concreto DT',
  'Concreto Circular',
  'Madeira',
  'Fibra / Polímero',
  'Aço',
  'Outro',
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
  'Pendente',
  'Regularizado',
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
  status: ProblemStatus;
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
    type: 'Concreto DT',
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
