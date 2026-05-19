import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Database,
  Wallet,
} from 'lucide-react';

const SECTIONS = [
  {
    title: 'Reports',
    items: [
      { to: '/', label: 'Seat Overview', icon: LayoutDashboard },
      { to: '/report', label: 'Seat Report', icon: Users },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/budgets', label: 'Budgets', icon: Wallet },
      { to: '/ingestion', label: 'Data Pipeline', icon: Database },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="fixed top-14 left-0 bottom-0 w-52 bg-gh-canvas-inset border-r border-gh-border overflow-y-auto">
      <div className="py-4 px-2 space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-1 text-xs font-semibold text-gh-fg-subtle uppercase tracking-wider">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                          isActive
                            ? 'bg-[#1f6feb22] text-gh-accent-emphasis font-medium'
                            : 'text-gh-fg-muted hover:text-gh-fg hover:bg-gh-canvas-subtle'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
