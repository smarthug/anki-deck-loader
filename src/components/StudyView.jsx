import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { extractMediaRefs, stripHtml } from '../utils/ankiParser'
import {
  Quality,
  createCardState,
  calculateNextReview,
  getDueCards,
  getStats,
  getAnswerButtons,
  saveStudyData,
  loadStudyData,
  generateDeckId,
  formatInterval,
} from '../utils/sm2'
import './StudyView.css'

export default function StudyView({ cards, media, onClose }) {
  const [deckId] = useState(() => generateDeckId(cards))
  const [cardStates, setCardStates] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 })
  const [isComplete, setIsComplete] = useState(false)

  // Initialize card states from localStorage or create new
  useEffect(() => {
    const saved = loadStudyData(deckId)
    if (saved?.cardStates) {
      setCardStates(saved.cardStates)
    } else {
      const initial = {}
      cards.forEach(card => {
        initial[card.noteId] = createCardState(card.noteId)
      })
      setCardStates(initial)
    }
  }, [deckId, cards])

  // Get due cards
  const dueCards = useMemo(() => {
    const states = Object.values(cardStates)
    if (states.length === 0) return []
    
    const due = getDueCards(states)
    return due.map(state => ({
      ...cards.find(c => c.noteId === state.cardId),
      state,
    })).filter(c => c.fields) // Filter out any missing cards
  }, [cardStates, cards])

  // Current card
  const currentCard = dueCards[currentIndex]

  // Statistics
  const stats = useMemo(() => {
    return getStats(Object.values(cardStates))
  }, [cardStates])

  // Answer buttons
  const buttons = useMemo(() => {
    if (!currentCard?.state) return null
    return getAnswerButtons(currentCard.state)
  }, [currentCard])

  // Handle answer
  const handleAnswer = useCallback((quality) => {
    if (!currentCard) return

    const newState = calculateNextReview(currentCard.state, quality)
    
    setCardStates(prev => {
      const updated = {
        ...prev,
        [currentCard.noteId]: newState,
      }
      // Save to localStorage
      saveStudyData(deckId, { cardStates: updated })
      return updated
    })

    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      correct: quality >= 3 ? prev.correct + 1 : prev.correct,
    }))

    // Move to next card
    setShowAnswer(false)
    
    if (quality < 3) {
      // Wrong answer - card stays in queue (will be reviewed again)
      // For now, just move to next and it will appear later
    }
    
    if (currentIndex + 1 >= dueCards.length) {
      // Check if there are still due cards (including ones we just failed)
      setTimeout(() => {
        const remaining = getDueCards(Object.values({
          ...cardStates,
          [currentCard.noteId]: newState,
        }))
        if (remaining.length === 0) {
          setIsComplete(true)
        } else {
          setCurrentIndex(0)
        }
      }, 100)
    } else {
      setCurrentIndex(prev => prev + 1)
    }
  }, [currentCard, currentIndex, dueCards.length, cardStates, deckId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showAnswer) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          setShowAnswer(true)
        }
      } else {
        if (e.key === '1') handleAnswer(Quality.AGAIN)
        else if (e.key === '2') handleAnswer(Quality.HARD)
        else if (e.key === '3') handleAnswer(Quality.GOOD)
        else if (e.key === '4') handleAnswer(Quality.EASY)
        else if (e.code === 'Space') handleAnswer(Quality.GOOD)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAnswer, handleAnswer])

  // Reset progress
  const handleReset = () => {
    if (confirm('모든 학습 기록을 초기화하시겠습니까?')) {
      const initial = {}
      cards.forEach(card => {
        initial[card.noteId] = createCardState(card.noteId)
      })
      setCardStates(initial)
      saveStudyData(deckId, { cardStates: initial })
      setCurrentIndex(0)
      setShowAnswer(false)
      setIsComplete(false)
      setSessionStats({ reviewed: 0, correct: 0 })
    }
  }

  // Session complete view
  if (isComplete) {
    return (
      <div className="study-view">
        <div className="study-header">
          <button className="back-btn" onClick={onClose}>← 목록</button>
          <h2>🎉 학습 완료!</h2>
        </div>
        
        <div className="study-complete">
          <div className="complete-icon">✨</div>
          <h2>오늘의 복습을 마쳤습니다!</h2>
          
          <div className="session-summary">
            <div className="summary-item">
              <span className="label">복습한 카드</span>
              <span className="value">{sessionStats.reviewed}장</span>
            </div>
            <div className="summary-item">
              <span className="label">정답률</span>
              <span className="value">
                {sessionStats.reviewed > 0 
                  ? Math.round(sessionStats.correct / sessionStats.reviewed * 100)
                  : 0}%
              </span>
            </div>
          </div>

          <div className="deck-stats">
            <h3>📊 덱 통계</h3>
            <div className="stats-grid">
              <div className="stat new">
                <span className="num">{stats.new}</span>
                <span className="label">새 카드</span>
              </div>
              <div className="stat learning">
                <span className="num">{stats.learning}</span>
                <span className="label">학습 중</span>
              </div>
              <div className="stat mature">
                <span className="num">{stats.mature}</span>
                <span className="label">장기 기억</span>
              </div>
            </div>
          </div>

          <div className="complete-actions">
            <button className="btn-primary" onClick={onClose}>
              돌아가기
            </button>
            <button className="btn-secondary" onClick={handleReset}>
              기록 초기화
            </button>
          </div>
        </div>
      </div>
    )
  }

  // No due cards
  if (dueCards.length === 0 && Object.keys(cardStates).length > 0) {
    return (
      <div className="study-view">
        <div className="study-header">
          <button className="back-btn" onClick={onClose}>← 목록</button>
          <h2>📚 학습하기</h2>
        </div>
        
        <div className="study-complete">
          <div className="complete-icon">🎯</div>
          <h2>오늘 복습할 카드가 없습니다</h2>
          <p>내일 다시 확인해주세요!</p>
          
          <div className="deck-stats">
            <h3>📊 덱 통계</h3>
            <div className="stats-grid">
              <div className="stat new">
                <span className="num">{stats.new}</span>
                <span className="label">새 카드</span>
              </div>
              <div className="stat learning">
                <span className="num">{stats.learning}</span>
                <span className="label">학습 중</span>
              </div>
              <div className="stat mature">
                <span className="num">{stats.mature}</span>
                <span className="label">장기 기억</span>
              </div>
            </div>
          </div>

          <div className="complete-actions">
            <button className="btn-primary" onClick={onClose}>
              돌아가기
            </button>
            <button className="btn-secondary" onClick={handleReset}>
              기록 초기화
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Loading
  if (!currentCard) {
    return (
      <div className="study-view">
        <div className="study-header">
          <button className="back-btn" onClick={onClose}>← 목록</button>
        </div>
        <div className="loading">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="study-view">
      {/* Header */}
      <div className="study-header">
        <button className="back-btn" onClick={onClose}>← 목록</button>
        <div className="progress-info">
          <span className="current">{currentIndex + 1}</span>
          <span className="divider">/</span>
          <span className="total">{dueCards.length}</span>
        </div>
        <div className="stats-mini">
          <span className="new">{stats.new} 새</span>
          <span className="learning">{stats.learning} 학습</span>
          <span className="due">{stats.due} 복습</span>
        </div>
      </div>

      {/* Card */}
      <div className="study-card">
        <CardContent 
          card={currentCard} 
          media={media} 
          showAnswer={showAnswer}
        />
      </div>

      {/* Controls */}
      <div className="study-controls">
        {!showAnswer ? (
          <button 
            className="show-answer-btn"
            onClick={() => setShowAnswer(true)}
          >
            정답 보기
            <span className="hint">Space</span>
          </button>
        ) : (
          <div className="answer-buttons">
            {buttons && Object.entries(buttons).map(([key, btn]) => (
              <button
                key={key}
                className={`answer-btn ${key}`}
                style={{ '--btn-color': btn.color }}
                onClick={() => handleAnswer(btn.quality)}
              >
                <span className="btn-label">{btn.label}</span>
                <span className="btn-interval">{btn.interval}</span>
                <span className="btn-key">{
                  key === 'again' ? '1' : key === 'hard' ? '2' : key === 'good' ? '3' : '4'
                }</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Card content component
const CardContent = memo(function CardContent({ card, media, showAnswer }) {
  const word = stripHtml(card.fields[0] || '')
  const meaning = stripHtml(card.fields[1] || '')
  
  const mediaRefs = useMemo(() => 
    extractMediaRefs(card.fields[0] || ''), 
    [card.fields]
  )

  const handleAudioPlay = useCallback((url) => {
    new Audio(url).play()
  }, [])

  return (
    <div className="card-content">
      {/* Front (Question) */}
      <div className="card-front">
        {/* Image */}
        {mediaRefs.filter(r => r.type === 'image').slice(0, 1).map((ref, idx) => {
          const url = media[ref.filename]
          return url ? (
            <img key={idx} src={url} alt="" className="card-image" />
          ) : null
        })}
        
        <h1 className="card-word">{word || '(empty)'}</h1>
        
        {/* Audio */}
        {mediaRefs.filter(r => r.type === 'audio').slice(0, 1).map((ref, idx) => {
          const url = media[ref.filename]
          return url ? (
            <button 
              key={idx}
              className="audio-btn"
              onClick={() => handleAudioPlay(url)}
            >
              🔊
            </button>
          ) : null
        })}
      </div>

      {/* Back (Answer) - only show when revealed */}
      {showAnswer && (
        <div className="card-back">
          <div className="divider" />
          <p className="card-meaning">{meaning}</p>
          
          {/* Extra fields */}
          {card.fields.slice(2, 5).map((field, idx) => {
            const text = stripHtml(field)
            if (!text) return null
            return <p key={idx} className="card-extra">{text}</p>
          })}
        </div>
      )}

      {/* Card info */}
      {showAnswer && card.state && (
        <div className="card-info">
          <span>EF: {card.state.easeFactor}</span>
          <span>간격: {formatInterval(card.state.interval)}</span>
          <span>복습: {card.state.reviewCount}회</span>
        </div>
      )}
    </div>
  )
})
