'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import posthog from 'posthog-js';

interface BriefSection {
  heading: string;
  content: string;
}

interface Brief {
  id: string;
  brief_type: string;
  content_json: {
    greeting: string;
    sections: BriefSection[];
    ctaText: string;
    ctaUrl: string;
  };
  created_at: string;
  epoch: number;
}

export function GovernanceBriefCard() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const token = getStoredSession();

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/briefs/latest', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.brief) setBrief(data.brief);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading || !brief) {
    if (!loading && !brief) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-4 text-center">
            <Sparkles className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Your first weekly governance brief arrives Monday
            </p>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  const content = brief.content_json;
  const createdDate = new Date(brief.created_at).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            Weekly Governance Brief
          </CardTitle>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {createdDate}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{content.greeting}</p>

        {/* Show first section always, expand for the rest */}
        {content.sections.length > 0 && (
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">
                {content.sections[0].heading}
              </p>
              <p className="text-sm">{content.sections[0].content}</p>
            </div>

            {expanded &&
              content.sections.slice(1).map((section, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">
                    {section.heading}
                  </p>
                  <p className="text-sm">{section.content}</p>
                </div>
              ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {content.sections.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1"
                onClick={() => {
                  setExpanded(!expanded);
                  if (!expanded) {
                    posthog.capture('governance_brief_opened', {
                      brief_id: brief.id,
                      source: 'in-app',
                    });
                  }
                }}
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {expanded ? 'Show less' : `Show ${content.sections.length - 1} more`}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-xs" asChild>
              <Link href="/pulse/report/latest">Full Report</Link>
            </Button>
          </div>
          <Button variant="outline" size="sm" className="text-xs" asChild>
            <a href={content.ctaUrl}>{content.ctaText}</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
