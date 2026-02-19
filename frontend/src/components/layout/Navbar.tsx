import { LogOut, Menu, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import NotificationBell from './NotificationBell';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  const { user, logout } = useAuthStore();

  return (
    <nav className="bg-eaw-dark text-white h-14 flex items-center px-4 shadow-md z-50">
      <button onClick={onToggleSidebar} className="mr-3 p-1 hover:bg-white/10 rounded">
        <Menu size={20} />
      </button>
      <a href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-white">
        <span className="bg-eaw-primary text-white rounded px-1.5 py-0.5 text-sm font-bold">AL</span>
        <span className="text-white drop-shadow-sm">Acquisition Lifecycle</span>
      </a>
      <div className="flex-1" />
      {user && <NotificationBell />}
      {user && (
        <div className="flex items-center gap-3 ml-3">
          <div className="flex items-center gap-2 text-sm text-white">
            <User size={16} />
            <span className="font-medium">{user.display_name}</span>
            <span className="bg-white/25 rounded px-2 py-0.5 text-xs text-gray-100">{user.role}</span>
          </div>
          <button onClick={logout} className="p-1.5 hover:bg-white/10 rounded" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      )}
    </nav>
  );
}
