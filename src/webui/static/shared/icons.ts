/**
 * @fileoverview Lucide icon utilities for the WebUI static client.
 *
 * Handles converting icon names to PascalCase, hydrating Lucide icons inside
 * dynamically rendered DOM nodes, and initializing the global set of icons
 * required by the WebUI header and dialogs.
 */

type LucideIconNode = [string, Record<string, string | number>];

type LucideGlobal = {
  readonly createIcons: (options?: {
    readonly icons?: Record<string, LucideIconNode[]>;
    readonly nameAttr?: string;
    readonly attrs?: Record<string, string>;
    readonly root?: Document | Element | DocumentFragment;
  }) => void;
  readonly icons: Record<string, LucideIconNode[]>;
};

declare global {
  interface Window {
    lucide?: LucideGlobal;
  }
}

export function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

export function hydrateLucideIcons(iconNames: string[], root: Document | Element | DocumentFragment = document): void {
  const lucide = window.lucide;
  if (!lucide?.createIcons) {
    return;
  }

  const icons: Record<string, LucideIconNode[]> = {};
  iconNames.forEach((name) => {
    const pascal = toPascalCase(name);
    const iconNode =
      lucide.icons?.[pascal] ??
      lucide.icons?.[name] ??
      lucide.icons?.[name.toUpperCase()] ??
      lucide.icons?.[name.toLowerCase()];

    if (iconNode) {
      icons[pascal] = iconNode;
    } else {
      console.warn(`[WebUI] Lucide icon "${name}" not available in global registry.`);
    }
  });

  if (Object.keys(icons).length === 0) {
    return;
  }

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

export function initializeLucideIcons(): void {
  hydrateLucideIcons(['settings', 'lock', 'package', 'search', 'circle'], document);
}
