import type { ReactNode } from "react";

// A small stroke icon set so icons render the same on every device (text symbols vary across Android fonts).
const paths = {
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  pencil: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9m-4 4 3 3m-6 0 2 2" /></>,
  package: <><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="2.5" /><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  sparkle: <path d="M12 3.5 13.8 10.2 20.5 12l-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8L12 3.5Z" />,
  book: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /></>,
  logout: <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />,
  alert: <><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5M12 17.2v.1" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  refresh: <path d="M20 11a8 8 0 0 0-14.7-4.4L4 8M4 4v4h4m-4 5a8 8 0 0 0 14.7 4.4L20 16m0 4v-4h-4" />,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  homework: <><path d="M8 4h8M9 2.5h6v3H9z" /><rect x="4.5" y="4" width="15" height="17.5" rx="2" /><path d="M8.5 11h7M8.5 15h4.5" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <path d="M5 13c6.4-2.2 12.8-.8 19 3.2v24c-6.2-3.6-12.6-4.7-19-2.5V13Z" fill="currentColor" />
        <path d="M24 16.2c6.2-4 12.6-5.4 19-3.2v24.7c-6.4-2.2-12.8-1.1-19 2.5v-24Z" fill="currentColor" opacity=".62" />
        <path d="M24 16v24M10 19c3.8-.5 7.5.3 10.5 1.8M10 25c3.8-.5 7.5.3 10.5 1.8m17-7.8c-2.8-.3-5.5.2-8.4 1.3" stroke="#fffefa" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="35" cy="30" r="6" fill="#E78450" />
        <path d="m32.3 30 1.8 1.8 3.7-4" stroke="#fffefa" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m39 2 1.2 3.3L43.5 6.5l-3.3 1.2L39 11l-1.2-3.3-3.3-1.2 3.3-1.2L39 2Z" fill="#E78450" />
      </svg>
    </span>
  );
}
