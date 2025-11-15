/**
 * @fileoverview Shared DOM helper utilities for the WebUI static client.
 *
 * Provides lightweight wrappers for common DOM interactions including
 * element lookup, visibility toggling, text updates, and toast notifications.
 * These helpers keep `app.ts` focused on higher-level orchestration logic.
 */

export function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function showElement(id: string): void {
  const element = $(id);
  if (element) {
    element.classList.remove('hidden');
  }
}

export function hideElement(id: string): void {
  const element = $(id);
  if (element) {
    element.classList.add('hidden');
  }
}

export function setTextContent(id: string, text: string): void {
  const element = $(id);
  if (element) {
    element.textContent = text;
  }
}

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const toast = $('toast');
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.className = `toast ${type}`;
  showElement('toast');
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => hideElement('toast'), 300);
  }, 3000);
}
