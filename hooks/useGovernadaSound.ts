'use client';

/**
 * useGovernadaSound — Procedural sound design for the Cockpit.
 *
 * All sounds generated via Web Audio API (no audio files).
 * Opt-in: muted by default, toggle via cockpit store.
 *
 * Sound types:
 * - Ambient drone: low continuous hum, frequency modulated by governance temperature
 * - Crystalline ping: short high tone on urgent action arrival
 * - Click: very short pop on node/card selection
 * - Whoosh: filtered noise sweep on overlay tab switch
 */

import { useRef, useCallback, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useCockpitStore } from '@/stores/cockpitStore';

const MASTER_VOLUME = 0.3;

interface SoundEngine {
  playPing: () => void;
  playClick: () => void;
  playWhoosh: () => void;
  startAmbient: (temperature?: number) => void;
  stopAmbient: () => void;
  updateAmbientTemperature: (temperature: number) => void;
}

function createSoundEngine(): SoundEngine | null {
  if (typeof window === 'undefined') return null;

  let ctx: AudioContext | null = null;
  let ambientOsc: OscillatorNode | null = null;
  let ambientGain: GainNode | null = null;

  function getCtx(): AudioContext {
    if (!ctx) {
      ctx = new AudioContext();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  return {
    /**
     * Crystalline ping — short sine wave at 800Hz with fast decay.
     * Used when urgent actions appear.
     */
    playPing() {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.15);

      gain.gain.setValueAtTime(MASTER_VOLUME * 0.6, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.3);
    },

    /**
     * Click — very short oscillator burst at 400Hz.
     * Used on node/card selection.
     */
    playClick() {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, c.currentTime);

      gain.gain.setValueAtTime(MASTER_VOLUME * 0.3, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.05);
    },

    /**
     * Whoosh — filtered white noise sweep.
     * Used on overlay tab switch.
     */
    playWhoosh() {
      const c = getCtx();
      const bufferSize = c.sampleRate * 0.3;
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate white noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = c.createBufferSource();
      source.buffer = buffer;

      // Bandpass filter with frequency sweep
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(2, c.currentTime);
      filter.frequency.setValueAtTime(200, c.currentTime);
      filter.frequency.exponentialRampToValueAtTime(2000, c.currentTime + 0.15);
      filter.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.3);

      const gain = c.createGain();
      gain.gain.setValueAtTime(MASTER_VOLUME * 0.15, c.currentTime);
      gain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.3, c.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      source.start(c.currentTime);
      source.stop(c.currentTime + 0.3);
    },

    /**
     * Ambient drone — low continuous oscillator.
     * Frequency modulated by governance temperature (40Hz calm → 60Hz heated).
     */
    startAmbient(temperature = 50) {
      const c = getCtx();
      if (ambientOsc) return; // Already playing

      ambientOsc = c.createOscillator();
      ambientGain = c.createGain();

      ambientOsc.type = 'sine';
      // Map temperature 0-100 to frequency 35-65 Hz
      const freq = 35 + (temperature / 100) * 30;
      ambientOsc.frequency.setValueAtTime(freq, c.currentTime);

      // Very quiet
      ambientGain.gain.setValueAtTime(0, c.currentTime);
      ambientGain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.08, c.currentTime + 2);

      ambientOsc.connect(ambientGain);
      ambientGain.connect(c.destination);
      ambientOsc.start(c.currentTime);
    },

    stopAmbient() {
      if (ambientGain && ctx) {
        ambientGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
        setTimeout(() => {
          ambientOsc?.stop();
          ambientOsc?.disconnect();
          ambientGain?.disconnect();
          ambientOsc = null;
          ambientGain = null;
        }, 1200);
      }
    },

    updateAmbientTemperature(temperature: number) {
      if (ambientOsc && ctx) {
        const freq = 35 + (temperature / 100) * 30;
        ambientOsc.frequency.linearRampToValueAtTime(freq, ctx.currentTime + 0.5);
      }
    },
  };
}

/**
 * Hook providing procedural sound effects for the Cockpit.
 * All sounds respect the `soundEnabled` store preference and `prefers-reduced-motion`.
 */
export function useGovernadaSound(): SoundEngine {
  const soundEnabled = useCockpitStore((s) => s.soundEnabled);
  const prefersReducedMotion = useReducedMotion();
  const engineRef = useRef<SoundEngine | null>(null);

  // Lazily create the engine (null check pattern for react-hooks/refs rule)
  if (engineRef.current == null) {
    engineRef.current = createSoundEngine();
  }

  const isEnabled = soundEnabled && !prefersReducedMotion;

  // Stop ambient when sound disabled
  useEffect(() => {
    if (!isEnabled) {
      engineRef.current?.stopAmbient();
    }
  }, [isEnabled]);

  // Return gated versions of the sound functions
  const playPing = useCallback(() => {
    if (isEnabled) engineRef.current?.playPing();
  }, [isEnabled]);

  const playClick = useCallback(() => {
    if (isEnabled) engineRef.current?.playClick();
  }, [isEnabled]);

  const playWhoosh = useCallback(() => {
    if (isEnabled) engineRef.current?.playWhoosh();
  }, [isEnabled]);

  const startAmbient = useCallback(
    (temperature?: number) => {
      if (isEnabled) engineRef.current?.startAmbient(temperature);
    },
    [isEnabled],
  );

  const stopAmbient = useCallback(() => {
    engineRef.current?.stopAmbient();
  }, []);

  const updateAmbientTemperature = useCallback(
    (temperature: number) => {
      if (isEnabled) engineRef.current?.updateAmbientTemperature(temperature);
    },
    [isEnabled],
  );

  return {
    playPing,
    playClick,
    playWhoosh,
    startAmbient,
    stopAmbient,
    updateAmbientTemperature,
  };
}
