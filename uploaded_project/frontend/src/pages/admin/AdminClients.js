import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { Plus, Search, Edit2, Trash2, Users, RotateCcw, ToggleLeft, ToggleRight, Package } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';

const AdminClients = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, client: null });
  const [resetModal, setResetModal] = useState({ open: false, client: null });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/clients');
      setClients(res.data.clients || []);
    } catch (error) {
      showError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (client) => {
    try {
      const newStatus = client.status === 'active' ? 'disabled' : 'active';
      await api.put(`/admin/clients/${client._id}`, { status: newStatus });
      setClients(clients.map(c => c._id === client._id ? { ...c, status: newStatus } : c));
      showSuccess(`Client ${newStatus === 'active' ? 'activated' : 'disabled'}`);
    } catch (error) {
      showError('Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.client) return;
    try {
      await api.delete(`/admin/clients/${deleteModal.client._id}`);
      setClients(clients.filter(c => c._id !== deleteModal.client._id));
      showSuccess('Client deleted successfully');
      setDeleteModal({ open: false, client: null });
    } catch (error) {
      showError('Failed to delete client');
    }
  };

  const handleResetDevice = async () => {
    if (!resetModal.client) return;
    try {
      await api.post(`/admin/clients/${resetModal.client._id}/reset-device`);
      showSuccess('Device binding reset successfully');
      setResetModal({ open: false, client: null });
    } catch (error) {
      showError('Failed to reset device');
    }
  };

  const filteredClients = clients.filter(client =>
    client.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Clients</h1>
            <p className="text-toolstack-muted">Manage client accounts and access</p>
          </div>
          <button
            onClick={() => navigate('/admin/clients/new')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-orange text-white rounded-full font-medium hover:opacity-90 transition-opacity"
            data-testid="create-client-btn"
          >
            <Plus size={20} />
            Add Client
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-toolstack-muted" size={20} />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-toolstack-card border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
              data-testid="search-clients-input"
            />
          </div>
        </div>

        {/* Clients Grid */}
        {filteredClients.length === 0 ? (
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-12 text-center">
            <Users size={48} className="mx-auto mb-4 text-toolstack-muted opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">
              {searchTerm ? 'No clients found' : 'No clients yet'}
            </h3>
            <p className="text-toolstack-muted mb-4">
              {searchTerm ? 'Try a different search term' : 'Create your first client to get started'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/admin/clients/new')}
                className="px-6 py-2 bg-gradient-orange text-white rounded-full font-medium hover:opacity-90"
              >
                Create Client
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredClients.map((client) => (
              <div
                key={client._id}
                className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 hover:border-toolstack-orange/50 transition-all duration-300"
                data-testid={`client-card-${client._id}`}
              >
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{client.fullName}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        client.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {client.status}
                      </span>
                    </div>
                    <p className="text-toolstack-muted text-sm mb-2">{client.email}</p>
                    <div className="flex items-center gap-4 text-xs text-toolstack-muted">
                      <span className="flex items-center gap-1">
                        <Package size={14} />
                        {client.assignmentCount || 0} tools assigned
                      </span>
                      <span>
                        Created: {new Date(client.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <button
                      onClick={() => toggleStatus(client)}
                      className="p-2 text-toolstack-muted hover:text-white transition-colors"
                      title={client.status === 'active' ? 'Disable' : 'Enable'}
                      data-testid={`toggle-status-${client._id}`}
                    >
                      {client.status === 'active' ? (
                        <ToggleRight size={24} className="text-green-400" />
                      ) : (
                        <ToggleLeft size={24} />
                      )}
                    </button>
                    <button
                      onClick={() => setResetModal({ open: true, client })}
                      className="p-2 text-toolstack-muted hover:text-yellow-400 transition-colors"
                      title="Reset Device Binding"
                      data-testid={`reset-device-${client._id}`}
                    >
                      <RotateCcw size={20} />
                    </button>
                    <button
                      onClick={() => navigate(`/admin/clients/${client._id}/edit`)}
                      className="p-2 text-toolstack-muted hover:text-toolstack-orange transition-colors"
                      title="Edit"
                      data-testid={`edit-client-${client._id}`}
                    >
                      <Edit2 size={20} />
                    </button>
                    <button
                      onClick={() => navigate(`/admin/clients/${client._id}/assign`)}
                      className="p-2 text-toolstack-muted hover:text-blue-400 transition-colors"
                      title="Manage Tool Assignments"
                      data-testid={`assign-tools-${client._id}`}
                    >
                      <Package size={20} />
                    </button>
                    <button
                      onClick={() => setDeleteModal({ open: true, client })}
                      className="p-2 text-toolstack-muted hover:text-red-400 transition-colors"
                      title="Delete"
                      data-testid={`delete-client-${client._id}`}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, client: null })}
        onConfirm={handleDelete}
        title="Delete Client"
        message={`Are you sure you want to delete "${deleteModal.client?.fullName}"? This will also remove all their tool assignments.`}
        confirmText="Delete"
        confirmStyle="danger"
      />

      <ConfirmModal
        isOpen={resetModal.open}
        onClose={() => setResetModal({ open: false, client: null })}
        onConfirm={handleResetDevice}
        title="Reset Device Binding"
        message={`Reset device binding for "${resetModal.client?.fullName}"? They will be able to login from a new device.`}
        confirmText="Reset"
        confirmStyle="warning"
      />
    </AdminLayout>
  );
};

export default AdminClients;
