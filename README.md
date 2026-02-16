# Anki Deck Loader

> 브라우저에서 Anki `.apkg` 덱을 직접 파싱하는 Frontend-Only POC

**🚀 Live Demo:** https://smarthug.github.io/anki-deck-loader/

## 개요

서버 없이 브라우저에서 Anki 덱 파일을 로드하고 JSON으로 변환합니다.

## 스택

- **Vite** + **React**
- **fflate** - ZIP 해제
- **sql.js** - SQLite WASM
- **Web Worker** - UI freeze 방지 (향후)

## 기능

- `.apkg` 파일 업로드 (Drag & Drop)
- 로딩 진행률 + 경과 시간 표시
- 카드/노트 데이터 JSON 변환
- 테이블/JSON 뷰 전환
- JSON 내보내기
- 검색 기능

## 플로우

```
.apkg 업로드
    ↓
ArrayBuffer Read
    ↓
fflate (ZIP 해제)
    ↓
collection.anki2 추출
    ↓
sql.js (WASM) 로딩
    ↓
SQL Query (Chunk)
    ↓
JSON 변환
    ↓
UI 렌더링
```

## 실행

```bash
npm install
npm run dev
```

http://localhost:3001 에서 확인

## 빌드 & 배포

```bash
npm run build
```

## 관련 프로젝트

- [word-shorts-frontend](https://github.com/smarthug/word-shorts-frontend) - 영단어 학습 쇼츠
- [word-shorts-prd](https://github.com/smarthug/word-shorts-prd) - 기획 문서

## License

MIT
