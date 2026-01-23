import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ClientLayout from '../../components/ClientLayout';
import { ArrowLeft, Package, ExternalLink, Copy, Check, Eye, EyeOff, Clock, Shield } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const ClientToolDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showSuccess, showError } = useToast();
  
  const [tool, setTool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [cookies, setCookies] = useState('');
  const [loadingCookies, setLoadingCookies] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCookies, setShowCookies] = useState(false);

  useEffect(() => {
    loadTool();
  }, [id]);

  const loadTool = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/client/tools/${id}`);
      setTool(res.data.tool);
    } catch (error) {
      showError('Failed to load tool');
      navigate('/client/tools');
    } finally {
      setLoading(false);
    }
  };

  const fetchCookies = async () => {
    try {
      setLoadingCookies(true);
      const { authService } = await import('../../services/authService');
      const deviceId = authService.getDeviceId();
      const res = await api.post(`/client/tools/${id}/cookies`, { deviceId });
      setCookies(res.data.cookies || '');
      setShowCookieModal(true);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to get cookies');
    } finally {
      setLoadingCookies(false);
    }
  };

  const copyCookies = async () => {
    try {
      await navigator.clipboard.writeText(cookies);
      setCopied(true);
      showSuccess('Cookies copied to clipboard');
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      showError('Failed to copy');
    }
  };

  const closeCookieModal = () => {
    setShowCookieModal(false);
    setCookies('');
    setShowCookies(false);
  };

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-toolstack-orange border-t-transparent"></div>
        </div>
      </ClientLayout>
    );
  }

  if (!tool) {
    return (
      <ClientLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <Package size={64} className="mx-auto mb-4 text-toolstack-muted opacity-50" />
          <h2 className="text-xl font-bold text-white mb-2">Tool not found</h2>
          <button
            onClick={() => navigate('/client/tools')}
            className="text-toolstack-orange hover:underline"
          >
            Back to Tools
          </button>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/client/tools')}
          className="flex items-center gap-2 text-toolstack-muted hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={20} />
          Back to Tools
        </button>

        {/* Tool Card */}
        <div className="bg-toolstack-card border border-toolstack-border rounded-2xl overflow-hidden">
          <div className="p-8">
            <div className="flex items-start gap-6 mb-6">
              <div className="w-20 h-20 bg-gradient-orange rounded-2xl flex items-center justify-center flex-shrink-0">
                <Package size={40} className="text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white mb-2">{tool.name}</h1>
                <p className="text-toolstack-muted">{tool.description}</p>
              </div>
            </div>

            {/* Access Info */}
            {tool.accessEndDate && (
              <div className="flex items-center gap-2 p-4 bg-white/5 rounded-xl mb-6">
                <Clock size={20} className="text-toolstack-orange" />
                <span className="text-white">
                  Access valid until:{' '}
                  <span className="font-semibold">
                    {new Date(tool.accessEndDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={fetchCookies}
                disabled={loadingCookies}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-orange text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                data-testid="get-cookies-btn"
              >
                <Shield size={20} />
                {loadingCookies ? 'Loading...' : 'Get Tool Cookies'}
              </button>
              
              {tool.targetUrl && (
                <a
                  href={tool.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-white/5 border border-toolstack-border text-white rounded-xl font-medium hover:border-toolstack-orange transition-colors"
                >
                  <ExternalLink size={20} />
                  Open Tool Website
                </a>
              )}
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="border-t border-toolstack-border p-8 bg-white/[0.02]">
            <h3 className="text-lg font-semibold text-white mb-4">How to Use</h3>
            <ol className="space-y-3 text-toolstack-muted">
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-toolstack-orange/20 text-toolstack-orange rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                <span>Click &quot;Get Tool Cookies&quot; to retrieve your access credentials</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-toolstack-orange/20 text-toolstack-orange rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                <span>Copy the cookies to your clipboard</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-toolstack-orange/20 text-toolstack-orange rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                <span>Open the tool website and use a cookie manager extension to import them</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-toolstack-orange/20 text-toolstack-orange rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
                <span>Refresh the page and enjoy your premium access!</span>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Cookie Modal */}
      {showCookieModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeCookieModal} />
          <div className="relative bg-toolstack-card border border-toolstack-border rounded-2xl p-6 max-w-lg w-full animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Shield size={24} className="text-toolstack-orange" />
                Tool Cookies
              </h3>
              <button
                onClick={() => setShowCookies(!showCookies)}
                className="p-2 text-toolstack-muted hover:text-white transition-colors"
                title={showCookies ? 'Hide' : 'Show'}
              >
                {showCookies ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            
            <div className="relative mb-6">
              <div className="p-4 bg-white/5 border border-toolstack-border rounded-xl font-mono text-sm overflow-x-auto max-h-48 overflow-y-auto">
                <code className={`text-white break-all ${!showCookies ? 'blur-sm select-none' : ''}`}>
                  {cookies || 'No cookies available'}
                </code>
              </div>
              {!showCookies && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-toolstack-muted text-sm">Click eye icon to reveal</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={copyCookies}
                disabled={!cookies}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-orange text-white rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                data-testid="copy-cookies-btn"
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
              <button
                onClick={closeCookieModal}
                className="px-6 py-3 bg-white/5 text-white rounded-full font-medium hover:bg-white/10 transition-colors"
              >
                Close
              </button>
            </div>
            
            <p className="mt-4 text-xs text-toolstack-muted text-center">
              🔒 Cookies are encrypted and only decrypted when you request them
            </p>
          </div>
        </div>
      )}
    </ClientLayout>
  );
};

export default ClientToolDetail;
