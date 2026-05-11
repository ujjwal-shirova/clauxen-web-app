declare module 'react-syntax-highlighter' {
  import type { ComponentType } from 'react';

  export const Prism: ComponentType<Record<string, unknown>>;
}

declare module 'react-syntax-highlighter/dist/cjs/styles/prism' {
  const styles: Record<string, Record<string, unknown>>;
  export default styles;
  export const oneLight: Record<string, unknown>;
  export const vs: Record<string, unknown>;
}
