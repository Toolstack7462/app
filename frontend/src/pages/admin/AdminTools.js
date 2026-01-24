import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight, Package, ExternalLink, Filter } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';

const AdminTools = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, tool: null });

  const CATEGORIES = ['AI', 'Academic', 'SEO', 'Productivity', 'Graphics & SEO', 'Text Humanizers', 'Career-Oriented', 'Miscellaneous', 'Other'];

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/tools');
      setTools(res.data.tools || []);
    } catch (error) {
      showError('Failed to load tools');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (tool) => {
    try {
      const newStatus = tool.status === 'active' ? 'inactive' : 'active';
      await api.put(`/admin/tools/${tool._id}`, { status: newStatus });
      setTools(tools.map(t => t._id === tool._id ? { ...t, status: newStatus } : t));
      showSuccess(`Tool ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (error) {
      showError('Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.tool) return;
    try {
      await api.delete(`/admin/tools/${deleteModal.tool._id}`);
      setTools(tools.filter(t => t._id !== deleteModal.tool._id));
      showSuccess('Tool deleted successfully');
      setDeleteModal({ open: false, tool: null });
    } catch (error) {
      showError('Failed to delete tool');
    }
  };

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || tool.category === categoryFilter;
    const matchesStatus = !statusFilter || tool.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

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
            <h1 className="text-3xl font-bold text-white mb-2">Tools</h1>
            <p className="text-toolstack-muted">Manage your digital tools collection</p>
          </div>
          <button
            onClick={() => navigate('/admin/tools/new')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-orange text-white rounded-full font-medium hover:opacity-90 transition-opacity"
            data-testid="create-tool-btn"
          >
            <Plus size={20} />
            Add Tool
          </button>
        </div>

        {/* Search & Filters */}
        <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-toolstack-muted pointer-events-none" size={18} />
              <input
                type="text"
                placeholder="Search tools..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-toolstack-bg border border-toolstack-border rounded-lg text-white placeholder-toolstack-muted focus:outline-none focus:ring-2 focus:ring-toolstack-orange/50 focus:border-toolstack-orange transition-all text-sm hover:border-toolstack-muted"
                data-testid="search-tools-input"
              />
            </div>
            <div className="flex items-center gap-3">
              <Filter size={18} className="text-toolstack-muted hidden md:block" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2.5 bg-toolstack-bg border border-toolstack-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-toolstack-orange/50 focus:border-toolstack-orange transition-all text-sm min-w-[140px] appearance-none cursor-pointer hover:border-toolstack-muted"
                style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27 viewBox=%270 0 12 8%27%3E%3Cpath fill=%27%23999%27 d=%27M6 8L0 0h12z%27/%3E%3C/svg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.65rem' }}
                data-testid="filter-category"
              >
                <option value="" className="bg-toolstack-bg text-white">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat} className="bg-toolstack-bg text-white">{cat}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 bg-toolstack-bg border border-toolstack-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-toolstack-orange/50 focus:border-toolstack-orange transition-all text-sm min-w-[120px] appearance-none cursor-pointer hover:border-toolstack-muted"
                style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27 viewBox=%270 0 12 8%27%3E%3Cpath fill=%27%23999%27 d=%27M6 8L0 0h12z%27/%3E%3C/svg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.65rem' }}
                data-testid="filter-status"
              >
                <option value="" className="bg-toolstack-bg text-white">All Status</option>
                <option value="active" className="bg-toolstack-bg text-white">Active</option>
                <option value="inactive" className="bg-toolstack-bg text-white">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tools Grid */}
        {filteredTools.length === 0 ? (
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-12 text-center">
            <Package size={48} className="mx-auto mb-4 text-toolstack-muted opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">
              {searchTerm ? 'No tools found' : 'No tools yet'}
            </h3>
            <p className="text-toolstack-muted mb-4">
              {searchTerm ? 'Try a different search term' : 'Create your first tool to get started'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/admin/tools/new')}
                className="px-6 py-2 bg-gradient-orange text-white rounded-full font-medium hover:opacity-90"
              >
                Create Tool
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredTools.map((tool) => (
              <div
                key={tool._id}
                className="group bg-toolstack-card border border-toolstack-border rounded-xl p-5 hover:border-toolstack-orange/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-toolstack-orange/5"
                data-testid={`tool-card-${tool._id}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-white truncate group-hover:text-toolstack-orange transition-colors">{tool.name}</h3>
                      <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
                        tool.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {tool.status}
                      </span>
                    </div>
                    {tool.category && (
                      <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {tool.category}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleStatus(tool)}
                    className="flex-shrink-0 p-2 rounded-lg hover:bg-white/5 transition-colors"
                    title={tool.status === 'active' ? 'Deactivate' : 'Activate'}
                    data-testid={`toggle-status-${tool._id}`}
                  >
                    {tool.status === 'active' ? (
                      <ToggleRight size={22} className="text-green-400" />
                    ) : (
                      <ToggleLeft size={22} className="text-toolstack-muted" />
                    )}
                  </button>
                </div>

                {/* Description */}
                <p className="text-toolstack-muted text-sm mb-4 line-clamp-2 min-h-[40px]">
                  {tool.description || 'No description available'}
                </p>

                {/* URL */}
                {tool.targetUrl && (
                  <a
                    href={tool.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-toolstack-orange hover:underline mb-4 truncate"
                  >
                    <ExternalLink size={14} className="flex-shrink-0" />
                    <span className="truncate">{tool.targetUrl}</span>
                  </a>
                )}

                {/* Stats */}
                {tool.assignmentCount !== undefined && (
                  <div className="flex items-center gap-2 text-xs text-toolstack-muted mb-4 px-3 py-2 bg-white/5 rounded-lg">
                    <Package size={14} />
                    <span>{tool.assignmentCount} active assignment{tool.assignmentCount !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-toolstack-border">
                  <button
                    onClick={() => navigate(`/admin/tools/${tool._id}/edit`)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium"
                    title="Edit"
                    data-testid={`edit-tool-${tool._id}`}
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteModal({ open: true, tool })}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium"
                    title="Delete"
                    data-testid={`delete-tool-${tool._id}`}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, tool: null })}
        onConfirm={handleDelete}
        title="Delete Tool"
        message={`Are you sure you want to delete "${deleteModal.tool?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmStyle="danger"
      />
    </AdminLayout>
  );
};

export default AdminTools;
