import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy - Governada',
  description:
    'Privacy baseline for Governada, including analytics behavior, wallet interactions, and browser Do Not Track support.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Privacy
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Privacy baseline
          </h1>
          <p className="text-sm leading-7 text-muted-foreground">
            Governada is an independent community product for Cardano governance intelligence. This
            page describes the current privacy posture of the app as it exists in production today.
          </p>
        </header>

        <Section title="What the app can process">
          <p>
            Governada can process the information you explicitly provide through the app, including
            wallet-connection state, preview-mode choices, feedback, and activity needed to render
            governance dashboards and workspace tools.
          </p>
          <p>
            The app also reads public on-chain governance data, proposal metadata, and public
            representative content in order to power rankings, summaries, matching, and integrity
            checks.
          </p>
        </Section>

        <Section title="Analytics">
          <p>
            When analytics is configured for a deployment, Governada uses PostHog for product
            telemetry such as page views and feature usage.
          </p>
          <p>
            Governada now respects browser Do Not Track. If your browser sends a Do Not Track
            signal, the PostHog client will not initialize in the browser.
          </p>
        </Section>

        <Section title="Wallets and governance actions">
          <p>
            Connecting a wallet lets the app personalize routes, governance context, and workspace
            behavior. Governada does not custody your ADA and does not submit on-chain actions on
            your behalf without an explicit wallet interaction from you.
          </p>
        </Section>

        <Section title="Updates to this baseline">
          <p>
            This is the current in-product baseline, not a jurisdiction-specific legal opinion. If
            the analytics, consent, or data-retention posture changes materially, this page should
            be updated alongside the code that implements that change.
          </p>
        </Section>
      </div>
    </div>
  );
}
