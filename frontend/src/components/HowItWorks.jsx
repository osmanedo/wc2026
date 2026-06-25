import './HowItWorks.css'

export default function HowItWorks({ onClose }) {
  return (
    <div className="ai-brief-overlay" onClick={onClose}>
      <div className="ai-brief-modal hiw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-brief-header">
          <span className="ai-brief-title">Welcome to WC2026 Fantasy!! 🏆</span>
          <button className="ai-brief-close" onClick={onClose}>✕</button>
        </div>

        <div className="ai-brief-body hiw-body">
          <p className="hiw-intro">
            Predict the score for every World Cup match and compete with your mates.
          </p>

          <div className="hiw-section-label">Points table</div>
          <div className="hiw-points-table">
            <div className="hiw-points-row">
              <span className="hiw-points-desc">Correct result (W / D / L)</span>
              <span className="hiw-points-val">2 pts</span>
            </div>
            <div className="hiw-points-row">
              <span className="hiw-points-desc">Exact score</span>
              <span className="hiw-points-val">5 pts</span>
            </div>
          </div>

          <div className="hiw-section-label hiw-section-label-new">
            Knockout rounds
            <span className="hiw-new-badge">New</span>
          </div>
          <div className="hiw-knockout-highlight">
          <p className="hiw-intro">
            Scores are based on the result at the end of extra time. Penalty shootout goals don't count toward the scoreline.
          </p>
          <div className="hiw-points-table hiw-points-table-wide">
            <div className="hiw-points-row hiw-points-row-wide hiw-points-head">
              <span className="hiw-points-desc">Outcome</span>
              <span className="hiw-points-val">Group</span>
              <span className="hiw-points-val">KO (×2)</span>
              <span className="hiw-points-val">Final (×3)</span>
            </div>
            <div className="hiw-points-row hiw-points-row-wide">
              <span className="hiw-points-desc">Correct result</span>
              <span className="hiw-points-val">2</span>
              <span className="hiw-points-val">4</span>
              <span className="hiw-points-val">6</span>
            </div>
            <div className="hiw-points-row hiw-points-row-wide">
              <span className="hiw-points-desc">Exact score</span>
              <span className="hiw-points-val">5</span>
              <span className="hiw-points-val">10</span>
              <span className="hiw-points-val">15</span>
            </div>
            <div className="hiw-points-row hiw-points-row-wide">
              <span className="hiw-points-desc">Advancement bonus</span>
              <span className="hiw-points-val">–</span>
              <span className="hiw-points-val">2</span>
              <span className="hiw-points-val">3</span>
            </div>
          </div>
          <p className="hiw-intro">
            About the advancement bonus: if you predict a winning scoreline, your advancer is implied. If you predict a draw, you'll be asked to pick who wins on penalties. Correctly picking who advances earns the bonus.
          </p>
          </div>

          <div className="hiw-section-label">Tiebreakers (in order)</div>
          <ol className="hiw-tiebreak-list">
            <li>Most exact-score predictions</li>
            <li>Most correct results (W / D / L)</li>
            <li>Highest single-match haul</li>
            <li>Longest current correct streak</li>
            <li>Best accuracy %</li>
            <li>Alphabetical, as a final fallback</li>
          </ol>

          <div className="hiw-section-label">Tips</div>
          <ul className="hiw-tips">
            <li>Tap any match to submit your tip before kickoff.</li>
            <li>Check <strong>AI Brief</strong> for match insights and predictions.</li>
            <li>Join a league to compete on a private leaderboard with friends.</li>
          </ul>

          <button className="hiw-cta" onClick={onClose}>Let's go!</button>
        </div>
      </div>
    </div>
  )
}
