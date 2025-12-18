/**
 * @fileoverview Shared helper for initializing Lucide icons in dialog renderer contexts.
 *
 * Uses the `lucide` library to hydrate `<i data-lucide="...">` placeholders.
 * Keeps the icon normalization logic in one place so dialogs can register the icons they need with a
 * single call.
 */

import { createIcons, icons } from 'lucide';

/**
 * Hydrates lucide icons within the provided root node.
 * @param iconNames Icon identifiers (kebab-case) matching `data-lucide` attributes.
 * @param root DOM root to search for lucide placeholders. Defaults to `document`.
 */
export function initializeLucideIconsFromGlobal(
  iconNames: string[],
  root: Document | Element | DocumentFragment = document
): void {
  const selectedIcons: Record<string, unknown> = {};
  
  iconNames.forEach((name) => {
    // Convert kebab-case to PascalCase (e.g., "arrow-right" -> "ArrowRight")
    const pascalName = name
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');

    // Lucide icons are exported as PascalCase keys in the `icons` object
    const iconNode = (icons as Record<string, unknown>)[pascalName];
    
    if (iconNode) {
      selectedIcons[pascalName] = iconNode;
    } else {
      console.warn(`[Lucide] Icon "${name}" not found in registry as "${pascalName}"`);
    }
  });

  createIcons({
    icons: selectedIcons,
    nameAttr: 'data-lucide',
    attrs: {
      'stroke-width': '2',
      'aria-hidden': 'true',
      focusable: 'false',
      class: 'lucide-icon',
    },
    root,
  });
}
