import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { Activity, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, Calendar, Download } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const AdminActivity = () => {
  const { showError } = useToast();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    role: '',
    action: '',
    search: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });

  useEffect(() => {
    loadActivities();
  }, [pagination.page, filters.role, filters.action, filters.startDate, filters.endDate]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit
      });
      
      if (filters.role) params.append('role', filters.role);
      if (filters.action) params.append('action', filters.action);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      
      const res = await api.get(`/admin/activity?${params}`);
      setActivities(res.data.activities || []);
      setPagination(prev => ({ ...prev, total: res.data.total || 0 }));
    } catch (error) {
      showError('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Time', 'Role', 'Action', 'Details'];
    const rows = activities.map(a => [
      formatDate(a.createdAt),
      a.actorRole,
      a.action,
      a.meta ? JSON.stringify(a.meta) : ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilters({ role: '', action: '', search: '', startDate: '', endDate: '' });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const getActionColor = (action) => {
    if (action.includes('LOGIN')) return 'text-blue-400 bg-blue-400/10';
    if (action.includes('CREATE') || action.includes('ASSIGN')) return 'text-green-400 bg-green-400/10';
    if (action.includes('DELETE') || action.includes('BLOCKED')) return 'text-red-400 bg-red-400/10';
    if (action.includes('UPDATE') || action.includes('RESET')) return 'text-yellow-400 bg-yellow-400/10';
    return 'text-toolstack-muted bg-white/5';
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const actionTypes = [
    'ADMIN_LOGIN', 'CLIENT_LOGIN', 'LOGIN_BLOCKED_DISABLED', 'LOGIN_BLOCKED_DEVICE',
    'TOOL_CREATED', 'TOOL_UPDATED', 'TOOL_DELETED',
    'CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_DELETED',
    'TOOL_ASSIGNED', 'TOOL_UNASSIGNED', 'BULK_ASSIGNMENT',
    'DEVICE_RESET', 'TOOL_COOKIES_ACCESSED'
  ];

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Activity Log</h1>
            <p className="text-toolstack-muted">Monitor all system activities and events</p>
          </div>
          <button
            onClick={loadActivities}
            className="flex items-center gap-2 px-4 py-2 bg-toolstack-card border border-toolstack-border rounded-xl text-white hover:border-toolstack-orange transition-colors"
            data-testid="refresh-activity-btn"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-4 text-white">
            <Filter size={18} />
            <span className="font-medium">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-toolstack-muted mb-1 block">Role</label>
              <select
                value={filters.role}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, role: e.target.value }));
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="w-full px-4 py-2 bg-white/5 border border-toolstack-border rounded-xl text-white focus:outline-none focus:border-toolstack-orange transition-colors"
                data-testid="filter-role"
              >
                <option value="">All Roles</option>
                <option value="ADMIN">Admin</option>
                <option value="CLIENT">Client</option>
                <option value="SYSTEM">System</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-toolstack-muted mb-1 block">Action</label>
              <select
                value={filters.action}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, action: e.target.value }));
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="w-full px-4 py-2 bg-white/5 border border-toolstack-border rounded-xl text-white focus:outline-none focus:border-toolstack-orange transition-colors"
                data-testid="filter-action"
              >
                <option value="">All Actions</option>
                {actionTypes.map(action => (
                  <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-toolstack-muted mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-toolstack-muted" size={16} />
                <input
                  type="text"
                  placeholder="Search in metadata..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                  data-testid="filter-search"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Activity List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-toolstack-orange border-t-transparent"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-12 text-center">
            <Activity size={48} className="mx-auto mb-4 text-toolstack-muted opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">No activity found</h3>
            <p className="text-toolstack-muted">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-toolstack-border">
                    <th className="text-left px-6 py-4 text-sm font-medium text-toolstack-muted">Time</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-toolstack-muted">Role</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-toolstack-muted">Action</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-toolstack-muted">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activities
                    .filter(a => !filters.search || JSON.stringify(a.meta || {}).toLowerCase().includes(filters.search.toLowerCase()))
                    .map((activity) => (
                    <tr key={activity._id} className="border-b border-toolstack-border/50 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm text-toolstack-muted whitespace-nowrap">
                        {formatDate(activity.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          activity.actorRole === 'ADMIN' ? 'bg-purple-400/10 text-purple-400' :
                          activity.actorRole === 'CLIENT' ? 'bg-blue-400/10 text-blue-400' :
                          'bg-gray-400/10 text-gray-400'
                        }`}>
                          {activity.actorRole}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${getActionColor(activity.action)}`}>
                          {activity.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-toolstack-muted max-w-md truncate">
                        {activity.meta ? JSON.stringify(activity.meta).substring(0, 80) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-toolstack-border">
                <span className="text-sm text-toolstack-muted">
                  Page {pagination.page} of {totalPages} ({pagination.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="p-2 text-toolstack-muted hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= totalPages}
                    className="p-2 text-toolstack-muted hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminActivity;
