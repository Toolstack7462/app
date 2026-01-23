import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Activity, 
  LogOut, 
  Menu, 
  X,
  Settings,
  Bell,
  Search
} from 'lucide-react';
import { authService } from '../services/authService';
import { useToast } from './Toast';

const AdminLayoutEnhanced = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);
  
  const handleLogout = async () => {
    try {
      await authService.logout();
      showSuccess('Logged out successfully');
      navigate('/admin/login');
    } catch (error) {
      showError('Logout failed');
    }
  };
  
  const navItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/tools', icon: Package, label: 'Tools' },
    { path: '/admin/clients', icon: Users, label: 'Clients' },
    { path: '/admin/activity', icon: Activity, label: 'Activity Logs' }
  ];
  
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E1F24] to-[#24252B]">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-toolstack-card/95 backdrop-blur-lg border-b border-toolstack-border">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo & Menu Toggle */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden lg:flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/5 transition-colors text-white"
                data-testid="sidebar-toggle"
              >
                <Menu size={20} />
              </button>
              
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/5 transition-colors text-white"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              
              <Link to="/admin/dashboard" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-orange rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">TS</span>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-white font-bold text-lg">ToolStack</h1>
                  <p className="text-toolstack-muted text-xs">Admin Portal</p>
                </div>
              </Link>
            </div>
            
            {/* Center: Search (Desktop) */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-toolstack-muted" size={18} />
                <input
                  type="text"
                  placeholder="Search clients, tools..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-toolstack-border rounded-lg text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                  data-testid="global-search"
                />
              </div>
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              <button className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors text-white">
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              
              <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-toolstack-border">
                <div className="text-right">
                  <p className="text-white text-sm font-medium">{user?.fullName || 'Admin'}</p>
                  <p className="text-toolstack-muted text-xs">{user?.role || 'Administrator'}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-orange rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">
                    {user?.fullName?.charAt(0) || 'A'}
                  </span>
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-all"
                data-testid="logout-btn"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Sidebar - Desktop */}
      <aside className={`
        hidden lg:block fixed left-0 top-16 bottom-0 bg-toolstack-card/50 backdrop-blur-lg border-r border-toolstack-border
        transition-all duration-300 z-40
        ${sidebarOpen ? 'w-64' : 'w-20'}
      `}>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                  ${active 
                    ? 'bg-gradient-orange text-white shadow-lg shadow-toolstack-orange/25' 
                    : 'text-toolstack-muted hover:text-white hover:bg-white/5'
                  }
                `}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon size={20} className="flex-shrink-0" />
                {sidebarOpen && (
                  <span className="font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>
        
        {sidebarOpen && (
          <div className="absolute bottom-4 left-4 right-4 p-4 bg-gradient-orange/10 border border-toolstack-orange/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Settings size={16} className="text-toolstack-orange" />
              <span className="text-white text-sm font-medium">Need Help?</span>
            </div>
            <p className="text-xs text-toolstack-muted mb-3">
              Check our documentation or contact support
            </p>
            <button className="w-full px-3 py-2 bg-toolstack-orange text-white text-xs rounded-lg hover:opacity-90 transition-opacity">
              Get Support
            </button>
          </div>
        )}
      </aside>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div 
            className="absolute left-0 top-16 bottom-0 w-64 bg-toolstack-card border-r border-toolstack-border"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="p-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                      ${active 
                        ? 'bg-gradient-orange text-white' 
                        : 'text-toolstack-muted hover:text-white hover:bg-white/5'
                      }
                    `}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <main className={`
        pt-16 min-h-screen
        transition-all duration-300
        ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}
      `}>
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayoutEnhanced;
