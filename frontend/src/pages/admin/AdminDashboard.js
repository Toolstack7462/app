import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { Package, Users, TrendingUp, Activity as ActivityIcon } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [stats, setStats] = useState({
    totalTools: 0,
    totalClients: 0,
    activeClients: 0,
    totalAssignments: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadDashboard();
  }, []);
  
  const loadDashboard = async () => {
    try {
      setLoading(true);
      
      const [toolsRes, clientsRes, activityRes] = await Promise.all([
        api.get('/admin/tools'),
        api.get('/admin/clients'),
        api.get('/admin/activity?limit=10')
      ]);
      
      const tools = toolsRes.data.tools || [];
      const clients = clientsRes.data.clients || [];
      const activeClients = clients.filter(c => c.status === 'active').length;
      const totalAssignments = clients.reduce((sum, c) => sum + (c.assignmentCount || 0), 0);
      
      setStats({
        totalTools: tools.length,
        totalClients: clients.length,
        activeClients,
        totalAssignments
      });
      
      setRecentActivity(activityRes.data.activities || []);
    } catch (error) {
      console.error('Load dashboard error:', error);
      showError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  const statCards = [
    { icon: Package, label: 'Total Tools', value: stats.totalTools, color: 'bg-blue-500' },
    { icon: Users, label: 'Total Clients', value: stats.totalClients, color: 'bg-green-500' },
    { icon: TrendingUp, label: 'Active Clients', value: stats.activeClients, color: 'bg-purple-500' },
    { icon: ActivityIcon, label: 'Assignments', value: stats.totalAssignments, color: 'bg-orange-500' }
  ];
  
  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };
  
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-toolstack-orange border-t-transparent"></div>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-toolstack-muted">Welcome back! Here&apos;s what&apos;s happening with your CRM.</p>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 hover:border-toolstack-orange transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                    <Icon size={24} className="text-white" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-toolstack-muted">{stat.label}</div>
              </div>
            );
          })}
        </div>
        
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => navigate('/admin/tools/new')}
            className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 text-left hover:border-toolstack-orange transition-all duration-300 group"
          >
            <Package size={32} className="text-toolstack-orange mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-toolstack-orange transition-colors">Create Tool</h3>
            <p className="text-sm text-toolstack-muted">Add a new tool to the platform</p>
          </button>
          
          <button
            onClick={() => navigate('/admin/clients/new')}
            className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 text-left hover:border-toolstack-orange transition-all duration-300 group"
          >
            <Users size={32} className="text-toolstack-orange mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-toolstack-orange transition-colors">Add Client</h3>
            <p className="text-sm text-toolstack-muted">Create a new client account</p>
          </button>
          
          <button
            onClick={() => navigate('/admin/assign')}
            className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 text-left hover:border-toolstack-orange transition-all duration-300 group"
          >
            <TrendingUp size={32} className="text-toolstack-orange mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-toolstack-orange transition-colors">Bulk Assign</h3>
            <p className="text-sm text-toolstack-muted">Assign tools to multiple clients</p>
          </button>
        </div>
        
        {/* Recent Activity */}
        <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
          
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-toolstack-muted">
              <ActivityIcon size={48} className="mx-auto mb-3 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity._id}
                  className="flex items-start justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-white text-sm">
                      <span className="font-semibold">{activity.actorRole}</span>
                      {' '}
                      <span className="text-toolstack-muted">{activity.action.replace(/_/g, ' ').toLowerCase()}</span>
                    </p>
                    {activity.meta && (
                      <p className="text-xs text-toolstack-muted mt-1">
                        {JSON.stringify(activity.meta).substring(0, 100)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-toolstack-muted ml-4">
                    {formatDate(activity.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
