import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayoutEnhanced from '../../components/AdminLayoutEnhanced';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  ExternalLink,
  TrendingUp
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const AdminToolsEnhanced = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 12, totalPages: 0 });
  
  const categories = ['AI', 'Academic', 'SEO', 'Productivity', 'Graphics & SEO', 'Text Humanizers', 'Career-Oriented', 'Miscellaneous', 'Other'];
  
  useEffect(() => {
    loadTools();
  }, [pagination.page, selectedCategory, selectedStatus]);
  
  const loadTools = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedStatus) params.append('status', selectedStatus);
      
      const response = await api.get(`/admin/tools?${params}`);
      setTools(response.data.tools || []);
      setPagination(prev => ({ ...prev, ...response.data.pagination }));
    } catch (error) {
      console.error('Load tools error:', error);
      showError('Failed to load tools');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadTools();
  };
  
  const handleDelete = async (toolId, toolName) => {
    if (!window.confirm(`Are you sure you want to delete "${toolName}"?`)) return;
    
    try {
      await api.delete(`/admin/tools/${toolId}`);
      showSuccess('Tool deleted successfully');
      loadTools();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete tool');
    }
  };
  
  const getCategoryColor = (category) => {
    const colors = {
      'AI': 'bg-purple-500/20 text-purple-400',
      'Academic': 'bg-blue-500/20 text-blue-400',
      'SEO': 'bg-green-500/20 text-green-400',
      'Productivity': 'bg-yellow-500/20 text-yellow-400',
      'Graphics & SEO': 'bg-pink-500/20 text-pink-400',
      'Text Humanizers': 'bg-indigo-500/20 text-indigo-400',
      'Career-Oriented': 'bg-orange-500/20 text-orange-400',
      'Miscellaneous': 'bg-gray-500/20 text-gray-400',
      'Other': 'bg-gray-500/20 text-gray-400'
    };
    return colors[category] || colors['Other'];
  };
  
  return (
    <AdminLayoutEnhanced>
      <div className="max-w-7xl mx-auto space-y-6" data-testid="admin-tools-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Tools Management</h1>
            <p className="text-toolstack-muted">Manage your tool library</p>
          </div>
          <button
            onClick={() => navigate('/admin/tools/new')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-orange text-white rounded-lg hover:opacity-90 transition-all hover:scale-105 shadow-lg"
            data-testid="create-tool-btn"
          >
            <Plus size={20} />
            <span className="font-medium">Create Tool</span>
          </button>
        </div>
        
        {/* Filters */}
        <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-toolstack-muted" size={18} />
                <input
                  type="text"
                  placeholder="Search tools by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-toolstack-border rounded-lg text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                  data-testid="search-input"
                />
              </div>
            </div>
            
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 bg-toolstack-bg border border-toolstack-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-toolstack-orange/50 focus:border-toolstack-orange transition-all appearance-none cursor-pointer hover:border-toolstack-muted min-w-[150px]"
              style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27 viewBox=%270 0 12 8%27%3E%3Cpath fill=%27%23999%27 d=%27M6 8L0 0h12z%27/%3E%3C/svg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.65rem' }}
              data-testid="category-filter"
            >
              <option value="" className="bg-toolstack-bg text-white">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat} className="bg-toolstack-bg text-white">{cat}</option>
              ))}
            </select>
            
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 bg-toolstack-bg border border-toolstack-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-toolstack-orange/50 focus:border-toolstack-orange transition-all appearance-none cursor-pointer hover:border-toolstack-muted min-w-[120px]"
              style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27 viewBox=%270 0 12 8%27%3E%3Cpath fill=%27%23999%27 d=%27M6 8L0 0h12z%27/%3E%3C/svg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.65rem' }}
              data-testid="status-filter"
            >
              <option value="" className="bg-toolstack-bg text-white">All Status</option>
              <option value="active" className="bg-toolstack-bg text-white">Active</option>
              <option value="inactive" className="bg-toolstack-bg text-white">Inactive</option>
            </select>
          </div>
          
          <button
            onClick={handleSearch}
            className="w-full md:w-auto px-6 py-2 bg-gradient-orange text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Apply Filters
          </button>
        </div>
        
        {/* Tools Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-toolstack-orange border-t-transparent"></div>
          </div>
        ) : tools.length === 0 ? (
          <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-12 text-center">
            <Package size={64} className="mx-auto mb-4 text-toolstack-muted opacity-50" />
            <h3 className="text-xl font-semibold text-white mb-2">No tools found</h3>
            <p className="text-toolstack-muted mb-6">Get started by creating your first tool</p>
            <button
              onClick={() => navigate('/admin/tools/new')}
              className="px-6 py-3 bg-gradient-orange text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Create Tool
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map(tool => (
                <div
                  key={tool._id}
                  className="group bg-toolstack-card border border-toolstack-border rounded-2xl p-6 hover:border-toolstack-orange transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  data-testid={`tool-card-${tool._id}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-toolstack-orange transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-toolstack-muted line-clamp-2">
                        {tool.description || 'No description'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(tool.category)}`}>
                      {tool.category}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      tool.status === 'active' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {tool.status}
                    </span>
                  </div>
                  
                  {tool.targetUrl && (
                    <a
                      href={tool.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-toolstack-orange hover:underline mb-4"
                    >
                      <ExternalLink size={14} />
                      <span className="truncate">View Tool</span>
                    </a>
                  )}
                  
                  {tool.assignmentCount !== undefined && (
                    <div className="flex items-center gap-2 text-sm text-toolstack-muted mb-4">
                      <TrendingUp size={14} />
                      <span>{tool.assignmentCount} active assignment{tool.assignmentCount !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 pt-4 border-t border-toolstack-border">
                    <button
                      onClick={() => navigate(`/admin/tools/${tool._id}/edit`)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                      data-testid={`edit-tool-${tool._id}`}
                    >
                      <Edit2 size={16} />
                      <span className="text-sm font-medium">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(tool._id, tool.name)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      data-testid={`delete-tool-${tool._id}`}
                    >
                      <Trash2 size={16} />
                      <span className="text-sm font-medium">Delete</span>
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

export default AdminToolsEnhanced;