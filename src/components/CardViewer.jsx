import { useState, useMemo } from 'react'

export default function CardViewer({ cards }) {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'json'
  const [page, setPage] = useState(0)
  const pageSize = 50

  const filteredCards = useMemo(() => {
    if (!search.trim()) return cards
    const query = search.toLowerCase()
    return cards.filter(card => 
      card.fields.some(f => f.toLowerCase().includes(query))
    )
  }, [cards, search])

  const pagedCards = useMemo(() => {
    const start = page * pageSize
    return filteredCards.slice(start, start + pageSize)
  }, [filteredCards, page])

  const totalPages = Math.ceil(filteredCards.length / pageSize)

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'anki-cards.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card-viewer">
      <div className="viewer-toolbar">
        <input
          type="text"
          placeholder="검색..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="search-input"
        />
        
        <div className="view-toggle">
          <button 
            className={viewMode === 'table' ? 'active' : ''}
            onClick={() => setViewMode('table')}
          >
            📋 테이블
          </button>
          <button 
            className={viewMode === 'json' ? 'active' : ''}
            onClick={() => setViewMode('json')}
          >
            🔧 JSON
          </button>
        </div>

        <button className="export-btn" onClick={handleExportJSON}>
          📥 JSON 내보내기
        </button>
      </div>

      <p className="result-count">
        {filteredCards.length}개 카드 {search && `(검색: "${search}")`}
      </p>

      {viewMode === 'table' ? (
        <>
          <div className="cards-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Note ID</th>
                  <th>필드 1 (앞면)</th>
                  <th>필드 2 (뒷면)</th>
                  <th>추가 필드</th>
                </tr>
              </thead>
              <tbody>
                {pagedCards.map((card, idx) => (
                  <tr key={card.noteId}>
                    <td>{page * pageSize + idx + 1}</td>
                    <td className="note-id">{card.noteId}</td>
                    <td className="field-cell" dangerouslySetInnerHTML={{ __html: card.fields[0] || '-' }} />
                    <td className="field-cell" dangerouslySetInnerHTML={{ __html: card.fields[1] || '-' }} />
                    <td className="field-cell">
                      {card.fields.length > 2 && (
                        <span className="extra-fields">+{card.fields.length - 2} 필드</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                ← 이전
              </button>
              <span>{page + 1} / {totalPages}</span>
              <button 
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                다음 →
              </button>
            </div>
          )}
        </>
      ) : (
        <pre className="json-view">
          {JSON.stringify(pagedCards, null, 2)}
        </pre>
      )}
    </div>
  )
}
