import type { CanvasFile, GameSaveFile, Stroke } from '@quiet-year/shared';
import {
  normalizeStrokes, contentBounds, normalizeSaveFile, SAVE_FILE_EXTENSION,
} from '@quiet-year/shared';
import { renderToCanvas } from './render';

const FILE_FORMAT = 'quiet-year-canvas';
const FILE_VERSION = 1;
export const CANVAS_FILE_EXTENSION = '.quietyear.json';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function timestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

/** Write the whole canvas out as an editable JSON file. */
export function saveCanvasFile(strokes: Stroke[], roomId: string | null) {
  const file: CanvasFile = {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    savedAt: Date.now(),
    ...(roomId ? { roomId } : {}),
    strokes,
  };
  const name = `quiet-year-map-${roomId ?? 'local'}-${timestamp()}${CANVAS_FILE_EXTENSION}`;
  download(new Blob([JSON.stringify(file)], { type: 'application/json' }), name);
}

/** Write a whole game - state, chronicle and map - out to a file. */
export function saveGameFile(save: GameSaveFile) {
  const name = `quiet-year-game-${save.roomId}-${timestamp()}${SAVE_FILE_EXTENSION}`;
  download(new Blob([JSON.stringify(save)], { type: 'application/json' }), name);
}

/**
 * Parse a picked game file. The same reader serves both purposes a save has:
 * handing it back to the server to resume, and opening it here to read.
 */
export async function readGameSaveFile(
  file: File,
): Promise<{ save: GameSaveFile } | { error: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { error: 'That file is not valid JSON' };
  }
  return normalizeSaveFile(parsed);
}

/** Parse a picked file back into strokes, or explain why it cannot be used. */
export async function readCanvasFile(file: File): Promise<{ strokes: Stroke[] } | { error: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { error: 'That file is not valid JSON' };
  }

  // Accept both a wrapped file and a bare array of strokes.
  const raw = Array.isArray(parsed)
    ? parsed
    : (parsed as Partial<CanvasFile> | null)?.strokes;

  if (!Array.isArray(raw)) {
    return { error: 'That file does not contain a saved map' };
  }

  const strokes = normalizeStrokes(raw);
  if (strokes.length === 0) {
    return { error: 'That map file is empty or unreadable' };
  }
  return { strokes };
}

/** Export the drawn area as a PNG image. */
export function exportPng(strokes: Stroke[], roomId: string | null, scale = 2): string | null {
  const bounds = contentBounds(strokes);
  if (!bounds) return 'There is nothing drawn to export yet';

  const margin = 40;
  const padded = {
    minX: bounds.minX - margin,
    minY: bounds.minY - margin,
    maxX: bounds.maxX + margin,
    maxY: bounds.maxY + margin,
  };

  // Keep very large maps within what browsers will allocate for a canvas.
  const maxDimension = 8000;
  const longest = Math.max(padded.maxX - padded.minX, padded.maxY - padded.minY) * scale;
  const safeScale = longest > maxDimension ? (maxDimension / longest) * scale : scale;

  const canvas = renderToCanvas(strokes, padded, safeScale);
  canvas.toBlob(blob => {
    if (blob) download(blob, `quiet-year-map-${roomId ?? 'local'}-${timestamp()}.png`);
  }, 'image/png');
  return null;
}
