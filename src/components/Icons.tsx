interface IconProps {
  size?: number
  className?: string
}

function svgProps({ size = 22, className }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
    focusable: false,
  }
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      {/*
        Canonical Lucide `settings` path. The previous hand-mangled variant
        rendered as a bare dot in WKWebView: WebKit stops drawing at the first
        malformed path segment, while Gecko tolerated it — so it looked fine
        in the browser and broke only on device.
      */}
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function IconFilter(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 5h16l-6.4 7.6V19l-3.2 1.6v-8z" />
    </svg>
  )
}

export function IconUndo(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 9h11a4.5 4.5 0 1 1 0 9H8" />
      <path d="m8 5-4 4 4 4" />
    </svg>
  )
}

export function IconHeart(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 20.4 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13z" />
    </svg>
  )
}

export function IconHeartFilled(props: IconProps) {
  return (
    <svg {...svgProps(props)} fill="currentColor" stroke="none">
      <path d="M12 20.4 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13z" />
    </svg>
  )
}

export function IconClock(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 13h9l1-13" />
    </svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...svgProps(props)} fill="currentColor" stroke="none">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  )
}

export function IconScreenshot(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
      <path d="M9 3v18M15 3v18" opacity="0.45" />
    </svg>
  )
}

export function IconCloud(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M7 18h10.5a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6-1.2A4 4 0 0 0 7 18z" />
    </svg>
  )
}

export function IconPhotos(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 17 4.5-4.5 3 3L16 12l3.5 3.5" />
    </svg>
  )
}
