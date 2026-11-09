import { useCallback, useEffect, useRef, useState } from 'react'

const storageKey = 'rixu.tasks.v1'
export const TASKS_PER_PAGE = 3

const examples = [
  ['安排本周三件重要的事', '先列出三件最想推进的事，为每件留出一段时间。'],
  ['复习 C++ 哈希表', '用 unordered_map 重写两数之和，试试 [3, 3] 这个边界用例。'],
  ['整理课堂笔记', '挑一节课，用自己的话写下三个知识点。'],
  ['清理下载文件夹', '把需要留存的资料归到对应目录。'],
  ['出门散步 20 分钟', '离开屏幕，走一段熟悉的路线。'],
  ['安排一次专注学习', '设一个 25 分钟的计时器，只做手头这一件事。'],
  ['写下今天的学习收获', '记一个弄懂的问题，再留一个明天想问的问题。'],
  ['准备明天要带的东西', '把课本、充电器和水杯放进书包。', true],
  ['归档上周的学习资料', '把讲义和练习按课程放好。', true],
]

export function createExampleTasks() {
  const now = Date.now()
  return examples.map(([title, note, done = false], index) => ({
    id: `example-${index + 1}`,
    example: true,
    title,
    note,
    done,
    createdAt: now - index,
    reminderAt: null,
    remindedAt: null,
  }))
}

export function sortTasks(tasks, sort) {
  return [...tasks].sort((first, second) => {
    const byStatus = Number(first.done) - Number(second.done)
    const byReminder = (first.reminderAt ?? Infinity) - (second.reminderAt ?? Infinity)
    return byStatus || (sort === 'time' ? byReminder : 0) || second.createdAt - first.createdAt
  })
}

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
  const [tasks, setTasks] = useState(() => readTasks() ?? createExampleTasks())
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
