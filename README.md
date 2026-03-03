# DRepScore

**Find Your Ideal Cardano DRep**

DRepScore is an educational tool that helps casual Cardano ADA holders discover and delegate to Delegated Representatives (DReps) who align with their values. Compare participation rates, voting history, decentralization scores, and rationale provision to make informed delegation decisions.

## Features

- **🔍 Value-Based Discovery**: Select up to 5 values (Treasury Conservative, Pro-DeFi, High Participation, etc.) to find matching DReps
- **📊 Comprehensive Metrics**: View voting power, participation rates, rationale provision, and decentralization scores
- **📈 Voting History**: Explore detailed voting timelines with both governance and Catalyst votes
- **💼 Wallet Integration**: Connect Cardano wallets (Eternl, Nami, Lace, Typhon) for delegation
- **📚 Educational Content**: Tooltips and modals explaining DReps, governance, and delegation
- **🎨 Modern UI**: Clean, Cardano-themed design with responsive tables and charts

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript strict mode)
- **UI Components**: shadcn/ui + Radix UI + Tailwind CSS
- **Charts**: Recharts
- **Wallet Integration**: MeshJS
- **Data Source**: Koios API (Cardano mainnet)
- **Deployment**: Railway (Docker)

## Getting Started

### Prerequisites

- Node.js 18.17.0 or higher
- npm or yarn

### Installation

1. Clone the repository:

\`\`\`bash
git clone <repository-url>
cd drepscore-app
\`\`\`

2. Install dependencies:

\`\`\`bash
npm install
\`\`\`

3. Set up environment variables:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Edit `.env.local` and optionally add your Koios API key:

\`\`\`env

# Optional - for higher rate limits

KOIOS_API_KEY=your_api_key_here

# Default Koios mainnet URL (no need to change)

NEXT_PUBLIC_KOIOS_BASE_URL=https://api.koios.rest/api/v1
\`\`\`

4. Run the development server:

\`\`\`bash
npm run dev
\`\`\`

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

\`\`\`
drepscore-app/
├── app/ # Next.js App Router pages
│ ├── drep/[drepId]/ # DRep detail page
│ ├── layout.tsx # Root layout with header
│ ├── page.tsx # Homepage
│ └── globals.css # Global styles + Tailwind
├── components/ # React components
│ ├── ui/ # shadcn/ui components
│ ├── DRepTable.tsx # Main DRep table
│ ├── Header.tsx # Global header with branding
│ ├── WalletConnect.tsx # Wallet integration
│ ├── VotingHistoryChart.tsx # Recharts visualizations
│ └── ... # Other components
├── utils/ # Utility functions
│ ├── koios.ts # Koios API helpers
│ ├── scoring.ts # Metrics calculations
│ └── wallet.tsx # Wallet context
├── types/ # TypeScript types
│ ├── drep.ts # DRep types
│ └── koios.ts # Koios API types
└── lib/
└── utils.ts # shadcn utilities
\`\`\`

## Key Features Explained

### Value Selector

Choose from preset value tags to find DReps aligned with your preferences:

- **Treasury Conservative**: Prefers fiscal responsibility
- **Pro-DeFi**: Supports DeFi ecosystem growth
- **High Participation**: Actively votes on most proposals
- **Pro-Privacy**: Prioritizes privacy-focused proposals
- **Pro-Decentralization**: Supports decentralization initiatives
- **Active Rationale Provider**: Regularly provides voting rationale

### Scoring Metrics

1. **Participation Rate**: Percentage of proposals voted on (color-coded: green 70%+, yellow 40-70%, red <40%)
2. **Rationale Provision Rate**: Percentage of votes with written rationale
3. **Decentralization Score**: Distribution quality of delegators and voting power (0-100)
4. **Match Score**: Alignment with your selected values (shown when filters active)

### Data Caching

- Koios API responses are cached for 15 minutes (900 seconds)
- Server Components automatically handle caching
- Revalidation ensures fresh data without constant refetching

## Deployment

### Deploy to Railway

1. Push your code to GitHub
2. Connect the repository in Railway dashboard
3. Configure environment variables in Railway:
   - `KOIOS_API_KEY` (optional)
   - `NEXT_PUBLIC_KOIOS_BASE_URL` (default: https://api.koios.rest/api/v1)
   - See `.env.example` for the full list
4. Railway auto-deploys from `main` via Docker

DNS/CDN is managed via Cloudflare. Background jobs run on Inngest Cloud.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Koios API

This project uses the [Koios API](https://koios.rest/) to fetch Cardano governance data:

- DRep list and details
- Voting history
- Metadata and rationale
- Delegation information

The free tier works without an API key, but registering for a key provides higher rate limits.

## Roadmap

- [ ] Integrate ADA Handle lookup for DRep names
- [ ] Add actual vote history fetching (currently placeholder)
- [ ] Implement full delegation functionality with MeshJS
- [ ] Add stake pool operator links for transparency
- [ ] Enhanced value alignment algorithms based on proposal content analysis
- [ ] User accounts to track delegation history
- [ ] Email notifications for DRep activity

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Branding

**$drepscore** - Powered by the Cardano community

## Acknowledgments

- [Cardano Foundation](https://cardanofoundation.org/) for governance infrastructure
- [Koios](https://koios.rest/) for providing the API
- [MeshJS](https://meshjs.dev/) for wallet integration
- [shadcn/ui](https://ui.shadcn.com/) for beautiful components
