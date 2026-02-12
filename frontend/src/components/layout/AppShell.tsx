import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-eaw-background">
      <Navbar />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main
        className={`pt-14 transition-all duration-200 ${
          sidebarCollapsed ? 'ml-12' : 'ml-56'
        }`}
      >
        <div className="p-6">{<Outlet />}</div>
      </main>
    </div>
  );
}
