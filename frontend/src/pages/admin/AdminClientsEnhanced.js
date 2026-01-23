import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayoutEnhanced from '../../components/AdminLayoutEnhanced';
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Shield,
  ShieldOff,
  LogOut,
  Smartphone,
  TrendingUp,
  Clock
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const AdminClientsEnhanced = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 12, totalPages: 0 });
  
  useEffect(() => {
    loadClients();
  }, [pagination.page, selectedStatus]);
  
  const loadClients = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (selectedStatus) params.append('status', selectedStatus);
      
      const response = await api.get(`/admin/clients?${params}`);
      setClients(response.data.clients || []);
      setPagination(prev => ({ ...prev, ...response.data.pagination }));
    } catch (error) {
      console.error('Load clients error:', error);
      showError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadClients();
  };
  
  const handleDeviceReset = async (clientId, clientName) => {
    if (!window.confirm(`Reset device binding for "${clientName}"? They will need to login again.`)) return;
    
    try {
      await api.post(`/admin/clients/${clientId}/device-reset`);
      showSuccess('Device binding reset successfully');
      loadClients();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to reset device');
    }
  };
  
  const handleForceLogout = async (clientId, clientName) => {
    if (!window.confirm(`Force logout "${clientName}" from all devices?`)) return;
    
    try {
      await api.post(`/admin/clients/${clientId}/force-logout`);
      showSuccess('Client has been logged out from all devices');
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to force logout');
    }
  };
  
  const handleDelete = async (clientId, clientName) => {
    if (!window.confirm(`Are you sure you want to delete "${clientName}"? This action cannot be undone.`)) return;
    
    try {
      await api.delete(`/admin/clients/${clientId}`);
      showSuccess('Client deleted successfully');
      loadClients();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete client');
    }
  };
  
  const formatDate = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <AdminLayoutEnhanced>
      <div className="max-w-7xl mx-auto space-y-6" data-testid="admin-clients-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Client Management</h1>
            <p className="text-toolstack-muted">Manage client accounts and access</p>
          </div>
          <button
            onClick={() => navigate('/admin/clients/new')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-orange text-white rounded-lg hover:opacity-90 transition-all hover:scale-105 shadow-lg"
            data-testid="create-client-btn"
          >
            <Plus size={20} />
            <span className="font-medium">Add Client</span>
          </button>
        </div>
        
        {/* Filters */}
        <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-toolstack-muted" size={18} />
                <input
                  type="text"
                  placeholder="Search clients by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-toolstack-border rounded-lg text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                  data-testid="search-input"
                />
              </div>
            </div>
            
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-toolstack-border rounded-lg text-white focus:outline-none focus:border-toolstack-orange transition-colors"
              data-testid="status-filter"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          
          <button
            onClick={handleSearch}
            className="w-full md:w-auto px-6 py-2 bg-gradient-orange text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Apply Filters
          </button>
        </div>
        
        {/* Clients Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-toolstack-orange border-t-transparent"></div>
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-12 text-center">
            <Users size={64} className="mx-auto mb-4 text-toolstack-muted opacity-50" />
            <h3 className="text-xl font-semibold text-white mb-2">No clients found</h3>
            <p className="text-toolstack-muted mb-6">Get started by adding your first client</p>
            <button
              onClick={() => navigate('/admin/clients/new')}
              className="px-6 py-3 bg-gradient-orange text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Add Client
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {clients.map(client => (
                <div
                  key={client._id}
                  className="group bg-toolstack-card border border-toolstack-border rounded-2xl p-6 hover:border-toolstack-orange transition-all duration-300 hover:shadow-xl"
                  data-testid={`client-card-${client._id}`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 bg-gradient-orange rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-2xl">
                        {client.fullName?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white mb-1 truncate group-hover:text-toolstack-orange transition-colors">
                        {client.fullName}
                      </h3>
                      <p className="text-sm text-toolstack-muted truncate">{client.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          client.status === 'active' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {client.status}
                        </span>
                        {client.isDeviceLocked && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 flex items-center gap-1">
                            <Smartphone size={12} />
                            Device Locked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-white/5 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2 text-toolstack-muted text-xs mb-1">
                        <TrendingUp size={14} />
                        <span>Assignments</span>
                      </div>
                      <p className="text-white font-semibold">{client.activeAssignments || 0} active</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-toolstack-muted text-xs mb-1">
                        <Clock size={14} />
                        <span>Last Login</span>
                      </div>
                      <p className="text-white font-semibold text-sm">{formatDate(client.lastLoginAt)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => navigate(`/admin/clients/${client._id}/edit`)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                      data-testid={`edit-client-${client._id}`}
                    >
                      <Edit2 size={14} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => navigate(`/admin/clients/${client._id}/assign`)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors text-sm"
                    >
                      <TrendingUp size={14} />
                      <span>Assign</span>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {client.isDeviceLocked && (
                      <button
                        onClick={() => handleDeviceReset(client._id, client.fullName)}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors text-sm"
                        data-testid={`reset-device-${client._id}`}
                      >
                        <ShieldOff size={14} />
                        <span>Reset Device</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleForceLogout(client._id, client.fullName)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors text-sm"
                    >
                      <LogOut size={14} />
                      <span>Force Logout</span>
                    </button>
                    <button
                      onClick={() => handleDelete(client._id, client.fullName)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                      data-testid={`delete-client-${client._id}`}
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 bg-toolstack-card border border-toolstack-border rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-toolstack-orange transition-colors"
                >
                  Previous
                </button>
                <span className="text-white">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-4 py-2 bg-toolstack-card border border-toolstack-border rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-toolstack-orange transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayoutEnhanced>
  );
};

export default AdminClientsEnhanced;