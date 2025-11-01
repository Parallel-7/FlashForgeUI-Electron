/**
 * @fileoverview Shared Lucide icon utilities for renderer processes.
 *
 * Resolves the Lucide runtime in secured Electron environments, provides
 * helpers for initializing data-lucide declarations, and exposes utilities
 * for programmatic SVG creation and custom numbered badge icons.
 */

import type { IconNode } from 'lucide';

const SVG_NS = 'http://www.w3.org/2000/svg';

type LucideModule = {
  readonly createIcons: (options?: {
    readonly icons?: Record<string, IconNode>;
    readonly nameAttr?: string;
    readonly attrs?: Record<string, string>;
    readonly root?: Document | Element | DocumentFragment;
  }) => void;
  readonly createElement: (iconNode: IconNode, attrs?: Record<string, string | number>) => SVGElement;
  readonly icons: Record<string, IconNode>;
};

let cachedLucide: LucideModule | null = null;

function normalizeClassName(className?: string | string[]): string | undefined {
  if (!className) {
    return undefined;
  }
  return Array.isArray(className) ? className.join(' ') : className;
}

function resolveLucide(): LucideModule {
  if (cachedLucide) {
    return cachedLucide;
  }

  const resolved = attemptResolveLucide();
  if (!resolved) {
    throw new Error('Lucide runtime is not available. Ensure the lucide package is installed and accessible.');
  }
  cachedLucide = resolved;
  return resolved;
}

function attemptResolveLucide(): LucideModule | null {
  const globalCandidate = (globalThis as { lucide?: LucideModule }).lucide;
  if (globalCandidate?.createIcons) {
    return globalCandidate;
  }

  if (typeof require !== 'function') {
    return null;
  }

  try {
    const direct = require('lucide') as LucideModule;
    if (direct && typeof direct.createIcons === 'function') {
      return direct;
    }
  } catch {
    // Fall back to manual resolution paths below.
  }

  try {
    const path = require('path') as typeof import('path');
    const candidateDirs: string[] = [];

    if (typeof __dirname === 'string') {
      candidateDirs.push(__dirname);
      candidateDirs.push(path.resolve(__dirname, '..'));
      candidateDirs.push(path.resolve(__dirname, '../..'));
    }

    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      candidateDirs.push(process.cwd());
    }

    for (const dir of new Set(candidateDirs)) {
      try {
        const modulePath = path.join(dir, 'node_modules/lucide');
        const mod = require(modulePath) as LucideModule;
        if (mod && typeof mod.createIcons === 'function') {
          return mod;
        }
      } catch {
        // Try next candidate path.
      }
    }
  } catch {
    // Ignore path resolution errors and fall back to null.
  }

  return null;
}

function assertIcon(name: string, icon: IconNode | undefined): IconNode {
  if (!icon) {
    throw new Error(`Lucide icon "${name}" was requested but not found.`);
  }
  return icon;
}

export interface IconConfig {
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly color?: string;
  readonly className?: string | string[];
  readonly attrs?: Record<string, string>;
}

export interface LucideInitializationOptions {
  readonly strokeWidth?: number;
  readonly className?: string | string[];
  readonly attrs?: Record<string, string>;
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function resolveIconNode(lucide: LucideModule, name: string): IconNode | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!lucide.icons) {
    console.error('[Lucide] lucide.icons is undefined or null');
    return undefined;
  }

  const candidates = new Set<string>();
  candidates.add(trimmed);
  candidates.add(trimmed.charAt(0).toUpperCase() + trimmed.slice(1));
  candidates.add(toPascalCase(trimmed));

  console.log(`[Lucide] Resolving "${name}", trying candidates:`, Array.from(candidates));

  for (const candidate of candidates) {
    const iconNode = lucide.icons?.[candidate];
    if (iconNode) {
      console.log(`[Lucide] Found icon "${name}" as "${candidate}"`);
      return iconNode;
    }
  }

  console.warn(`[Lucide] Could not resolve "${name}". Tried:`, Array.from(candidates));
  console.log('[Lucide] Available icons sample:', Object.keys(lucide.icons).slice(0, 10));

  return undefined;
}

export function getLucideIcons(...names: string[]): Record<string, IconNode> {
  const lucide = resolveLucide();
  return names.reduce<Record<string, IconNode>>((acc, rawName) => {
    const key = rawName.trim();
    if (!key) {
      return acc;
    }
    const iconNode = resolveIconNode(lucide, key);
    if (iconNode) {
      const pascalKey = toPascalCase(key);
      acc[pascalKey] = iconNode;
      console.log(`[Lucide] Loaded "${key}" as "${pascalKey}"`);
    } else {
      console.warn(`[Lucide] Icon "${rawName}" is not available in the loaded lucide icons set.`);
    }
    return acc;
  }, {});
}

export function getLucideIcon(name: string): IconNode {
  const lucide = resolveLucide();
  const iconNode = resolveIconNode(lucide, name);
  return assertIcon(name, iconNode);
}

export function initializeLucideIcons(
  root: Document | Element | DocumentFragment,
  icons: Record<string, IconNode>,
  options: LucideInitializationOptions = {}
): void {
  const lucide = resolveLucide();
  const iconKeys = Object.keys(icons);
  console.log('[Lucide] initializeLucideIcons called with:', {
    iconKeys,
    iconCount: iconKeys.length,
    sampleIcon: icons[iconKeys[0]],
  });
  const { strokeWidth = 2, className = 'lucide-icon', attrs = {} } = options;
  const classValue = normalizeClassName(className) ?? 'lucide-icon';

  const attributeEntries: Record<string, string> = {
    'stroke-width': `${strokeWidth}`,
    'aria-hidden': 'true',
    focusable: 'false',
    class: classValue,
    ...attrs,
  };

  lucide.createIcons({
    icons,
    nameAttr: 'data-lucide',
    attrs: attributeEntries,
    root,
  });
}

export function createIcon(icon: IconNode, config: IconConfig = {}): SVGElement {
  const lucide = resolveLucide();
  const {
    size = 24,
    strokeWidth = 2,
    color,
    className,
    attrs = {},
  } = config;

  const normalizedClass = normalizeClassName(className);
  const elementAttributes: Record<string, string | number> = {
    width: size,
    height: size,
    'stroke-width': strokeWidth,
    'aria-hidden': 'true',
    focusable: 'false',
    ...attrs,
  };

  if (normalizedClass) {
    elementAttributes.class = normalizedClass;
  }

  const element = lucide.createElement(icon, elementAttributes);

  if (color) {
    element.setAttribute('stroke', color);
  }

  if (!element.getAttribute('fill')) {
    element.setAttribute('fill', 'none');
  }

  return element;
}

export function createNumberedBadge(
  number: 1 | 2 | 3,
  config: IconConfig = {}
): SVGElement {
  const circleIcon = getLucideIcon('circle');
  const badge = createIcon(circleIcon, {
    size: config.size ?? 16,
    strokeWidth: config.strokeWidth ?? 2,
    className: config.className,
    color: config.color,
    attrs: config.attrs,
  });

  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', '12');
  text.setAttribute('y', '12');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('font-size', '12');
  text.setAttribute('font-weight', 'bold');
  text.setAttribute('fill', 'currentColor');
  text.textContent = number.toString();

  badge.appendChild(text);
  return badge;
}
