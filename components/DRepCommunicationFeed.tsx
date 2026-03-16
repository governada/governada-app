'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { posthog } from '@/lib/posthog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, ChevronDown, ChevronUp, HelpCircle, CalendarDays } from 'lucide-react';
import { QuestionForm } from '@/components/QuestionForm';

interface DRepCommunicationFeedProps {
  drepId: string;
}

interface Explanation {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string | null;
  explanationText: string;
  vote: string | null;
  createdAt: string;
}

interface Position {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string | null;
  statementText: string;
  createdAt: string;
}

interface GeneralStatement {
  statementText: string;
  createdAt: string;
}

interface EpochUpdate {
  epoch: number;
  updateText: string;
  voteCount: number;
  rationaleCount: number;
  generatedAt: string;
}

interface FeedData {
  explanations: Explanation[];
  positions: Position[];
  generalStatements: GeneralStatement[];
  philosophy: string | null;
  drepName: string | null;
  epochUpdates: EpochUpdate[];
}

interface QAItem {
  id: string;
  questionText: string;
  askerWallet: string;
  createdAt: string;
  status: string;
  response: { response_text: string; created_at: string } | null;
}

type FeedItem =
  | { type: 'explanation'; date: string; content: Explanation }
  | { type: 'position'; date: string; content: Position }
  | { type: 'general_statement'; date: string; content: GeneralStatement }
  | { type: 'epoch_update'; date: string; content: EpochUpdate };

type TabKey = 'feed' | 'qa';

export function DRepCommunicationFeed({ drepId }: DRepCommunicationFeedProps) {
  const [data, setData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [philosophyOpen, setPhilosophyOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('feed');
  const [questions, setQuestions] = useState<QAItem[]>([]);
  const [qaLoading, setQaLoading] = useState(false);
  const tracked = useRef(false);

  useEffect(() => {
    fetch(`/api/governance/drep-feed?drepId=${encodeURIComponent(drepId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [drepId]);

  const fetchQuestions = useCallback(() => {
    setQaLoading(true);
    fetch(`/api/governance/questions?drepId=${encodeURIComponent(drepId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setQuestions)
      .catch(() => setQuestions([]))
      .finally(() => setQaLoading(false));
  }, [drepId]);

  useEffect(() => {
    if (activeTab === 'qa') fetchQuestions();
  }, [activeTab, fetchQuestions]);

  useEffect(() => {
    if (!tracked.current && !loading) {
      const hasContent = !!(
        data &&
        (data.explanations.length > 0 || data.positions.length > 0 || data.philosophy)
      );
      posthog.capture('drep_communication_feed_viewed', { drepId, hasContent });
      tracked.current = true;
    }
  }, [loading, data, drepId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            From Your Representative
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const hasContent =
    data &&
    (data.explanations.length > 0 ||
      data.positions.length > 0 ||
      (data.generalStatements || []).length > 0 ||
      (data.epochUpdates || []).length > 0);
  const drepName = data?.drepName || `${drepId.slice(0, 16)}...`;

  const feedItems: FeedItem[] = [];
  if (data) {
    for (const e of data.explanations) {
      feedItems.push({ type: 'explanation', date: e.createdAt, content: e });
    }
    for (const p of data.positions) {
      feedItems.push({ type: 'position', date: p.createdAt, content: p });
    }
    for (const s of data.generalStatements || []) {
      feedItems.push({ type: 'general_statement', date: s.createdAt, content: s });
    }
    for (const u of data.epochUpdates || []) {
      feedItems.push({ type: 'epoch_update', date: u.generatedAt, content: u });
    }
  }
  feedItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          From Your Representative
        </CardTitle>
      </CardHeader>

      {/* Tab bar */}
      <div className="px-6 border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('feed')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'feed'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Statements
          </button>
          <button
            onClick={() => {
              setActiveTab('qa');
              posthog.capture('drep_qa_tab_clicked', { drepId });
            }}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'qa'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Q&A
            {questions.length > 0 && (
              <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5 tabular-nums">
                {questions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <CardContent className="pt-4 space-y-4">
        {activeTab === 'feed' && (
          <>
            {!hasContent && (
              <p className="text-sm text-muted-foreground">
                Your DRep hasn&apos;t shared any explanations or positions yet. DReps who explain
                their votes score higher.
              </p>
            )}

            {feedItems.length > 0 && (
              <div className="space-y-3">
                {feedItems.map((item, i) => {
                  if (item.type === 'explanation') {
                    const e = item.content;
                    const proposalLabel = e.proposalTitle || `${e.proposalTxHash.slice(0, 12)}...`;
                    return (
                      <div key={`e-${i}`} className="border-l-2 border-primary/20 pl-3 py-1">
                        <p className="text-sm">
                          <span className="font-medium">{drepName}</span>
                          {e.vote ? (
                            <>
                              {' '}
                              voted <span className="font-medium">{e.vote}</span> on{' '}
                            </>
                          ) : (
                            <> explained their vote on </>
                          )}
                          <Link
                            href={`/proposals/${e.proposalTxHash}/${e.proposalIndex}`}
                            className="text-primary hover:underline"
                          >
                            {proposalLabel}
                          </Link>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                          &ldquo;{e.explanationText}&rdquo;
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(e.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    );
                  }

                  if (item.type === 'epoch_update') {
                    const u = item.content;
                    return (
                      <div key={`u-${i}`} className="border-l-2 border-blue-400/30 pl-3 py-1">
                        <p className="text-sm flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span className="font-medium">Epoch {u.epoch} Update</span>
                          <span className="text-xs text-muted-foreground">
                            {u.voteCount} vote{u.voteCount !== 1 ? 's' : ''}
                            {u.rationaleCount > 0 &&
                              `, ${u.rationaleCount} rationale${u.rationaleCount !== 1 ? 's' : ''}`}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">{u.updateText}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(u.generatedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    );
                  }

                  if (item.type === 'general_statement') {
                    const s = item.content as GeneralStatement;
                    return (
                      <div key={`gs-${i}`} className="border-l-2 border-emerald-400/30 pl-3 py-1">
                        <p className="text-sm">
                          <span className="font-medium">{drepName}</span> shared a governance
                          statement
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                          &ldquo;{s.statementText}&rdquo;
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(s.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    );
                  }

                  const p = item.content as Position;
                  const proposalLabel = p.proposalTitle || `${p.proposalTxHash.slice(0, 12)}...`;
                  return (
                    <div key={`p-${i}`} className="border-l-2 border-violet-400/30 pl-3 py-1">
                      <p className="text-sm">
                        <span className="font-medium">{drepName}</span> stated their position on{' '}
                        <Link
                          href={`/proposals/${p.proposalTxHash}/${p.proposalIndex}`}
                          className="text-primary hover:underline"
                        >
                          {proposalLabel}
                        </Link>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                        &ldquo;{p.statementText}&rdquo;
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(p.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {data?.philosophy && (
              <div className="pt-2 border-t">
                <button
                  onClick={() => setPhilosophyOpen(!philosophyOpen)}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  {philosophyOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Governance Philosophy
                </button>
                {philosophyOpen && (
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">
                    {data.philosophy}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'qa' && (
          <div className="space-y-4">
            <QuestionForm
              drepId={drepId}
              onSubmitted={fetchQuestions}
              isFirstQuestion={!qaLoading && questions.length === 0}
            />

            {qaLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : questions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No questions yet. Be the first to ask!
              </p>
            ) : (
              <div className="space-y-3">
                {questions.map((q) => (
                  <div key={q.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{q.questionText}</p>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                          q.status === 'answered'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {q.status === 'answered' ? 'Answered' : 'Open'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {q.askerWallet.slice(0, 12)}... ·{' '}
                      {new Date(q.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    {q.response && (
                      <div className="border-l-2 border-primary/30 pl-3 mt-2">
                        <p className="text-sm text-muted-foreground">{q.response.response_text}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {drepName} ·{' '}
                          {new Date(q.response.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
