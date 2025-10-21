/**
 * @fileoverview Time conversion, formatting, and calculation utilities for human-readable
 * duration display, print time estimation, and ETA calculations. Provides consistent time
 * formatting across the application with support for elapsed time tracking, remaining time
 * calculations, and smart date/time formatting based on relative dates.
 *
 * Key Features:
 * - Time unit conversion (seconds/minutes) with rounding
 * - Human-readable duration formatting (e.g., "2h 15m", "45m", "30s")
 * - Date and time formatting (ISO dates, 24-hour time, localized strings)
 * - Elapsed time calculation from start timestamps
 * - Remaining time and ETA calculations based on progress
 * - Duration string parsing (e.g., "2h 15m" to seconds)
 * - Relative date formatting (today, tomorrow, specific date/time)
 * - Time range checking and next occurrence calculations
 *
 * Conversion Functions:
 * - secondsToMinutes(seconds): Seconds to minutes (rounded)
 * - minutesToSeconds(minutes): Minutes to seconds
 * - formatDuration(seconds): Seconds to "Xh Ym" or "Xm" or "Xs"
 * - formatMinutes(minutes): Minutes to "Xh Ym" or "Xm"
 * - parseDuration(string): "Xh Ym Zs" to seconds
 *
 * Date/Time Formatting:
 * - formatTime(date): "HH:MM:SS" 24-hour format
 * - formatDate(date): "YYYY-MM-DD" ISO date
 * - formatDateTime(date): Combined date and time
 * - formatETA(seconds): Smart relative ETA ("HH:MM", "Tomorrow HH:MM", or full date/time)
 *
 * Calculation Functions:
 * - calculateElapsed(start, end?): Elapsed seconds between timestamps
 * - calculateRemaining(elapsed, total): Remaining time (clamped to 0)
 * - calculateETA(progress, elapsed): Total estimated time from progress percentage
 *
 * Utility Functions:
 * - isWithinRange(date, start, end): Date range checking
 * - getTimeUntil(hour, minute): Seconds until next occurrence of time
 *
 * Usage Context:
 * Used throughout the UI for print job time displays, progress tracking, ETA calculations,
 * uptime displays, and any scenario requiring human-friendly time representation.
 */

// src/utils/time.utils.ts
// Time conversion and formatting utilities

/**
 * Convert seconds to minutes
 * @param seconds - Time in seconds
 * @returns Time in minutes (rounded)
 */
export function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

/**
 * Convert minutes to seconds
 * @param minutes - Time in minutes
 * @returns Time in seconds
 */
export function minutesToSeconds(minutes: number): number {
  return minutes * 60;
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
 * Format minutes as human-readable duration
 * @param minutes - Duration in minutes
 * @returns Formatted string (e.g., "2h 15m", "45m")
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
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
 * Calculate elapsed time from start
 * @param startTime - Start time
 * @param endTime - End time (defaults to now)
 * @returns Elapsed time in seconds
 */
export function calculateElapsed(startTime: Date, endTime: Date = new Date()): number {
  return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
}

/**
 * Calculate remaining time
 * @param elapsed - Elapsed time in seconds
 * @param total - Total estimated time in seconds
 * @returns Remaining time in seconds (0 if elapsed > total)
 */
export function calculateRemaining(elapsed: number, total: number): number {
  return Math.max(0, total - elapsed);
}

/**
 * Calculate ETA based on progress and elapsed time
 * @param progress - Progress percentage (0-100)
 * @param elapsedSeconds - Elapsed time in seconds
 * @returns Estimated total time in seconds
 */
export function calculateETA(progress: number, elapsedSeconds: number): number {
  if (progress <= 0) {
    return 0;
  }
  
  return Math.round((elapsedSeconds / progress) * 100);
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

/**
 * Parse duration string to seconds
 * @param duration - Duration string (e.g., "2h 15m", "45m", "30s")
 * @returns Duration in seconds
 */
export function parseDuration(duration: string): number {
  const parts = duration.toLowerCase().match(/(\d+)\s*([hms])/g);
  if (!parts) {
    return 0;
  }
  
  let seconds = 0;
  
  for (const part of parts) {
    const match = part.match(/(\d+)\s*([hms])/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      
      switch (unit) {
        case 'h':
          seconds += value * 3600;
          break;
        case 'm':
          seconds += value * 60;
          break;
        case 's':
          seconds += value;
          break;
      }
    }
  }
  
  return seconds;
}

/**
 * Check if a date is within a time range
 * @param date - Date to check
 * @param startDate - Start of range
 * @param endDate - End of range
 */
export function isWithinRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

/**
 * Get time until next occurrence of a specific time
 * @param targetHour - Target hour (0-23)
 * @param targetMinute - Target minute (0-59)
 * @returns Seconds until next occurrence
 */
export function getTimeUntil(targetHour: number, targetMinute = 0): number {
  const now = new Date();
  const target = new Date();
  
  target.setHours(targetHour, targetMinute, 0, 0);
  
  // If target time has passed today, set it for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  
  return Math.floor((target.getTime() - now.getTime()) / 1000);
}

