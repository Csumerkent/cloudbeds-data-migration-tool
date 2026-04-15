import type { CSSProperties } from 'react';

export type IconName =
  | 'cloud'
  | 'search'
  | 'bell'
  | 'user'
  | 'settings'
  | 'key'
  | 'link'
  | 'bed'
  | 'tag'
  | 'calendar'
  | 'users'
  | 'receipt'
  | 'chart'
  | 'file'
  | 'server'
  | 'chevron-right'
  | 'minus'
  | 'square'
  | 'copy-square'
  | 'close';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const ICONS: Record<IconName, JSX.Element> = {
  cloud: (
    <path d="M7 18h10.5a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.56 7.2 4 4 0 0 0 7 18Z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  bell: (
    <>
      <path d="M15 17H5.5c1.1-1.1 1.5-2.7 1.5-4.5V10a4 4 0 1 1 8 0v2.5c0 1.8.4 3.4 1.5 4.5Z" />
      <path d="M9 19a2 2 0 0 0 4 0" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.5l-1.2 1.2a1 1 0 0 1-1.5 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.7a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.5 0l-1.2-1.2a1 1 0 0 1 0-1.5l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.7a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.5l1.2-1.2a1 1 0 0 1 1.5 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.7a1 1 0 0 1 1 1v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.5 0l1.2 1.2a1 1 0 0 1 0 1.5l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1 1 0 0 1 1 1v1.7a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.6Z" />
    </>
  ),
  key: (
    <>
      <circle cx="8.5" cy="11.5" r="3.5" />
      <path d="M12 11.5h8" />
      <path d="M17 11.5v3" />
      <path d="M19 11.5v2" />
    </>
  ),
  link: (
    <>
      <path d="M10.5 13.5 8 16a3 3 0 1 1-4.2-4.2l2.5-2.5" />
      <path d="m13.5 10.5 2.5-2.5a3 3 0 1 1 4.2 4.2L17.7 15" />
      <path d="m8 16 8-8" />
    </>
  ),
  bed: (
    <>
      <path d="M3 12h18v6" />
      <path d="M3 18v-7a2 2 0 0 1 2-2h4a3 3 0 0 1 3 3v6" />
      <path d="M12 11h6a3 3 0 0 1 3 3v4" />
    </>
  ),
  tag: (
    <>
      <path d="m11 3 8 8-8 8-8-8V3h8Z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 10h18" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10" r="2.4" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M14.5 19a4.2 4.2 0 0 1 7 0" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21V3Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19h16" />
      <path d="M7 16V9" />
      <path d="M12 16V6" />
      <path d="M17 16v-4" />
    </>
  ),
  file: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </>
  ),
  server: (
    <>
      <rect x="4" y="4" width="16" height="6" rx="2" />
      <rect x="4" y="14" width="16" height="6" rx="2" />
      <path d="M8 7h.01" />
      <path d="M8 17h.01" />
    </>
  ),
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  minus: <path d="M5 12h14" />,
  square: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  'copy-square': (
    <>
      <rect x="9" y="9" width="10" height="10" rx="1.5" />
      <path d="M7 15H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
};

function Icon({ name, size = 18, className, style }: IconProps) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

export default Icon;
