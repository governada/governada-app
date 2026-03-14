'use client';
import { useEffect, useState } from 'react';
import { StatementCard } from '@/components/governada/proposals/StatementCard';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';

interface PositionStatement {
  id: string;
  drep_id: string;
  proposal_tx_hash: string | null;
  proposal_index: number | null;
  statement_text: string;
  created_at: string;
}

interface StatementsTabProps {
  drepId: string;
  drepName: string;
  isOwner?: boolean;
  onCompose?: () => void;
}

export function StatementsTab({ drepId, drepName, isOwner, onCompose }: StatementsTabProps) {
  const [statements, setStatements] = useState<PositionStatement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/drep/${encodeURIComponent(drepId)}/positions`)
      .then((r) => r.json())
      .then((d) => {
        setStatements(d.data ?? d.positions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [drepId]);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">Loading statements…</div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {isOwner && onCompose && (
        <Button onClick={onCompose} variant="outline" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Share your position
        </Button>
      )}
      {statements.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? 'Share your view on active proposals to let your delegators know how you think.'
              : `When ${drepName} shares their view on proposals, it appears here.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {statements.map((s) => (
            <StatementCard
              key={s.id}
              drepName={drepName}
              drepId={drepId}
              statementText={s.statement_text}
              createdAt={s.created_at}
            />
          ))}
        </div>
      )}
    </div>
  );
}
