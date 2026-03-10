/**
 * TypeScript declaration file for SVG imports
 * - *.svg?url: URL string for use in img tags
 * - *.svg: React component (via SVGR) for theme-aware icons
 */
declare module '*.svg?url' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  import * as React from 'react';
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}