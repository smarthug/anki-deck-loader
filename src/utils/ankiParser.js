import { unzip } from 'fflate'
import initSqlJs from 'sql.js'

// sql.js WASM URL (CDN)
const SQL_WASM_URL = 'https://sql.js.org/dist/sql-wasm.wasm'

/**
 * .apkg 파일을 파싱하여 카드 데이터 추출
 * @param {File} file - .apkg 파일
 * @param {Function} onProgress - 진행률 콜백 (step, percent)
 * @returns {Promise<Object>} { cards, models, media }
 */
export async function parseApkg(file, onProgress) {
  let db = null

  try {
    // Step 0: 파일 읽기
    onProgress(0, 0)
    const arrayBuffer = await file.arrayBuffer()
    onProgress(0, 100)

    // Step 1: ZIP 해제
    onProgress(1, 0)
    const zipData = new Uint8Array(arrayBuffer)
    const unzipped = await new Promise((resolve, reject) => {
      unzip(zipData, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
    onProgress(1, 100)

    // Step 2: SQLite 파일 추출
    onProgress(2, 0)
    let sqliteData = null
    
    // Anki 2.1+ uses collection.anki21, older uses collection.anki2
    if (unzipped['collection.anki21']) {
      sqliteData = unzipped['collection.anki21']
    } else if (unzipped['collection.anki2']) {
      sqliteData = unzipped['collection.anki2']
    } else {
      const files = Object.keys(unzipped)
      console.log('ZIP 내용:', files)
      throw new Error('collection.anki2 또는 collection.anki21을 찾을 수 없습니다')
    }

    // 미디어 매핑 추출
    let mediaMap = {}
    if (unzipped['media']) {
      try {
        const mediaJson = new TextDecoder().decode(unzipped['media'])
        mediaMap = JSON.parse(mediaJson)
      } catch (e) {
        console.warn('미디어 매핑 파싱 실패:', e)
      }
    }

    // 미디어 파일들을 Blob URL로 변환
    const mediaBlobs = {}
    for (const [numKey, fileName] of Object.entries(mediaMap)) {
      if (unzipped[numKey]) {
        const blob = new Blob([unzipped[numKey]])
        mediaBlobs[fileName] = URL.createObjectURL(blob)
      }
    }
    
    onProgress(2, 100)

    // Step 3: sql.js 로딩
    onProgress(3, 0)
    const SQL = await initSqlJs({
      locateFile: () => SQL_WASM_URL
    })
    onProgress(3, 100)

    // Step 4: DB 열기
    onProgress(4, 0)
    db = new SQL.Database(sqliteData)
    onProgress(4, 100)

    // Step 5: 데이터 쿼리
    onProgress(5, 0)
    
    // 모델(노트 타입) 정보 추출
    const models = {}
    try {
      const colResult = db.exec("SELECT models FROM col")
      if (colResult.length > 0 && colResult[0].values.length > 0) {
        const modelsJson = JSON.parse(colResult[0].values[0][0])
        for (const [modelId, model] of Object.entries(modelsJson)) {
          models[modelId] = {
            id: modelId,
            name: model.name,
            fields: model.flds.map(f => f.name)
          }
        }
      }
    } catch (e) {
      console.warn('모델 정보 추출 실패:', e)
    }

    // 카드 데이터 쿼리 (청크 처리)
    const CHUNK_SIZE = 500
    let offset = 0
    let allCards = []
    let hasMore = true

    while (hasMore) {
      const query = `
        SELECT 
          notes.id as noteId,
          notes.mid as modelId,
          notes.flds as fields,
          cards.did as deckId
        FROM notes
        JOIN cards ON notes.id = cards.nid
        GROUP BY notes.id
        LIMIT ${CHUNK_SIZE} OFFSET ${offset}
      `
      
      const result = db.exec(query)
      
      if (result.length === 0 || result[0].values.length === 0) {
        hasMore = false
      } else {
        const cards = result[0].values.map(row => {
          const modelId = String(row[1])
          const fieldValues = String(row[2]).split('\x1f')
          const fieldNames = models[modelId]?.fields || []
          
          // 필드 이름과 값 매핑
          const fieldsObj = {}
          fieldValues.forEach((value, idx) => {
            const fieldName = fieldNames[idx] || `Field ${idx + 1}`
            fieldsObj[fieldName] = value
          })
          
          return {
            noteId: row[0],
            modelId: modelId,
            modelName: models[modelId]?.name || 'Unknown',
            deckId: row[3],
            fields: fieldValues,
            fieldNames: fieldNames.length > 0 ? fieldNames : fieldValues.map((_, i) => `Field ${i + 1}`),
            fieldsMap: fieldsObj
          }
        })
        allCards = allCards.concat(cards)
        offset += CHUNK_SIZE
        
        onProgress(5, Math.min((offset / 1000) * 100, 99))
        
        if (result[0].values.length < CHUNK_SIZE) {
          hasMore = false
        }
      }
    }
    onProgress(5, 100)

    // Step 6: 완료
    onProgress(6, 100)

    console.log(`파싱 완료: ${allCards.length}개 카드, ${Object.keys(models).length}개 모델`)
    
    return {
      cards: allCards,
      models,
      media: mediaBlobs,
      mediaMap
    }

  } finally {
    if (db) {
      db.close()
    }
  }
}

/**
 * 필드 값에서 미디어 참조 추출
 * @param {string} fieldValue - 필드 값
 * @returns {Array} 미디어 참조 배열 [{type: 'image'|'audio', filename: string}]
 */
export function extractMediaRefs(fieldValue) {
  const refs = []
  
  // 이미지: <img src="filename.jpg">
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match
  while ((match = imgRegex.exec(fieldValue)) !== null) {
    refs.push({ type: 'image', filename: match[1] })
  }
  
  // 오디오: [sound:filename.mp3]
  const soundRegex = /\[sound:([^\]]+)\]/gi
  while ((match = soundRegex.exec(fieldValue)) !== null) {
    refs.push({ type: 'audio', filename: match[1] })
  }
  
  return refs
}

/**
 * HTML 태그 제거 (텍스트만 추출)
 * @param {string} html 
 * @returns {string}
 */
export function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\[sound:[^\]]+\]/g, '')
    .trim()
}
