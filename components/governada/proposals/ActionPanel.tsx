import { VoteRationaleFlow } from '@/components/governada/proposals/VoteRationaleFlow';
import { CitizenVoiceCard } from '@/components/engagement/CitizenVoiceCard';
import { AskYourDRep } from '@/components/engagement/AskYourDRep';

interface ActionPanelProps {
  txHash: string;
  proposalIndex: number;
  title: string;
  isOpen: boolean;
  proposalAbstract?: string | null;
  proposalType?: string | null;
  aiSummary?: string | null;
}

export function ActionPanel({
  txHash,
  proposalIndex,
  title,
  isOpen,
  proposalAbstract,
  proposalType,
  aiSummary,
}: ActionPanelProps) {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <VoteRationaleFlow
          txHash={txHash}
          proposalIndex={proposalIndex}
          title={title}
          isOpen={isOpen}
          proposalAbstract={proposalAbstract}
          proposalType={proposalType}
          aiSummary={aiSummary}
        />
        <CitizenVoiceCard txHash={txHash} proposalIndex={proposalIndex} isOpen={isOpen} />
      </div>

      {isOpen && (
        <AskYourDRep txHash={txHash} proposalIndex={proposalIndex} proposalTitle={title} />
      )}
    </section>
  );
}
