import type { GlobeBehavior, BehaviorContext } from './types';
import type { GlobeCommand } from '@/lib/globe/types';

export function createDriftBehavior(): GlobeBehavior {
  return {
    id: 'drift',
    handles: ['drift'],
    execute(command: GlobeCommand, ctx: BehaviorContext) {
      if (command.type !== 'drift' || command.motionStrength === 0) return;

      ctx.dispatch({
        type: 'cinematic',
        state: {
          orbitSpeed: 0.0016 * command.motionStrength,
          transitionDuration: 1.8,
        },
      });
    },
  };
}
