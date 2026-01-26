import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { ArrowLeft, Save, Package, Link as LinkIcon, FileText, Key, Settings, Shield, Database, LogIn, Globe, AlertCircle, CheckCircle, Info } from 'lucide-react';
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
    loginUrl: '',
    category: 'Other',
    credentialType: 'cookies',
    // Unified credential fields
    credentials: {
      type: 'cookies',
      payload: {},
      selectors: {},
      successCheck: {}
    },
    // Legacy fields (for backward compatibility)
    cookiesEncrypted: '',
    tokenEncrypted: '',
    tokenHeader: 'Authorization',
    tokenPrefix: 'Bearer ',
    localStorageEncrypted: '',
    status: 'active',
    extensionSettings: {
      requirePermission: true,
      autoInject: true,
      injectOnPageLoad: true,
      clearExistingCookies: false,
      reloadAfterLogin: true,
      waitForNavigation: true,
      spaMode: false,
      retryAttempts: 2,
      retryDelayMs: 1000
    }
  });

  const CATEGORIES = ['AI', 'Academic', 'SEO', 'Productivity', 'Graphics & SEO', 'Text Humanizers', 'Career-Oriented', 'Miscellaneous', 'Other'];
  
  // Unified credential types with better descriptions
  const CREDENTIAL_TYPES = [
    { 
      value: 'form', 
      label: 'Form Login', 
      icon: '📝', 
      description: 'Username/password form auto-fill',
      hint: 'Best for traditional login pages'
    },
    { 
      value: 'sso', 
      label: 'SSO / OAuth', 
      icon: '🔐', 
      description: 'One-click SSO authentication',
      hint: 'Google, Microsoft, SAML, etc.'
    },
    { 
      value: 'cookies', 
      label: 'Cookies', 
      icon: '🍪', 
      description: 'Inject browser cookies',
      hint: 'Export from browser DevTools'
    },
    { 
      value: 'token', 
      label: 'Bearer Token', 
      icon: '🔑', 
      description: 'JWT / API token injection',
      hint: 'Stored in localStorage'
    },
    { 
      value: 'headers', 
      label: 'Custom Headers', 
      icon: '📋', 
      description: 'Multiple header auth (MV3 limited)',
      hint: 'Prefer cookies for MV3'
    },
    { 
      value: 'localStorage', 
      label: 'Local Storage', 
      icon: '💾', 
      description: 'Inject localStorage data',
      hint: 'Key-value pairs'
    },
    { 
      value: 'sessionStorage', 
      label: 'Session Storage', 
      icon: '⏱️', 
      description: 'Inject sessionStorage data',
      hint: 'Cleared on tab close'
    },
    { 
      value: 'none', 
      label: 'None', 
      icon: '⭕', 
      description: 'No credentials needed',
      hint: 'Public tool'
    }
  ];

  // Form-specific state
  const [formLoginData, setFormLoginData] = useState({
    username: '',
    password: '',
    loginUrl: ''
  });
  
  const [formSelectors, setFormSelectors] = useState({
    username: '',
    password: '',
    submit: '',
    rememberMe: '',
    errorMessage: ''
  });
  
  const [successCheck, setSuccessCheck] = useState({
    urlIncludes: '',
    urlExcludes: '',
    elementExists: '',
    elementNotExists: '',
    cookieNames: ''
  });
  
  // SSO-specific state
  const [ssoData, setSsoData] = useState({
    authStartUrl: '',
    postLoginUrl: '',
    provider: '',
    buttonSelector: '',
    autoClick: true
  });
  
  // Headers-specific state
  const [headersData, setHeadersData] = useState([
    { name: 'Authorization', value: '', prefix: 'Bearer ' }
  ]);

  useEffect(() => {
    if (isEdit) {
      loadTool();
    }
  }, [id]);

  const loadTool = async () => {
    try {
      const res = await api.get(`/admin/tools/${id}`);
      const tool = res.data.tool;
      
      // Load form data
      setFormData({
        name: tool.name || '',
        description: tool.description || '',
        targetUrl: tool.targetUrl || '',
        loginUrl: tool.loginUrl || '',
        category: tool.category || 'Other',
        credentialType: tool.credentials?.type || tool.credentialType || 'cookies',
        credentials: tool.credentials || { type: 'cookies', payload: {}, selectors: {}, successCheck: {} },
        cookiesEncrypted: '', // Don't show encrypted data
        tokenEncrypted: '',
        tokenHeader: tool.tokenHeader || 'Authorization',
        tokenPrefix: tool.tokenPrefix || 'Bearer ',
        localStorageEncrypted: '',
        status: tool.status || 'active',
        extensionSettings: {
          requirePermission: tool.extensionSettings?.requirePermission ?? true,
          autoInject: tool.extensionSettings?.autoInject ?? true,
          injectOnPageLoad: tool.extensionSettings?.injectOnPageLoad ?? true,
          clearExistingCookies: tool.extensionSettings?.clearExistingCookies ?? false,
          reloadAfterLogin: tool.extensionSettings?.reloadAfterLogin ?? true,
          waitForNavigation: tool.extensionSettings?.waitForNavigation ?? true,
          spaMode: tool.extensionSettings?.spaMode ?? false,
          retryAttempts: tool.extensionSettings?.retryAttempts ?? 2,
          retryDelayMs: tool.extensionSettings?.retryDelayMs ?? 1000
        }
      });
      
      // Load selectors if present
      if (tool.credentials?.selectors) {
        setFormSelectors(prev => ({
          ...prev,
          ...tool.credentials.selectors
        }));
      }
      
      // Load success check if present
      if (tool.credentials?.successCheck) {
        setSuccessCheck(prev => ({
          ...prev,
          urlIncludes: tool.credentials.successCheck.urlIncludes || '',
          urlExcludes: tool.credentials.successCheck.urlExcludes || '',
          elementExists: tool.credentials.successCheck.elementExists || '',
          elementNotExists: tool.credentials.successCheck.elementNotExists || '',
          cookieNames: (tool.credentials.successCheck.cookieNames || []).join(', ')
        }));
      }
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
        loginUrl: formData.loginUrl.trim() || formData.targetUrl.trim(),
        category: formData.category,
        credentialType: formData.credentialType,
        status: formData.status,
        extensionSettings: formData.extensionSettings
      };
      
      // Build unified credentials object
      const credentials = {
        type: formData.credentialType,
        payload: {},
        selectors: {},
        successCheck: {}
      };
      
      // Build selectors
      const cleanedSelectors = {};
      Object.entries(formSelectors).forEach(([key, value]) => {
        if (value && value.trim()) {
          cleanedSelectors[key] = value.trim();
        }
      });
      if (Object.keys(cleanedSelectors).length > 0) {
        credentials.selectors = cleanedSelectors;
      }
      
      // Build success check
      const cleanedSuccessCheck = {};
      if (successCheck.urlIncludes?.trim()) {
        cleanedSuccessCheck.urlIncludes = successCheck.urlIncludes.trim();
      }
      if (successCheck.urlExcludes?.trim()) {
        cleanedSuccessCheck.urlExcludes = successCheck.urlExcludes.trim();
      }
      if (successCheck.elementExists?.trim()) {
        cleanedSuccessCheck.elementExists = successCheck.elementExists.trim();
      }
      if (successCheck.elementNotExists?.trim()) {
        cleanedSuccessCheck.elementNotExists = successCheck.elementNotExists.trim();
      }
      if (successCheck.cookieNames?.trim()) {
        cleanedSuccessCheck.cookieNames = successCheck.cookieNames.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (Object.keys(cleanedSuccessCheck).length > 0) {
        credentials.successCheck = cleanedSuccessCheck;
      }
      
      // Handle credential type specific data
      switch (formData.credentialType) {
        case 'form':
          if (formLoginData.username || formLoginData.password) {
            credentials.payload = {
              username: formLoginData.username,
              password: formLoginData.password,
              loginUrl: formLoginData.loginUrl || formData.loginUrl
            };
          }
          break;
          
        case 'sso':
          if (ssoData.authStartUrl) {
            credentials.payload = {
              authStartUrl: ssoData.authStartUrl,
              postLoginUrl: ssoData.postLoginUrl || formData.targetUrl,
              provider: ssoData.provider,
              buttonSelector: ssoData.buttonSelector,
              autoClick: ssoData.autoClick
            };
          }
          break;
          
        case 'headers':
          const validHeaders = headersData.filter(h => h.name && h.value);
          if (validHeaders.length > 0) {
            credentials.payload = { headers: validHeaders };
          }
          break;
          
        case 'cookies':
          if (formData.cookiesEncrypted.trim()) {
            payload.cookiesEncrypted = formData.cookiesEncrypted.trim();
          }
          break;
          
        case 'token':
          payload.tokenHeader = formData.tokenHeader;
          payload.tokenPrefix = formData.tokenPrefix;
          if (formData.tokenEncrypted.trim()) {
            payload.tokenEncrypted = formData.tokenEncrypted.trim();
          }
          break;
          
        case 'localStorage':
        case 'sessionStorage':
          if (formData.localStorageEncrypted.trim()) {
            payload.localStorageEncrypted = formData.localStorageEncrypted.trim();
          }
          break;
      }
      
      // Add credentials to payload if it has meaningful data
      if (credentials.payload && Object.keys(credentials.payload).length > 0 ||
          credentials.selectors && Object.keys(credentials.selectors).length > 0 ||
          credentials.successCheck && Object.keys(credentials.successCheck).length > 0) {
        payload.credentials = credentials;
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
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('extensionSettings.')) {
      const settingName = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        extensionSettings: {
          ...prev.extensionSettings,
          [settingName]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <p className="text-toolstack-muted mt-1">Configure tool details and credentials for Chrome Extension</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info Card */}
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-6">
              <Package size={20} className="text-toolstack-orange" />
              Basic Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
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

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-white mb-2">
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-toolstack-bg border border-toolstack-border rounded-xl text-white focus:outline-none focus:border-toolstack-orange transition-colors appearance-none cursor-pointer"
                  style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27 viewBox=%270 0 12 8%27%3E%3Cpath fill=%27%23999%27 d=%27M6 8L0 0h12z%27/%3E%3C/svg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '0.75rem' }}
                  data-testid="tool-category-select"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-toolstack-bg text-white">{cat}</option>
                  ))}
                </select>
              </div>

              {/* Target URL */}
              <div className="md:col-span-2">
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

              {/* Description */}
              <div className="md:col-span-2">
                <label htmlFor="description" className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                  <FileText size={16} className="text-toolstack-orange" />
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors resize-none"
                  placeholder="Brief description of the tool..."
                  data-testid="tool-description-input"
                />
              </div>
            </div>
          </div>

          {/* Credential Type Card */}
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-6">
              <Key size={20} className="text-toolstack-orange" />
              Credential Type
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {CREDENTIAL_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, credentialType: type.value }))}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    formData.credentialType === type.value
                      ? 'border-toolstack-orange bg-toolstack-orange/10'
                      : 'border-toolstack-border bg-white/5 hover:border-toolstack-orange/50'
                  }`}
                  data-testid={`credential-type-${type.value}`}
                >
                  <div className="text-2xl mb-2">{type.icon}</div>
                  <div className="font-medium text-white text-sm">{type.label}</div>
                  <div className="text-xs text-toolstack-muted mt-1">{type.description}</div>
                </button>
              ))}
            </div>

            {/* Credential Input based on type */}
            {formData.credentialType === 'cookies' && (
              <div>
                <label htmlFor="cookiesEncrypted" className="block text-sm font-medium text-white mb-2">
                  Cookies JSON {isEdit && '(leave empty to keep existing)'}
                </label>
                <textarea
                  id="cookiesEncrypted"
                  name="cookiesEncrypted"
                  value={formData.cookiesEncrypted}
                  onChange={handleChange}
                  rows={5}
                  spellCheck="false"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  className="w-full px-4 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors resize-none font-mono text-sm"
                  placeholder='[{"name": "session", "value": "abc123", "domain": ".example.com"}]'
                  data-testid="tool-cookies-input"
                />
                <p className="mt-2 text-xs text-toolstack-muted">
                  Paste cookies as JSON array. Will be encrypted with AES-256-GCM.
                </p>
              </div>
            )}

            {formData.credentialType === 'token' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tokenHeader" className="block text-sm font-medium text-white mb-2">
                      Header Name
                    </label>
                    <input
                      type="text"
                      id="tokenHeader"
                      name="tokenHeader"
                      value={formData.tokenHeader}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                      placeholder="Authorization"
                      data-testid="tool-token-header"
                    />
                  </div>
                  <div>
                    <label htmlFor="tokenPrefix" className="block text-sm font-medium text-white mb-2">
                      Token Prefix
                    </label>
                    <input
                      type="text"
                      id="tokenPrefix"
                      name="tokenPrefix"
                      value={formData.tokenPrefix}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                      placeholder="Bearer "
                      data-testid="tool-token-prefix"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="tokenEncrypted" className="block text-sm font-medium text-white mb-2">
                    Token Value {isEdit && '(leave empty to keep existing)'}
                  </label>
                  <input
                    type="password"
                    id="tokenEncrypted"
                    name="tokenEncrypted"
                    value={formData.tokenEncrypted}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors font-mono"
                    placeholder="Enter token value..."
                    data-testid="tool-token-value"
                  />
                  <p className="mt-2 text-xs text-toolstack-muted">
                    Token will be injected as: {formData.tokenHeader}: {formData.tokenPrefix}[token]
                  </p>
                </div>
              </div>
            )}

            {formData.credentialType === 'localStorage' && (
              <div>
                <label htmlFor="localStorageEncrypted" className="block text-sm font-medium text-white mb-2">
                  LocalStorage Data {isEdit && '(leave empty to keep existing)'}
                </label>
                <textarea
                  id="localStorageEncrypted"
                  name="localStorageEncrypted"
                  value={formData.localStorageEncrypted}
                  onChange={handleChange}
                  rows={5}
                  spellCheck="false"
                  autoComplete="off"
                  className="w-full px-4 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors resize-none font-mono text-sm"
                  placeholder='{"key1": "value1", "key2": "value2"}'
                  data-testid="tool-localstorage-input"
                />
                <p className="mt-2 text-xs text-toolstack-muted">
                  Paste localStorage data as JSON object. Keys will be set in browser localStorage.
                </p>
              </div>
            )}

            {formData.credentialType === 'none' && (
              <div className="p-4 bg-white/5 rounded-xl text-center">
                <p className="text-toolstack-muted">No credentials required for this tool.</p>
              </div>
            )}
          </div>

          {/* Extension Settings Card */}
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-6">
              <Settings size={20} className="text-toolstack-orange" />
              Extension Settings
            </h2>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  name="extensionSettings.autoInject"
                  checked={formData.extensionSettings.autoInject}
                  onChange={handleChange}
                  className="w-5 h-5 rounded border-toolstack-border text-toolstack-orange focus:ring-toolstack-orange"
                />
                <div>
                  <div className="font-medium text-white">Auto-inject credentials</div>
                  <div className="text-xs text-toolstack-muted">Automatically inject when visiting tool URL</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  name="extensionSettings.injectOnPageLoad"
                  checked={formData.extensionSettings.injectOnPageLoad}
                  onChange={handleChange}
                  className="w-5 h-5 rounded border-toolstack-border text-toolstack-orange focus:ring-toolstack-orange"
                />
                <div>
                  <div className="font-medium text-white">Inject on page load</div>
                  <div className="text-xs text-toolstack-muted">Inject credentials as soon as page loads</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  name="extensionSettings.clearExistingCookies"
                  checked={formData.extensionSettings.clearExistingCookies}
                  onChange={handleChange}
                  className="w-5 h-5 rounded border-toolstack-border text-toolstack-orange focus:ring-toolstack-orange"
                />
                <div>
                  <div className="font-medium text-white">Clear existing cookies</div>
                  <div className="text-xs text-toolstack-muted">Remove existing cookies before injecting new ones</div>
                </div>
              </label>
            </div>
          </div>

          {/* Status Card */}
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
              <Shield size={20} className="text-toolstack-orange" />
              Status
            </h2>
            
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="active"
                  checked={formData.status === 'active'}
                  onChange={handleChange}
                  className="w-4 h-4 text-toolstack-orange focus:ring-toolstack-orange"
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
                  className="w-4 h-4 text-toolstack-orange focus:ring-toolstack-orange"
                />
                <span className="text-white">Inactive</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-4">
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
              className="flex items-center gap-2 px-8 py-3 bg-gradient-orange text-white rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
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
