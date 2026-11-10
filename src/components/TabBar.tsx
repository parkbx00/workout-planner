import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const icon = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    className="h-6 w-6"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const tabs = [
  {
    to: '/',
    label: 'Today',
    icon: icon(
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>,
    ),
  },
  {
    to: '/workout',
    label: 'Workout',
    icon: icon(<path d="M9 12h6M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5" />),
  },
  {
    to: '/templates',
    label: 'Templates',
    icon: icon(<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />),
  },
  {
    to: '/history',
    label: 'History',
    icon: icon(
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>,
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: icon(<path d="M4 7h10M18 7h2M4 17h2M10 17h10M16 4.5v5M8 14.5v5" />),
  },
]

export default function TabBar() {
  return (
    <nav className="border-line bg-surface grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)]">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-accent' : 'text-muted'
            }`
          }
        >
          {tab.icon}
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
