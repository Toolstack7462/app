import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ClientLayoutEnhanced from '../../components/ClientLayoutEnhanced';
import { ArrowLeft, Package, ExternalLink, Clock, Info } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const ClientToolDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showError } = useToast();
  
  const [tool, setTool] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const getCategoryColor = (category) => {
    const colors = {
      'AI': 'from-purple-500 to-purple-600',
      'Academic': 'from-blue-500 to-blue-600',
      'SEO': 'from-green-500 to-green-600',
      'Productivity': 'from-yellow-500 to-yellow-600',
      'Graphics & SEO': 'from-pink-500 to-pink-600',
      'Text Humanizers': 'from-indigo-500 to-indigo-600',
      'Career-Oriented': 'from-orange-500 to-orange-600'
    };
    return colors[category] || 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <ClientLayoutEnhanced>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-toolstack-orange border-t-transparent mx-auto mb-4"></div>
            <p className="text-toolstack-muted">Loading tool details...</p>
          </div>
        </div>
      </ClientLayoutEnhanced>
    );
  }

  if (!tool) {
    return (
      <ClientLayoutEnhanced>
        <div className="max-w-3xl mx-auto text-center py-16">
          <Package size={64} className="mx-auto mb-4 text-toolstack-muted opacity-50" />
          <h2 className="text-xl font-bold text-white mb-2">Tool not found</h2>
          <button
            onClick={() => navigate('/client/tools')}
            className="text-toolstack-orange hover:underline"
          >
            Back to Tools
          </button>
        </div>
      </ClientLayoutEnhanced>
    );
  }

  return (
    <ClientLayoutEnhanced>
      <div className="max-w-4xl mx-auto">
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
              <div className={`w-20 h-20 bg-gradient-to-br ${getCategoryColor(tool.category)} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                <Package size={40} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-white">{tool.name}</h1>
                  {tool.category && (
                    <span className="px-3 py-1 bg-white/10 text-toolstack-muted rounded-full text-sm">
                      {tool.category}
                    </span>
                  )}
                </div>
                <p className="text-toolstack-muted text-lg">{tool.description || 'No description available'}</p>
              </div>
            </div>

            {/* Access Info */}
            {tool.accessEndDate && (
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-toolstack-orange/10 to-orange-500/5 border border-toolstack-orange/20 rounded-xl mb-6">
                <Clock size={24} className="text-toolstack-orange flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Access valid until: </span>
                  <span className="text-toolstack-orange font-semibold">
                    {new Date(tool.accessEndDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* Action Button */}
            {tool.targetUrl && (
              <a
                href={tool.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-toolstack-orange to-orange-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all hover:shadow-lg hover:shadow-toolstack-orange/20"
                data-testid="open-tool-website-btn"
              >
                <ExternalLink size={22} />
                Open Tool Website
              </a>
            )}
          </div>

          {/* Info Section */}
          <div className="border-t border-toolstack-border p-8 bg-white/[0.02]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Info size={20} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">How to Use This Tool</h3>
                <p className="text-toolstack-muted">
                  Click the "Open Tool Website" button above to access your assigned tool. 
                  Your access has been granted by your administrator and is valid until the expiry date shown above.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ClientLayoutEnhanced>
  );
};

export default ClientToolDetail;
