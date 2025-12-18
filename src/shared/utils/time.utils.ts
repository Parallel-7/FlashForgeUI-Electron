/**
 * @fileoverview Shared time formatting utilities for consistent time display across
 * the main and renderer processes.
 */

// Copied from main process utils to avoid complex imports, ensuring availability in renderer

/**
 * Convert seconds to minutes
 * @param seconds - Time in seconds
 * @returns Time in minutes (rounded)
 */
export function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

/**
 * Format seconds as human-readable duration
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "2h 15m", "45m", "30s")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  
  return `${minutes}m`;
}

/**
 * Format job elapsed time as mm:ss or HH:mm:ss
 * @param seconds - Elapsed time in seconds
 * @returns Formatted time string (e.g., "03:45", "16:00", "1:25:30")
 */
export function formatJobTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}

/**
 * Format timestamp as time string
 * @param date - Date to format
 * @returns Formatted time (e.g., "14:30:45")
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Format date as short date string
 * @param date - Date to format
 * @returns Formatted date (e.g., "2024-03-15")
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format date and time together
 * @param date - Date to format
 * @returns Formatted date and time
 */
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Format ETA as date/time string
 * @param etaSeconds - ETA in seconds from now
 * @returns Formatted ETA string
 */
export function formatETA(etaSeconds: number): string {
  const eta = new Date(Date.now() + etaSeconds * 1000);
  const now = new Date();
  
  // If ETA is today, show time only
  if (eta.toDateString() === now.toDateString()) {
    return formatTime(eta);
  }
  
  // If ETA is tomorrow, show "Tomorrow HH:MM"
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (eta.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${formatTime(eta)}`;
  }
  
  // Otherwise show full date and time
  return formatDateTime(eta);
}
