import type { ReactNode } from 'react';
import { TopNav } from './TopNav';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gh-canvas">
      <TopNav />
      <Sidebar />
      <main className="pt-14 pl-52">
        <div className="p-6 max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
