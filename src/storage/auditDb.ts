import { AuditInspection, PhotoEvidence, createId } from '../types/audit';

const DB_NAME = 'auditoria_blindagem_rede_db';
const DB_VERSION = 1;
const STORE_NAME = 'inspections';
const ACTIVE_AUDIT_ID_KEY = 'auditoria_blindagem_active_id';
const LOCAL_FALLBACK_KEY = 'auditoria_blindagem_fallback_list';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB não disponível neste navegador.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir IndexedDB.'));
  });
}

export async function getAllAudits(): Promise<AuditInspection[]> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const items = (request.result as AuditInspection[]) || [];
        items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(LOCAL_FALLBACK_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as AuditInspection[];
      return parsed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch {
      return [];
    }
  }
}

export async function getAuditById(id: string): Promise<AuditInspection | null> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve((request.result as AuditInspection) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    const all = await getAllAudits();
    return all.find((item) => item.id === id) ?? null;
  }
}

export async function saveAudit(audit: AuditInspection): Promise<AuditInspection> {
  const updated: AuditInspection = {
    ...audit,
    updatedAt: new Date().toISOString(),
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(updated);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await getAllAudits();
    const filtered = existing.filter((item) => item.id !== updated.id);
    localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify([updated, ...filtered]));
  }

  setActiveAuditId(updated.id);
  return updated;
}

export async function deleteAudit(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await getAllAudits();
    const filtered = existing.filter((item) => item.id !== id);
    localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(filtered));
  }

  if (getActiveAuditId() === id) {
    clearActiveAuditId();
  }
}

export function getActiveAuditId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_AUDIT_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveAuditId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_AUDIT_ID_KEY, id);
  } catch {
    // Ignore storage restriction
  }
}

export function clearActiveAuditId(): void {
  try {
    localStorage.removeItem(ACTIVE_AUDIT_ID_KEY);
  } catch {
    // Ignore storage restriction
  }
}

export async function compressImageFile(file: File): Promise<PhotoEvidence> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
    image.src = rawDataUrl;
  });

  const MAX_SIDE = 1280;
  let targetWidth = img.naturalWidth || img.width || 1280;
  let targetHeight = img.naturalHeight || img.height || 960;

  if (targetWidth > MAX_SIDE || targetHeight > MAX_SIDE) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((targetHeight * MAX_SIDE) / targetWidth);
      targetWidth = MAX_SIDE;
    } else {
      targetWidth = Math.round((targetWidth * MAX_SIDE) / targetHeight);
      targetHeight = MAX_SIDE;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      id: createId('foto'),
      dataUrl: rawDataUrl,
      name: file.name,
      capturedAt: new Date().toISOString(),
      sizeBytes: file.size,
      width: targetWidth,
      height: targetHeight,
    };
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
  const approxBytes = Math.round((compressedDataUrl.length * 3) / 4);

  return {
    id: createId('foto'),
    dataUrl: compressedDataUrl,
    name: file.name || `evidencia_${Date.now()}.jpg`,
    capturedAt: new Date().toISOString(),
    sizeBytes: approxBytes,
    width: targetWidth,
    height: targetHeight,
  };
}

export async function exportBackupJson(audits: AuditInspection[]): Promise<void> {
  const payload = {
    exportedAt: new Date().toISOString(),
    system: 'Auditoria Pós-Obra Blindagem de Rede',
    version: 1,
    audits,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `backup_auditorias_blindagem_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importBackupJson(file: File): Promise<number> {
  const text = await file.text();
  const parsed = JSON.parse(text) as { audits?: AuditInspection[] } | AuditInspection[];
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.audits) ? parsed.audits : [];
  let count = 0;
  for (const item of list) {
    if (item && item.id && Array.isArray(item.poles)) {
      await saveAudit(item);
      count++;
    }
  }
  return count;
}
