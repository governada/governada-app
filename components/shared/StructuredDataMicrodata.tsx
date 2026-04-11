import type { ReactNode } from 'react';

interface StructuredDataRootProps {
  itemType: string;
  children: ReactNode;
}

interface StructuredDataMetaProps {
  itemProp: string;
  content?: string | number | null;
}

interface StructuredDataNestedProps {
  itemProp: string;
  itemType: string;
  children: ReactNode;
}

export function StructuredDataRoot({ itemType, children }: StructuredDataRootProps) {
  return (
    <div itemScope itemType={itemType} className="contents">
      {children}
    </div>
  );
}

export function StructuredDataMeta({ itemProp, content }: StructuredDataMetaProps) {
  if (content === null || content === undefined || content === '') {
    return null;
  }

  return <meta itemProp={itemProp} content={String(content)} />;
}

export function StructuredDataNested({ itemProp, itemType, children }: StructuredDataNestedProps) {
  return (
    <div itemProp={itemProp} itemScope itemType={itemType} hidden>
      {children}
    </div>
  );
}
