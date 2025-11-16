declare module 'lucide/dist/esm/icons/*.js' {
  import type { IconNode } from 'lucide';
  const icon: IconNode;
  export default icon;
}

declare module 'lucide/dist/esm/createElement.js' {
  import type { IconNode } from 'lucide';
  export default function createElement(
    iconNode: IconNode,
    attrs?: Record<string, string | number>
  ): SVGElement;
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
