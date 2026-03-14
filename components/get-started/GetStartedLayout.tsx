'use client';

import { ProgressBar } from './ProgressBar';
import { GovernancePassport } from './GovernancePassport';
import type { GovernancePassport as PassportType } from '@/lib/passport';
import type { ReactNode } from 'react';

interface GetStartedLayoutProps {
  passport: PassportType | null;
  onStageClick?: (stage: 1 | 2 | 3 | 4) => void;
  children: ReactNode;
}

export function GetStartedLayout({ passport, onStageClick, children }: GetStartedLayoutProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full">
      {/* Progress bar */}
      {passport && (
        <div className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto max-w-5xl px-4 py-3">
            <ProgressBar currentStage={passport.stage} onStageClick={onStageClick} />
          </div>
        </div>
      )}

      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content — stage area */}
          <main className="flex-1 min-w-0">{children}</main>

          {/* Sidebar — Governance Passport (desktop) */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24">
              <GovernancePassport
                passport={
                  passport
                    ? {
                        stage: passport.stage,
                        alignment: passport.alignment,
                        matchedDrepId: passport.matchedDrepId,
                        matchedDrepName: passport.matchedDrepName,
                        matchScore: passport.matchScore,
                        walletReady: passport.walletReady,
                        walletPath: passport.walletPath,
                        connectedAt: passport.connectedAt,
                        delegatedAt: passport.delegatedAt,
                        createdAt: passport.createdAt,
                      }
                    : undefined
                }
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile floating passport indicator */}
      <div className="lg:hidden fixed bottom-4 right-4 z-20">
        <GovernancePassport
          passport={
            passport
              ? {
                  stage: passport.stage,
                  alignment: passport.alignment,
                  matchedDrepId: passport.matchedDrepId,
                  matchedDrepName: passport.matchedDrepName,
                  matchScore: passport.matchScore,
                  walletReady: passport.walletReady,
                  walletPath: passport.walletPath,
                  connectedAt: passport.connectedAt,
                  delegatedAt: passport.delegatedAt,
                  createdAt: passport.createdAt,
                }
              : undefined
          }
          className="w-72 shadow-xl"
        />
      </div>
    </div>
  );
}
