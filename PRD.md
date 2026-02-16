# Anki Web Deck Loader POC (Frontend-Only)

## 1. Overview

### 1.1 Background

Word Shorts 서비스 확장을 위해 사용자가 보유한 Anki `.apkg` 덱을\
웹 브라우저에서 직접 로드하고 JSON 구조로 변환하여\
콘텐츠 데이터베이스처럼 활용할 수 있는 구조가 필요하다.

본 프로젝트는 **서버 없이 브라우저 내에서 `.apkg`를 파싱하는
Frontend-Only POC**를 구현한다.

------------------------------------------------------------------------

### 1.2 Objective

브라우저에서 다음을 구현한다:

-   `.apkg` 파일 업로드
-   ZIP 해제
-   `collection.anki2` 추출
-   SQLite 파싱 (WASM 기반)
-   카드/노트 데이터를 JSON 변환
-   로딩바 및 경과 시간 표시
-   JSON 결과 UI 출력

------------------------------------------------------------------------

### 1.3 Non-Goals

-   Anki Sync 기능
-   학습 스케줄링 로직
-   미디어 완전 지원
-   사용자 계정 관리
-   서버 API 구축

------------------------------------------------------------------------

## 2. Success Metrics

  Metric                     Target
  -------------------------- ----------
  50MB 이하 덱 로드 성공률   95% 이상
  로딩 중 UI freeze          0
  총 처리 시간 표시 정확도   ±5%
  iOS Safari 실행 성공       80% 이상

------------------------------------------------------------------------

## 3. User Stories

1.  사용자는 `.apkg` 파일을 업로드할 수 있다.
2.  시스템은 로딩 진행 상황을 보여준다.
3.  시스템은 경과 시간을 표시한다.
4.  시스템은 카드 데이터를 JSON 구조로 보여준다.
5.  사용자는 카드 수를 확인할 수 있다.

------------------------------------------------------------------------

## 4. Functional Requirements

### 4.1 File Upload

-   `.apkg` 파일만 허용
-   Drag & Drop 지원
-   최대 파일 크기: 100MB
-   파일 크기 표시

------------------------------------------------------------------------

### 4.2 Loading Progress System

단계 정의:

1.  파일 읽기
2.  ZIP 해제
3.  SQLite 추출
4.  SQLite 로딩
5.  SQL 쿼리
6.  JSON 변환
7.  렌더링

요구사항:

-   진행률 퍼센트 표시
-   현재 단계 표시
-   실시간 경과 시간 표시
-   완료 시 총 처리 시간 표시

------------------------------------------------------------------------

### 4.3 SQLite Processing

최소 쿼리 예:

SELECT notes.id, notes.flds, cards.did FROM notes JOIN cards ON notes.id
= cards.nid LIMIT 200;

------------------------------------------------------------------------

### 4.4 Data Transformation

`notes.flds`는 `\x1f` 구분자로 분리한다.

예시 JSON 구조:

{ "noteId": 123, "deckId": 456, "fields": \["word", "meaning",
"example"\] }

------------------------------------------------------------------------

### 4.5 Memory Safety Strategy (iOS 대응)

-   Chunk Query 사용
-   SQL 완료 후 `db.close()`
-   WASM 메모리 장기 유지 금지
-   Web Worker 사용

------------------------------------------------------------------------

## 5. Technical Architecture

### High-Level Flow

Upload\
→ ArrayBuffer Read\
→ Unzip\
→ Extract collection.anki2\
→ sql.js load (Worker)\
→ Chunk Query\
→ Transform to JSON\
→ Render UI

------------------------------------------------------------------------

## 6. Tech Stack

  Layer        Technology
  ------------ ------------------
  Build Tool   Vite
  UI           React
  ZIP          fflate
  SQLite       sql.js (WASM)
  Threading    Web Worker
  Hosting      Vercel / Netlify

------------------------------------------------------------------------

## 7. Risks & Mitigation

  Risk                Mitigation
  ------------------- -------------------------
  iOS OOM             Chunk + close DB
  UI freeze           Worker 사용
  대형 덱 로딩 실패   사전 경고 표시
  다양한 모델 구조    models 테이블 기반 처리

------------------------------------------------------------------------

## 8. Milestones

  Phase                Duration
  -------------------- ----------
  Upload + Unzip       1일
  SQLite + JSON 변환   1일
  Progress UI          0.5일
  Worker + 안정화      0.5일

총 3일 POC 목표

------------------------------------------------------------------------

## 9. Strategic Importance

이 POC는:

-   Anki를 콘텐츠 공급원으로 활용
-   Word Shorts와 직접 연결 가능
-   서버 비용 없이 사용자 덱 활용
-   향후 AI 기반 콘텐츠 자동화 파이프라인 기반 마련

------------------------------------------------------------------------

## 10. Future Roadmap

-   IndexedDB 캐싱
-   Word Shorts 자동 변환
-   AI 요약
-   덱 통계 분석
-   PWA 오프라인 지원
