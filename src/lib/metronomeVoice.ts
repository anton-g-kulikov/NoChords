/**
 * What the metronome sounds like (ADR-065).
 *
 * Each voice is a pair of strokes — strong and weak — described as parameters rather than as audio
 * code, so the table can be read, compared and tested without a sound card. The hook builds the
 * graph from these; nothing here touches Web Audio.
 */

export type VoiceName = 'shaker' | 'woodblock' | 'beep';

export interface Stroke {
  /** Noise through a band, or a pitch. A shaker is the first; a block or a beep the second. */
  kind: 'noise' | 'tone';
  /** Band centre for noise, starting pitch for a tone. */
  hz: number;
  /** Where the pitch falls to, for tones that drop — which is what makes a struck sound. */
  toHz?: number;
  /** How wide the band is. Broad for a shaker, which is hiss rather than a note. */
  q?: number;
  wave?: OscillatorType;
  /** Seconds. A snap here reads as a click, however soft the rest of the stroke is. */
  attack: number;
  /**
   * Seconds to the nominal end of an exponential fall — not what is heard. The stroke drops under
   * hearing at roughly half of this, which is measured rather than assumed.
   */
  decay: number;
  /** Share of the set volume at the peak. Noise carries more energy than a tone at equal peak. */
  peak: number;
}

export interface Voice {
  label: string;
  accent: Stroke;
  beat: Stroke;
}

export const VOICES: Record<VoiceName, Voice> = {
  /** Soft and broadband; sits under a slow song instead of announcing itself over it. */
  shaker: {
    label: 'Shaker',
    accent: { kind: 'noise', hz: 6000, q: 1, attack: 0.005, decay: 0.14, peak: 0.34 },
    beat: { kind: 'noise', hz: 4600, q: 1, attack: 0.005, decay: 0.11, peak: 0.2 },
  },
  /** Struck and woody: a pitch that falls away as the strike energy goes. */
  woodblock: {
    label: 'Woodblock',
    accent: {
      kind: 'tone',
      hz: 1300,
      toHz: 900,
      wave: 'triangle',
      attack: 0.002,
      // Measured: 0.05 was 22ms of audible block, which is a tick. A struck block rings longer.
      decay: 0.09,
      peak: 0.4,
    },
    beat: {
      kind: 'tone',
      hz: 1000,
      toHz: 750,
      wave: 'triangle',
      attack: 0.002,
      decay: 0.07,
      peak: 0.28,
    },
  },
  /**
   * Sharp and hard to miss, which is the point of it in a loud room.
   *
   * Square, as the sound this app used to make — but accenting a fourth up rather than the near
   * octave it used, which was the part that read as a second instrument rather than a stronger
   * beat (ADR-065). Keeping the old interval would have been shipping the fault as a choice.
   */
  beep: {
    label: 'Beep',
    accent: { kind: 'tone', hz: 1200, wave: 'square', attack: 0.002, decay: 0.04, peak: 0.42 },
    beat: { kind: 'tone', hz: 900, wave: 'square', attack: 0.002, decay: 0.035, peak: 0.3 },
  },
};

export const VOICE_NAMES = Object.keys(VOICES) as VoiceName[];

export const DEFAULT_VOICE: VoiceName = 'shaker';

export function isVoiceName(value: unknown): value is VoiceName {
  return typeof value === 'string' && value in VOICES;
}

/** The voice for a stored name, falling back rather than falling silent. */
export function voiceFor(name: unknown): Voice {
  return VOICES[isVoiceName(name) ? name : DEFAULT_VOICE];
}
