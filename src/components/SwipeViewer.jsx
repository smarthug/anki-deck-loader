import { useState, useMemo, useCallback, memo } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Virtual, Mousewheel, Pagination } from 'swiper/modules'
import { extractMediaRefs, stripHtml } from '../utils/ankiParser'

import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/virtual'

export default function SwipeViewer({ cards, media, onClose }) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [verticalSwiper, setVerticalSwiper] = useState(null)

  // 각 카드에 대해 예문 슬라이드 생성 (placeholder)
  const cardSlides = useMemo(() => {
    return cards.map(card => {
      const word = stripHtml(card.fields[0] || '')
      const meaning = stripHtml(card.fields[1] || '')
      
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

  const handleVerticalSlideChange = useCallback((swiper) => {
    setCurrentCardIndex(swiper.activeIndex)
    setCurrentSlideIndex(0)
  }, [])

  const handleHorizontalSlideChange = useCallback((swiper, cardIdx) => {
    if (cardIdx === currentCardIndex) {
      setCurrentSlideIndex(swiper.activeIndex)
    }
  }, [currentCardIndex])

  return (
    <div className="swipe-viewer">
      {/* 헤더 */}
      <div className="swipe-header">
        <button className="back-btn" onClick={onClose}>← 목록</button>
        <span className="card-counter">
          {currentCardIndex + 1} / {cards.length}
        </span>
        <div className="swipe-hint">
          ↑↓ 단어 • ←→ 예문
        </div>
      </div>

      {/* 세로 Swiper: 단어 간 이동 (Virtual) */}
      <Swiper
        direction="vertical"
        slidesPerView={1}
        mousewheel={{ sensitivity: 1 }}
        speed={300}
        virtual={{
          enabled: true,
          addSlidesAfter: 2,
          addSlidesBefore: 2,
        }}
        modules={[Virtual, Mousewheel]}
        onSwiper={setVerticalSwiper}
        onSlideChange={handleVerticalSlideChange}
        className="vertical-swiper"
      >
        {cardSlides.map((card, cardIdx) => (
          <SwiperSlide key={card.noteId} virtualIndex={cardIdx}>
            <CardSlideContent
              card={card}
              cardIdx={cardIdx}
              currentCardIndex={currentCardIndex}
              currentSlideIndex={currentSlideIndex}
              media={media}
              onHorizontalChange={handleHorizontalSlideChange}
            />
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

// 카드 슬라이드 (메모이제이션)
const CardSlideContent = memo(function CardSlideContent({ 
  card, 
  cardIdx, 
  currentCardIndex,
  currentSlideIndex,
  media, 
  onHorizontalChange 
}) {
  // 현재 카드 근처만 horizontal swiper 활성화
  const isNearby = Math.abs(cardIdx - currentCardIndex) <= 1

  if (!isNearby) {
    // 멀리 있는 카드는 placeholder만
    return (
      <div className="slide-main">
        <h1 className="slide-word">{card.word || '...'}</h1>
      </div>
    )
  }

  return (
    <Swiper
      direction="horizontal"
      slidesPerView={1}
      speed={250}
      pagination={{ clickable: true }}
      modules={[Pagination]}
      nested={true}
      onSlideChange={(swiper) => onHorizontalChange(swiper, cardIdx)}
      className="horizontal-swiper"
    >
      {card.slides.map((slide, slideIdx) => (
        <SwiperSlide key={slideIdx}>
          {slideIdx === 0 ? (
            <MainSlide card={card} media={media} />
          ) : (
            <ExampleSlide card={card} slide={slide} />
          )}
        </SwiperSlide>
      ))}
    </Swiper>
  )
})

// 메인 슬라이드 (메모이제이션)
const MainSlide = memo(function MainSlide({ card, media }) {
  const mediaRefs = useMemo(() => 
    extractMediaRefs(card.fields[0] || ''), 
    [card.fields]
  )

  const handleAudioPlay = useCallback((url) => {
    new Audio(url).play()
  }, [])

  return (
    <div className="slide-main">
      {/* 이미지 */}
      {mediaRefs.filter(r => r.type === 'image').slice(0, 1).map((ref, idx) => {
        const url = media[ref.filename]
        return url ? (
          <img key={idx} src={url} alt="" className="slide-image" loading="lazy" />
        ) : null
      })}
      
      {/* 단어 */}
      <h1 className="slide-word">{card.word || '(empty)'}</h1>
      
      {/* 뜻 */}
      <p className="slide-meaning">{card.meaning || ''}</p>
      
      {/* 추가 필드 (최대 2개) */}
      {card.fields.slice(2, 4).map((field, idx) => {
        const text = stripHtml(field)
        if (!text) return null
        return <p key={idx} className="slide-extra">{text}</p>
      })}
      
      {/* 오디오 */}
      {mediaRefs.filter(r => r.type === 'audio').slice(0, 1).map((ref, idx) => {
        const url = media[ref.filename]
        return url ? (
          <button 
            key={idx}
            className="slide-audio-btn"
            onClick={() => handleAudioPlay(url)}
          >
            🔊 발음 듣기
          </button>
        ) : null
      })}
      
      {/* 모델 이름 */}
      <span className="slide-model">{card.modelName}</span>
    </div>
  )
})

// 예문 슬라이드 (메모이제이션)
const ExampleSlide = memo(function ExampleSlide({ card, slide }) {
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
})
