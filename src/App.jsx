import { useState, useCallback } from 'react'
import FileUpload from './components/FileUpload'
import ProgressBar from './components/ProgressBar'
import CardViewer from './components/CardViewer'
import { parseApkg } from './utils/ankiParser'
import './App.css'

const STEPS = [
  '파일 읽기',
  'ZIP 해제',
  'SQLite 추출',
  'SQLite 로딩',
  'SQL 쿼리',
  'JSON 변환',
  '완료'
]

function App() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ step: 0, percent: 0 })
  const [startTime, setStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [cards, setCards] = useState(null)
  const [error, setError] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)

  const updateProgress = useCallback((step, percent = 100) => {
    setProgress({ step, percent })
  }, [])

  const handleFileSelect = useCallback(async (file) => {
    // 파일 검증
    if (!file.name.endsWith('.apkg')) {
      setError('.apkg 파일만 업로드 가능합니다.')
      return
    }

    // 제한을 200MB로 상향하거나, 체크를 제거할 수 있습니다.
    if (file.size > 300 * 1024 * 1024) {
      setError('파일 크기는 200MB 이하여야 합니다.')
      return
    }

    // 초기화
    setError(null)
    setCards(null)
    setLoading(true)
    setFileInfo({ name: file.name, size: file.size })
    setStartTime(Date.now())
    setElapsedTime(0)

    // 타이머 시작
    const timer = setInterval(() => {
      setElapsedTime(Date.now() - Date.now() + (Date.now() - (startTime || Date.now())))
    }, 100)

    try {
      const result = await parseApkg(file, updateProgress)
      setCards(result)
      updateProgress(6, 100)
    } catch (err) {
      console.error('Parse error:', err)
      setError(`파싱 실패: ${err.message}`)
    } finally {
      clearInterval(timer)
      setElapsedTime(Date.now() - (startTime || Date.now()))
      setLoading(false)
    }
  }, [startTime, updateProgress])

  return (
    <div className="app">
      <header className="header">
        <h1>📚 Anki Deck Loader</h1>
        <p>브라우저에서 .apkg 파일을 직접 파싱합니다</p>
      </header>

      <main className="main">
        {!loading && !cards && (
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
            <button onClick={() => { setError(null); setCards(null); }}>
              다시 시도
            </button>
          </div>
        )}

        {cards && !loading && (
          <>
            <div className="result-header">
              <h2>✅ 파싱 완료</h2>
              <p>
                {fileInfo?.name} ({(fileInfo?.size / 1024 / 1024).toFixed(2)} MB)
                • {cards.length}개 카드
                • {((Date.now() - startTime) / 1000).toFixed(2)}초
              </p>
              <button className="reset-btn" onClick={() => { setCards(null); setFileInfo(null); }}>
                다른 파일 열기
              </button>
            </div>
            <CardViewer cards={cards} />
          </>
        )}
      </main>

      <footer className="footer">
        <p>Word Shorts 프로젝트 • <a href="https://github.com/smarthug/anki-deck-loader" target="_blank" rel="noopener noreferrer">GitHub</a></p>
      </footer>
    </div>
  )
}

export default App
