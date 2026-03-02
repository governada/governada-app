'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './ui/button';

interface CodeExampleProps {
  code: Record<string, string>;
  className?: string;
}

const LANG_LABELS: Record<string, string> = {
  curl: 'cURL',
  javascript: 'JavaScript',
  python: 'Python',
};

export function CodeExample({ code, className = '' }: CodeExampleProps) {
  const languages = Object.keys(code);
  const [activeLang, setActiveLang] = useState(languages[0] ?? 'curl');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code[activeLang] ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`overflow-hidden rounded-lg border border-border/60 bg-[#0d0e1a] ${className}`}>
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
        <div className="flex gap-1">
          {languages.map(lang => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeLang === lang
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {LANG_LABELS[lang] ?? lang}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="text-emerald-300/90 font-mono">{code[activeLang]}</code>
      </pre>
    </div>
  );
}
