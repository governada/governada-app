import { Shield, Users, Vote } from 'lucide-react';

const STEPS = [
  {
    icon: Shield,
    text: 'Your ADA stays in your wallet',
    detail: 'Delegation is non-custodial — you keep full control.',
  },
  {
    icon: Users,
    text: 'Pick a DRep who shares your values',
    detail: 'We score them on participation, rationale, and reliability.',
  },
  {
    icon: Vote,
    text: 'They vote on proposals for you',
    detail: 'Track how they represent you on every governance action.',
  },
];

export function HowItWorks() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-center">How Governance Works</h2>
      <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 sm:gap-4">
        {STEPS.map(({ icon: Icon, text, detail }, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-2.5 px-5 py-5 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 text-center"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium">{text}</span>
            <span className="text-xs text-muted-foreground">{detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
