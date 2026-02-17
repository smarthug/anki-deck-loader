import { useState, useMemo, useRef } from 'react'
import { extractMediaRefs, stripHtml } from '../utils/ankiParser'

export default function CardViewer({ cards, models, media }) {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('table')
  const [page, setPage] = useState(0)
  const [selectedModel, setSelectedModel] = useState('all')
  const [expandedCard, setExpandedCard] = useState(null)
  const pageSize = 50

  // 모델별 필터링
  const modelOptions = useMemo(() => {
    const modelSet = new Map()
    cards.forEach(card => {
      if (!modelSet.has(card.modelId)) {
        modelSet.set(card.modelId, card.modelName)
      }
    })
    return Array.from(modelSet.entries())
  }, [cards])

  // 필터링된 카드
  const filteredCards = useMemo(() => {
    let result = cards
    
    // 모델 필터
    if (selectedModel !== 'all') {
      result = result.filter(card => card.modelId === selectedModel)
    }
    
    // 검색 필터
    if (search.trim()) {
      const query = search.toLowerCase()
      result = result.filter(card => 
        card.fields.some(f => stripHtml(f).toLowerCase().includes(query))
      )
    }
    
    return result
  }, [cards, search, selectedModel])

  // 현재 모델의 필드 이름들
  const currentFieldNames = useMemo(() => {
    if (selectedModel !== 'all' && models[selectedModel]) {
      return models[selectedModel].fields
    }
    // 전체 모드면 첫 번째 카드 기준
    if (filteredCards.length > 0) {
      return filteredCards[0].fieldNames
    }
    return []
  }, [selectedModel, models, filteredCards])

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
        
        {/* 모델 필터 */}
        <select 
          value={selectedModel} 
          onChange={(e) => { setSelectedModel(e.target.value); setPage(0) }}
          className="model-select"
        >
          <option value="all">모든 노트 타입</option>
          {modelOptions.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        
        <div className="view-toggle">
          <button 
            className={viewMode === 'table' ? 'active' : ''}
            onClick={() => setViewMode('table')}
          >
            📋 테이블
          </button>
          <button 
            className={viewMode === 'card' ? 'active' : ''}
            onClick={() => setViewMode('card')}
          >
            🃏 카드
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
        {filteredCards.length}개 카드 
        {search && ` (검색: "${search}")`}
        {selectedModel !== 'all' && ` • ${models[selectedModel]?.name}`}
      </p>

      {viewMode === 'table' && (
        <>
          <div className="cards-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>타입</th>
                  {currentFieldNames.map((name, idx) => (
                    <th key={idx}>{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedCards.map((card, idx) => (
                  <tr key={card.noteId} onClick={() => setExpandedCard(card)}>
                    <td>{page * pageSize + idx + 1}</td>
                    <td className="model-name">{card.modelName}</td>
                    {currentFieldNames.map((fieldName, fieldIdx) => (
                      <td key={fieldIdx} className="field-cell">
                        <FieldRenderer 
                          value={card.fieldsMap[fieldName] || card.fields[fieldIdx] || ''} 
                          media={media}
                          compact={true}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} setPage={setPage} />
          )}
        </>
      )}

      {viewMode === 'card' && (
        <>
          <div className="cards-grid">
            {pagedCards.map((card, idx) => (
              <div key={card.noteId} className="card-item" onClick={() => setExpandedCard(card)}>
                <div className="card-header">
                  <span className="card-number">#{page * pageSize + idx + 1}</span>
                  <span className="card-model">{card.modelName}</span>
                </div>
                {card.fieldNames.map((fieldName, fieldIdx) => (
                  <div key={fieldIdx} className="card-field">
                    <label>{fieldName}</label>
                    <FieldRenderer 
                      value={card.fields[fieldIdx] || ''} 
                      media={media}
                      compact={false}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} setPage={setPage} />
          )}
        </>
      )}

      {viewMode === 'json' && (
        <pre className="json-view">
          {JSON.stringify(pagedCards, null, 2)}
        </pre>
      )}

      {/* 확장 모달 */}
      {expandedCard && (
        <CardModal 
          card={expandedCard} 
          media={media} 
          onClose={() => setExpandedCard(null)} 
        />
      )}
    </div>
  )
}

// 필드 렌더러 (이미지, 오디오, 텍스트)
function FieldRenderer({ value, media, compact }) {
  const audioRef = useRef(null)
  
  if (!value) return <span className="empty">-</span>
  
  const mediaRefs = extractMediaRefs(value)
  const textContent = stripHtml(value)
  
  return (
    <div className={`field-content ${compact ? 'compact' : ''}`}>
      {/* 텍스트 */}
      {textContent && (
        <span className="text-content">{textContent}</span>
      )}
      
      {/* 미디어 */}
      {mediaRefs.map((ref, idx) => {
        const url = media[ref.filename]
        
        if (!url) {
          return (
            <span key={idx} className="missing-media">
              [{ref.type}: {ref.filename}]
            </span>
          )
        }
        
        if (ref.type === 'image') {
          return (
            <img 
              key={idx}
              src={url} 
              alt={ref.filename}
              className="field-image"
              onClick={(e) => {
                e.stopPropagation()
                window.open(url, '_blank')
              }}
            />
          )
        }
        
        if (ref.type === 'audio') {
          return (
            <button 
              key={idx}
              className="audio-btn"
              onClick={(e) => {
                e.stopPropagation()
                const audio = new Audio(url)
                audio.play()
              }}
            >
              🔊 {compact ? '' : ref.filename}
            </button>
          )
        }
        
        return null
      })}
    </div>
  )
}

// 페이지네이션
function Pagination({ page, totalPages, setPage }) {
  return (
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
  )
}

// 카드 상세 모달
function CardModal({ card, media, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{card.modelName}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {card.fieldNames.map((fieldName, idx) => (
            <div key={idx} className="modal-field">
              <label>{fieldName}</label>
              <FieldRenderer 
                value={card.fields[idx] || ''} 
                media={media}
                compact={false}
              />
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <span className="note-id">Note ID: {card.noteId}</span>
        </div>
      </div>
    </div>
  )
}
