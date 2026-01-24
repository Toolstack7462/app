import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { ArrowLeft, Save, Package, Link as LinkIcon, FileText, Key } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const AdminToolForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { showSuccess, showError } = useToast();
  
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetUrl: '',
    category: 'Other',
    cookiesEncrypted: '',
    status: 'active'
  });

  useEffect(() => {
    if (isEdit) {
      loadTool();
    }
  }, [id]);

  const loadTool = async () => {
    try {
      const res = await api.get(`/admin/tools/${id}`);
      const tool = res.data.tool;
      setFormData({
        name: tool.name || '',
        description: tool.description || '',
        targetUrl: tool.targetUrl || '',
        category: tool.category || 'Other',
        cookiesEncrypted: '', // Don't show encrypted cookies
        status: tool.status || 'active'
      });
    } catch (error) {
      showError('Failed to load tool');
      navigate('/admin/tools');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      showError('Tool name is required');
      return;
    }
    
    if (!formData.targetUrl.trim()) {
      showError('Target URL is required');
      return;
    }

    try {
      setSaving(true);
      
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        targetUrl: formData.targetUrl.trim(),
        category: formData.category,
        status: formData.status
      };
      
      // Only include cookiesEncrypted if provided (for create or update)
      if (formData.cookiesEncrypted.trim()) {
        payload.cookiesEncrypted = formData.cookiesEncrypted.trim();
      }

      if (isEdit) {
        await api.put(`/admin/tools/${id}`, payload);
        showSuccess('Tool updated successfully');
      } else {
        await api.post('/admin/tools', payload);
        showSuccess('Tool created successfully');
      }
      
      navigate('/admin/tools');
    } catch (error) {
      console.error('Save tool error:', error);
      const errorMessage = error.response?.data?.details 
        ? error.response.data.details.map(d => d.message || d).join(', ')
        : error.response?.data?.error || 'Failed to save tool';
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/tools')}
            className="flex items-center gap-2 text-toolstack-muted hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            Back to Tools
          </button>
          <h1 className="text-3xl font-bold text-white">
            {isEdit ? 'Edit Tool' : 'Create Tool'}
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 sm:p-8">
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                <Package size={16} className="text-toolstack-orange" />
                Tool Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                placeholder="e.g., ChatGPT Premium"
                data-testid="tool-name-input"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                <FileText size={16} className="text-toolstack-orange" />
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors resize-none"
                placeholder="Brief description of the tool..."
                data-testid="tool-description-input"
              />
            </div>

            {/* Target URL */}
            <div>
              <label htmlFor="targetUrl" className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                <LinkIcon size={16} className="text-toolstack-orange" />
                Target URL *
              </label>
              <input
                type="url"
                id="targetUrl"
                name="targetUrl"
                value={formData.targetUrl}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                placeholder="https://example.com"
                data-testid="tool-url-input"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                <Package size={16} className="text-toolstack-orange" />
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-toolstack-bg border border-toolstack-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-toolstack-orange/50 focus:border-toolstack-orange transition-all appearance-none cursor-pointer hover:border-toolstack-muted"
                style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27 viewBox=%270 0 12 8%27%3E%3Cpath fill=%27%23999%27 d=%27M6 8L0 0h12z%27/%3E%3C/svg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '0.75rem' }}
                data-testid="tool-category-select"
              >
                <option value="AI" className="bg-toolstack-bg text-white">AI</option>
                <option value="Academic" className="bg-toolstack-bg text-white">Academic</option>
                <option value="SEO" className="bg-toolstack-bg text-white">SEO</option>
                <option value="Productivity" className="bg-toolstack-bg text-white">Productivity</option>
                <option value="Graphics & SEO" className="bg-toolstack-bg text-white">Graphics & SEO</option>
                <option value="Text Humanizers" className="bg-toolstack-bg text-white">Text Humanizers</option>
                <option value="Career-Oriented" className="bg-toolstack-bg text-white">Career-Oriented</option>
                <option value="Miscellaneous" className="bg-toolstack-bg text-white">Miscellaneous</option>
                <option value="Other" className="bg-toolstack-bg text-white">Other</option>
              </select>
            </div>

            {/* Cookies */}
            <div>
              <label htmlFor="cookiesEncrypted" className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                <Key size={16} className="text-toolstack-orange" />
                Tool Cookies {isEdit && '(leave empty to keep existing)'}
              </label>
              <textarea
                id="cookiesEncrypted"
                name="cookiesEncrypted"
                value={formData.cookiesEncrypted}
                onChange={handleChange}
                rows={4}
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                className="w-full px-4 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors resize-none font-mono text-sm code-textarea"
                placeholder="Paste tool cookies here (will be encrypted)..."
                data-testid="tool-cookies-input"
              />
              <p className="mt-2 text-xs text-toolstack-muted">
                Cookies are encrypted using AES-256-GCM before storage
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Status</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={formData.status === 'active'}
                    onChange={handleChange}
                    className="w-4 h-4 text-toolstack-orange"
                  />
                  <span className="text-white">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="inactive"
                    checked={formData.status === 'inactive'}
                    onChange={handleChange}
                    className="w-4 h-4 text-toolstack-orange"
                  />
                  <span className="text-white">Inactive</span>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-toolstack-border">
            <button
              type="button"
              onClick={() => navigate('/admin/tools')}
              className="px-6 py-3 text-toolstack-muted hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-orange text-white rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              data-testid="save-tool-btn"
            >
              <Save size={20} />
              {saving ? 'Saving...' : (isEdit ? 'Update Tool' : 'Create Tool')}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default AdminToolForm;
