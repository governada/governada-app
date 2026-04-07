import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms - Governada',
  description:
    'Basic terms for Governada, including independent-project status, informational-use limits, and user responsibilities.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Terms
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Terms of use</h1>
          <p className="text-sm leading-7 text-muted-foreground">
            Governada is an independent community project. These terms describe the baseline rules
            for using the app.
          </p>
        </header>

        <Section title="Independent project status">
          <p>
            Governada is not affiliated with, endorsed by, or acting on behalf of the Cardano
            Foundation, IOG, or EMURGO unless a page explicitly says otherwise.
          </p>
        </Section>

        <Section title="Informational use">
          <p>
            Governada provides governance intelligence, analytics, summaries, and workflow tools for
            informational and productivity purposes. It is not legal, financial, tax, or investment
            advice.
          </p>
        </Section>

        <Section title="Your responsibilities">
          <p>
            You are responsible for your wallet security, governance decisions, and any on-chain
            actions you approve. Review proposals, representatives, and wallet prompts carefully
            before acting.
          </p>
        </Section>

        <Section title="Availability">
          <p>
            The app is provided on an as-is basis. Features, data sources, and workflows may change
            over time as the governance ecosystem evolves.
          </p>
        </Section>
      </div>
    </div>
  );
}
