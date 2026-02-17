import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ClipboardCheck, Shield, FolderOpen,
  DollarSign, TrendingUp, Truck, Bot, BarChart3, Settings, PlusCircle,
  ChevronLeft,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface SidebarProps {
  collapsed: boolean;
  onCollapse: () => void;
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/intake', icon: PlusCircle, label: 'Start Acquisition' },
  { to: '/requests', icon: FileText, label: 'Requests' },
  { to: '/approvals', icon: ClipboardCheck, label: 'Approval Queue', roles: ['admin', 'branch_chief', 'cto', 'ko', 'legal', 'cio', 'budget'] },
  { to: '/advisory', icon: Shield, label: 'Advisory Queue', roles: ['admin', 'scrm', 'sb', 'cto', 'cio', 'section508', 'budget', 'legal'] },
  { to: '/loa', icon: DollarSign, label: 'LOA / Funding', roles: ['admin', 'budget', 'ko'] },
  { to: '/forecasts', icon: TrendingUp, label: 'Demand Forecast' },
  { to: '/execution', icon: Truck, label: 'CLIN Execution' },
  { to: '/ai', icon: Bot, label: 'AI Assistant' },
  { to: '/pipeline', icon: BarChart3, label: 'Pipeline Dashboard' },
  { to: '/admin', icon: Settings, label: 'Admin Config', roles: ['admin'] },
];

export default function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  const { user } = useAuthStore();

  const filtered = navItems.filter(item => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.role);
  });

  return (
    <aside
      className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      <div className="flex-1 py-3 overflow-y-auto">
        {filtered.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-eaw-primary/10 text-eaw-primary border-r-3 border-eaw-primary font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${collapsed ? 'justify-center px-2' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={18} className="shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </div>
      <button
        onClick={onCollapse}
        className="p-3 border-t border-gray-200 text-gray-400 hover:text-gray-600 flex items-center justify-center"
      >
        <ChevronLeft size={18} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
      </button>
    </aside>
  );
}
