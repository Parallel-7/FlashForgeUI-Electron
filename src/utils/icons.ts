/**
 * @fileoverview Shared Lucide icon utilities for renderer processes.
 *
 * Resolves the Lucide runtime in secured Electron environments, provides
 * helpers for initializing data-lucide declarations, and exposes utilities
 * for programmatic SVG creation and custom numbered badge icons.
 */

import type { IconNode } from 'lucide';
import lucideCreateElement from 'lucide/dist/esm/createElement.js';
import lucideReplaceElement from 'lucide/dist/esm/replaceElement.js';
import Menu from 'lucide/dist/esm/icons/menu.js';
import Printer from 'lucide/dist/esm/icons/printer.js';
import SettingsIcon from 'lucide/dist/esm/icons/settings.js';
import BarChart3 from 'lucide/dist/esm/icons/chart-column.js';
import Grid3x3 from 'lucide/dist/esm/icons/grid-3x3.js';
import Pin from 'lucide/dist/esm/icons/pin.js';
import Minus from 'lucide/dist/esm/icons/minus.js';
import Square from 'lucide/dist/esm/icons/square.js';
import CloseIcon from 'lucide/dist/esm/icons/x.js';
import CheckCircle from 'lucide/dist/esm/icons/circle-check-big.js';
import XCircle from 'lucide/dist/esm/icons/circle-x.js';
import Pencil from 'lucide/dist/esm/icons/pencil.js';
import RotateCcw from 'lucide/dist/esm/icons/rotate-ccw.js';
import Plug from 'lucide/dist/esm/icons/plug.js';
import Package from 'lucide/dist/esm/icons/package.js';
import Search from 'lucide/dist/esm/icons/search.js';
import AlertTriangle from 'lucide/dist/esm/icons/triangle-alert.js';
import Circle from 'lucide/dist/esm/icons/circle.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

type ReplaceElementFn = (
  element: Element,
  options: {
    nameAttr: string;
    icons: Record<string, IconNode>;
    attrs: Record<string, string>;
  }
) => void;

const replaceElement = lucideReplaceElement as ReplaceElementFn;

interface CreateIconsOptions {
  readonly icons?: Record<string, IconNode>;
  readonly nameAttr?: string;
  readonly attrs?: Record<string, string>;
  readonly root?: Document | Element | DocumentFragment;
  readonly inTemplates?: boolean;
}

type LucideRuntime = {
  readonly createIcons: (options?: CreateIconsOptions) => void;
  readonly createElement: typeof lucideCreateElement;
};

let cachedRuntime: LucideRuntime | null = null;
function createIconsRuntime({
  icons = {},
  nameAttr = 'data-lucide',
  attrs = {},
  root = typeof document !== 'undefined' ? document : undefined,
  inTemplates
}: CreateIconsOptions = {}): void {
  if (!Object.keys(icons).length) {
    throw new Error(
      'Please provide an icons object.\nIf you want to use all the icons you can import it like:\n `import { createIcons, icons } from \'lucide\';\nlucide.createIcons({icons});`'
    );
  }

  if (!root) {
    throw new Error('`createIcons()` only works in a browser environment.');
  }

  const elementsToReplace = Array.from(root.querySelectorAll(`[${nameAttr}]`));
  elementsToReplace.forEach((element) => {
    replaceElement(element, { nameAttr, icons, attrs });
  });

  if (inTemplates) {
    const templates = Array.from(root.querySelectorAll('template'));
    templates.forEach((template) => {
      createIconsRuntime({
        icons,
        nameAttr,
        attrs,
        root: (template as HTMLTemplateElement).content,
        inTemplates
      });
    });
  }

  if (nameAttr === 'data-lucide') {
    const deprecatedElements = root.querySelectorAll('[icon-name]');
    if (deprecatedElements.length > 0) {
      console.warn(
        '[Lucide] Some icons were found with the deprecated icon-name attribute. Support will be removed in a future release.'
      );
      Array.from(deprecatedElements).forEach((element) => {
        replaceElement(element, { nameAttr: 'icon-name', icons, attrs });
      });
    }
  }
}

const moduleRuntime: LucideRuntime = {
  createIcons: createIconsRuntime,
  createElement: lucideCreateElement
};

const ICON_REGISTRY: Map<string, IconNode> = new Map();

function normalizeClassName(className?: string | string[]): string | undefined {
  if (!className) {
    return undefined;
  }
  return Array.isArray(className) ? className.join(' ') : className;
}

function resolveLucideRuntime(): LucideRuntime {
  if (cachedRuntime) {
    return cachedRuntime;
  }

  const globalCandidate = (globalThis as { lucide?: Partial<LucideRuntime> }).lucide;
  if (globalCandidate?.createIcons && globalCandidate?.createElement) {
    cachedRuntime = {
      createIcons: globalCandidate.createIcons,
      createElement: globalCandidate.createElement
    };
    return cachedRuntime;
  }

  cachedRuntime = moduleRuntime;
  return cachedRuntime;
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

function normalizeIconKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function registerIcon(icon: IconNode, ...aliases: string[]): void {
  aliases.forEach((alias) => {
    ICON_REGISTRY.set(normalizeIconKey(alias), icon);
  });
}

registerIcon(Menu, 'menu');
registerIcon(Printer, 'printer');
registerIcon(SettingsIcon, 'settings');
registerIcon(BarChart3, 'bar-chart-3', 'chart-column');
registerIcon(Grid3x3, 'grid-3x3', 'grid3x3');
registerIcon(Pin, 'pin');
registerIcon(Minus, 'minus');
registerIcon(Square, 'square');
registerIcon(CloseIcon, 'x');
registerIcon(CheckCircle, 'check-circle');
registerIcon(XCircle, 'x-circle');
registerIcon(Pencil, 'pencil');
registerIcon(RotateCcw, 'rotate-ccw');
registerIcon(Plug, 'plug');
registerIcon(Package, 'package');
registerIcon(Search, 'search');
registerIcon(AlertTriangle, 'alert-triangle', 'triangle-alert');
registerIcon(Circle, 'circle');

function resolveIconNode(name: string): IconNode | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return undefined;
  }

  const candidates = new Set<string>([
    trimmed,
    trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    toPascalCase(trimmed)
  ]);

  for (const candidate of candidates) {
    const iconNode = ICON_REGISTRY.get(normalizeIconKey(candidate));
    if (iconNode) {
      return iconNode;
    }
  }

  console.warn(`[Lucide] Icon "${name}" is not registered in the renderer bundle.`);
  return undefined;
}

export function getLucideIcons(...names: string[]): Record<string, IconNode> {
  return names.reduce<Record<string, IconNode>>((acc, rawName) => {
    const key = rawName.trim();
    if (!key) {
      return acc;
    }
    const iconNode = resolveIconNode(key);
    if (iconNode) {
      const pascalKey = toPascalCase(key);
      acc[pascalKey] = iconNode;
    } else {
      console.warn(`[Lucide] Icon "${rawName}" is not available in the renderer registry.`);
    }
    return acc;
  }, {});
}

export function getLucideIcon(name: string): IconNode {
  const iconNode = resolveIconNode(name);
  return assertIcon(name, iconNode);
}

export function initializeLucideIcons(
  root: Document | Element | DocumentFragment,
  icons: Record<string, IconNode>,
  options: LucideInitializationOptions = {}
): void {
  const lucide = resolveLucideRuntime();
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
  const lucide = resolveLucideRuntime();
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

interface WindowLucideHelpers {
  initializeLucideIconsFromGlobal(iconNames: string[], root?: Document | Element | DocumentFragment): void;
}

declare global {
  interface Window {
    lucideHelpers?: WindowLucideHelpers;
  }
}

export function initializeUniversalLucideIcons(
  iconNames: string[],
  root: Document | Element | DocumentFragment = document
): void {
  if (typeof window !== 'undefined' && window.lucideHelpers?.initializeLucideIconsFromGlobal) {
    const globalLucide = (window as typeof window & { lucide?: { createIcons?: (...args: unknown[]) => void } }).lucide;
    const hasGlobalRuntime = typeof globalLucide?.createIcons === 'function';
    if (hasGlobalRuntime) {
      try {
        window.lucideHelpers.initializeLucideIconsFromGlobal(iconNames, root);
        return;
      } catch (error) {
        console.warn('[Lucide] Global helper initialization failed, falling back to module runtime:', error);
      }
    }
  }

  const icons = getLucideIcons(...iconNames);
  if (Object.keys(icons).length === 0) {
    console.warn('[Lucide] No icons resolved for initialization', iconNames);
    return;
  }

  initializeLucideIcons(root, icons);
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
