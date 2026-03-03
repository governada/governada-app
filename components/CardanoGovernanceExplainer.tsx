'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { spring, fadeInUp, staggerContainer } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users, ScrollText, Landmark } from 'lucide-react';

interface ExplainerProps {
  activeDReps?: number;
  activeProposals?: number;
  totalAdaGoverned?: string;
}

export function CardanoGovernanceExplainer({
  activeDReps,
  activeProposals,
  totalAdaGoverned,
}: ExplainerProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/50 border border-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent" />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        className="relative px-6 py-10 md:px-12 md:py-14 max-w-4xl mx-auto"
      >
        <motion.h2 variants={fadeInUp} className="text-2xl md:text-3xl font-bold text-white mb-4">
          What is Cardano Governance?
        </motion.h2>

        <motion.p
          variants={fadeInUp}
          className="text-base text-white/70 leading-relaxed mb-6 max-w-2xl"
        >
          Cardano is the only major blockchain where every token holder has a direct voice in
          treasury decisions worth billions. Through CIP-1694, ADA holders delegate their voting
          power to <strong className="text-white/90">DReps</strong> (Delegated Representatives) — a
          liquid democracy model where you can change your representative at any time.
        </motion.p>

        <motion.p
          variants={fadeInUp}
          className="text-sm text-white/50 leading-relaxed mb-8 max-w-2xl"
        >
          Unlike Ethereum&apos;s multisig-heavy governance or Polkadot&apos;s council system,
          Cardano&apos;s model is fully on-chain, permissionless, and transparent. Every vote, every
          rationale, every delegation is recorded on the blockchain.
        </motion.p>

        {/* Live stats */}
        {(activeDReps || activeProposals || totalAdaGoverned) && (
          <motion.div variants={fadeInUp} className="grid grid-cols-3 gap-4 mb-8 max-w-lg">
            {totalAdaGoverned && (
              <div className="text-center">
                <Landmark className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-white tabular-nums">{totalAdaGoverned}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">ADA Governed</p>
              </div>
            )}
            {activeDReps != null && (
              <div className="text-center">
                <Users className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-white tabular-nums">{activeDReps}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Active DReps</p>
              </div>
            )}
            {activeProposals != null && (
              <div className="text-center">
                <ScrollText className="h-5 w-5 text-amber-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-white tabular-nums">{activeProposals}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Open Proposals</p>
              </div>
            )}
          </motion.div>
        )}

        <motion.div variants={fadeInUp} className="flex flex-wrap gap-3">
          <Link href="/discover">
            <Button size="lg" className="gap-2">
              Explore DReps <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/proposals">
            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-white/10 text-white hover:bg-white/5"
            >
              See Live Proposals
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
