'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Loader2, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { CodeExample } from './CodeExample';
import { fadeInUp, spring } from '@/lib/animations';

interface EndpointDef {
  id: string;
  method: string;
  path: string;
  title: string;
  description: string;
  tier: 'public' | 'pro';
  params: { name: string; type: string; default?: string; description: string }[];
  examplePath: string;
}

const ENDPOINTS: EndpointDef[] = [
  {
    id: 'list-dreps',
    method: 'GET',
    path: '/api/v1/dreps',
    title: 'List DReps',
    description: 'Search and list all scored DReps with filtering and pagination.',
    tier: 'public',
    params: [
      { name: 'search', type: 'string', description: 'Search by name, ticker, or ID' },
      { name: 'sort', type: 'string', default: 'score', description: 'Sort field: score, name, voting_power' },
      { name: 'limit', type: 'number', default: '20', description: 'Results per page (max 100)' },
      { name: 'offset', type: 'number', default: '0', description: 'Pagination offset' },
    ],
    examplePath: '/api/v1/dreps?limit=3&sort=score',
  },
  {
    id: 'get-drep',
    method: 'GET',
    path: '/api/v1/dreps/:drepId',
    title: 'Get DRep',
    description: 'Get detailed profile, score breakdown, and alignment data for a specific DRep.',
    tier: 'public',
    params: [
      { name: 'drepId', type: 'string', description: 'DRep bech32 ID (drep1...)' },
    ],
    examplePath: '/api/v1/dreps/drep1...',
  },
  {
    id: 'drep-votes',
    method: 'GET',
    path: '/api/v1/dreps/:drepId/votes',
    title: 'DRep Votes',
    description: 'Voting history for a DRep with rationale content.',
    tier: 'pro',
    params: [
      { name: 'limit', type: 'number', default: '20', description: 'Results per page' },
      { name: 'offset', type: 'number', default: '0', description: 'Pagination offset' },
      { name: 'epoch', type: 'number', description: 'Filter by epoch' },
    ],
    examplePath: '/api/v1/dreps/drep1.../votes?limit=5',
  },
  {
    id: 'drep-history',
    method: 'GET',
    path: '/api/v1/dreps/:drepId/history',
    title: 'Score History',
    description: 'Historical score data for trend analysis.',
    tier: 'pro',
    params: [
      { name: 'days', type: 'number', default: '30', description: 'Lookback period (1-365)' },
    ],
    examplePath: '/api/v1/dreps/drep1.../history?days=30',
  },
  {
    id: 'list-proposals',
    method: 'GET',
    path: '/api/v1/proposals',
    title: 'List Proposals',
    description: 'Governance proposals with status filtering and AI summaries.',
    tier: 'public',
    params: [
      { name: 'status', type: 'string', description: 'Filter: open, ratified, enacted, dropped, expired' },
      { name: 'type', type: 'string', description: 'Proposal type filter' },
      { name: 'limit', type: 'number', default: '20', description: 'Results per page' },
    ],
    examplePath: '/api/v1/proposals?status=open&limit=5',
  },
  {
    id: 'governance-health',
    method: 'GET',
    path: '/api/v1/governance/health',
    title: 'Governance Health',
    description: 'Ecosystem-wide governance statistics and health metrics.',
    tier: 'public',
    params: [],
    examplePath: '/api/v1/governance/health',
  },
  {
    id: 'drep-embed',
    method: 'GET',
    path: '/api/v1/embed/:drepId',
    title: 'DRep Embed',
    description: 'Embeddable DRep card in SVG, HTML, or JSON format.',
    tier: 'public',
    params: [
      { name: 'format', type: 'string', default: 'svg', description: 'Output: svg, html, json' },
      { name: 'style', type: 'string', default: 'card', description: 'SVG style: badge, card, minimal' },
      { name: 'theme', type: 'string', default: 'dark', description: 'Theme: dark, light' },
    ],
    examplePath: '/api/v1/embed/drep1...?format=json',
  },
];

function generateCodeExamples(endpoint: EndpointDef, baseUrl: string): Record<string, string> {
  const url = `${baseUrl}${endpoint.examplePath}`;
  return {
    curl: `curl "${url}"`,
    javascript: `const response = await fetch("${url}", {
  headers: {
    "Authorization": "Bearer ds_live_YOUR_API_KEY"
  }
});
const data = await response.json();
console.log(data);`,
    python: `import requests

response = requests.get(
    "${url}",
    headers={"Authorization": "Bearer ds_live_YOUR_API_KEY"}
)
data = response.json()
print(data)`,
  };
}

export function ApiExplorer() {
  const [selected, setSelected] = useState<string>(ENDPOINTS[0].id);
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const endpoint = ENDPOINTS.find(e => e.id === selected) ?? ENDPOINTS[0];
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://drepscore.io';
  const codeExamples = generateCodeExamples(endpoint, baseUrl);

  const tryEndpoint = useCallback(async () => {
    if (endpoint.examplePath.includes('drep1...')) {
      setResponse(JSON.stringify({ hint: 'Replace drep1... with a real DRep ID to try this endpoint.' }, null, 2));
      return;
    }
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch(endpoint.examplePath);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse(JSON.stringify({ error: 'Request failed. The endpoint may require authentication.' }, null, 2));
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      {/* Endpoint list */}
      <div className="space-y-1">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endpoints</h3>
        {ENDPOINTS.map(ep => (
          <button
            key={ep.id}
            onClick={() => { setSelected(ep.id); setResponse(null); }}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
              selected === ep.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <span className={`inline-flex w-10 justify-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
              ep.method === 'GET' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'
            }`}>
              {ep.method}
            </span>
            <span className="flex-1 truncate">{ep.title}</span>
            {ep.tier === 'pro' && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">PRO</span>
            )}
          </button>
        ))}
      </div>

      {/* Detail panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={endpoint.id}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="space-y-5"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
                {endpoint.method}
              </span>
              <code className="text-sm font-mono text-foreground">{endpoint.path}</code>
              {endpoint.tier === 'pro' && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">Pro Tier</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{endpoint.description}</p>
          </div>

          {/* Parameters */}
          {endpoint.params.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parameters</h4>
              <div className="overflow-hidden rounded-lg border border-border/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.params.map(p => (
                      <tr key={p.name} className="border-b border-border/20 last:border-0">
                        <td className="px-3 py-2 font-mono text-xs text-primary">{p.name}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.type}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {p.description}
                          {p.default && <span className="ml-1 text-muted-foreground/60">(default: {p.default})</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Code examples */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Example</h4>
            <CodeExample code={codeExamples} />
          </div>

          {/* Try it */}
          <div className="flex items-center gap-3">
            <Button onClick={tryEndpoint} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Try it
            </Button>
            <span className="text-xs text-muted-foreground">
              Makes a real API call — no key needed for public endpoints
            </span>
          </div>

          {/* Response */}
          {response && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ ...spring.snappy }}
            >
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response</h4>
              <pre className="max-h-[400px] overflow-auto rounded-lg border border-border/40 bg-[#0d0e1a] p-4 text-xs leading-relaxed text-emerald-300/80 font-mono">
                {response}
              </pre>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
