import { Volume, VolumeX } from 'lucide-react';
import { countInProgress } from '../lib/metronome';
import type { BarPulse } from '../lib/metronome';

interface BeatStripProps {
  /** Beats in the bar being shown, and which of them has sounded. */
  pulse: BarPulse | null;
  /** True while the count-in is running, which is what the strip counts down. */
  counting: boolean;
  /** Bars of count-in, and how many are left — only meaningful while counting. */
  countInBars: number;
  countInRemaining: number;
  /** Beats in a bar of the song's opening meter, for the count and for the resting state. */
  beatsPerBar: number;
  /** Whether each beat of the bar carries the accent. */
  isAccent: (beatInBar: number) => boolean;
  /** The song's meter, shown while playing where the count-in's own label has nothing to say. */
  meter: string;
  /** Whether the beats are also heard. The dots run either way. */
  sound: boolean;
  onSoundChange: (sound: boolean) => void;
}

/**
 * The pulse, pinned under the strip of buttons (ADR-059).
 *
 * One bar of dots that fills as the beats go by: the count-in first, then the song, resetting at
 * every barline so it reads as "where in the bar am I" all the way through. The dots run whether or
 * not anything is clicking — seeing the beat and hearing it are different things, and the count-in
 * counts you in silently when the sound is off.
 *
 * The switch for that sound sits here, on the thing it governs. It says what it does to the sound
 * rather than what it does to the metronome, because that is the question being asked of it: the
 * beat is on screen either way.
 */
export function BeatStrip({
  pulse,
  counting,
  countInBars,
  countInRemaining,
  beatsPerBar,
  isAccent,
  meter,
  sound,
  onSoundChange,
}: BeatStripProps) {
  const count = countInProgress(countInBars, beatsPerBar, countInRemaining);
  const showing = counting ? beatsPerBar : (pulse?.beatsPerBar ?? beatsPerBar);
  const sounded = counting ? count.inBar : (pulse?.inBar ?? 0);

  return (
    <div
      className={counting ? 'beat-strip beat-strip--counting' : 'beat-strip'}
      role="status"
      aria-live="off"
    >
      <span className="beat-strip__pulse">
        <span className="beat-strip__beats" aria-hidden="true">
          {Array.from({ length: showing }, (_, position) => (
            <span
              key={position}
              className={[
                'beat-strip__beat',
                isAccent(position + 1) ? 'beat-strip__beat--accent' : '',
                // Filling rather than a single travelling dot, so the count and the song read the
                // same way: how far into this bar you are.
                position < sounded ? 'beat-strip__beat--sounded' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ))}
        </span>

        <span className="beat-strip__label">
          {counting && countInBars > 1
            ? `${count.barsLeft}/${countInBars} bars of ${meter}`
            : counting || pulse === null
              ? `${countInBars} bar${countInBars === 1 ? '' : 's'} of ${meter}`
              : meter}
        </span>
      </span>

      <button
        type="button"
        className={
          sound ? 'beat-strip__sound beat-strip__sound--on' : 'beat-strip__sound'
        }
        aria-pressed={sound}
        aria-label={sound ? 'Mute the beat' : 'Hear the beat'}
        title={sound ? 'The beat is heard' : 'The beat is seen, not heard'}
        onClick={() => onSoundChange(!sound)}
      >
        {sound ? <Volume size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
      </button>

    </div>
  );
}
