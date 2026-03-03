'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyableAddressProps {
  address: string;
  truncate?: boolean;
  className?: string;
}

function shorten(addr: string) {
  if (addr.length <= 20) return addr;
  return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
}

export function CopyableAddress({
  address,
  truncate = false,
  className = '',
}: CopyableAddressProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 font-mono hover:text-foreground transition-colors group ${className}`}
      title="Click to copy full address"
    >
      {truncate ? shorten(address) : address}
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500 shrink-0 animate-check-pop" />
      ) : (
        <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  );
}
