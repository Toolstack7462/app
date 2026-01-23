import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayoutEnhanced from '../../components/AdminLayoutEnhanced';
import { 
  Package, 
  Users, 
  TrendingUp, 
  Activity as ActivityIcon,
  UserPlus,
  PackagePlus,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Calendar
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const AdminDashboardEnhanced = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [stats, setStats] = useState({
    totalTools: 0,
    activeTools: 0,
    totalClients: 0,
    activeClients: 0,
    disabledClients: 0,
    totalAssignments: 0,
    deviceBindings: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentClients, setRecentClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadDashboard();
  }, []);
  
  const loadDashboard = async () => {
    try {
      setLoading(true);
      
      const [toolsRes, clientsRes, clientStatsRes, activityRes] = await Promise.all([
        api.get('/admin/tools/stats'),
        api.get('/admin/clients?limit=5'),
        api.get('/admin/clients/stats'),
        api.get('/admin/activity?limit=10')
      ]);
      
      const toolStats = toolsRes.data.stats || {};
      const clientStats = clientStatsRes.data.stats || {};
      const clients = clientsRes.data.clients || [];
      
      // Calculate total assignments
      const totalAssignments = clients.reduce((sum, c) => sum + (c.assignmentCount || 0), 0);
      
      setStats({
        totalTools: toolStats.totalTools || 0,
        activeTools: toolStats.activeTools || 0,
        totalClients: clientStats.totalClients || 0,
        activeClients: clientStats.activeClients || 0,
        disabledClients: clientStats.disabledClients || 0,
        totalAssignments,
        deviceBindings: clientStats.clientsWithDeviceBinding || 0
      });
      
      setRecentClients(clientStats.recentClients || []);
      setRecentActivity(activityRes.data.activities || []);
    } catch (error) {
      console.error('Load dashboard error:', error);
      showError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  const statCards = [
    { 
      icon: Package, 
      label: 'Total Tools', 
      value: stats.totalTools,
      sublabel: `${stats.activeTools} active`,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400'
    },
    { 
      icon: Users, 
      label: 'Total Clients', 
      value: stats.totalClients,
      sublabel: `${stats.activeClients} active`,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400'
    },
    { 
      icon: TrendingUp, 
      label: 'Assignments', 
      value: stats.totalAssignments,
      sublabel: 'Active assignments',
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/10',
      textColor: 'text-purple-400'
    },
    { 
      icon: ActivityIcon, 
      label: 'Device Bindings', 
      value: stats.deviceBindings,
      sublabel: 'Secured clients',
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/10',
      textColor: 'text-orange-400'
    }
  ];
  
  const quickActions = [
    {
      icon: PackagePlus,
      title: 'Create Tool',
      description: 'Add a new tool to the platform',
      action: () => navigate('/admin/tools/new'),
      color: 'blue'
    },
    {
      icon: UserPlus,
      title: 'Add Client',
      description: 'Create a new client account',
      action: () => navigate('/admin/clients/new'),
      color: 'green'
    },
    {
      icon: TrendingUp,
      title: 'Bulk Assign',
      description: 'Assign tools to multiple clients',
      action: () => navigate('/admin/assign'),
      color: 'purple'
    }
  ];
  
  const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000); // seconds
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };
  
  const getActionIcon = (action) => {
    if (action.includes('LOGIN')) return <CheckCircle2 size={16} className="text-green-400" />;
    if (action.includes('CREATED')) return <UserPlus size={16} className="text-blue-400" />;
    if (action.includes('DELETED')) return <AlertCircle size={16} className="text-red-400" />;
    if (action.includes('UPDATED')) return <Clock size={16} className="text-yellow-400" />;
    return <ActivityIcon size={16} className="text-gray-400" />;
  };
  
  if (loading) {
    return (
      <AdminLayoutEnhanced>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-toolstack-orange border-t-transparent mx-auto mb-4"></div>
            <p className="text-toolstack-muted">Loading dashboard...</p>
          </div>
        </div>
      </AdminLayoutEnhanced>
    );
  }
  
  return (
    <AdminLayoutEnhanced>
      <div className="max-w-7xl mx-auto space-y-8" data-testid="admin-dashboard">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-toolstack-muted flex items-center gap-2">
              <Calendar size={16} />
              Welcome back! Here's what's happening today
            </p>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="group bg-toolstack-card border border-toolstack-border rounded-2xl p-6 hover:border-toolstack-orange transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-toolstack-orange/10"
                data-testid={`stat-card-${index}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-14 h-14 ${stat.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icon size={28} className={stat.textColor} />
                  </div>
                </div>
                <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-sm text-toolstack-muted font-medium mb-1">{stat.label}</div>
                <div className={`text-xs ${stat.textColor} flex items-center gap-1`}>
                  <TrendingUp size={12} />
                  {stat.sublabel}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              const colorMap = {
                blue: 'from-blue-500/10 to-blue-600/10 border-blue-500/30 hover:border-blue-500',
                green: 'from-green-500/10 to-green-600/10 border-green-500/30 hover:border-green-500',
                purple: 'from-purple-500/10 to-purple-600/10 border-purple-500/30 hover:border-purple-500'
              };
              
              return (
                <button
                  key={index}
                  onClick={action.action}
                  className={`
                    group relative overflow-hidden
                    bg-gradient-to-br ${colorMap[action.color]}
                    border rounded-2xl p-6 text-left
                    transition-all duration-300 hover:-translate-y-1 hover:shadow-xl
                  `}
                  data-testid={`quick-action-${index}`}
                >
                  <Icon size={36} className="text-toolstack-orange mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-toolstack-orange transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-sm text-toolstack-muted mb-4">
                    {action.description}
                  </p>
                  <div className="flex items-center gap-2 text-toolstack-orange text-sm font-medium">
                    <span>Get Started</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Clients */}
          <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Recent Clients</h2>
              <button 
                onClick={() => navigate('/admin/clients')}
                className="text-toolstack-orange hover:underline text-sm font-medium"
              >
                View All
              </button>
            </div>
            
            {recentClients.length === 0 ? (
              <div className="text-center py-12">
                <Users size={48} className="mx-auto mb-4 text-toolstack-muted opacity-50" />
                <p className="text-toolstack-muted">No clients yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentClients.map((client) => (
                  <div
                    key={client._id}
                    className="flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/clients/${client._id}/edit`)}
                  >
                    <div className="w-12 h-12 bg-gradient-orange rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">
                        {client.fullName?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">{client.fullName}</h3>
                      <p className="text-sm text-toolstack-muted truncate">{client.email}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      client.status === 'active' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {client.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Recent Activity */}
          <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Recent Activity</h2>
              <button 
                onClick={() => navigate('/admin/activity')}
                className="text-toolstack-orange hover:underline text-sm font-medium"
              >
                View All
              </button>
            </div>
            
            {recentActivity.length === 0 ? (
              <div className="text-center py-12">
                <ActivityIcon size={48} className="mx-auto mb-4 text-toolstack-muted opacity-50" />
                <p className="text-toolstack-muted">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentActivity.map((activity) => (
                  <div
                    key={activity._id}
                    className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <div className="mt-0.5">
                      {getActionIcon(activity.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">
                        <span className="font-semibold">{activity.actorRole}</span>
                        {' '}
                        <span className="text-toolstack-muted">
                          {activity.action.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      </p>
                      <p className="text-xs text-toolstack-muted mt-1">
                        {formatDate(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayoutEnhanced>
  );
};

export default AdminDashboardEnhanced;
