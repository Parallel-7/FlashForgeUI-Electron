/**
 * @fileoverview Ambient declarations for Lucide ESM internals used by the app.
 *
 * Provides wildcard icon-module typings plus helper declarations for
 * `createElement` and `replaceElement` so TypeScript can resolve the Lucide
 * paths imported by desktop and WebUI icon utilities.
 */
/**
 * @fileoverview Ambient module declarations for Lucide ESM internals imported by
 * the desktop and WebUI icon hydration code.
 */

declare module 'lucide/dist/esm/icons/*.js' {
  import type { IconNode } from 'lucide';
  const icon: IconNode;
  export default icon;
}

declare module 'lucide/dist/esm/createElement.js' {
  import type { IconNode } from 'lucide';
  export default function createElement(iconNode: IconNode, attrs?: Record<string, string | number>): SVGElement;
}

declare module 'lucide/dist/esm/replaceElement.js' {
  import type { IconNode } from 'lucide';
  const replaceElement: (
    element: Element,
    options: {
      nameAttr: string;
      icons: Record<string, IconNode>;
      attrs: Record<string, string>;
    }
  ) => void;
  export default replaceElement;
}
