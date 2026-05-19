import { NavLink } from 'react-router-dom';
import { useAppConfig } from '../../hooks/useUsage';

const NAV_ITEMS = [
  { to: '/', label: 'Overview' },
  { to: '/report', label: 'Detailed Report' },
  { to: '/ingestion', label: 'Data Pipeline' },
];

export function TopNav() {
  const { data: appConfig } = useAppConfig();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-gh-canvas-inset border-b border-gh-border flex items-center px-4 gap-4">
      <div className="flex items-center gap-2.5 text-gh-fg min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#30363d] bg-[radial-gradient(circle_at_top,_rgba(139,148,158,0.18),_transparent_58%),linear-gradient(180deg,#1f2328_0%,#11161c_100%)] p-1.5 shadow-[0_10px_24px_rgba(1,4,9,0.32)] ring-1 ring-white/5">
          <img src="/copilot-mark.svg" alt="GitHub Copilot" className="h-full w-full object-contain" />
        </div>
        <div className="hidden sm:flex flex-col leading-[1.05]">
          <span className="text-[10px] uppercase tracking-[0.1em] text-gh-fg-subtle font-medium">GitHub Copilot</span>
          <span className="text-sm font-semibold text-gh-fg mt-0.5">Management Platform</span>
        </div>
        <span className="sm:hidden text-sm font-semibold">GCMP</span>
      </div>

      <div className="h-5 w-px bg-gh-border" />

      <nav className="flex items-center gap-1 overflow-x-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `px-3 py-1 text-sm rounded-md transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-gh-canvas-subtle text-gh-fg font-medium'
                  : 'text-gh-fg-muted hover:text-gh-fg hover:bg-gh-canvas-subtle'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2 text-xs text-gh-fg-subtle">
        {appConfig?.enterpriseSlug ? <span className="hidden sm:block">{appConfig.enterpriseSlug}</span> : null}
      </div>
    </header>
  );
}
