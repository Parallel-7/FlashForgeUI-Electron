/**
 * @fileoverview Formatting helpers and type guards for WebUI job metadata.
 *
 * Centralizes logic for determining AD5X job characteristics along with
 * formatting utilities for materials, durations, ETA display, and lifetime
 * usage statistics. These helpers are shared across multiple WebUI features.
 */

import type { AD5XToolData, WebUIJobFile } from '../app.js';

export function isAD5XJobFile(job?: WebUIJobFile): job is WebUIJobFile & {
  metadataType: 'ad5x';
  toolDatas: AD5XToolData[];
} {
  return Boolean(job && job.metadataType === 'ad5x' && Array.isArray(job.toolDatas));
}

export function isMultiColorJobFile(job?: WebUIJobFile): job is WebUIJobFile & {
  metadataType: 'ad5x';
  toolDatas: AD5XToolData[];
} {
  return isAD5XJobFile(job) && job.toolDatas.length > 1;
}

export function normalizeMaterialString(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function colorsDiffer(toolColor: string, slotColor: string | null): boolean {
  if (!toolColor) {
    return false;
  }
  return normalizeMaterialString(toolColor) !== normalizeMaterialString(slotColor);
}

export function materialsMatch(toolMaterial: string, slotMaterial: string | null): boolean {
  if (!toolMaterial) {
    return false;
  }
  return normalizeMaterialString(toolMaterial) === normalizeMaterialString(slotMaterial);
}

export function buildMaterialBadgeTooltip(job: WebUIJobFile): string {
  if (!isAD5XJobFile(job)) {
    return 'Multi-color job';
  }

  const materials = job.toolDatas.map((tool) => `Tool ${tool.toolId + 1}: ${tool.materialName}`).join('\n');
  return `Requires material station\n${materials}`;
}

export function formatJobPrintingTime(printingTime?: number): string {
  if (!printingTime || Number.isNaN(printingTime) || printingTime <= 0) {
    return '';
  }

  const totalMinutes = Math.round(printingTime / 60);
  if (totalMinutes <= 0) {
    return `${Math.max(printingTime, 1)}s`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }

  return `${mins}:00`;
}

export function formatETA(remainingMinutes: number): string {
  const now = new Date();
  const completionTime = new Date(now.getTime() + remainingMinutes * 60 * 1000);

  return completionTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatLifetimePrintTime(minutes: number): string {
  if (!minutes || Number.isNaN(minutes) || minutes <= 0) {
    return '--';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours >= 1000) {
    return `${hours.toLocaleString()}h ${remainingMinutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${remainingMinutes}m`;
}

export function formatLifetimeFilament(meters: number): string {
  if (!meters || Number.isNaN(meters) || meters <= 0) {
    return '--';
  }

  return `${meters.toFixed(2)}m`;
}

/**
 * Format elapsed time from seconds to H:MM:SS or MM:SS.
 * Mirrors the desktop's formatJobTime in src/shared/utils/time.utils.ts.
 */
export function formatElapsedSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Convert a firmware ETA string (HH:MM remaining) to a clock time string.
 * Mirrors the desktop's formatETAToCompletionTime in job-stats.ts.
 */
export function formatETAFromString(hhmm: string): string {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const completion = new Date(Date.now() + (hours * 60 + minutes) * 60_000);
  return completion.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
