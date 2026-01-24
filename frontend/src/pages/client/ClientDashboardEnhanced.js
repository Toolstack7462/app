import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClientLayoutEnhanced from '../../components/ClientLayoutEnhanced';
import { 
  Package, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  TrendingUp,
  Calendar,
  ExternalLink,
  Lock,
  Chrome,
  Download
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { authService } from '../../services/authService';

const ClientDashboardEnhanced = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [tools, setTools] = useState([]);
  const [expiringTools, setExpiringTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [showExtensionBanner, setShowExtensionBanner] = useState(true);
  
  const user = authService.getCurrentUser();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [toolsRes, expiringRes] = await Promise.all([
        api.get('/client/tools'),
        api.get('/client/assignments/expiring')
      ]);
      
      setTools(toolsRes.data.tools || []);
      setExpiringTools(expiringRes.data.expiring || []);
      
      // Show warning if there are expiring tools
      if (expiringRes.data.expiring?.length > 0) {
        const dismissed = localStorage.getItem('expiry_warning_dismissed');
        const dismissedTime = dismissed ? new Date(dismissed) : null;
        const now = new Date();
        
        // Show again after 24 hours
        if (!dismissedTime || (now - dismissedTime) > 24 * 60 * 60 * 1000) {
          setShowExpiryWarning(true);
        }
      }
    } catch (error) {
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const dismissWarning = () => {
    setShowExpiryWarning(false);
    localStorage.setItem('expiry_warning_dismissed', new Date().toISOString());
  };

  const daysUntilExpiry = (endDate) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff;
  };
  
  const getCategoryColor = (category) => {
    const colors = {
      'AI': 'from-purple-500 to-purple-600',
      'Academic': 'from-blue-500 to-blue-600',
      'SEO': 'from-green-500 to-green-600',
      'Productivity': 'from-yellow-500 to-yellow-600',
      'Graphics & SEO': 'from-pink-500 to-pink-600',
      'Text Humanizers': 'from-indigo-500 to-indigo-600',
      'Career-Oriented': 'from-orange-500 to-orange-600'
    };
    return colors[category] || 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <ClientLayoutEnhanced>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-toolstack-orange border-t-transparent mx-auto mb-4"></div>
            <p className="text-toolstack-muted">Loading your tools...</p>
          </div>
        </div>
      </ClientLayoutEnhanced>
    );
  }

  return (
    <ClientLayoutEnhanced>
      {/* Expiry Warning Modal */}
      {showExpiryWarning && expiringTools.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={dismissWarning} />
          <div className="relative bg-toolstack-card border-2 border-yellow-500/50 rounded-2xl p-8 max-w-md w-full animate-in fade-in zoom-in duration-200 shadow-2xl">
            <button
              onClick={dismissWarning}
              className="absolute top-4 right-4 text-toolstack-muted hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle size={32} className="text-yellow-400" />
              </div>
              <h3 className="text-2xl font-bold text-white">Access Expiring Soon!</h3>
            </div>
            
            <p className="text-toolstack-muted mb-6 text-lg">
              The following tools will expire within 3 days:
            </p>
            
            <div className="space-y-3 mb-8">
              {expiringTools.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <span className="text-white font-semibold">{item.tool?.name || 'Unknown Tool'}</span>
                  <span className="text-yellow-400 font-bold text-sm">
                    {daysUntilExpiry(item.endDate)} days left
                  </span>
                </div>
              ))}
            </div>
            
            <p className="text-sm text-toolstack-muted mb-6">
              Please contact your administrator to extend access.
            </p>
            
            <button
              onClick={dismissWarning}
              className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all hover:scale-105"
            >
              Got it, Thanks!
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8" data-testid="client-dashboard">
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Welcome back, {user?.fullName || 'User'}! 👋
            </h1>
            <p className="text-toolstack-muted flex items-center gap-2">
              <Calendar size={16} />
              Access your tools and manage your account
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Package size={28} className="text-blue-400" />
              </div>
            </div>
            <div className="text-4xl font-bold text-white mb-2">{tools.length}</div>
            <div className="text-sm text-blue-400 font-medium">Assigned Tools</div>
          </div>
          
          <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center">
                <CheckCircle2 size={28} className="text-green-400" />
              </div>
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              {tools.filter(t => t.status === 'active').length}
            </div>
            <div className="text-sm text-green-400 font-medium">Active Now</div>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border border-yellow-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-14 h-14 ${expiringTools.length > 0 ? 'bg-yellow-500/20' : 'bg-gray-500/20'} rounded-xl flex items-center justify-center`}>
                <Clock size={28} className={expiringTools.length > 0 ? 'text-yellow-400' : 'text-gray-400'} />
              </div>
            </div>
            <div className="text-4xl font-bold text-white mb-2">{expiringTools.length}</div>
            <div className="text-sm text-yellow-400 font-medium">Expiring Soon</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp size={28} className="text-purple-400" />
              </div>
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              {tools.reduce((sum, t) => sum + (t.assignmentCount || 0), 0)}
            </div>
            <div className="text-sm text-purple-400 font-medium">Total Access</div>
          </div>
        </div>

        {/* Quick Access Tools */}
        <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Your Tools</h2>
            {tools.length > 6 && (
              <button 
                onClick={() => navigate('/client/tools')}
                className="text-toolstack-orange hover:underline text-sm font-medium"
              >
                View All →
              </button>
            )}
          </div>
          
          {tools.length === 0 ? (
            <div className="text-center py-16">
              <Lock size={64} className="mx-auto mb-6 text-toolstack-muted opacity-50" />
              <h3 className="text-xl font-semibold text-white mb-3">No Tools Assigned Yet</h3>
              <p className="text-toolstack-muted max-w-md mx-auto">
                Contact your administrator to get access to tools. Once assigned, they'll appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.slice(0, 6).map((tool) => (
                <button
                  key={tool._id}
                  onClick={() => navigate(`/client/tools/${tool._id}`)}
                  className="group relative overflow-hidden p-6 bg-gradient-to-br from-white/5 to-white/10 border border-toolstack-border rounded-2xl text-left hover:border-toolstack-orange transition-all hover:-translate-y-1 hover:shadow-xl"
                  data-testid={`quick-tool-${tool._id}`}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${getCategoryColor(tool.category)} opacity-10 rounded-full blur-2xl`} />
                  
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${getCategoryColor(tool.category)} rounded-xl flex items-center justify-center`}>
                        <Package size={24} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white group-hover:text-toolstack-orange transition-colors truncate text-lg">
                          {tool.name}
                        </h3>
                        <p className="text-xs text-toolstack-muted truncate">{tool.category}</p>
                      </div>
                    </div>
                    
                    <p className="text-sm text-toolstack-muted line-clamp-2 mb-4">
                      {tool.description || 'No description available'}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      {tool.endDate && (
                        <div className="flex items-center gap-2 text-xs text-toolstack-muted">
                          <Clock size={12} />
                          <span>Expires {new Date(tool.endDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      <ExternalLink size={16} className="text-toolstack-orange group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ClientLayoutEnhanced>
  );
};

export default ClientDashboardEnhanced;