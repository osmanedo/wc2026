import './HowItWorks.css'

export default function HowItWorks({ onClose }) {
  return (
    <div className="ai-brief-overlay" onClick={onClose}>
      <div className="ai-brief-modal hiw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-brief-header">
          <span className="ai-brief-title">Welcome to WC2026 Fantasy! 🏆</span>
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
            <div className="hiw-points-row multiplier">
              <span className="hiw-points-desc">Knockout rounds</span>
              <span className="hiw-points-val">×2</span>
            </div>
            <div className="hiw-points-row multiplier">
              <span className="hiw-points-desc">Final</span>
              <span className="hiw-points-val">×3</span>
            </div>
          </div>

          <div className="hiw-section-label">Tips</div>
          <ul className="hiw-tips">
            <li>Tap any match to submit your tip before kickoff.</li>
            <li>Check <strong>AI Brief</strong> for match insights and predictions.</li>
            <li>Join a group to compete on a private leaderboard with friends.</li>
          </ul>

          <button className="hiw-cta" onClick={onClose}>Let's go!</button>
        </div>
      </div>
    </div>
  )
}
