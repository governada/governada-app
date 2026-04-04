import { STORAGE_KEYS, readStoredValue, writeStoredValue } from '@/lib/persistence';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function isSoundEnabled(): boolean {
  return readStoredValue(STORAGE_KEYS.soundEnabled) === '1';
}

export function setSoundEnabled(enabled: boolean): void {
  writeStoredValue(STORAGE_KEYS.soundEnabled, enabled ? '1' : '0');
}

export function getSoundEnabled(): boolean {
  return isSoundEnabled();
}

export function playDelegationChime(): void {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  // C major chord arpeggio — C5 E5 G5
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + i * 0.05);
    gain.gain.linearRampToValueAtTime(0.12, now + i * 0.05 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.05);
    osc.stop(now + i * 0.05 + 0.35);
  });
}

export function playMilestoneChime(): void {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Celebratory ascending: G5 → C6
  [783.99, 880, 987.77, 1046.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + i * 0.06);
    gain.gain.linearRampToValueAtTime(0.1, now + i * 0.06 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.06);
    osc.stop(now + i * 0.06 + 0.45);
  });
}
