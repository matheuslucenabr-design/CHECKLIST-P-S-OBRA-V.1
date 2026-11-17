import { AlertTriangle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';

interface StatusTextProps {
  status: string;
}

export function StatusText({ status }: StatusTextProps) {
  switch (status) {
    case 'Conforme':
    case 'Regularizado':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Em Análise':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Pendente':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Não Conforme':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
  }
}
