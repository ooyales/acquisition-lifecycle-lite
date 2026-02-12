import { Search, User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/requests?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-gray-800 text-white flex items-center justify-between px-4 z-50 shadow-md">
      {/* Left: Logo */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => navigate('/')}
      >
        <div className="w-8 h-8 bg-eaw-primary rounded flex items-center justify-center text-sm font-bold">
          AL
        </div>
        <span className="text-base font-semibold tracking-wide">
          Acquisition Lifecycle Lite
        </span>
      </div>

      {/* Right: Search + User */}
      <div className="flex items-center gap-4">
        {/* Search */}
        {searchOpen ? (
          <form onSubmit={handleSearch} className="flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search requests..."
              className="px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 outline-none focus:border-eaw-primary w-56"
              autoFocus
              onBlur={() => {
                if (!searchQuery) setSearchOpen(false);
              }}
            />
          </form>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="p-1.5 rounded hover:bg-gray-700 transition-colors"
            title="Search"
          >
            <Search size={18} />
          </button>
        )}

        {/* User */}
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <User size={16} />
          <span>{user?.name ?? 'User'}</span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-1.5 rounded hover:bg-gray-700 transition-colors"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
