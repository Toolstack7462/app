import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClientLayoutEnhanced from '../../components/ClientLayoutEnhanced';
import { Package, Search, Clock, ExternalLink, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const ClientTools = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      setLoading(true);
      const res = await api.get('/client/tools');
      setTools(res.data.tools || []);
    } catch (error) {
      showError('Failed to load tools');
    } finally {
      setLoading(false);
    }
  };

  const daysUntilExpiry = (endDate) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const filteredTools = tools.filter(tool =>
    tool.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <ClientLayoutEnhanced>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-toolstack-orange border-t-transparent"></div>
        </div>
      </ClientLayoutEnhanced>
    );
  }

  return (
    <ClientLayoutEnhanced>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Tools</h1>
          <p className="text-toolstack-muted">Access and use your assigned tools</p>
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
              {searchTerm ? 'No tools found' : 'No tools assigned'}
            </h3>
            <p className="text-toolstack-muted">
              {searchTerm ? 'Try a different search term' : 'Contact your administrator to get tool access'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTools.map((tool) => {
              const days = daysUntilExpiry(tool.accessEndDate);
              const isExpiringSoon = days !== null && days <= 3 && days > 0;
              const isExpired = days !== null && days <= 0;
              
              return (
                <div
                  key={tool._id}
                  className={`bg-toolstack-card border rounded-xl overflow-hidden transition-all hover:shadow-lg ${
                    isExpired ? 'border-red-500/50 opacity-60' :
                    isExpiringSoon ? 'border-yellow-500/50' :
                    'border-toolstack-border hover:border-toolstack-orange/50'
                  }`}
                  data-testid={`tool-card-${tool._id}`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-gradient-orange rounded-xl flex items-center justify-center">
                        <Package size={24} className="text-white" />
                      </div>
                      {isExpired && (
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                          Expired
                        </span>
                      )}
                      {isExpiringSoon && !isExpired && (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                          <AlertTriangle size={12} />
                          {days} days left
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-white mb-2">{tool.name}</h3>
                    <p className="text-sm text-toolstack-muted line-clamp-2 mb-4">{tool.description}</p>
                    
                    {tool.accessEndDate && (
                      <div className="flex items-center gap-2 text-xs text-toolstack-muted mb-4">
                        <Clock size={14} />
                        Access until: {new Date(tool.accessEndDate).toLocaleDateString()}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/client/tools/${tool._id}`)}
                        disabled={isExpired}
                        className="flex-1 py-2 bg-gradient-orange text-white rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        data-testid={`use-tool-${tool._id}`}
                      >
                        Use Tool
                      </button>
                      {tool.targetUrl && (
                        <a
                          href={tool.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-white/5 border border-toolstack-border rounded-full hover:border-toolstack-orange transition-colors"
                          title="Open tool website"
                        >
                          <ExternalLink size={18} className="text-toolstack-muted" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ClientLayoutEnhanced>
  );
};

export default ClientTools;
