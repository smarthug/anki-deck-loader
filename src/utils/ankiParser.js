import { unzip } from 'fflate'
import initSqlJs from 'sql.js'

// sql.js WASM URL (CDN)
const SQL_WASM_URL = 'https://sql.js.org/dist/sql-wasm.wasm'

/**
 * .apkg 파일을 파싱하여 카드 데이터 추출
 * @param {File} file - .apkg 파일
 * @param {Function} onProgress - 진행률 콜백 (step, percent)
 * @returns {Promise<Array>} 카드 배열
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
      // 파일 목록 확인
      const files = Object.keys(unzipped)
      console.log('ZIP 내용:', files)
      throw new Error('collection.anki2 또는 collection.anki21을 찾을 수 없습니다')
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
    
    // 테이블 구조 확인
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
    console.log('테이블 목록:', tables[0]?.values.map(v => v[0]))

    // 카드 데이터 쿼리 (청크 처리)
    const CHUNK_SIZE = 500
    let offset = 0
    let allCards = []
    let hasMore = true

    while (hasMore) {
      const query = `
        SELECT 
          notes.id as noteId,
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
        const cards = result[0].values.map(row => ({
          noteId: row[0],
          fields: String(row[1]).split('\x1f'), // Anki 필드 구분자
          deckId: row[2]
        }))
        allCards = allCards.concat(cards)
        offset += CHUNK_SIZE
        
        // 진행률 업데이트 (최대 500개 기준)
        onProgress(5, Math.min((offset / 1000) * 100, 99))
        
        if (result[0].values.length < CHUNK_SIZE) {
          hasMore = false
        }
      }
    }
    onProgress(5, 100)

    // Step 6: 완료
    onProgress(6, 100)

    console.log(`파싱 완료: ${allCards.length}개 카드`)
    return allCards

  } finally {
    // 메모리 해제
    if (db) {
      db.close()
    }
  }
}
