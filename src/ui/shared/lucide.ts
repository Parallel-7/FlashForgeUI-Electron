/**
 * @fileoverview Shared helper for initializing Lucide icons in dialog renderer contexts.
 *
 * Leverages the global UMD `window.lucide` exposed by bundled lucide.min.js to hydrate
 * `<i data-lucide="...">` placeholders without importing the ES module build. Keeps the
 * icon normalization logic in one place so dialogs can register the icons they need with a
 * single call.
 */

type LucideGlobal = {
  readonly createIcons?: (options?: {
    readonly icons?: Record<string, unknown>;
    readonly nameAttr?: string;
    readonly attrs?: Record<string, string>;
    readonly root?: Document | Element | DocumentFragment;
  }) => void;
  readonly icons?: Record<string, unknown>;
};

export interface LucideHelpers {
  initializeLucideIconsFromGlobal(iconNames: string[], root?: Document | Element | DocumentFragment): void;
}

declare global {
  interface Window {
    lucideHelpers?: LucideHelpers;
  }
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

/**
 * Hydrates lucide icons within the provided root node using the global UMD bundle.
 * @param iconNames Icon identifiers (kebab-case) matching `data-lucide` attributes.
 * @param root DOM root to search for lucide placeholders. Defaults to `document`.
 */
function initializeLucideIconsFromGlobal(
  iconNames: string[],
  root: Document | Element | DocumentFragment = document
): void {
  const lucide = (window as typeof window & { lucide?: LucideGlobal }).lucide;
  if (!lucide?.createIcons) {
    console.warn('[Lucide] Global lucide library not available for renderer initialization');
    return;
  }

  const icons: Record<string, unknown> = {};
  iconNames.forEach((name) => {
    const pascal = toPascalCase(name);
    const node = lucide.icons?.[pascal];
    if (node) {
      icons[pascal] = node;
    } else {
      console.warn(`[Lucide] Icon "${name}" not found in global registry as "${pascal}"`);
    }
  });

  lucide.createIcons({
    icons,
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

const helpers: LucideHelpers = {
  initializeLucideIconsFromGlobal,
};

if (typeof window !== 'undefined') {
  window.lucideHelpers = {
    ...window.lucideHelpers,
    ...helpers,
  };
}

export { initializeLucideIconsFromGlobal };
