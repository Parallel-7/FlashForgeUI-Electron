/**
 * Safe DOM manipulation utilities to prevent null reference errors.
 * Provides type-safe element queries and manipulation helpers.
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
