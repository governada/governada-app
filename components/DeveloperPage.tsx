'use client';

import { motion } from 'framer-motion';
import {
  Code2,
  Blocks,
  Zap,
  Key,
  ArrowRight,
  Globe,
  BarChart3,
  Users,
  ChevronRight,
} from 'lucide-react';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ApiExplorer } from './ApiExplorer';
import { CodeExample } from './CodeExample';
import Link from 'next/link';

const QUICK_START_CODE = {
  javascript: `// Get the top 5 DReps by score
const response = await fetch(
  "https://governada.io/api/v1/dreps?limit=5&sort=score"
);
const { data, meta } = await response.json();

data.forEach(drep => {
  console.log(\`\${drep.name}: \${drep.score}/100\`);
});`,
  python: `import requests

# Get the top 5 DReps by score
response = requests.get(
    "https://governada.io/api/v1/dreps",
    params={"limit": 5, "sort": "score"}
)
data = response.json()

for drep in data["data"]:
    print(f'{drep["name"]}: {drep["score"]}/100')`,
  curl: `# Get the top 5 DReps by score
curl "https://governada.io/api/v1/dreps?limit=5&sort=score"`,
};

const EMBED_CODE = {
  html: `<!-- Embed a DRep score card -->
<iframe
  src="https://governada.io/embed/drep/DREP_ID?theme=dark"
  width="320"
  height="200"
  frameBorder="0"
  style="border-radius: 12px; overflow: hidden;"
></iframe>`,
  javascript: `<!-- Or use the script loader -->
<div id="governada-widget"></div>
<script
  src="https://governada.io/embed.js"
  data-type="drep"
  data-id="DREP_ID"
  data-theme="dark"
></script>`,
};

export function DeveloperPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto max-w-6xl px-4 py-20 relative">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="mx-auto max-w-3xl text-center space-y-6"
          >
            <motion.div variants={fadeInUp} className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
                <Code2 className="h-4 w-4" />
                Developer Platform
              </span>
            </motion.div>
            <motion.h1
              variants={fadeInUp}
              className="text-4xl font-bold tracking-tight sm:text-5xl"
            >
              Build on Governance Intelligence
            </motion.h1>
            <motion.p variants={fadeInUp} className="text-lg text-muted-foreground">
              Access scored DRep data, governance health metrics, and proposal intelligence via a
              simple REST API. Embed governance widgets on any site.
            </motion.p>
            <motion.div variants={fadeInUp} className="flex justify-center gap-3">
              <Button size="lg" asChild>
                <a href="#explorer">
                  Explore the API <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#widgets">Embed Widgets</a>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Quick start */}
      <section className="container mx-auto max-w-6xl px-4 py-16 space-y-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center space-y-2"
        >
          <h2 className="text-2xl font-bold">Get Started in 60 Seconds</h2>
          <p className="text-muted-foreground">No API key needed for public endpoints.</p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          <StepCard
            step={1}
            icon={<Zap className="h-5 w-5" />}
            title="Copy your first call"
            description="Public endpoints require no authentication. Just fetch and go."
          />
          <StepCard
            step={2}
            icon={<BarChart3 className="h-5 w-5" />}
            title="See governance data"
            description="DRep scores, alignment data, proposals, and ecosystem health — all structured JSON."
          />
          <StepCard
            step={3}
            icon={<Blocks className="h-5 w-5" />}
            title="Embed a widget"
            description="Drop a governance widget on your site with a single iframe or script tag."
          />
        </motion.div>

        <CodeExample code={QUICK_START_CODE} />
      </section>

      {/* API Explorer */}
      <section id="explorer" className="border-t border-border/40">
        <div className="container mx-auto max-w-6xl px-4 py-16 space-y-8">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-2"
          >
            <h2 className="text-2xl font-bold">API Explorer</h2>
            <p className="text-muted-foreground">
              Interactive documentation for all v1 endpoints. Click &quot;Try it&quot; to make a
              real request.
            </p>
          </motion.div>

          <ApiExplorer />
        </div>
      </section>

      {/* Embeddable Widgets */}
      <section id="widgets" className="border-t border-border/40 bg-muted/5">
        <div className="container mx-auto max-w-6xl px-4 py-16 space-y-8">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-2"
          >
            <h2 className="text-2xl font-bold">Embeddable Widgets</h2>
            <p className="text-muted-foreground">
              Add governance intelligence to any website. DRep score cards, health gauges, and more.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  DRep Score Card
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Embeddable DRep card with score, alignment radar, and identity color. Available in
                  SVG, HTML, and JSON.
                </p>
                <CodeExample code={EMBED_CODE} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-4 w-4 text-primary" />
                  Governance Health Gauge
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Live governance health gauge with trend sparkline. Updates automatically.
                </p>
                <CodeExample
                  code={{
                    html: `<iframe
  src="https://governada.io/embed/ghi?theme=dark"
  width="280"
  height="160"
  frameBorder="0"
  style="border-radius: 12px;"
></iframe>`,
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Rate limits and tiers */}
      <section className="border-t border-border/40">
        <div className="container mx-auto max-w-6xl px-4 py-16 space-y-8">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-2"
          >
            <h2 className="text-2xl font-bold">Rate Limits &amp; Tiers</h2>
            <p className="text-muted-foreground">
              Public endpoints are free. Upgrade for higher limits and Pro-only data.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent" />
              <CardHeader>
                <CardTitle className="text-lg">Free</CardTitle>
                <p className="text-sm text-muted-foreground">No API key required</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <TierFeature text="10 requests / hour" />
                <TierFeature text="DRep list + details" />
                <TierFeature text="Proposals + governance health" />
                <TierFeature text="Embed widgets (SVG, HTML, JSON)" />
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-primary/30">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Pro</CardTitle>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Coming Soon
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">API key authenticated</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <TierFeature text="10,000 requests / day" highlight />
                <TierFeature text="All Free tier endpoints" />
                <TierFeature text="Voting history + rationale" highlight />
                <TierFeature text="Score history (trend data)" highlight />
                <TierFeature text="Priority support" />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Auth */}
      <section className="border-t border-border/40 bg-muted/5">
        <div className="container mx-auto max-w-6xl px-4 py-16 space-y-8">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-2"
          >
            <h2 className="text-2xl font-bold">Authentication</h2>
            <p className="text-muted-foreground">
              Pass your API key as a Bearer token in the Authorization header.
            </p>
          </motion.div>

          <CodeExample
            code={{
              curl: `curl "https://governada.io/api/v1/dreps?limit=5" \\
  -H "Authorization: Bearer ds_live_YOUR_API_KEY"`,
              javascript: `const response = await fetch("https://governada.io/api/v1/dreps?limit=5", {
  headers: {
    "Authorization": "Bearer ds_live_YOUR_API_KEY"
  }
});`,
              python: `response = requests.get(
    "https://governada.io/api/v1/dreps",
    headers={"Authorization": "Bearer ds_live_YOUR_API_KEY"},
    params={"limit": 5}
)`,
            }}
          />

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Key className="h-4 w-4" />
            <span>
              API keys start with{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">ds_live_</code>.
              Pro tier keys coming soon.
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/40">
        <div className="container mx-auto max-w-6xl px-4 py-16 text-center space-y-4">
          <h2 className="text-2xl font-bold">Ready to build?</h2>
          <p className="text-muted-foreground">
            Start with the API Explorer above, or check out the Pulse page to see governance
            intelligence in action.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <a href="#explorer">API Explorer</a>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pulse">View Governance Pulse</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div variants={fadeInUp}>
      <Card className="h-full">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
              {step}
            </div>
            <div className="text-primary">{icon}</div>
          </div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TierFeature({ text, highlight = false }: { text: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <ChevronRight
        className={`h-3.5 w-3.5 ${highlight ? 'text-primary' : 'text-muted-foreground'}`}
      />
      <span className={highlight ? 'text-foreground font-medium' : 'text-muted-foreground'}>
        {text}
      </span>
    </div>
  );
}
