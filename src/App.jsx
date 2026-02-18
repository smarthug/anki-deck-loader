import { useState, useCallback } from 'react'
import FileUpload from './components/FileUpload'
import ProgressBar from './components/ProgressBar'
import CardViewer from './components/CardViewer'
import SwipeViewer from './components/SwipeViewer'
import { parseApkg } from './utils/ankiParser'
import './App.css'

const STEPS = [
  '파일 읽기',
  'ZIP 해제',
  'SQLite/미디어 추출',
  'SQLite 로딩',
  'SQL 쿼리',
  'JSON 변환',
  '완료'
]

function App() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ step: 0, percent: 0 })
  const [startTime, setStartTime] = useState(null)
  const [result, setResult] = useState(null) // { cards, models, media }
  const [error, setError] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'swipe'

  const updateProgress = useCallback((step, percent = 100) => {
    setProgress({ step, percent })
  }, [])

  const handleFileSelect = useCallback(async (file) => {
    // 파일 검증
    if (!file.name.endsWith('.apkg')) {
      setError('.apkg 파일만 업로드 가능합니다.')
      return
    }

    if (file.size > 300 * 1024 * 1024) {
      setError('파일 크기는 300MB 이하여야 합니다.')
      return
    }

    // 초기화
    setError(null)
    setResult(null)
    setLoading(true)
    setFileInfo({ name: file.name, size: file.size })
    const start = Date.now()
    setStartTime(start)

    try {
      const data = await parseApkg(file, updateProgress)
      setResult(data)
      updateProgress(6, 100)
    } catch (err) {
      console.error('Parse error:', err)
      setError(`파싱 실패: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [updateProgress])

  const handleReset = () => {
    // 미디어 Blob URL 해제
    if (result?.media) {
      Object.values(result.media).forEach(url => {
        URL.revokeObjectURL(url)
      })
    }
    setResult(null)
    setFileInfo(null)
    setError(null)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>📚 Anki Deck Loader</h1>
        <p>브라우저에서 .apkg 파일을 직접 파싱합니다</p>
      </header>

      <main className="main">
        {!loading && !result && (
          <FileUpload onFileSelect={handleFileSelect} />
        )}

        {loading && (
          <ProgressBar 
            step={progress.step}
            stepName={STEPS[progress.step]}
            percent={progress.percent}
            startTime={startTime}
          />
        )}

        {error && (
          <div className="error">
            <span>❌</span> {error}
            <button onClick={() => { setError(null); setResult(null); }}>
              다시 시도
            </button>
          </div>
        )}

        {result && !loading && viewMode === 'list' && (
          <>
            <div className="result-header">
              <h2>✅ 파싱 완료</h2>
              <div className="result-stats">
                <span>📄 {fileInfo?.name}</span>
                <span>💾 {(fileInfo?.size / 1024 / 1024).toFixed(2)} MB</span>
                <span>🃏 {result.cards.length}개 카드</span>
                <span>📝 {Object.keys(result.models).length}개 노트 타입</span>
                <span>🖼️ {Object.keys(result.media).length}개 미디어</span>
                <span>⏱️ {((Date.now() - startTime) / 1000).toFixed(2)}초</span>
              </div>
              <div className="action-buttons">
                <button className="swipe-btn" onClick={() => setViewMode('swipe')}>
                  📱 스와이프 모드로 학습
                </button>
                <button className="reset-btn" onClick={handleReset}>
                  다른 파일 열기
                </button>
              </div>
            </div>
            <CardViewer 
              cards={result.cards} 
              models={result.models}
              media={result.media}
            />
          </>
        )}

        {result && !loading && viewMode === 'swipe' && (
          <SwipeViewer
            cards={result.cards}
            media={result.media}
            onClose={() => setViewMode('list')}
          />
        )}
      </main>

      <footer className="footer">
        <p>Word Shorts 프로젝트 • <a href="https://github.com/smarthug/anki-deck-loader" target="_blank" rel="noopener noreferrer">GitHub</a></p>
      </footer>
    </div>
  )
}

export default App
