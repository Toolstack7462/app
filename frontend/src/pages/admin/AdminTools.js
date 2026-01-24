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

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-toolstack-muted" size={20} />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-toolstack-card border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
              data-testid="search-tools-input"
            />
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
          <div className="grid gap-4">
            {filteredTools.map((tool) => (
              <div
                key={tool._id}
                className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 hover:border-toolstack-orange/50 transition-all duration-300"
                data-testid={`tool-card-${tool._id}`}
              >
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{tool.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        tool.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {tool.status}
                      </span>
                    </div>
                    <p className="text-toolstack-muted text-sm mb-3 line-clamp-2">{tool.description}</p>
                    {tool.targetUrl && (
                      <a
                        href={tool.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-toolstack-orange hover:underline"
                      >
                        <ExternalLink size={14} />
                        {tool.targetUrl}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <button
                      onClick={() => toggleStatus(tool)}
                      className="p-2 text-toolstack-muted hover:text-white transition-colors"
                      title={tool.status === 'active' ? 'Deactivate' : 'Activate'}
                      data-testid={`toggle-status-${tool._id}`}
                    >
                      {tool.status === 'active' ? (
                        <ToggleRight size={24} className="text-green-400" />
                      ) : (
                        <ToggleLeft size={24} />
                      )}
                    </button>
                    <button
                      onClick={() => navigate(`/admin/tools/${tool._id}/edit`)}
                      className="p-2 text-toolstack-muted hover:text-toolstack-orange transition-colors"
                      title="Edit"
                      data-testid={`edit-tool-${tool._id}`}
                    >
                      <Edit2 size={20} />
                    </button>
                    <button
                      onClick={() => setDeleteModal({ open: true, tool })}
                      className="p-2 text-toolstack-muted hover:text-red-400 transition-colors"
                      title="Delete"
                      data-testid={`delete-tool-${tool._id}`}
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
