import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { formatReminder, isSameDay, notificationPermission, toLocalInput, useReminders, useTasks } from './tasks.js'
import './App.css'

const fullDate = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
const views = [
  { id: 'all', icon: 'layers', title: '全部待办', empty: '添加第一条待办，把想做的事记下来。' },
  { id: 'today', icon: 'sun', title: '今日提醒', empty: '设置在今天的提醒会出现在这里。' },
  { id: 'done', icon: 'complete', title: '已完成', empty: '勾选任务后，可以在这里回看。' },
]

function TaskEditor({ task, onClose, onSave, onDelete }) {
  const dialog = useRef(null)
  const titleInput = useRef(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    if (!element.open) element.showModal()
    titleInput.current.focus()
  }, [])

  function submit(event) {
    event.preventDefault()
    if (confirmDelete) return
    const fields = new FormData(event.currentTarget)
    const title = fields.get('title').trim()
    const note = fields.get('note').trim()
    const reminder = fields.get('reminder')
    const reminderAt = reminder ? new Date(reminder).getTime() : null
    if (!title || Number.isNaN(reminderAt)) {
      setError(!title ? '请输入待办名称。' : '请输入有效的提醒时间。')
      return
    }
    onSave({ title, note, reminderAt })
  }

  return (
    <dialog ref={dialog} className="editor" aria-labelledby="editor-title" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="editor-heading">
          <h2 id="editor-title">{task ? '编辑待办' : '新建待办'}</h2>
          <button type="button" className="icon-button" aria-label="关闭" onClick={onClose}><Icon name="close" /></button>
        </div>
        <label className="field">
          <span>待办名称</span>
          <input ref={titleInput} name="title" required maxLength={120} placeholder="想做什么？" defaultValue={task?.title ?? ''} />
        </label>
        <label className="field">
          <span>备注 <small>可选</small></span>
          <textarea name="note" rows={3} maxLength={400} placeholder="记下需要的细节" defaultValue={task?.note ?? ''} />
        </label>
        <label className="field">
          <span>提醒时间 <small>可选</small></span>
          <input name="reminder" type="datetime-local" defaultValue={toLocalInput(task?.reminderAt ?? null)} />
        </label>
        <p className="field-hint">使用本地时间。到点时，打开的页面会显示提醒。</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {confirmDelete ? (
          <div className="delete-confirm">
            <p>确定删除这条待办？</p>
            <button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)}>返回</button>
            <button type="button" className="danger-button" onClick={onDelete}>确认删除</button>
          </div>
        ) : (
          <div className="editor-actions">
            {task && (
              <button type="button" className="icon-button delete-button" aria-label="删除待办" title="删除待办" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" size={18} />
              </button>
            )}
            <button type="button" className="secondary-button" onClick={onClose}>取消</button>
            <button type="submit" className="primary-button">保存待办</button>
          </div>
        )}
      </form>
    </dialog>
  )
}

function NotificationCard() {
  const [permission, setPermission] = useState(notificationPermission)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    const refresh = () => setPermission(notificationPermission())
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  async function enable() {
    setRequesting(true)
    try {
      setPermission(await Notification.requestPermission())
    } catch {
      setPermission('unsupported')
    } finally {
      setRequesting(false)
    }
  }

  const descriptions = {
    default: '开启后，页面在后台时也可以尝试发送桌面通知。',
    granted: '桌面通知已开启，页面打开时会按设定时间提醒。',
    denied: '浏览器已阻止通知。可在站点权限中开启，页面内提醒仍可用。',
    unsupported: '当前环境可使用页面内提醒。',
  }

  return (
    <section className="panel reminder-panel" aria-labelledby="notification-heading">
      <div className="panel-caption">
        <Icon name="device" size={17} />
        <h2 id="notification-heading">桌面通知</h2>
      </div>
      <p>{descriptions[permission]}</p>
      {permission === 'default' && (
        <button type="button" className="enable-button" disabled={requesting} onClick={enable}>
          {requesting ? '等待授权' : '开启通知'} <Icon name="arrow" size={15} />
        </button>
      )}
      {permission === 'granted' && <span className="enabled-tag"><Icon name="check" size={15} /> 已开启</span>}
    </section>
  )
}

function TaskRow({ task, now, onToggle, onEdit }) {
  const late = !task.done && task.reminderAt !== null && task.reminderAt <= now
  return (
    <li className={task.done ? 'task-row done' : 'task-row'}>
      <input className="task-check" type="checkbox" checked={task.done} onChange={onToggle}
        aria-label={`${task.done ? '重新打开' : '完成'}：${task.title}`} />
      <div className="task-content">
        <strong>{task.title}</strong>
        {task.note && <p>{task.note}</p>}
        {task.reminderAt !== null && (
          <span className={late ? 'task-time late' : 'task-time'}>
            <Icon name="clock" size={14} /> {formatReminder(task.reminderAt, now)}{late && ' · 已到期'}
          </span>
        )}
      </div>
      <button type="button" className="icon-button edit-button" aria-label={`编辑：${task.title}`} title="编辑待办" onClick={onEdit}>
        <Icon name="edit" size={18} />
      </button>
    </li>
  )
}

function DailySummary({ date }) {
  const storageKey = `rixu.summary.v1.${date}`
  const [summary, setSummary] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? ''
    } catch {
      return ''
    }
  })
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    function sync(event) {
      if (saveFailed || event.storageArea !== localStorage) return
      if (event.key === storageKey || event.key === null) setSummary(event.newValue ?? '')
    }

    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [saveFailed, storageKey])

  function changeSummary(event) {
    const value = event.target.value
    setSummary(value)
    try {
      if (value) localStorage.setItem(storageKey, value)
      else localStorage.removeItem(storageKey)
      setSaveFailed(false)
    } catch {
      setSaveFailed(true)
    }
  }

  return (
    <section className="panel summary-panel" aria-labelledby="summary-heading">
      <div className="panel-caption"><Icon name="edit" size={17} /><h2 id="summary-heading">今日总结</h2></div>
      <div className="field">
        <textarea rows={4} value={summary} onChange={changeSummary} aria-labelledby="summary-heading"
          aria-describedby="summary-status" placeholder="今天做了什么？有什么收获或想记下的事？" />
      </div>
      <p id="summary-status" className={saveFailed ? 'form-error' : 'field-hint'} role="status">
        {saveFailed ? '暂时无法保存，请在离开页面前复制总结内容。' : '填写后自动保存到此浏览器。'}
      </p>
    </section>
  )
}

function App() {
  const { tasks, updateTasks, saveFailed } = useTasks()
  const { now, notices, dismiss } = useReminders(tasks, updateTasks)
  const [view, setView] = useState('all')
  const [sort, setSort] = useState('time')
  const [editor, setEditor] = useState(null)
  const [status, setStatus] = useState('')
  const editorTrigger = useRef(null)
  const addButton = useRef(null)

  const localDate = toLocalInput(now).slice(0, 10)
  const today = tasks.filter((task) => !task.done && task.reminderAt !== null && isSameDay(task.reminderAt, now))
  const done = tasks.filter((task) => task.done)
  const pending = tasks.length - done.length
  const progress = tasks.length ? Math.round(done.length / tasks.length * 100) : 0
  const activeView = views.find((item) => item.id === view)
  const currentTasks = view === 'all' ? tasks : view === 'today' ? today : done
  const sortedTasks = [...currentTasks].sort((first, second) => {
    const byStatus = Number(first.done) - Number(second.done)
    const byReminder = (first.reminderAt ?? Infinity) - (second.reminderAt ?? Infinity)
    return byStatus || (sort === 'time' ? byReminder : 0) || second.createdAt - first.createdAt
  })
  const upcoming = tasks.filter((task) => !task.done && task.reminderAt !== null && task.reminderAt > now)
    .sort((first, second) => first.reminderAt - second.reminderAt).slice(0, 3)
  const dueNotices = notices.map((id) => tasks.find((task) => task.id === id))
    .filter((task) => task && !task.done && task.remindedAt !== null)
  const editingTask = tasks.find((task) => task.id === editor?.id)

  function openEditor(id = null) {
    editorTrigger.current = document.activeElement
    setEditor({ id })
  }

  function closeEditor() {
    setEditor(null)
    requestAnimationFrame(() => {
      const target = editorTrigger.current?.isConnected ? editorTrigger.current : addButton.current
      target?.focus()
    })
  }

  function saveTask(fields) {
    if (editor.id) {
      if (fields.reminderAt !== editingTask?.reminderAt) dismiss(editor.id)
      updateTasks((current) => current.map((task) => task.id === editor.id ? {
        ...task,
        ...fields,
        remindedAt: task.reminderAt === fields.reminderAt ? task.remindedAt : null,
      } : task))
      setStatus('待办已更新')
    } else {
      const task = { ...fields, id: crypto.randomUUID(), createdAt: Date.now(), done: false, remindedAt: null }
      updateTasks((current) => [...current, task])
      setView('all')
      setStatus('待办已添加')
    }
    closeEditor()
  }

  function removeTask() {
    updateTasks((current) => current.filter((task) => task.id !== editor.id))
    dismiss(editor.id)
    setStatus('待办已删除')
    closeEditor()
  }

  function toggleTask(id) {
    updateTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task))
    dismiss(id)
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/rhythm.svg" alt="" width="44" height="44" />
          <div><strong>日序</strong><span>个人待办与提醒</span></div>
        </div>
        <p className="nav-label">任务视图</p>
        <nav className="navigation" aria-label="任务视图">
          {views.map(({ id, icon, title }) => (
            <button type="button" key={id} className={id === view ? 'nav-item active' : 'nav-item'}
              aria-current={id === view ? 'page' : undefined} onClick={() => setView(id)}>
              <Icon name={icon} size={19} /><span>{title}</span>
              <small>{id === 'all' ? tasks.length : id === 'today' ? today.length : done.length}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="local-dot" /> 数据保存在此浏览器</div>
      </aside>

      <main className="workspace">
        <div className="dashboard">
          <header className="hero">
            <p className="hero-date"><Icon name="calendar" size={15} /> {fullDate.format(now)}</p>
            <h1>我的待办</h1>
            <p className="hero-value" aria-hidden="true">{progress}<span>%</span></p>
            <div className="progress-summary">
              <div><span>完成进度</span><strong>{done.length} / {tasks.length} 项</strong></div>
              <progress max="100" value={progress} aria-label="任务完成进度" />
            </div>
            <button ref={addButton} type="button" className="primary-button add-button" onClick={() => openEditor()}>
              <Icon name="plus" size={19} /> 新建待办
            </button>
          </header>

          <div className="metrics" aria-label="待办统计">
            {[
              { title: '待完成', count: pending, icon: 'layers' },
              { title: '今日提醒', count: today.length, icon: 'sun' },
              { title: '已完成', count: done.length, icon: 'complete' },
            ].map((metric) => (
              <div className="metric panel" key={metric.title}>
                <div className="panel-caption"><Icon name={metric.icon} size={16} /><span>{metric.title}</span></div>
                <strong>{metric.count}</strong>
              </div>
            ))}
          </div>

          {saveFailed && <p className="warning" role="alert">浏览器暂时无法保存待办。刷新页面前请保留需要的内容。</p>}
          <div className="notices" aria-live="polite">
            {dueNotices.map((task) => (
              <div className="warning reminder-notice" key={task.id}>
                <Icon name="bell" size={18} />
                <span>待办时间到了 <strong>{task.title}</strong></span>
                <button type="button" className="icon-button" aria-label="关闭此提醒" onClick={() => dismiss(task.id)}><Icon name="close" size={17} /></button>
              </div>
            ))}
          </div>

          <div className="content-grid">
            <section className="panel task-panel" aria-labelledby="task-heading">
              <div className="panel-heading">
                <div><h2 id="task-heading">{activeView.title}</h2><p>共 {currentTasks.length} 项</p></div>
                <label className="sort-control">
                  <Icon name="sort" size={16} />
                  <select aria-label="排序方式" value={sort} onChange={(event) => setSort(event.target.value)}>
                    <option value="time">按提醒时间</option><option value="new">按添加时间</option>
                  </select>
                  <Icon name="chevron" size={13} />
                </label>
              </div>
              {sortedTasks.length > 0 ? (
                <ul className="task-list">
                  {sortedTasks.map((task) => (
                    <TaskRow key={task.id} task={task} now={now} onToggle={() => toggleTask(task.id)} onEdit={() => openEditor(task.id)} />
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon"><Icon name={activeView.icon} size={27} /></span>
                  <h3>{view === 'all' ? '清单还是空的' : view === 'today' ? '今天暂无提醒' : '还没有完成的待办'}</h3>
                  <p>{activeView.empty}</p>
                  {view === 'all' && <button type="button" className="secondary-button" onClick={() => openEditor()}><Icon name="plus" size={16} /> 添加待办</button>}
                </div>
              )}
            </section>

            <aside className="right-column" aria-label="总结与提醒">
              <DailySummary key={localDate} date={localDate} />
              <section className="panel reminder-panel" aria-labelledby="upcoming-heading">
                <div className="panel-caption"><Icon name="bell" size={17} /><h2 id="upcoming-heading">即将提醒</h2></div>
                {upcoming.length ? (
                  <ul className="upcoming-list">
                    {upcoming.map((task) => (
                      <li key={task.id}>
                        <button type="button" onClick={() => openEditor(task.id)}>
                          <span className="upcoming-dot" />
                          <span><strong>{task.title}</strong><small>{formatReminder(task.reminderAt, now)}</small></span>
                          <Icon name="arrow" size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p>有设定时间的待办会按提醒时间排列。</p>}
              </section>
              <NotificationCard />
            </aside>
          </div>
          <div className="sr-only" role="status">{status}</div>
        </div>
      </main>
      {editor && <TaskEditor task={editingTask} onSave={saveTask} onDelete={removeTask} onClose={closeEditor} />}
    </div>
  )
}

export default App
