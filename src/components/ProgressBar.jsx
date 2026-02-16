import { useState, useEffect } from 'react'

export default function ProgressBar({ step, stepName, percent, startTime }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      if (startTime) {
        setElapsed((Date.now() - startTime) / 1000)
      }
    }, 100)

    return () => clearInterval(timer)
  }, [startTime])

  const totalSteps = 7
  const overallPercent = ((step / totalSteps) * 100) + (percent / totalSteps)

  return (
    <div className="progress-container">
      <div className="progress-header">
        <span className="spinner">⏳</span>
        <h3>처리 중...</h3>
      </div>

      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${Math.min(overallPercent, 100)}%` }}
        />
      </div>

      <div className="progress-info">
        <p className="step-name">
          Step {step + 1}/7: {stepName}
        </p>
        <p className="elapsed-time">
          ⏱️ {elapsed.toFixed(1)}초
        </p>
      </div>

      <div className="step-dots">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <span 
            key={i} 
            className={`dot ${i < step ? 'done' : i === step ? 'active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
