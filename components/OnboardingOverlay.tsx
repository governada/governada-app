'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@/utils/wallet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { spring } from '@/lib/animations';
import { STORAGE_KEYS, readStoredValue, writeStoredValue } from '@/lib/persistence';

export function OnboardingOverlay() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(1);
  const { isAuthenticated } = useWallet();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (readStoredValue(STORAGE_KEYS.onboardingComplete)) return;
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible || step !== 2) return;
    if (isAuthenticated) setStep(3);
  }, [visible, step, isAuthenticated]);

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      writeStoredValue(STORAGE_KEYS.onboardingComplete, '1');
    }
    setVisible(false);
  };

  const handleSkip = () => dismiss();

  const handleExplore = () => setStep(2);

  const handleConnect = () => {
    window.dispatchEvent(new CustomEvent('openWalletConnect'));
  };

  const handleFindMatch = () => {
    if (typeof window !== 'undefined') {
      writeStoredValue(STORAGE_KEYS.onboardingComplete, '1');
    }
    setVisible(false);
    router.push('/match');
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={spring.smooth}
            >
              <Card className="border-white/10 bg-card/95 backdrop-blur">
                <CardContent className="pt-6 pb-6">
                  <h2 className="text-xl font-semibold mb-2">Welcome to Cardano Governance</h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    Cardano governance has three bodies: DReps vote on proposals, Pools run the
                    network, and the Committee oversees protocol changes.
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-6">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      DReps
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                      Pools
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Committee
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSkip} className="flex-1">
                      Skip
                    </Button>
                    <Button size="sm" onClick={handleExplore} className="flex-1">
                      Explore
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={spring.smooth}
            >
              <Card className="border-white/10 bg-card/95 backdrop-blur">
                <CardContent className="pt-6 pb-6">
                  <h2 className="text-xl font-semibold mb-2">Find Your Place</h2>
                  {isAuthenticated ? (
                    <p className="text-muted-foreground text-sm mb-4">
                      Your wallet is connected. Let&apos;s find your match.
                    </p>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-sm mb-4">
                        Connect your wallet to see how your ADA is represented.
                      </p>
                      <Button size="sm" onClick={handleConnect} className="w-full">
                        Connect Wallet
                      </Button>
                    </>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={handleSkip} className="flex-1">
                      Skip
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={spring.smooth}
            >
              <Card className="border-white/10 bg-card/95 backdrop-blur">
                <CardContent className="pt-6 pb-6">
                  <h2 className="text-xl font-semibold mb-2">Get Matched</h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    In 30 seconds, find the DRep or Pool that best represents your values.
                  </p>
                  <Button size="sm" className="w-full" onClick={handleFindMatch}>
                    Find My Match →
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center gap-2 mt-4">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${
                s === step ? 'bg-primary' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
