import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  User, 
  LogOut, 
  Menu, 
  X,
  Bell,
  HelpCircle
} from 'lucide-react';
import { authService } from '../services/authService';
import { useToast } from './Toast';
import ToolStackLogo from './ToolStackLogo';

// ============================================================================
// SHARED THEME CONSTANTS - Use these across all client portal pages
// ============================================================================
export const CATEGORY_COLORS = {
  'AI': { gradient: 'from-purple-500 to-purple-600', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'purple' },
  'Academic': { gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'blue' },
  'SEO': { gradient: 'from-green-500 to-green-600', bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', glow: 'green' },
  'Productivity': { gradient: 'from-yellow-500 to-yellow-600', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', glow: 'yellow' },
  'Graphics & SEO': { gradient: 'from-pink-500 to-pink-600', bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', glow: 'pink' },
  'Text Humanizers': { gradient: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400', glow: 'indigo' },
  'Career-Oriented': { gradient: 'from-orange-500 to-orange-600', bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', glow: 'orange' },
  'Miscellaneous': { gradient: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'cyan' },
  'Other': { gradient: 'from-gray-500 to-gray-600', bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', glow: 'gray' }
};

export const getCategoryTheme = (category) => {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
};

export const getCategoryGradient = (category) => {
  return getCategoryTheme(category).gradient;
};

// Card style variants
export const CARD_VARIANTS = {
  default: 'bg-gradient-to-br from-white/[0.03] to-white/[0.08] border border-white/10 backdrop-blur-sm',
  elevated: 'bg-gradient-to-br from-white/[0.05] to-white/[0.12] border border-white/15 backdrop-blur-sm shadow-xl',
  blue: 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30',
  green: 'bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/30',
  yellow: 'bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/30',
  purple: 'bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30',
  orange: 'bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-toolstack-orange/30',
  pink: 'bg-gradient-to-br from-pink-500/10 to-pink-600/5 border border-pink-500/30',
  cyan: 'bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/30',
  indigo: 'bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border border-indigo-500/30',
};

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================
const ClientLayoutEnhanced = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();
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
      navigate('/client/login');
    } catch (error) {
      showError('Logout failed');
    }
  };
  
  const navItems = [
    { path: '/client/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/client/tools', icon: Package, label: 'My Tools' },
    { path: '/client/profile', icon: User, label: 'Profile' }
  ];
  
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f12] via-[#1a1a22] to-[#12121a] relative overflow-hidden">
      {/* Ambient Background Glow Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Purple glow - top right */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        {/* Blue glow - bottom left */}
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        {/* Orange glow - center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-toolstack-orange/5 rounded-full blur-[150px]" />
        {/* Green accent - bottom right */}
        <div className="absolute bottom-20 right-20 w-64 h-64 bg-green-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
      </div>

      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1a1a22]/80 backdrop-blur-xl border-b border-white/10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo & Mobile Menu */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              
              <Link to="/client/dashboard" className="flex items-center gap-3">
                <ToolStackLogo className="h-10" />
                <span className="hidden sm:inline text-sm text-white/60">Client Portal</span>
              </Link>
            </div>
            
            {/* Center: Navigation (Desktop) */}
            <div className="hidden lg:flex items-center gap-2 p-1 bg-white/5 rounded-xl">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
                      ${ active 
                        ? 'bg-gradient-to-r from-toolstack-orange to-orange-600 text-white shadow-lg shadow-toolstack-orange/25' 
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                      }
                    `}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            
            {/* Right: User Actions */}
            <div className="flex items-center gap-2">
              <button className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white">
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-[#1a1a22]"></span>
                )}
              </button>
              
              <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white">
                <HelpCircle size={20} />
              </button>
              
              <div className="hidden sm:flex items-center gap-3 pl-3 ml-2 border-l border-white/10">
                <div className="text-right">
                  <p className="text-white text-sm font-medium">{user?.fullName || 'User'}</p>
                  <p className="text-white/50 text-xs">{user?.email || ''}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-toolstack-orange to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-toolstack-orange/25">
                  <span className="text-white font-bold">
                    {user?.fullName?.charAt(0) || 'U'}
                  </span>
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all"
                data-testid="logout-btn"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div 
            className="absolute left-0 top-16 bottom-0 w-72 bg-[#1a1a22]/95 backdrop-blur-xl border-r border-white/10"
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
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${ active 
                        ? 'bg-gradient-to-r from-toolstack-orange to-orange-600 text-white shadow-lg' 
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                      }
                    `}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            
            <div className="absolute bottom-4 left-4 right-4 p-4 bg-gradient-to-br from-toolstack-orange/20 to-orange-600/10 border border-toolstack-orange/30 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle size={16} className="text-toolstack-orange" />
                <span className="text-white text-sm font-medium">Need Help?</span>
              </div>
              <p className="text-xs text-white/60 mb-3">
                Contact support for assistance
              </p>
              <button className="w-full px-3 py-2 bg-gradient-to-r from-toolstack-orange to-orange-600 text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-toolstack-orange/20">
                Get Support
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <main className="relative pt-16 min-h-screen z-10">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default ClientLayoutEnhanced;
