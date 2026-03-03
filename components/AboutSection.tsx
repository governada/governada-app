'use client';

/**
 * About Section Component
 * Displays DRep description with truncation and expand/collapse
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { SocialIconsLarge } from './SocialIconsLarge';

interface AboutSectionProps {
  description?: string | null;
  bio?: unknown;
  email?: unknown;
  references?: Array<{ uri: string; label?: string }>;
}

function extractValue(field: unknown): string | null {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field !== null && '@value' in field) {
    return (field as { '@value': string })['@value'];
  }
  return null;
}

export function AboutSection({ description, bio, email, references }: AboutSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const descText = description || '';
  const bioText = extractValue(bio);
  const emailText = extractValue(email);

  const hasContent = descText || bioText || emailText || (references && references.length > 0);

  if (!hasContent) return null;

  const combinedText = [descText, bioText].filter(Boolean).join('\n\n');
  const shouldTruncate = combinedText.length > 400;
  const displayText =
    shouldTruncate && !isExpanded ? combinedText.slice(0, 400) + '...' : combinedText;

  return (
    <Card>
      <CardHeader>
        <CardTitle>About</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Description / Bio */}
        {combinedText && (
          <div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {displayText}
            </p>
            {shouldTruncate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 h-auto p-0 text-primary hover:bg-transparent"
              >
                {isExpanded ? (
                  <>
                    Show less <ChevronUp className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Read more <ChevronDown className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Contact */}
        {emailText && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <a href={`mailto:${emailText}`} className="text-sm text-primary hover:underline">
              {emailText}
            </a>
          </div>
        )}

        {/* Social Links - using larger icons for detail page */}
        {references && references.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Links</p>
            <SocialIconsLarge references={references} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
