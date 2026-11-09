const shapes = {
  check: <path d="m5 12 4 4L19 6" />,
  layers: <><rect x="5" y="5" width="15" height="15" rx="3" /><path d="M16 5V4a2 2 0 0 0-2-2H6a4 4 0 0 0-4 4v8a2 2 0 0 0 2 2h1M9 12l2 2 4-4" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19m0-14-1.5 1.5m-11 11L5 19" /></>,
  complete: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.6 2.6L16 9" /></>,
  calendar: <><rect x="3.5" y="5.5" width="17" height="15" rx="2.5" /><path d="M7.5 3v5m9-5v5M4 10h16" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 6-3 7-3 9h18c0-2-3-3-3-9m-8 12a2 2 0 0 0 4 0" /></>,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  sort: <><path d="M4 6h16M4 12h12M4 18h7" /></>,
  edit: <><path d="m15 5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></>,
  device: <><rect x="3" y="4.5" width="18" height="13" rx="2" /><path d="M9 21h6m-3-3.5V21" /></>,
}

export default function Icon({ name, size = 20, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {shapes[name]}
    </svg>
  )
}
