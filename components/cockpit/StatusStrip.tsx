'use client';

/**
 * StatusStrip — Top HUD bar for the Cockpit.
 *
 * Displays: epoch progress, governance temperature, urgent action count, sound toggle.
 * Adapts density based on governance activity level.
 */

import { Volume2, VolumeX, Zap } from 'lucide-react';
import { useEpochContext } from '@/hooks/useEpochContext';
import { useCockpitStore } from '@/stores/cockpitStore';
import { TemporalScrubber } from './TemporalScrubber';
import type { DensityLevel } from '@/lib/cockpit/types';

interface GovStateData {
  urgencyScore: number;
  temperatureScore: number;
  activeProposalCount: number;
  epoch: number;
  epochDay: number;
  epochTotalDays: number;
}

interface StatusStripProps {
  govState?: GovStateData;
  /** Real urgent action count from the action queue (not approximated) */
  realUrgentCount?: number;
}

function getTemperatureLabel(score: number): { label: string; colorClass: string } {
  if (score >= 80) return { label: 'Hot', colorClass: 'text-red-400' };
  if (score >= 60) return { label: 'Warm', colorClass: 'text-amber-400' };
  if (score >= 40) return { label: 'Mild', colorClass: 'text-yellow-400' };
  return { label: 'Cool', colorClass: 'text-compass-teal' };
}

function getDensitySpacing(density: DensityLevel): string {
  if (density === 'heated') return 'gap-3 px-4 py-1.5';
  if (density === 'calm') return 'gap-4 px-5 py-2.5';
  return 'gap-3.5 px-4 py-2';
}

export function StatusStrip({ govState, realUrgentCount }: StatusStripProps) {
  const { epoch, day, totalDays } = useEpochContext();
  const densityLevel = useCockpitStore((s) => s.densityLevel);
  const soundEnabled = useCockpitStore((s) => s.soundEnabled);
  const toggleSound = useCockpitStore((s) => s.toggleSound);

  const temperature = govState?.temperatureScore ?? 50;
  const urgentCount = realUrgentCount ?? 0;
  const tempInfo = getTemperatureLabel(temperature);
  const epochProgress = totalDays > 0 ? (day / totalDays) * 100 : 0;
  const remainingDays = totalDays - day;

  return (
    <div className="relative" role="status" aria-label="Governance status">
      {/* Glassmorphic bar */}
      <div
        className={`flex items-center justify-between ${getDensitySpacing(densityLevel)} bg-black/60 backdrop-blur-md border-b border-white/5`}
      >
        {/* Left: Epoch info */}
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <span className="text-muted-foreground">EPOCH {epoch}</span>
          <div className="flex items-center gap-1.5">
            {/* Progress bar */}
            <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-compass-teal/60 to-compass-teal transition-all duration-1000"
                style={{ width: `${epochProgress}%` }}
              />
            </div>
            <span className="text-muted-foreground/70 text-[10px]">
              Day {day}/{totalDays}
            </span>
          </div>
          {remainingDays > 0 && (
            <span className="text-muted-foreground/50 text-[10px] hidden sm:inline">
              {remainingDays}d left
            </span>
          )}
        </div>

        {/* Center: Temperature + Urgent count */}
        <div className="flex items-center gap-4">
          {/* Temperature */}
          <div className="flex items-center gap-1.5 text-xs">
            <div
              className={`w-1.5 h-1.5 rounded-full ${temperature >= 60 ? 'animate-pulse' : ''}`}
              style={{
                backgroundColor:
                  temperature >= 80
                    ? '#f87171'
                    : temperature >= 60
                      ? '#fbbf24'
                      : temperature >= 40
                        ? '#facc15'
                        : '#2dd4bf',
              }}
            />
            <span className={`font-mono ${tempInfo.colorClass}`}>{Math.round(temperature)}°</span>
            <span className="text-muted-foreground/60 hidden lg:inline">{tempInfo.label}</span>
          </div>

          {/* Urgent count */}
          {urgentCount > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <Zap className="h-3 w-3 text-red-400 animate-pulse" />
              <span className="text-red-400 font-semibold font-mono">{urgentCount}</span>
              <span className="text-muted-foreground/60 hidden lg:inline">urgent</span>
            </div>
          )}
        </div>

        {/* Right: Sound toggle + temporal scrub placeholder */}
        <div className="flex items-center gap-2">
          <TemporalScrubber />

          <button
            onClick={toggleSound}
            className="p-1 rounded hover:bg-white/5 transition-colors text-muted-foreground/50 hover:text-muted-foreground"
            aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
