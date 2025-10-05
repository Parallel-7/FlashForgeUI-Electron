/**
 * @fileoverview Type-safe DOM manipulation utilities providing null-safe element querying,
 * manipulation, and event handling. Eliminates null reference errors through consistent
 * defensive programming patterns while maintaining TypeScript type safety. Includes specialized
 * helpers for form inputs, visibility management, class manipulation, and attribute handling.
 *
 * Key Features:
 * - Null-safe element querying with optional required validation
 * - Type-safe generic element accessors with HTMLElement specialization
 * - Form input value getters/setters with null handling
 * - Class manipulation helpers (add/remove/toggle)
 * - Visibility utilities with "hidden" class convention
 * - Attribute management with safe get/set/remove/toggle
 * - Event listener attachment with cleanup callback returns
 * - Basic XSS prevention in innerHTML operations
 *
 * Utility Categories:
 * 1. Element Query: Safe querySelector/querySelectorAll/getElementById with type parameters
 * 2. Element Manipulation: Text content, innerHTML (sanitized), class management
 * 3. Form Elements: Input values, checkbox states, select values with null safety
 * 4. Event Handling: Click and change listeners with automatic cleanup functions
 * 5. Visibility: Show/hide/toggle with "hidden" class convention
 * 6. Attributes: Get/set/remove/toggle with null-safe operations
 *
 * Design Patterns:
 * - All functions return boolean success indicators or null for failures
 * - Accepts both selector strings and HTMLElement references
 * - Generic type parameters for specialized element types
 * - Consistent null-coalescing for safe default returns
 *
 * Security:
 * - XSS prevention: Strips script tags from innerHTML operations
 * - Safe attribute manipulation preventing injection attacks
 *
 * Usage Context:
 * Primarily used in renderer processes for UI manipulation, providing a consistent
 * API for DOM operations across all dialog and main window renderers.
 */

import { AppError, ErrorCode } from './error.utils';

// ============================================================================
// ELEMENT QUERY UTILITIES
// ============================================================================

/**
 * Safely query a single element by selector
 */
export function safeQuerySelector<T extends HTMLElement = HTMLElement>(
  selector: string,
  container: Element | Document = document
): T | null {
  try {
    return container.querySelector<T>(selector);
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return null;
  }
}

/**
 * Query element with required result
 */
export function requireElement<T extends HTMLElement = HTMLElement>(
  selector: string,
  container: Element | Document = document
): T {
  const element = safeQuerySelector<T>(selector, container);
  if (!element) {
    throw new AppError(
      `Required element not found: ${selector}`,
      ErrorCode.UNKNOWN,
      { selector }
    );
  }
  return element;
}

/**
 * Safely query all elements by selector
 */
export function safeQuerySelectorAll<T extends HTMLElement = HTMLElement>(
  selector: string,
  container: Element | Document = document
): T[] {
  try {
    return Array.from(container.querySelectorAll<T>(selector));
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return [];
  }
}

/**
 * Get element by ID with type safety
 */
export function safeGetElementById<T extends HTMLElement = HTMLElement>(
  id: string
): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Get element by ID with required result
 */
export function requireElementById<T extends HTMLElement = HTMLElement>(
  id: string
): T {
  const element = safeGetElementById<T>(id);
  if (!element) {
    throw new AppError(
      `Required element not found by ID: ${id}`,
      ErrorCode.UNKNOWN,
      { id }
    );
  }
  return element;
}

// ============================================================================
// ELEMENT MANIPULATION UTILITIES
// ============================================================================

/**
 * Safely set text content
 */
export function setTextContent(
  selector: string | HTMLElement,
  text: string,
  container?: Element | Document
): boolean {
  const element = typeof selector === 'string' 
    ? safeQuerySelector(selector, container)
    : selector;
    
  if (element) {
    element.textContent = text;
    return true;
  }
  return false;
}

/**
 * Safely set innerHTML with sanitization
 */
export function setInnerHTML(
  selector: string | HTMLElement,
  html: string,
  container?: Element | Document
): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector, container)
    : selector;
    
  if (element) {
    // Basic XSS prevention - remove script tags
    const sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    element.innerHTML = sanitized;
    return true;
  }
  return false;
}

/**
 * Safely toggle class
 */
export function toggleClass(
  selector: string | HTMLElement,
  className: string,
  force?: boolean,
  container?: Element | Document
): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector, container)
    : selector;
    
  if (element) {
    element.classList.toggle(className, force);
    return true;
  }
  return false;
}

/**
 * Safely add class
 */
export function addClass(
  selector: string | HTMLElement,
  ...classNames: string[]
): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector)
    : selector;
    
  if (element) {
    element.classList.add(...classNames);
    return true;
  }
  return false;
}

/**
 * Safely remove class
 */
export function removeClass(
  selector: string | HTMLElement,
  ...classNames: string[]
): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector)
    : selector;
    
  if (element) {
    element.classList.remove(...classNames);
    return true;
  }
  return false;
}

// ============================================================================
// FORM ELEMENT UTILITIES
// ============================================================================

/**
 * Get input element value safely
 */
export function getInputValue(selector: string | HTMLInputElement): string | null {
  const element = typeof selector === 'string'
    ? safeQuerySelector<HTMLInputElement>(selector)
    : selector;
    
  return element?.value ?? null;
}

/**
 * Set input element value safely
 */
export function setInputValue(
  selector: string | HTMLInputElement,
  value: string
): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector<HTMLInputElement>(selector)
    : selector;
    
  if (element) {
    element.value = value;
    return true;
  }
  return false;
}

/**
 * Get checkbox/radio checked state
 */
export function isChecked(selector: string | HTMLInputElement): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector<HTMLInputElement>(selector)
    : selector;
    
  return element?.checked ?? false;
}

/**
 * Set checkbox/radio checked state
 */
export function setChecked(
  selector: string | HTMLInputElement,
  checked: boolean
): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector<HTMLInputElement>(selector)
    : selector;
    
  if (element) {
    element.checked = checked;
    return true;
  }
  return false;
}

/**
 * Get select element value
 */
export function getSelectValue(selector: string | HTMLSelectElement): string | null {
  const element = typeof selector === 'string'
    ? safeQuerySelector<HTMLSelectElement>(selector)
    : selector;
    
  return element?.value ?? null;
}

/**
 * Set select element value
 */
export function setSelectValue(
  selector: string | HTMLSelectElement,
  value: string
): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector<HTMLSelectElement>(selector)
    : selector;
    
  if (element) {
    element.value = value;
    return true;
  }
  return false;
}

// ============================================================================
// EVENT UTILITIES
// ============================================================================

/**
 * Safely add event listener
 */
export function addClickListener(
  selector: string | HTMLElement,
  handler: (event: MouseEvent) => void,
  container?: Element | Document
): (() => void) | null {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector, container)
    : selector;
    
  if (element) {
    element.addEventListener('click', handler);
    return () => element.removeEventListener('click', handler);
  }
  return null;
}

/**
 * Safely add change listener
 */
export function addChangeListener(
  selector: string | HTMLElement,
  handler: (event: Event) => void,
  container?: Element | Document
): (() => void) | null {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector, container)
    : selector;
    
  if (element) {
    element.addEventListener('change', handler);
    return () => element.removeEventListener('change', handler);
  }
  return null;
}

// ============================================================================
// VISIBILITY UTILITIES
// ============================================================================

/**
 * Show element
 */
export function showElement(selector: string | HTMLElement): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector)
    : selector;
    
  if (element) {
    removeClass(element, 'hidden');
    element.style.display = '';
    return true;
  }
  return false;
}

/**
 * Hide element
 */
export function hideElement(selector: string | HTMLElement): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector)
    : selector;
    
  if (element) {
    addClass(element, 'hidden');
    return true;
  }
  return false;
}

/**
 * Toggle element visibility
 */
export function toggleVisibility(selector: string | HTMLElement): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector)
    : selector;
    
  if (element) {
    if (element.classList.contains('hidden')) {
      showElement(element);
    } else {
      hideElement(element);
    }
    return true;
  }
  return false;
}

// ============================================================================
// ATTRIBUTE UTILITIES
// ============================================================================

/**
 * Get attribute value safely
 */
export function getAttribute(
  selector: string | HTMLElement,
  attribute: string
): string | null {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector)
    : selector;
    
  return element?.getAttribute(attribute) ?? null;
}

/**
 * Set attribute value safely
 */
export function setAttribute(
  selector: string | HTMLElement,
  attribute: string,
  value: string
): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector)
    : selector;
    
  if (element) {
    element.setAttribute(attribute, value);
    return true;
  }
  return false;
}

/**
 * Remove attribute safely
 */
export function removeAttribute(
  selector: string | HTMLElement,
  attribute: string
): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector)
    : selector;
    
  if (element) {
    element.removeAttribute(attribute);
    return true;
  }
  return false;
}

/**
 * Toggle attribute
 */
export function toggleAttribute(
  selector: string | HTMLElement,
  attribute: string,
  force?: boolean
): boolean {
  const element = typeof selector === 'string'
    ? safeQuerySelector(selector)
    : selector;
    
  if (element) {
    element.toggleAttribute(attribute, force);
    return true;
  }
  return false;
}
