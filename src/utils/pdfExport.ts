import { jsPDF } from 'jspdf';
import type { Bar, Section, Song } from '../types';
import {
  formatBarChordsSummary,
  formatLastBarCuePassPrintBadge,
  transposeKey,
} from './chords';

export interface PdfExportOptions {
  includeCues: boolean;
  includeLyrics: boolean;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// 96 DPI A4 logical canvas dimensions rendered at 2x DPI
const PAGE_W = 794;
const PAGE_H = 1123;
const SCALE = 2;
const MARGIN_X = 42;
const MARGIN_TOP = 44;
const MARGIN_BOTTOM = 44;
const COL_GAP = 22;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const COL_W = (CONTENT_W - COL_GAP) / 2;

const SERIF_FONT = '"Playfair Display", "Lora", "Noto Sans Sinhala", serif';
const SANS_FONT = '"Inter", "Noto Sans Sinhala", system-ui, sans-serif';

function chunkBars(bars: Bar[], size = 4): Bar[][] {
  const rows: Bar[][] = [];
  for (let i = 0; i < bars.length; i += size) {
    rows.push(bars.slice(i, i + size));
  }
  return rows;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // Break ultra-long unbroken tokens safely
      if (ctx.measureText(word).width > maxWidth) {
        let slice = '';
        for (const ch of Array.from(word)) {
          if (ctx.measureText(slice + ch).width > maxWidth && slice) {
            lines.push(slice);
            slice = ch;
          } else {
            slice += ch;
          }
        }
        current = slice;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function drawTruncatedCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  maxWidth: number
): void {
  let out = text;
  if (ctx.measureText(out).width > maxWidth) {
    while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
      out = out.slice(0, -1);
    }
    out = `${out}…`;
  }
  ctx.fillText(out, centerX, y);
}

interface PageSurface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

function createA4PageSurface(): PageSurface {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W * SCALE;
  canvas.height = PAGE_H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize canvas 2D context for PDF generation.');
  }
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  return { canvas, ctx };
}

function measureSectionHeight(section: Section, includeCues: boolean): number {
  if (section.isReference) {
    return 36;
  }
  const rows = chunkBars(section.bars, 4);
  const rowH = includeCues ? 44 : 38;
  const headerH = 22;
  const rowsGap = Math.max(0, rows.length - 1) * 6;
  return headerH + rows.length * rowH + rowsGap + 14;
}

function drawChordSection(
  ctx: CanvasRenderingContext2D,
  section: Section,
  song: Song,
  displayKey: string,
  includeCues: boolean,
  x: number,
  y: number,
  w: number
): number {
  if (section.isReference) {
    const label = `(${section.name})`;
    ctx.font = `700 13px ${SERIF_FONT}`;
    const textW = Math.min(w - 16, ctx.measureText(label).width);
    const pillW = textW + 20;
    const pillH = 26;

    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, pillW, pillH, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 10, y + pillH / 2 + 0.5, w - 20);
    return 36;
  }

  const secTranspose = (song.transpose || 0) + (section.transpose || 0);
  const isRepeat = Boolean(section.repeat);
  const repeatCount = Math.max(2, section.repeatCount ?? 2);
  const passBadge = isRepeat
    ? formatLastBarCuePassPrintBadge(section.lastBarCuePassRule, repeatCount)
    : null;

  // Section Heading
  ctx.fillStyle = '#111827';
  ctx.font = `700 14.5px ${SERIF_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(section.name, x, y, w - (isRepeat ? 75 : 4));

  if (isRepeat) {
    ctx.fillStyle = '#475569';
    ctx.font = `600 10.5px ${SANS_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(
      `×${repeatCount}${passBadge ? ` ${passBadge}` : ''}`,
      x + w,
      y + 3
    );
  }

  let cursorY = y + 22;
  const rows = chunkBars(section.bars, 4);
  const rowH = includeCues ? 44 : 38;
  const leftSignW = isRepeat ? 22 : 14;
  const rightSignW = isRepeat ? (passBadge ? 56 : 24) : 14;
  const gridW = w - leftSignW - rightSignW;
  const cellW = gridW / 4;
  const gridX = x + leftSignW;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const rowBars = rows[rowIdx];
    const isFirstRow = rowIdx === 0;
    const isLastRow = rowIdx === rows.length - 1;

    // Left barline / ||:
    ctx.fillStyle = '#111827';
    ctx.font = '700 12.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isFirstRow && isRepeat ? '||:' : '|',
      x + leftSignW / 2,
      cursorY + rowH / 2
    );

    // Outer top/bottom borders of 4-bar row
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gridX, cursorY);
    ctx.lineTo(gridX + gridW, cursorY);
    ctx.moveTo(gridX, cursorY + rowH);
    ctx.lineTo(gridX + gridW, cursorY + rowH);
    ctx.stroke();

    // 4 Bars
    for (let colIdx = 0; colIdx < 4; colIdx++) {
      const cellX = gridX + colIdx * cellW;
      if (colIdx < 3) {
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cellX + cellW, cursorY);
        ctx.lineTo(cellX + cellW, cursorY + rowH);
        ctx.stroke();
      }

      const bar = rowBars[colIdx];
      if (!bar) continue;

      const chordText = formatBarChordsSummary(bar, secTranspose, displayKey);
      const printableChord = chordText === '—' ? '-' : chordText;
      const barRepeat = bar.repeat && bar.repeat > 1 ? bar.repeat : 1;
      const cueLabel = includeCues && (bar.cue || bar.voiceCountLocked)
        ? bar.cue || 'count'
        : null;
      const barLyrics = bar.lyrics?.trim() || null;

      const centerX = cellX + cellW / 2;
      const hasSub = Boolean(cueLabel || barLyrics);
      const chordY = hasSub ? cursorY + rowH * 0.34 : cursorY + rowH * 0.5;

      ctx.fillStyle = '#111827';
      ctx.font = `700 12.5px ${SANS_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fullChord = barRepeat > 1 ? `${printableChord} ×${barRepeat}` : printableChord;
      drawTruncatedCenteredText(ctx, fullChord, centerX, chordY, cellW - 8);

      if (cueLabel) {
        ctx.fillStyle = '#92400E';
        ctx.font = `600 8.5px ${SANS_FONT}`;
        drawTruncatedCenteredText(
          ctx,
          cueLabel,
          centerX,
          cursorY + (barLyrics ? rowH * 0.63 : rowH * 0.72),
          cellW - 8
        );
      }

      if (barLyrics) {
        ctx.fillStyle = '#334155';
        ctx.font = `500 8.5px ${SANS_FONT}`;
        drawTruncatedCenteredText(
          ctx,
          barLyrics,
          centerX,
          cursorY + (cueLabel ? rowH * 0.84 : rowH * 0.73),
          cellW - 8
        );
      }
    }

    // Right barline / :|| + optional pass badge
    const rightX = gridX + gridW + 4;
    ctx.fillStyle = '#111827';
    ctx.font = '700 12.5px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (isLastRow && isRepeat) {
      ctx.fillText(':||', rightX, cursorY + rowH / 2);
      if (passBadge) {
        const badgeX = rightX + 20;
        const badgeW = 34;
        const badgeH = 14;
        const badgeY = cursorY + rowH / 2 - badgeH / 2;
        ctx.fillStyle = '#FEF3C7';
        ctx.strokeStyle = '#FCD34D';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#78350F';
        ctx.font = `600 7.5px ${SANS_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(passBadge, badgeX + badgeW / 2, cursorY + rowH / 2 + 0.5, badgeW - 3);
      }
    } else {
      ctx.fillText('|', rightX + 2, cursorY + rowH / 2);
    }

    cursorY += rowH + (rowIdx < rows.length - 1 ? 6 : 0);
  }

  return cursorY - y + 14;
}

export async function downloadSongChordSheetPdf(
  song: Song,
  options: PdfExportOptions
): Promise<string> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Proceed even if webfont loading times out offline
    }
  }

  const displayKey = transposeKey(song.key, song.transpose || 0);
  const pages: PageSurface[] = [];
  let current = createA4PageSurface();
  pages.push(current);

  const drawTitleHeader = (ctx: CanvasRenderingContext2D): number => {
    const centerX = PAGE_W / 2;
    let y = MARGIN_TOP;

    ctx.font = `700 28px ${SERIF_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const titleMetrics = ctx.measureText(song.title);
    const titleWidth = Math.min(CONTENT_W - 24, titleMetrics.width);

    // Classic yellow highlighter underline under bottom 36% of title
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(centerX - titleWidth / 2 - 4, y + 19, titleWidth + 8, 12);

    ctx.fillStyle = '#111827';
    ctx.fillText(song.title, centerX, y, CONTENT_W - 12);
    y += 38;

    ctx.fillStyle = '#475569';
    ctx.font = `500 12px ${SANS_FONT}`;
    ctx.fillText(
      `${song.artist}  ·  Key ${displayKey}  ·  ${song.bpm} BPM  ·  ${song.timeSignature}`,
      centerX,
      y,
      CONTENT_W
    );
    y += 22;

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, y);
    ctx.lineTo(PAGE_W - MARGIN_X, y);
    ctx.stroke();

    return y + 18;
  };

  let startY = drawTitleHeader(current.ctx);
  let colY: [number, number] = [startY, startY];
  const maxY = PAGE_H - MARGIN_BOTTOM - 16;

  // Render Chord Sections across balanced 2 columns (natural left-to-right / shortest column flow)
  for (const section of song.sections) {
    const secH = measureSectionHeight(section, options.includeCues);

    // Pick shortest column on current page that fits
    let targetCol: 0 | 1 = colY[0] <= colY[1] ? 0 : 1;
    if (colY[targetCol] + secH > maxY) {
      const otherCol: 0 | 1 = targetCol === 0 ? 1 : 0;
      if (colY[otherCol] + secH <= maxY) {
        targetCol = otherCol;
      } else {
        // Start a fresh A4 page
        current = createA4PageSurface();
        pages.push(current);
        startY = MARGIN_TOP;
        colY = [startY, startY];
        targetCol = 0;
      }
    }

    const colX = MARGIN_X + targetCol * (COL_W + COL_GAP);
    const drawnH = drawChordSection(
      current.ctx,
      section,
      song,
      displayKey,
      options.includeCues,
      colX,
      colY[targetCol],
      COL_W
    );
    colY[targetCol] += drawnH;
  }

  // Optional Lyrics Section
  if (options.includeLyrics && song.lyrics.length > 0) {
    let lyricTop = Math.max(colY[0], colY[1]) + 10;
    if (lyricTop + 90 > maxY) {
      current = createA4PageSurface();
      pages.push(current);
      lyricTop = MARGIN_TOP;
    }

    current.ctx.strokeStyle = '#CBD5E1';
    current.ctx.lineWidth = 1;
    current.ctx.beginPath();
    current.ctx.moveTo(MARGIN_X, lyricTop);
    current.ctx.lineTo(PAGE_W - MARGIN_X, lyricTop);
    current.ctx.stroke();
    lyricTop += 14;

    current.ctx.fillStyle = '#64748B';
    current.ctx.font = `700 10.5px ${SANS_FONT}`;
    current.ctx.textAlign = 'left';
    current.ctx.textBaseline = 'top';
    current.ctx.fillText('LYRICS', MARGIN_X, lyricTop);
    lyricTop += 20;

    let lyricColY: [number, number] = [lyricTop, lyricTop];

    for (const lyr of song.lyrics) {
      current.ctx.font = `400 12.5px ${SANS_FONT}`;
      const wrappedBlock: string[] = [];
      for (const rawLine of lyr.lines) {
        const parts = wrapTextLines(current.ctx, rawLine, COL_W - 6);
        wrappedBlock.push(...parts);
      }
      const blockH = 20 + wrappedBlock.length * 19 + 14;

      let targetCol: 0 | 1 = lyricColY[0] <= lyricColY[1] ? 0 : 1;
      if (lyricColY[targetCol] + blockH > maxY) {
        const otherCol: 0 | 1 = targetCol === 0 ? 1 : 0;
        if (lyricColY[otherCol] + blockH <= maxY) {
          targetCol = otherCol;
        } else {
          current = createA4PageSurface();
          pages.push(current);
          lyricColY = [MARGIN_TOP, MARGIN_TOP];
          targetCol = 0;
        }
      }

      const lx = MARGIN_X + targetCol * (COL_W + COL_GAP);
      let ly = lyricColY[targetCol];

      current.ctx.fillStyle = '#475569';
      current.ctx.font = `700 11px ${SANS_FONT}`;
      current.ctx.textAlign = 'left';
      current.ctx.textBaseline = 'top';
      current.ctx.fillText(lyr.label.toUpperCase(), lx, ly, COL_W);
      ly += 18;

      current.ctx.fillStyle = '#111827';
      current.ctx.font = `400 12.5px ${SANS_FONT}`;
      for (const line of wrappedBlock) {
        current.ctx.fillText(line, lx, ly, COL_W);
        ly += 19;
      }

      lyricColY[targetCol] = ly + 12;
    }
  }

  // Page footers
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    p.ctx.fillStyle = '#94A3B8';
    p.ctx.font = `500 9.5px ${SANS_FONT}`;
    p.ctx.textAlign = 'left';
    p.ctx.textBaseline = 'bottom';
    p.ctx.fillText(`${song.title} · CHORDBOOK`, MARGIN_X, PAGE_H - 18);

    p.ctx.textAlign = 'right';
    p.ctx.fillText(
      `Page ${idx + 1} of ${totalPages}`,
      PAGE_W - MARGIN_X,
      PAGE_H - 18
    );
  });

  // Assemble crisp A4 jsPDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pages.forEach((p, idx) => {
    if (idx > 0) pdf.addPage();
    const imgData = p.canvas.toDataURL('image/jpeg', 0.94);
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, 'FAST');
  });

  const slug =
    song.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'chord-sheet';
  const filename = `${slug}-chord-sheet.pdf`;

  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  return filename;
}
