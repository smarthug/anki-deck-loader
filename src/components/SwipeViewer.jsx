import { useState, useMemo } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Mousewheel, Pagination } from 'swiper/modules'
import { extractMediaRefs, stripHtml } from '../utils/ankiParser'

import 'swiper/css'
import 'swiper/css/pagination'

export default function SwipeViewer({ cards, media, onClose }) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)

  // 각 카드에 대해 예문 슬라이드 생성 (placeholder)
  const cardSlides = useMemo(() => {
    return cards.map(card => {
      // 첫 번째 필드를 단어로, 두 번째 필드를 뜻으로 가정
      const word = stripHtml(card.fields[0] || '')
      const meaning = stripHtml(card.fields[1] || '')
      
      // 예문 placeholder 생성
      const exampleSentences = [
        `The word "${word}" is commonly used in everyday conversation.`,
        `Can you use "${word}" in a sentence?`,
        `Understanding "${word}" will help improve your vocabulary.`,
      ]
      
      return {
        ...card,
        word,
        meaning,
        slides: [
          { type: 'main', word, meaning },
          ...exampleSentences.map((sentence, idx) => ({
            type: 'example',
            sentence,
            index: idx + 1
          }))
        ]
      }
    })
  }, [cards])

  const currentCard = cardSlides[currentCardIndex]

  return (
    <div className="swipe-viewer">
      {/* 헤더 */}
      <div className="swipe-header">
        <button className="back-btn" onClick={onClose}>← 목록</button>
        <span className="card-counter">
          {currentCardIndex + 1} / {cards.length}
        </span>
        <div className="swipe-hint">
          ↑↓ 단어 이동 • ←→ 예문
        </div>
      </div>

      {/* 세로 Swiper: 단어 간 이동 */}
      <Swiper
        direction="vertical"
        slidesPerView={1}
        mousewheel={true}
        modules={[Mousewheel]}
        onSlideChange={(swiper) => {
          setCurrentCardIndex(swiper.activeIndex)
          setCurrentSlideIndex(0)
        }}
        className="vertical-swiper"
      >
        {cardSlides.map((card, cardIdx) => (
          <SwiperSlide key={card.noteId}>
            {/* 가로 Swiper: 예문 슬라이드 */}
            <Swiper
              direction="horizontal"
              slidesPerView={1}
              pagination={{ clickable: true }}
              modules={[Pagination]}
              nested={true}
              onSlideChange={(swiper) => {
                if (cardIdx === currentCardIndex) {
                  setCurrentSlideIndex(swiper.activeIndex)
                }
              }}
              className="horizontal-swiper"
            >
              {card.slides.map((slide, slideIdx) => (
                <SwiperSlide key={slideIdx}>
                  <SlideContent 
                    card={card}
                    slide={slide}
                    media={media}
                    isMain={slide.type === 'main'}
                  />
                </SwiperSlide>
              ))}
            </Swiper>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* 하단 인디케이터 */}
      <div className="swipe-footer">
        <div className="slide-dots">
          {currentCard?.slides.map((_, idx) => (
            <span 
              key={idx}
              className={`dot ${idx === currentSlideIndex ? 'active' : ''}`}
            />
          ))}
        </div>
        <span className="slide-label">
          {currentSlideIndex === 0 ? '단어 카드' : `예문 ${currentSlideIndex}`}
        </span>
      </div>
    </div>
  )
}

// 슬라이드 내용 렌더링
function SlideContent({ card, slide, media, isMain }) {
  if (isMain) {
    // 메인 단어 카드
    const mediaRefs = extractMediaRefs(card.fields[0] || '')
    
    return (
      <div className="slide-main">
        {/* 이미지가 있으면 표시 */}
        {mediaRefs.filter(r => r.type === 'image').map((ref, idx) => {
          const url = media[ref.filename]
          return url ? (
            <img key={idx} src={url} alt="" className="slide-image" />
          ) : null
        })}
        
        {/* 단어 */}
        <h1 className="slide-word">{slide.word || '(empty)'}</h1>
        
        {/* 뜻 */}
        <p className="slide-meaning">{slide.meaning || ''}</p>
        
        {/* 추가 필드들 */}
        {card.fields.slice(2).map((field, idx) => {
          const text = stripHtml(field)
          if (!text) return null
          return (
            <p key={idx} className="slide-extra">{text}</p>
          )
        })}
        
        {/* 오디오 */}
        {extractMediaRefs(card.fields[0] || '').filter(r => r.type === 'audio').map((ref, idx) => {
          const url = media[ref.filename]
          return url ? (
            <button 
              key={idx}
              className="slide-audio-btn"
              onClick={() => new Audio(url).play()}
            >
              🔊 발음 듣기
            </button>
          ) : null
        })}
        
        {/* 모델 이름 */}
        <span className="slide-model">{card.modelName}</span>
      </div>
    )
  } else {
    // 예문 슬라이드
    return (
      <div className="slide-example">
        <span className="example-label">Example {slide.index}</span>
        <p className="example-sentence">{slide.sentence}</p>
        <div className="example-word">
          <span className="highlight">{card.word}</span>
        </div>
        <p className="placeholder-note">
          💡 이 예문은 placeholder입니다.<br/>
          실제 예문 데이터로 교체 가능합니다.
        </p>
      </div>
    )
  }
}
