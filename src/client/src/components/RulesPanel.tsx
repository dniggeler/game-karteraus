export function RulesPanel() {
  return (
    <section className="panel rules-panel">
      <div className="section-header">
        <h2>Spielregeln</h2>
      </div>

      <div className="rules-grid">
        <article className="rules-card">
          <h3>Ziel und Vorbereitung</h3>
          <ul className="rules-list">
            <li>Gespielt wird mit 3 bis 4 Spielern und 36 Karten von 6 bis As.</li>
            <li>Jede Runde waehlt genau ein Spieler den Startwert fuer alle Farben.</li>
            <li>In Runde 1 beginnt der Geber mit der Wahl, danach wandert das Wahlrecht gegen den Uhrzeigersinn weiter.</li>
            <li>Der Spieler rechts vom Waehler macht den ersten Zug.</li>
          </ul>
        </article>

        <article className="rules-card">
          <h3>Karten legen</h3>
          <ul className="rules-list">
            <li>Eine Farbe wird mit der Karte des gewaehlten Startwerts eroeffnet.</li>
            <li>Danach darf in derselben Farbe nur die naechstkleinere oder naechstgroessere Karte angelegt werden.</li>
            <li>Bei Startwert 6 geht es nur nach oben, bei As nur nach unten.</li>
            <li>Normalerweise darf pro Zug genau eine gueltige Karte gespielt werden.</li>
          </ul>
        </article>

        <article className="rules-card">
          <h3>Zugregeln</h3>
          <ul className="rules-list">
            <li>Wer keine gueltige Karte legen kann, muss passen.</li>
            <li>Wer noch mindestens eine gueltige Karte hat, darf nicht passen.</li>
            <li>Mehrere Karten auf einmal sind nur erlaubt, wenn damit die komplette Hand regelkonform abgelegt wird.</li>
            <li>Die Runde endet sofort, sobald ein Spieler keine Handkarten mehr hat.</li>
          </ul>
        </article>

        <article className="rules-card">
          <h3>Wertung</h3>
          <ul className="rules-list">
            <li>Nach jeder Runde zaehlen die uebrigen Handkarten aller Spieler als Punkte.</li>
            <li>Der Rundensieger erhaelt 0 Punkte.</li>
            <li>Die Punkte werden ueber alle Runden aufsummiert.</li>
            <li>Der beste Spieler ist der mit der niedrigsten Gesamtpunktzahl.</li>
          </ul>
        </article>
      </div>
    </section>
  )
}
