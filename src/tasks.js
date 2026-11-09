import { useCallback, useEffect, useRef, useState } from 'react'

const storageKey = 'rixu.tasks.v1'
const dateFormat = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function isSameDay(first, second) {
  return new Date(first).toDateString() === new Date(second).toDateString()
}

export function formatReminder(timestamp, now) {
  const day = isSameDay(timestamp, now) ? '今天' : dateFormat.format(timestamp)
  return `${day} · ${timeFormat.format(timestamp)}`
}

export function toLocalInput(timestamp) {
  if (timestamp === null) return ''
  const date = new Date(timestamp)
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function readTasks() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey))
    return Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

export function useTasks() {
  const [tasks, setTasks] = useState(() => readTasks() ?? [])
  const [saveFailed, setSaveFailed] = useState(false)
  const latest = useRef(tasks)
  const memoryOnly = useRef(false)

  const updateTasks = useCallback((change) => {
    const current = (memoryOnly.current ? null : readTasks()) ?? latest.current
    const next = change(current)
    if (next === current) return

    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      memoryOnly.current = false
    } catch {
      memoryOnly.current = true
    }
    setSaveFailed(memoryOnly.current)
    latest.current = next
    setTasks(next)
  }, [])

  useEffect(() => {
    function sync(event) {
      if ((event.key !== storageKey && event.key !== null) || memoryOnly.current) return
      latest.current = readTasks() ?? []
      setTasks(latest.current)
    }

    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  return { tasks, updateTasks, saveFailed }
}

export function notificationPermission() {
  if (!window.isSecureContext || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export function useReminders(tasks, updateTasks) {
  const [now, setNow] = useState(Date.now)
  const [notices, setNotices] = useState([])

  useEffect(() => {
    let timer
    let active = true

    function deliver(time) {
      if (!active) return
      let due = []
      updateTasks((current) => {
        due = current.filter((task) => (
          !task.done && task.reminderAt !== null && task.reminderAt <= time &&
          task.remindedAt === null
        ))
        if (!due.length) return current
        const ids = new Set(due.map((task) => task.id))
        return current.map((task) => ids.has(task.id) ? { ...task, remindedAt: time } : task)
      })
      if (!due.length) return
      setNotices((current) => [...new Set([...current, ...due.map((task) => task.id)])])

      if (notificationPermission() !== 'granted') return
      for (const task of due) {
        try {
          new Notification('日序 · 待办提醒', { body: task.title, tag: task.id })
        } catch {
          // The in-page alert covers browsers without desktop notification support.
        }
      }
    }

    function check() {
      window.clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      if (navigator.locks) {
        navigator.locks.request(storageKey, () => deliver(time)).catch(() => deliver(time))
      } else {
        deliver(time)
      }

      const nextCheck = tasks.reduce((delay, task) => {
        if (task.done || task.reminderAt === null || task.remindedAt !== null) return delay
        if (task.reminderAt <= time) return delay
        return Math.min(delay, task.reminderAt - time)
      }, 30_000)
      timer = window.setTimeout(check, nextCheck)
    }

    function onVisible() {
      if (!document.hidden) check()
    }

    check()
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tasks, updateTasks])

  function dismiss(id) {
    setNotices((current) => current.filter((notice) => notice !== id))
  }

  return { now, notices, dismiss }
}
