import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VOICE,
  VOICES,
  VOICE_NAMES,
  isVoiceName,
  voiceFor,
} from '../src/lib/metronomeVoice';

describe('metronome voices', () => {
  it('VC-01 offers a soft one, a struck one and a sharp one', () => {
    expect(VOICE_NAMES).toEqual(['shaker', 'woodblock', 'beep']);
    expect(VOICES.shaker.accent.kind).toBe('noise');
    expect(VOICES.woodblock.accent.kind).toBe('tone');
    expect(VOICES.beep.accent.kind).toBe('tone');
  });

  it('VC-02 **accents by weight, never by becoming another instrument**', () => {
    // The sound this replaced jumped most of an octave, so the strong beat read as a second
    // instrument. Every voice now accents within a fifth, and always louder (ADR-065).
    for (const [name, voice] of Object.entries(VOICES)) {
      expect(voice.accent.peak, name).toBeGreaterThan(voice.beat.peak);
      expect(voice.accent.hz / voice.beat.hz, name).toBeLessThan(1.5);
      expect(voice.accent.hz, name).toBeGreaterThan(voice.beat.hz);
      expect(voice.accent.kind, name).toBe(voice.beat.kind);
    }
  });

  it('VC-03 every stroke clears the fastest beat it could be asked to play', () => {
    // 300 quarter-notes a minute is 200ms a beat, the ceiling the tempo field allows.
    for (const [name, voice] of Object.entries(VOICES)) {
      for (const stroke of [voice.accent, voice.beat]) {
        expect(stroke.decay, name).toBeLessThan(0.2);
        expect(stroke.attack, name).toBeLessThan(0.01);
        expect(stroke.peak, name).toBeLessThanOrEqual(1);
      }
    }
  });

  it('VC-04 a stored name that is not a voice falls back rather than falling silent', () => {
    expect(voiceFor('woodblock')).toBe(VOICES.woodblock);
    expect(voiceFor('gamelan')).toBe(VOICES[DEFAULT_VOICE]);
    expect(voiceFor(undefined)).toBe(VOICES[DEFAULT_VOICE]);
    expect(isVoiceName('beep')).toBe(true);
    expect(isVoiceName('cowbell')).toBe(false);
  });
});
