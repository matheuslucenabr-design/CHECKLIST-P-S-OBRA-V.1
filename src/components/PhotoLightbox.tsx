import { X } from 'lucide-react';
import { PhotoEvidence } from '../types/audit';

interface PhotoLightboxProps {
  photo: PhotoEvidence | null;
  caption?: string;
  onClose: () => void;
}

export function PhotoLightbox({ photo, caption, onClose }: PhotoLightboxProps) {
  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Visualização de evidência fotográfica"
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{caption || photo.name}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-400 tabular-nums">
              {new Date(photo.capturedAt).toLocaleString('pt-BR')} · {photo.width}×{photo.height}px ·{' '}
              {Math.max(1, Math.round(photo.sizeBytes / 1024))} KB
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-700 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"
            aria-label="Fechar visualização"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-950 p-4">
          <img
            src={photo.dataUrl}
            alt={caption || photo.name}
            referrerPolicy="no-referrer"
            className="max-h-[75vh] w-auto rounded object-contain"
          />
        </div>
      </div>
    </div>
  );
}
