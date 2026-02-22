/**
 * SM-2 Spaced Repetition Algorithm
 * Based on: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */

// Quality ratings
export const Quality = {
  AGAIN: 0,    // Complete blackout, wrong answer
  HARD: 2,     // Correct but with difficulty
  GOOD: 3,     // Correct with some hesitation
  EASY: 5,     // Perfect, instant recall
}

// Default card state
export const createCardState = (cardId) => ({
  cardId,
  easeFactor: 2.5,    // EF starts at 2.5
  interval: 0,        // Days until next review
  repetition: 0,      // Successful repetitions in a row
  dueDate: new Date().toISOString().split('T')[0], // Due today
  lastReview: null,
  reviewCount: 0,
})

/**
 * Calculate next review state based on SM-2 algorithm
 * @param {Object} cardState - Current card state
 * @param {number} quality - User rating (0-5)
 * @returns {Object} Updated card state
 */
export function calculateNextReview(cardState, quality) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  
  let { easeFactor, interval, repetition } = cardState
  
  // Calculate new ease factor
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const newEaseFactor = Math.max(
    1.3, // Minimum EF
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  )
  
  let newInterval
  let newRepetition
  
  if (quality < 3) {
    // Failed - reset repetition, review again soon
    newRepetition = 0
    newInterval = 0 // Review again in same session
  } else {
    // Success
    newRepetition = repetition + 1
    
    if (newRepetition === 1) {
      newInterval = 1 // 1 day
    } else if (newRepetition === 2) {
      newInterval = 6 // 6 days
    } else {
      newInterval = Math.round(interval * newEaseFactor)
    }
  }
  
  // Calculate due date
  const dueDate = new Date(now)
  dueDate.setDate(dueDate.getDate() + newInterval)
  
  return {
    ...cardState,
    easeFactor: Number(newEaseFactor.toFixed(2)),
    interval: newInterval,
    repetition: newRepetition,
    dueDate: dueDate.toISOString().split('T')[0],
    lastReview: today,
    reviewCount: cardState.reviewCount + 1,
  }
}

/**
 * Check if a card is due for review
 * @param {Object} cardState - Card state
 * @returns {boolean}
 */
export function isDue(cardState) {
  if (!cardState.dueDate) return true
  const today = new Date().toISOString().split('T')[0]
  return cardState.dueDate <= today
}

/**
 * Get cards due for review, sorted by priority
 * @param {Array} cardStates - Array of card states
 * @returns {Array} Due cards sorted by overdue days (most overdue first)
 */
export function getDueCards(cardStates) {
  const today = new Date()
  
  return cardStates
    .filter(isDue)
    .sort((a, b) => {
      // Sort by overdue days (most overdue first)
      const aDate = new Date(a.dueDate)
      const bDate = new Date(b.dueDate)
      return aDate - bDate
    })
}

/**
 * Get learning statistics
 * @param {Array} cardStates - Array of card states
 * @returns {Object} Statistics
 */
export function getStats(cardStates) {
  const today = new Date().toISOString().split('T')[0]
  
  const stats = {
    total: cardStates.length,
    new: 0,      // Never reviewed
    learning: 0, // Interval < 21 days
    mature: 0,   // Interval >= 21 days
    due: 0,      // Due today
    overdue: 0,  // Past due
  }
  
  cardStates.forEach(card => {
    if (card.reviewCount === 0) {
      stats.new++
    } else if (card.interval < 21) {
      stats.learning++
    } else {
      stats.mature++
    }
    
    if (card.dueDate <= today) {
      stats.due++
      if (card.dueDate < today) {
        stats.overdue++
      }
    }
  })
  
  return stats
}

/**
 * Format interval for display
 * @param {number} interval - Interval in days
 * @returns {string}
 */
export function formatInterval(interval) {
  if (interval === 0) return '< 1분'
  if (interval === 1) return '1일'
  if (interval < 7) return `${interval}일`
  if (interval < 30) return `${Math.round(interval / 7)}주`
  if (interval < 365) return `${Math.round(interval / 30)}개월`
  return `${(interval / 365).toFixed(1)}년`
}

/**
 * Get button labels with next interval preview
 * @param {Object} cardState - Current card state
 * @returns {Object} Button configs
 */
export function getAnswerButtons(cardState) {
  return {
    again: {
      quality: Quality.AGAIN,
      label: '모름',
      interval: '< 1분',
      color: '#ef4444',
    },
    hard: {
      quality: Quality.HARD,
      label: '어려움',
      interval: formatInterval(calculateNextReview(cardState, Quality.HARD).interval),
      color: '#f59e0b',
    },
    good: {
      quality: Quality.GOOD,
      label: '보통',
      interval: formatInterval(calculateNextReview(cardState, Quality.GOOD).interval),
      color: '#22c55e',
    },
    easy: {
      quality: Quality.EASY,
      label: '쉬움',
      interval: formatInterval(calculateNextReview(cardState, Quality.EASY).interval),
      color: '#3b82f6',
    },
  }
}

// Storage key
const STORAGE_KEY = 'anki-deck-loader-study-data'

/**
 * Save study data to localStorage
 * @param {string} deckId - Deck identifier
 * @param {Object} data - Study data
 */
export function saveStudyData(deckId, data) {
  try {
    const allData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    allData[deckId] = {
      ...data,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData))
  } catch (e) {
    console.error('Failed to save study data:', e)
  }
}

/**
 * Load study data from localStorage
 * @param {string} deckId - Deck identifier
 * @returns {Object|null}
 */
export function loadStudyData(deckId) {
  try {
    const allData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return allData[deckId] || null
  } catch (e) {
    console.error('Failed to load study data:', e)
    return null
  }
}

/**
 * Generate deck ID from cards
 * @param {Array} cards - Cards array
 * @returns {string}
 */
export function generateDeckId(cards) {
  // Use first few card IDs to create a unique deck identifier
  const sample = cards.slice(0, 5).map(c => c.noteId).join('-')
  return `deck-${sample}-${cards.length}`
}
