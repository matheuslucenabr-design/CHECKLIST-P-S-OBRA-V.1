import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { AuditInspection, formatPoleNumber } from '../types/audit';
import { computeAnalytics, formatMinutesDuration, parseTimeToMinutes } from './analytics';

function sanitizeFileName(raw: string): string {
  return (raw || 'auditoria')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function formatDateBr(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getImageFormatForPdf(dataUrl: string): 'JPEG' | 'PNG' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  return 'JPEG';
}

function getImageTypeForDocx(dataUrl: string): 'jpg' | 'png' {
  if (dataUrl.startsWith('data:image/png')) return 'png';
  return 'jpg';
}

function getImageExtensionForExcel(dataUrl: string): 'jpeg' | 'png' {
  if (dataUrl.startsWith('data:image/png')) return 'png';
  return 'jpeg';
}

export function exportAuditToPdf(audit: AuditInspection): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('AUDITORIA PÓS OBRA — BLINDAGEM DE REDE', margin, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Projeto: ${audit.projeto || 'Não informado'}  |  Bairro: ${audit.bairro || 'Não informado'}  |  Execução: ${formatDateBr(audit.dataExecucao)}`,
    margin,
    18
  );

  // Project Details Table
  const startMin = parseTimeToMinutes(audit.inicioVistoria);
  const endMin = parseTimeToMinutes(audit.finalVistoria);
  const durStr =
    startMin !== null && endMin !== null && endMin >= startMin
      ? formatMinutesDuration(endMin - startMin)
      : '—';

  autoTable(doc, {
    startY: 29,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42], lineColor: [226, 232, 240] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    head: [['IDENTIFICAÇÃO DA AUDITORIA', '']],
    body: [
      [`Projeto: ${audit.projeto || '—'}`, `Bairro: ${audit.bairro || '—'}`],
      [`Data de Execução: ${formatDateBr(audit.dataExecucao)}`, `Fiscal da Obra: ${audit.fiscalObra || '—'}`],
      [`Revalidador: ${audit.revalidador || '—'}`, `Duração da Vistoria: ${durStr}`],
    ],
    columnStyles: {
      0: { cellWidth: (pageWidth - margin * 2) / 2 },
      1: { cellWidth: (pageWidth - margin * 2) / 2 },
    },
  });

  // Operational Timestamps
  const afterInfoY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  autoTable(doc, {
    startY: afterInfoY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, textColor: [15, 23, 42], lineColor: [226, 232, 240] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    head: [['Chegada', 'Revisão Projeto', 'Desembarque', 'Início Vistoria', 'Final Vistoria', 'Embarque Saída']],
    body: [
      [
        audit.chegada || '—',
        audit.revisaoProjetoInicio || audit.revisaoProjetoFim
          ? `${audit.revisaoProjetoInicio || '--:--'} às ${audit.revisaoProjetoFim || '--:--'}`
          : '—',
        audit.desembarque || '—',
        audit.inicioVistoria || '—',
        audit.finalVistoria || '—',
        audit.embarqueSaida || '—',
      ],
    ],
  });

  // Observations
  let currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  if (audit.observacao && audit.observacao.trim()) {
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      head: [['OBSERVAÇÃO GERAL']],
      body: [[audit.observacao.trim()]],
    });
    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  } else {
    currentY += 2;
  }

  // Summary metrics line
  const summary = computeAnalytics([audit]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RESUMO QUANTITATIVO DA INSPEÇÃO', margin, currentY);
  currentY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Postes Inspecionados: ${summary.totalPoles}   |   Ocorrências: ${summary.totalOccurrences}   |   Qtd. Total de Itens: ${summary.totalProblemQuantity}   |   Conformidade: ${summary.complianceRate}%   |   Evidências Fotográficas: ${summary.totalPhotos}`,
    margin,
    currentY
  );
  currentY += 5;

  // Per-Pole Problem List followed immediately by an adaptive, full-width proportional photo grid
  const usableWidth = pageWidth - margin * 2;
  const photoGap = 4;
  const captionSpace = 4.5;
  const rowBottomGap = 3.5;

  for (const pole of audit.poles) {
    const poleStatus = pole.problems.length > 0 ? 'Não Conforme' : 'Conforme';
    const pNum = `Poste ${formatPoleNumber(pole.number)}`;
    const pId = pole.poleId || '—';
    const pType = pole.type || '—';

    if (currentY > pageHeight - 48) {
      doc.addPage();
      currentY = 16;
    }

    const poleRows: Array<[string, string, string, string, string, string]> = [];
    if (pole.problems.length === 0) {
      poleRows.push([pNum, pId, pType, 'Sem não conformidades registradas', '0', poleStatus]);
    } else {
      pole.problems.forEach((prob, idx) => {
        poleRows.push([
          idx === 0 ? pNum : '',
          idx === 0 ? pId : '',
          idx === 0 ? pType : '',
          prob.note ? `${prob.problem}\nObs: ${prob.note}` : prob.problem,
          String(prob.quantity),
          idx === 0 ? poleStatus : '',
        ]);
      });
    }

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.3, textColor: [15, 23, 42], lineColor: [226, 232, 240], valign: 'middle' },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Poste', 'ID', 'Tipo', 'Problema Identificado', 'Qtd', 'Status']],
      body: poleRows,
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' },
        1: { cellWidth: 22 },
        2: { cellWidth: 22 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 26 },
      },
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2.5;

    if (pole.observation && pole.observation.trim()) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.8);
      doc.setTextColor(71, 85, 105);
      const obsLines = doc.splitTextToSize(`Obs. do ${pNum}: ${pole.observation.trim()}`, usableWidth);
      if (currentY + obsLines.length * 3.8 > pageHeight - 16) {
        doc.addPage();
        currentY = 16;
      }
      doc.text(obsLines, margin, currentY + 1.5);
      currentY += obsLines.length * 3.8 + 2.5;
    }

    const photos = pole.photos.slice(0, 4);
    if (photos.length > 0) {
      interface MeasuredPhoto {
        photo: (typeof photos)[number];
        globalIdx: number;
        natW: number;
        natH: number;
        drawW: number;
        drawH: number;
        valid: boolean;
      }

      const measuredAll = photos.map((photo, idx) => {
        try {
          const props = doc.getImageProperties(photo.dataUrl);
          return {
            photo,
            globalIdx: idx,
            natW: props.width || photo.width || 4,
            natH: props.height || photo.height || 3,
            valid: true,
          };
        } catch {
          return {
            photo,
            globalIdx: idx,
            natW: photo.width || 4,
            natH: photo.height || 3,
            valid: false,
          };
        }
      });

      const allPortrait = measuredAll.every((m) => m.natH > m.natW);

      type PhotoRowSpec = {
        items: typeof measuredAll;
        cellMaxW: number;
        cellMaxH: number;
      };

      const photoRows: PhotoRowSpec[] = [];
      if (photos.length === 1) {
        photoRows.push({
          items: measuredAll,
          cellMaxW: Math.min(156, usableWidth),
          cellMaxH: 102,
        });
      } else if (photos.length === 2) {
        photoRows.push({
          items: measuredAll,
          cellMaxW: (usableWidth - photoGap) / 2, // 89mm
          cellMaxH: 78,
        });
      } else if (photos.length === 3) {
        if (allPortrait) {
          photoRows.push({
            items: measuredAll,
            cellMaxW: (usableWidth - photoGap * 2) / 3, // 58mm
            cellMaxH: 82,
          });
        } else {
          photoRows.push({
            items: measuredAll.slice(0, 2),
            cellMaxW: (usableWidth - photoGap) / 2, // 89mm
            cellMaxH: 72,
          });
          photoRows.push({
            items: measuredAll.slice(2, 3),
            cellMaxW: 120,
            cellMaxH: 76,
          });
        }
      } else {
        // 4 photos: crisp 2x2 grid utilizing full 182mm width
        const twoColW = (usableWidth - photoGap) / 2; // 89mm
        photoRows.push({
          items: measuredAll.slice(0, 2),
          cellMaxW: twoColW,
          cellMaxH: 70,
        });
        photoRows.push({
          items: measuredAll.slice(2, 4),
          cellMaxW: twoColW,
          cellMaxH: 70,
        });
      }

      const fitRow = (spec: PhotoRowSpec): { items: MeasuredPhoto[]; rowImageH: number } => {
        const fitted: MeasuredPhoto[] = spec.items.map((m) => {
          const imgRatio = m.natW / m.natH;
          const boxRatio = spec.cellMaxW / spec.cellMaxH;
          let drawW = spec.cellMaxW;
          let drawH = spec.cellMaxH;
          if (imgRatio > boxRatio) {
            drawW = spec.cellMaxW;
            drawH = spec.cellMaxW / imgRatio;
          } else {
            drawH = spec.cellMaxH;
            drawW = spec.cellMaxH * imgRatio;
          }
          return { ...m, drawW, drawH };
        });
        const rowImageH = Math.max(...fitted.map((f) => f.drawH));
        return { items: fitted, rowImageH };
      };

      const computedRows = photoRows.map(fitRow);
      const firstRowH = computedRows[0].rowImageH + captionSpace + rowBottomGap;

      // Keep section title attached to first photo row
      if (currentY + 5 + firstRowH > pageHeight - 14) {
        doc.addPage();
        currentY = 16;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(`Evidências Fotográficas — ${pNum} (${photos.length}/4):`, margin, currentY + 2.5);
      currentY += 5;

      computedRows.forEach((rowBlock, rowIdx) => {
        const neededH = rowBlock.rowImageH + captionSpace + rowBottomGap;
        if (rowIdx > 0 && currentY + neededH > pageHeight - 14) {
          doc.addPage();
          currentY = 16;
        }

        const totalRowW =
          rowBlock.items.reduce((sum, item) => sum + item.drawW, 0) +
          photoGap * (rowBlock.items.length - 1);
        let cursorX = margin + (usableWidth - totalRowW) / 2;

        rowBlock.items.forEach((item) => {
          const drawX = cursorX;
          const drawY = currentY + (rowBlock.rowImageH - item.drawH) / 2;

          if (item.valid) {
            try {
              doc.addImage(
                item.photo.dataUrl,
                getImageFormatForPdf(item.photo.dataUrl),
                drawX,
                drawY,
                item.drawW,
                item.drawH,
                undefined,
                'NONE'
              );
              doc.setDrawColor(203, 213, 225);
              doc.rect(drawX, drawY, item.drawW, item.drawH);
            } catch {
              doc.setDrawColor(203, 213, 225);
              doc.rect(drawX, drawY, item.drawW, item.drawH);
              doc.setFontSize(7.5);
              doc.text('Imagem indisponível', drawX + 3, drawY + item.drawH / 2);
            }
          } else {
            doc.setDrawColor(203, 213, 225);
            doc.rect(drawX, drawY, item.drawW, item.drawH);
            doc.setFontSize(7.5);
            doc.text('Imagem indisponível', drawX + 3, drawY + item.drawH / 2);
          }

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.2);
          doc.setTextColor(71, 85, 105);
          doc.text(
            `Foto ${item.globalIdx + 1}/${photos.length}`,
            drawX + item.drawW / 2,
            drawY + item.drawH + 3.4,
            { align: 'center' }
          );

          cursorX += item.drawW + photoGap;
        });

        currentY += rowBlock.rowImageH + captionSpace + rowBottomGap;
      });

      currentY += 1.5;
    } else {
      currentY += 4;
    }
  }

  // Page Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Auditoria Pós-Obra Blindagem de Rede — Gerado em ${new Date().toLocaleString('pt-BR')}`,
      margin,
      pageHeight - 8
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin - 22, pageHeight - 8);
  }

  const fileSlug = sanitizeFileName(audit.projeto || audit.bairro || 'relatorio');
  doc.save(`auditoria_blindagem_${fileSlug}_${audit.dataExecucao || 'sem_data'}.pdf`);
}

export async function exportAuditToExcel(audit: AuditInspection): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Auditoria Pós-Obra Blindagem de Rede';
  wb.created = new Date();
  const summary = computeAnalytics([audit]);

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  // Sheet 1: Resumo da Auditoria
  const wsCover = wb.addWorksheet('Resumo da Auditoria');
  wsCover.columns = [{ width: 38 }, { width: 52 }];

  const titleRow = wsCover.addRow(['AUDITORIA PÓS OBRA BLINDAGEM DE REDE']);
  wsCover.mergeCells('A1:B1');
  titleRow.height = 28;
  titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  wsCover.addRow([]);

  const addCoverSection = (sectionTitle: string, entries: Array<[string, string | number]>) => {
    const hdr = wsCover.addRow([sectionTitle, 'VALOR']);
    hdr.height = 22;
    hdr.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };
    });

    for (const [label, val] of entries) {
      const r = wsCover.addRow([label, val]);
      r.height = 20;
      r.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF334155' } };
      r.getCell(2).font = { size: 10, color: { argb: 'FF0F172A' } };
      r.eachCell((cell) => {
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
    }
    wsCover.addRow([]);
  };

  addCoverSection('DADOS DA AUDITORIA', [
    ['Projeto', audit.projeto || '—'],
    ['Bairro', audit.bairro || '—'],
    ['Data de Execução', formatDateBr(audit.dataExecucao)],
    ['Fiscal da Obra', audit.fiscalObra || '—'],
    ['Revalidador', audit.revalidador || '—'],
    ['Observação Geral', audit.observacao || '—'],
  ]);

  addCoverSection('HORÁRIOS DA OPERAÇÃO', [
    ['Chegada', audit.chegada || '—'],
    ['Revisão Projeto (Início)', audit.revisaoProjetoInicio || '—'],
    ['Revisão Projeto (Final)', audit.revisaoProjetoFim || '—'],
    ['Desembarque', audit.desembarque || '—'],
    ['Início de Vistoria', audit.inicioVistoria || '—'],
    ['Final de Vistoria', audit.finalVistoria || '—'],
    ['Embarque Saída', audit.embarqueSaida || '—'],
  ]);

  addCoverSection('INDICADORES RESUMIDOS', [
    ['Postes Inspecionados', summary.totalPoles],
    ['Postes Conformes', summary.conformingPoles],
    ['Postes Não Conformes', summary.nonConformingPoles],
    ['Taxa de Conformidade (%)', `${summary.complianceRate}%`],
    ['Total de Ocorrências Registradas', summary.totalOccurrences],
    ['Quantidade Total de Itens Apontados', summary.totalProblemQuantity],
    ['Fotos de Evidência Anexadas', summary.totalPhotos],
  ]);

  // Sheet 2: Checklist de Postes (sem coluna J)
  const wsChecklist = wb.addWorksheet('Checklist de Postes');
  wsChecklist.columns = [
    { width: 13 }, // A: Poste Nº
    { width: 16 }, // B: ID do Poste
    { width: 15 }, // C: Tipo de Poste
    { width: 16 }, // D: Status do Poste
    { width: 46 }, // E: Problema Identificado
    { width: 12 }, // F: Quantidade
    { width: 28 }, // G: Observação do Item
    { width: 28 }, // H: Observação do Poste
    { width: 18 }, // I: Qtd. Fotos Anexadas
  ];

  const headerRow = wsChecklist.addRow([
    'Poste Nº',
    'ID do Poste',
    'Tipo de Poste',
    'Status do Poste',
    'Problema Identificado',
    'Quantidade',
    'Observação do Item',
    'Observação do Poste',
    'Qtd. Fotos Anexadas',
  ]);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  for (const pole of audit.poles) {
    const items =
      pole.problems.length === 0
        ? [{ problem: 'Sem não conformidades registradas', quantity: 0, note: '—' }]
        : pole.problems.map((pr) => ({
            problem: pr.problem,
            quantity: pr.quantity,
            note: pr.note || '—',
          }));

    for (const item of items) {
      const row = wsChecklist.addRow([
        `Poste ${formatPoleNumber(pole.number)}`,
        pole.poleId || '—',
        pole.type || '—',
        pole.status,
        item.problem,
        item.quantity,
        item.note,
        pole.observation || '—',
        pole.photos.length,
      ]);
      row.height = 22;
      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        cell.font = { size: 10, color: { argb: 'FF0F172A' } };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 6 || colNumber === 9 ? 'center' : 'left',
          wrapText: true,
        };
      });
    }
  }

  // Sheet 3: Indicadores por Problema
  const wsProblems = wb.addWorksheet('Indicadores por Problema');
  wsProblems.columns = [
    { width: 54 },
    { width: 14 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];

  const probHeaderRow = wsProblems.addRow([
    'Problema Padrão',
    'Ocorrências',
    'Quantidade Total',
    'Postes Afetados',
    'Não Conformes',
    'Conformes',
  ]);
  probHeaderRow.height = 24;
  probHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  for (const st of summary.problemStats) {
    const r = wsProblems.addRow([
      st.problem,
      st.occurrences,
      st.totalQuantity,
      st.polesAffected,
      st.pendingCount,
      st.regularizedCount,
    ]);
    r.height = 20;
    r.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { size: 10, color: { argb: 'FF0F172A' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 ? 'left' : 'center',
      };
    });
  }

  // Sheet 4: EVIDENCIA FOTOGRAFICA
  const wsEvidence = wb.addWorksheet('EVIDENCIA FOTOGRAFICA');
  wsEvidence.columns = [
    { width: 18 }, // A: ID POSTE
    { width: 16 }, // B: TIPO
    { width: 18 }, // C: STATUS DO POSTE
    { width: 44 }, // D: OBSERVAÇÃO DO ITEM
    { width: 32 }, // E: EVIDENCIA 1
    { width: 32 }, // F: EVIDENCIA 2
    { width: 32 }, // G: EVIDENCIA 3
    { width: 32 }, // H: EVIDENCIA 4
  ];

  const evHeaderRow = wsEvidence.addRow([
    'ID POSTE',
    'TIPO',
    'STATUS DO POSTE',
    'OBSERVAÇÃO DO ITEM',
    'EVIDENCIA 1',
    'EVIDENCIA 2',
    'EVIDENCIA 3',
    'EVIDENCIA 4',
  ]);
  evHeaderRow.height = 26;
  evHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  for (const pole of audit.poles) {
    const photos = pole.photos.slice(0, 4);
    const itemNotesText =
      pole.problems.length === 0
        ? 'Sem não conformidades registradas'
        : pole.problems
            .map((pr) => (pr.note ? `${pr.problem}: ${pr.note}` : pr.problem))
            .join('\n');

    const evRow = wsEvidence.addRow([
      pole.poleId || `Poste ${formatPoleNumber(pole.number)}`,
      pole.type || '—',
      pole.status,
      itemNotesText,
      photos[0] ? '' : '—',
      photos[1] ? '' : '—',
      photos[2] ? '' : '—',
      photos[3] ? '' : '—',
    ]);

    evRow.height = photos.length > 0 ? 136 : 26;
    evRow.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { size: 10, color: { argb: 'FF0F172A' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber >= 5 ? 'center' : 'left',
        wrapText: true,
      };
    });

    const rowIndex0Based = evRow.number - 1;
    photos.forEach((photo, idx) => {
      try {
        const imageId = wb.addImage({
          base64: photo.dataUrl,
          extension: getImageExtensionForExcel(photo.dataUrl),
        });

        const maxW = 212;
        const maxH = 166;
        let imgW = maxW;
        let imgH = maxH;
        if (photo.width > 0 && photo.height > 0) {
          const ratio = photo.width / photo.height;
          if (maxW / maxH > ratio) {
            imgH = maxH;
            imgW = Math.round(maxH * ratio);
          } else {
            imgW = maxW;
            imgH = Math.round(maxW / ratio);
          }
        }

        wsEvidence.addImage(imageId, {
          tl: { col: 4 + idx + 0.04, row: rowIndex0Based + 0.05 },
          ext: { width: imgW, height: imgH },
          editAs: 'oneCell',
        });
      } catch {
        // Ignore malformed image
      }
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fileSlug = sanitizeFileName(audit.projeto || audit.bairro || 'relatorio');
  triggerBlobDownload(blob, `auditoria_blindagem_${fileSlug}_${audit.dataExecucao || 'sem_data'}.xlsx`);
}

export function exportConsolidatedExcel(audits: AuditInspection[]): void {
  const wb = XLSX.utils.book_new();
  const summary = computeAnalytics(audits);

  // Sheet 1: Visão Geral das Auditorias
  const auditRows: Array<Array<string | number>> = [
    [
      'Projeto',
      'Bairro',
      'Data de Execução',
      'Fiscal da Obra',
      'Revalidador',
      'Início Vistoria',
      'Final Vistoria',
      'Postes Inspecionados',
      'Ocorrências',
      'Qtd. Itens',
      'Fotos Anexadas',
      'Conformidade (%)',
    ],
  ];

  for (const a of audits) {
    const s = computeAnalytics([a]);
    auditRows.push([
      a.projeto || '—',
      a.bairro || '—',
      formatDateBr(a.dataExecucao),
      a.fiscalObra || '—',
      a.revalidador || '—',
      a.inicioVistoria || '—',
      a.finalVistoria || '—',
      s.totalPoles,
      s.totalOccurrences,
      s.totalProblemQuantity,
      s.totalPhotos,
      s.complianceRate,
    ]);
  }

  const wsAudits = XLSX.utils.aoa_to_sheet(auditRows);
  wsAudits['!cols'] = [
    { wch: 24 },
    { wch: 20 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAudits, 'Auditorias');

  // Sheet 2: Ranking de Problemas
  const probRows: Array<Array<string | number>> = [
    ['Problema', 'Ocorrências', 'Quantidade Total', 'Postes Afetados', 'Pendentes/NC', 'Regularizados'],
  ];
  for (const p of summary.problemStats) {
    probRows.push([p.problem, p.occurrences, p.totalQuantity, p.polesAffected, p.pendingCount, p.regularizedCount]);
  }
  const wsProb = XLSX.utils.aoa_to_sheet(probRows);
  wsProb['!cols'] = [{ wch: 52 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsProb, 'Ranking de Problemas');

  // Sheet 3: Base Completa de Ocorrências
  const detailRows: Array<Array<string | number>> = [
    ['Projeto', 'Bairro', 'Data', 'Fiscal', 'Poste', 'ID Poste', 'Tipo', 'Status Poste', 'Problema', 'Quantidade', 'Detalhe', 'Fotos'],
  ];
  for (const a of audits) {
    for (const pole of a.poles) {
      if (pole.problems.length === 0) {
        detailRows.push([
          a.projeto || '—',
          a.bairro || '—',
          formatDateBr(a.dataExecucao),
          a.fiscalObra || '—',
          `Poste ${formatPoleNumber(pole.number)}`,
          pole.poleId || '—',
          pole.type || '—',
          pole.status,
          'Conforme / Sem irregularidades',
          0,
          '—',
          pole.photos.length,
        ]);
      } else {
        for (const prob of pole.problems) {
          detailRows.push([
            a.projeto || '—',
            a.bairro || '—',
            formatDateBr(a.dataExecucao),
            a.fiscalObra || '—',
            `Poste ${formatPoleNumber(pole.number)}`,
            pole.poleId || '—',
            pole.type || '—',
            pole.status,
            prob.problem,
            prob.quantity,
            prob.note || '—',
            pole.photos.length,
          ]);
        }
      }
    }
  }
  const wsDetails = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetails['!cols'] = [
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 46 },
    { wch: 12 },
    { wch: 24 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Base de Ocorrências');

  XLSX.writeFile(wb, `dados_consolidados_blindagem_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function makeDocxCell(text: string, bold = false, bgHex?: string): TableCell {
  return new TableCell({
    shading: bgHex ? { type: ShadingType.CLEAR, fill: bgHex } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || '—',
            bold,
            size: 19,
            font: 'Calibri',
            color: '0F172A',
          }),
        ],
      }),
    ],
  });
}

export async function exportAuditToWord(audit: AuditInspection): Promise<void> {
  const summary = computeAnalytics([audit]);
  const children: Array<Paragraph | Table> = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: 'AUDITORIA PÓS OBRA BLINDAGEM DE REDE',
          bold: true,
          size: 30,
          color: '0F172A',
          font: 'Calibri',
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Relatório Técnico de Inspeção em Campo  •  Gerado em ${new Date().toLocaleString('pt-BR')}`,
          size: 18,
          color: '475569',
          font: 'Calibri',
        }),
      ],
    })
  );

  // Identification Table
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [makeDocxCell('PROJETO', true, 'F1F5F9'), makeDocxCell(audit.projeto || '—'), makeDocxCell('BAIRRO', true, 'F1F5F9'), makeDocxCell(audit.bairro || '—')],
        }),
        new TableRow({
          children: [
            makeDocxCell('DATA DE EXECUÇÃO', true, 'F1F5F9'),
            makeDocxCell(formatDateBr(audit.dataExecucao)),
            makeDocxCell('FISCAL DA OBRA', true, 'F1F5F9'),
            makeDocxCell(audit.fiscalObra || '—'),
          ],
        }),
        new TableRow({
          children: [
            makeDocxCell('REVALIDADOR', true, 'F1F5F9'),
            makeDocxCell(audit.revalidador || '—'),
            makeDocxCell('CHEGADA / DESEMBARQUE', true, 'F1F5F9'),
            makeDocxCell(`${audit.chegada || '--:--'}  /  ${audit.desembarque || '--:--'}`),
          ],
        }),
        new TableRow({
          children: [
            makeDocxCell('REVISÃO PROJETO', true, 'F1F5F9'),
            makeDocxCell(`${audit.revisaoProjetoInicio || '--:--'} às ${audit.revisaoProjetoFim || '--:--'}`),
            makeDocxCell('VISTORIA (INÍCIO - FINAL)', true, 'F1F5F9'),
            makeDocxCell(`${audit.inicioVistoria || '--:--'} às ${audit.finalVistoria || '--:--'}`),
          ],
        }),
        new TableRow({
          children: [
            makeDocxCell('EMBARQUE SAÍDA', true, 'F1F5F9'),
            makeDocxCell(audit.embarqueSaida || '—'),
            makeDocxCell('RESUMO', true, 'F1F5F9'),
            makeDocxCell(`${summary.totalPoles} postes  |  ${summary.totalOccurrences} ocorrências  |  ${summary.totalPhotos} fotos`),
          ],
        }),
      ],
    })
  );

  // Observação
  children.push(
    new Paragraph({
      spacing: { before: 220, after: 80 },
      children: [new TextRun({ text: 'OBSERVAÇÃO GERAL', bold: true, size: 22, color: '0F172A', font: 'Calibri' })],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: audit.observacao?.trim() || 'Nenhuma observação geral registrada.',
          size: 20,
          color: '334155',
          font: 'Calibri',
        }),
      ],
    })
  );

  // Checklist Title
  children.push(
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [new TextRun({ text: 'DETALHAMENTO DOS POSTES INSPECIONADOS', bold: true, size: 22, color: '0F172A', font: 'Calibri' })],
    })
  );

  const checklistTableRows: TableRow[] = [
    new TableRow({
      children: [
        makeDocxCell('POSTE', true, 'E2E8F0'),
        makeDocxCell('ID', true, 'E2E8F0'),
        makeDocxCell('TIPO', true, 'E2E8F0'),
        makeDocxCell('PROBLEMA', true, 'E2E8F0'),
        makeDocxCell('QTD', true, 'E2E8F0'),
        makeDocxCell('STATUS', true, 'E2E8F0'),
        makeDocxCell('FOTOS', true, 'E2E8F0'),
      ],
    }),
  ];

  for (const pole of audit.poles) {
    if (pole.problems.length === 0) {
      checklistTableRows.push(
        new TableRow({
          children: [
            makeDocxCell(`Poste ${formatPoleNumber(pole.number)}`, true),
            makeDocxCell(pole.poleId || '—'),
            makeDocxCell(pole.type || '—'),
            makeDocxCell('Sem não conformidades registradas'),
            makeDocxCell('0'),
            makeDocxCell(pole.status),
            makeDocxCell(`${pole.photos.length}/4`),
          ],
        })
      );
    } else {
      pole.problems.forEach((prob, idx) => {
        checklistTableRows.push(
          new TableRow({
            children: [
              makeDocxCell(idx === 0 ? `Poste ${formatPoleNumber(pole.number)}` : '', idx === 0),
              makeDocxCell(idx === 0 ? pole.poleId || '—' : ''),
              makeDocxCell(idx === 0 ? pole.type || '—' : ''),
              makeDocxCell(prob.note ? `${prob.problem} (${prob.note})` : prob.problem),
              makeDocxCell(String(prob.quantity)),
              makeDocxCell(idx === 0 ? pole.status : ''),
              makeDocxCell(idx === 0 ? `${pole.photos.length}/4` : ''),
            ],
          })
        );
      });
    }
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: checklistTableRows,
    })
  );

  // Photographic Evidence Pages
  const polesWithPhotos = audit.poles.filter((p) => p.photos.length > 0);
  if (polesWithPhotos.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 160 },
        children: [new TextRun({ text: 'EVIDÊNCIAS FOTOGRÁFICAS POR POSTE', bold: true, size: 26, color: '0F172A', font: 'Calibri' })],
      })
    );

    for (const pole of polesWithPhotos) {
      children.push(
        new Paragraph({
          spacing: { before: 180, after: 80 },
          children: [
            new TextRun({
              text: `POSTE ${formatPoleNumber(pole.number)}  •  ID: ${pole.poleId || '—'}  •  Tipo: ${pole.type || '—'}  •  Status: ${pole.status}`,
              bold: true,
              size: 21,
              color: '1E3A8A',
              font: 'Calibri',
            }),
          ],
        })
      );

      if (pole.problems.length > 0) {
        children.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: `Problemas: ${pole.problems.map((pr) => `${pr.problem} (Qtd: ${pr.quantity}${pr.note ? ` - ${pr.note}` : ''})`).join('; ')}`,
                size: 18,
                color: '475569',
                font: 'Calibri',
              }),
            ],
          })
        );
      }

      // 2-column photo grid table inside Word
      const photoRows: TableRow[] = [];
      for (let i = 0; i < pole.photos.length; i += 2) {
        const pair = pole.photos.slice(i, i + 2);
        const cells: TableCell[] = pair.map((photo, offset) => {
          const aspect = photo.height > 0 && photo.width > 0 ? photo.height / photo.width : 0.75;
          const targetW = 260;
          const targetH = Math.min(220, Math.round(targetW * aspect));
          const bytes = dataUrlToUint8Array(photo.dataUrl);

          return new TableCell({
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    type: getImageTypeForDocx(photo.dataUrl),
                    data: bytes,
                    transformation: { width: targetW, height: targetH },
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60 },
                children: [
                  new TextRun({
                    text: `Foto ${i + offset + 1}/${pole.photos.length} • ${new Date(photo.capturedAt).toLocaleString('pt-BR')}`,
                    size: 16,
                    color: '64748B',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          });
        });

        if (cells.length === 1) {
          cells.push(
            new TableCell({
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              },
              children: [new Paragraph('')],
            })
          );
        }

        photoRows.push(new TableRow({ children: cells }));
      }

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: photoRows,
        })
      );
    }
  }

  const wordDoc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(wordDoc);
  const fileSlug = sanitizeFileName(audit.projeto || audit.bairro || 'relatorio');
  triggerBlobDownload(blob, `auditoria_blindagem_${fileSlug}_${audit.dataExecucao || 'sem_data'}.docx`);
}
