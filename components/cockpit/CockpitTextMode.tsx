'use client';

/**
 * CockpitTextMode — Screen reader accessible representation of the Cockpit.
 *
 * Renders a semantic, sr-only version of all HUD data alongside the visual globe.
 * Also serves as a No-WebGL fallback when GPU is unavailable.
 */

import { useSenecaStrip } from '@/hooks/useSenecaStrip';
import { useCockpitActions } from '@/hooks/useCockpitActions';
import { useCockpitStore } from '@/stores/cockpitStore';
import { useEpochContext } from '@/hooks/useEpochContext';
import { OVERLAY_CONFIGS, OVERLAY_ORDER } from '@/lib/cockpit/overlayConfigs';

interface CockpitTextModeProps {
  /** If true, render visually (not just sr-only) as a No-WebGL fallback */
  visible?: boolean;
}

export function CockpitTextMode({ visible = false }: CockpitTextModeProps) {
  const { epoch, day, totalDays } = useEpochContext();
  const { currentText, mode } = useSenecaStrip();
  const { items, urgentCount } = useCockpitActions();
  const activeOverlay = useCockpitStore((s) => s.activeOverlay);

  const containerClass = visible ? 'p-4 bg-background text-foreground min-h-[100dvh]' : 'sr-only';

  return (
    <div className={containerClass}>
      {/* Epoch progress */}
      <div
        role="progressbar"
        aria-valuenow={day}
        aria-valuemin={0}
        aria-valuemax={totalDays}
        aria-label={`Epoch ${epoch}, day ${day} of ${totalDays}`}
      >
        {visible && (
          <p className="text-sm text-muted-foreground">
            Epoch {epoch} — Day {day}/{totalDays}
          </p>
        )}
      </div>

      {/* Seneca insight */}
      <div aria-live="polite" aria-label="AI governance insight">
        {visible && <p className="mt-2 text-sm">{currentText}</p>}
        {!visible && <span>{currentText}</span>}
      </div>

      {/* Overlay tabs */}
      <div role="tablist" aria-label="Cockpit overlay tabs">
        {OVERLAY_ORDER.map((overlay) => (
          <span
            key={overlay}
            role="tab"
            aria-selected={activeOverlay === overlay}
            aria-label={`${OVERLAY_CONFIGS[overlay].label} overlay${activeOverlay === overlay ? ' (active)' : ''}`}
          >
            {visible && (
              <span
                className={`inline-block mr-2 text-sm ${activeOverlay === overlay ? 'text-compass-teal font-semibold' : 'text-muted-foreground'}`}
              >
                {OVERLAY_CONFIGS[overlay].label}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Action items */}
      <div aria-label={`${urgentCount} urgent governance actions`}>
        {items.length === 0 ? (
          <p>{visible ? 'All caught up — no actions need attention.' : 'No urgent actions.'}</p>
        ) : (
          <ul role="list" aria-label="Governance action items">
            {items.map((item) => (
              <li key={item.id}>
                {visible ? (
                  <a href={item.href} className="block py-1 text-sm hover:text-compass-teal">
                    [{item.priority}] {item.title}
                    {item.subtitle && ` — ${item.subtitle}`}
                    {item.deadline && ` (${item.deadline})`}
                  </a>
                ) : (
                  <span>
                    {item.priority} priority: {item.title}. {item.subtitle ?? ''}
                    {item.deadline ? ` Deadline: ${item.deadline}.` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {visible && (
        <p className="mt-4 text-xs text-muted-foreground">
          Seneca mode: {mode}. Active overlay: {activeOverlay}.
        </p>
      )}
    </div>
  );
}
