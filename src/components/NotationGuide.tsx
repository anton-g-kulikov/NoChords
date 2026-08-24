/**
 * What a bar is, and how this app writes one down (ADR-033).
 *
 * Deliberately short. Someone opens this because a word in the editor meant nothing to them, and
 * they want to get back to the song — not to read a theory chapter.
 */
interface NotationGuideProps {
  onClose: () => void;
}

export function NotationGuide({ onClose }: NotationGuideProps) {
  return (
    <div className="guide">
      <div className="guide__head">
        <button type="button" className="button" onClick={onClose}>
          ← Songs
        </button>
        <h1>Bars, beats and meter</h1>
      </div>

      <section className="guide__section">
        <h2>Beats</h2>
        <p>
          The beat is what you tap your foot to. <strong>Tempo</strong> counts them: 90 bpm is
          ninety beats a minute, so each one lasts two thirds of a second. Everything in NoChords is
          measured in beats and bars rather than seconds, which is why changing the tempo stretches
          the whole song evenly instead of pulling it out of shape.
        </p>
      </section>

      <section className="guide__section">
        <h2>Bars</h2>
        <p>
          Beats come in groups, and a group is a <strong>bar</strong>. The first beat of a bar is
          the strong one — the place a chord usually changes, and the one the metronome accents.
          Counting <em>one</em> two three four, <em>one</em> two three four is counting bars.
        </p>
      </section>

      <section className="guide__section">
        <h2>Time signature</h2>
        <p>
          A time signature says how the beats are grouped. It is written as two numbers: the top is
          how many beats are in a bar, the bottom is what counts as one beat — 4 for a quarter note,
          8 for an eighth.
        </p>
        <table className="guide__table">
          <thead>
            <tr>
              <th>Meter</th>
              <th>Counted</th>
              <th>Sounds like</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>4/4</td>
              <td>1 2 3 4</td>
              <td>Most songs ever written</td>
            </tr>
            <tr>
              <td>3/4</td>
              <td>1 2 3</td>
              <td>A waltz</td>
            </tr>
            <tr>
              <td>2/4</td>
              <td>1 2</td>
              <td>A march, a polka</td>
            </tr>
            <tr>
              <td>6/8</td>
              <td>
                <strong>1</strong> 2 3 <strong>4</strong> 5 6
              </td>
              <td>A jig, or House of the Rising Sun</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="guide__section">
        <h2>Why 6/8 clicks twice a bar</h2>
        <p>
          6/8 has six beats, but nobody counts all six evenly. They fall into two groups of three,
          and the pulse you feel — the one you would tap — is those two. Meters that group in threes
          are called <strong>compound</strong>: 6/8, 9/8, 12/8. NoChords accents every third beat in
          them, so a 6/8 bar clicks on 1 and 4 rather than once at the start.
        </p>
        <p className="guide__aside">
          3/8 is the exception: three eighths are a single pulse, not three of anything, so it is
          counted like 3/4 only faster.
        </p>
      </section>

      <section className="guide__section">
        <h2>How NoChords writes it</h2>
        <dl className="guide__terms">
          <dt>Meter</dt>
          <dd>The song's time signature. It sets how long a bar is and where the click falls.</dd>

          <dt>Bars per line</dt>
          <dd>
            How many bars one line of lyrics takes. Two bars of 3/4 and one bar of 6/8 are both six
            beats — the same length, counted differently.
          </dd>

          <dt>
            <code>|4|</code>
          </dt>
          <dd>
            At the end of a line: this line lasts four bars instead of the song's usual. That is how
            you hold the last line of a verse.
          </dd>

          <dt>
            <code>{'{3/4}'}</code>
          </dt>
          <dd>
            At the start of a line: change meter from here to the end of the song, or until the next
            one. A bridge in four inside a song in six is written this way, and the click follows.
          </dd>

          <dt>
            <code>[Am]</code>
          </dt>
          <dd>A chord, written where it falls in the words.</dd>

          <dt>Count-in</dt>
          <dd>How many bars of clicks before the song starts, so you come in in time.</dd>
        </dl>
      </section>

      <section className="guide__section">
        <h2>If a line feels wrong</h2>
        <p>
          A line that lasts an odd number of beats — two and a half bars, say — cannot be written,
          and that is deliberate: every bar after it would start in the wrong place. When a phrase
          really is short, give it its own line and its own meter:{' '}
          <code>{'{2/4}'}</code> for the short bar, then <code>{'{4/4}'}</code> to go back.
        </p>
      </section>
    </div>
  );
}
