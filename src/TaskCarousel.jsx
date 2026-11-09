import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { TASKS_PER_PAGE } from './tasks.js'

const rotationDelay = 7000
const reducedMotion = '(prefers-reduced-motion: reduce)'

export default function TaskCarousel({ tasks, position, setPosition, editorOpen, renderTask }) {
  const [auto, setAuto] = useState(() => !window.matchMedia(reducedMotion).matches)
  const [announcement, setAnnouncement] = useState('')
  const viewport = useRef(null)
  const pageCount = Math.ceil(tasks.length / TASKS_PER_PAGE)
  const page = Math.min(position.page, pageCount - 1)
  const first = page * TASKS_PER_PAGE
  const end = Math.min(first + TASKS_PER_PAGE, tasks.length)

  useEffect(() => {
    const media = window.matchMedia(reducedMotion)
    function update(event) {
      if (event.matches) setAuto(false)
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!auto || editorOpen || pageCount < 2) return
    const hoverAvailable = window.matchMedia('(hover: hover)')
    const timer = window.setInterval(() => {
      const list = viewport.current
      if (!list || document.hidden || list.contains(document.activeElement) ||
          (hoverAvailable.matches && list.matches(':hover'))) return
      setPosition({ page: (page + 1) % pageCount, direction: 1 })
    }, rotationDelay)
    return () => window.clearInterval(timer)
  }, [auto, editorOpen, page, pageCount, setPosition])

  function go(direction) {
    const nextPage = (page + direction + pageCount) % pageCount
    setPosition({ page: nextPage, direction })
    setAnnouncement(`第 ${nextPage + 1} 页，共 ${pageCount} 页`)
  }

  if (pageCount === 1) return <ul className="task-list">{tasks.map(renderTask)}</ul>

  const direction = position.page === page ? position.direction : 0
  const movement = direction > 0 ? ' enter-next' : direction < 0 ? ' enter-previous' : ''
  const playbackLabel = auto ? '暂停自动轮播' : '开启自动轮播'

  return (
    <div className="task-carousel" role="group" aria-roledescription="轮播" aria-label="待办分页">
      <div className="carousel-viewport" ref={viewport} id="task-carousel-page">
        <ul key={page} className={`task-list carousel-list${movement}`} aria-label={`第 ${page + 1} 页，共 ${pageCount} 页`}>
          {tasks.slice(first, end).map(renderTask)}
        </ul>
      </div>
      <div className="carousel-footer">
        <div className="carousel-range">
          <span>第 {first + 1}–{end} 项</span>
          {pageCount <= 8 && (
            <div className="carousel-dots" aria-hidden="true">
              {Array.from({ length: pageCount }, (_, index) => (
                <span key={index} className={index === page ? 'current' : undefined} />
              ))}
            </div>
          )}
        </div>
        <div className="carousel-controls">
          <button type="button" className="icon-button carousel-button" aria-label="上一页" title="上一页" aria-controls="task-carousel-page" onClick={() => go(-1)}>
            <Icon name="previous" size={17} />
          </button>
          <span className="carousel-page" aria-hidden="true">{page + 1} / {pageCount}</span>
          <button type="button" className="icon-button carousel-button" aria-label="下一页" title="下一页" aria-controls="task-carousel-page" onClick={() => go(1)}>
            <Icon name="next" size={17} />
          </button>
          <button type="button" className="icon-button carousel-button playback-button" aria-label={playbackLabel} title={playbackLabel} onClick={() => setAuto(!auto)}>
            <Icon name={auto ? 'pause' : 'play'} size={15} />
          </button>
        </div>
      </div>
      <span className="sr-only" role="status">{announcement}</span>
    </div>
  )
}
