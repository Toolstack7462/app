import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { authService } from '../../services/authService';
import ToolStackLogo from '../../components/ToolStackLogo';
import { useToast } from '../../components/Toast';

const ClientLogin = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const deviceId = authService.getOrCreateDeviceId();
      await authService.clientLogin(formData.email, formData.password, deviceId);
      navigate('/client/dashboard');
    } catch (error) {
      showError(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-24 bg-gradient-to-br from-[#1E1F24] to-[#24252B]">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <ToolStackLogo className="h-12" />
          </Link>
          <h1 className="text-3xl font-bold mb-2 text-white">Client Login</h1>
          <p className="text-toolstack-muted">Access your assigned tools</p>
        </div>

        {/* Login Form */}
        <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-white">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-toolstack-muted" size={20} />
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                  placeholder="you@example.com"
                  data-testid="client-email-input"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2 text-white">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-toolstack-muted" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-12 pr-12 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                  placeholder="••••••••"
                  data-testid="client-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-toolstack-muted hover:text-toolstack-orange transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-orange text-white rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              data-testid="client-login-btn"
            >
              {loading ? 'Logging in...' : 'Login to Portal'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="text-toolstack-muted hover:text-toolstack-orange text-sm transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>

        <p className="text-center text-toolstack-muted text-sm mt-6">
          Need access? Contact your administrator.
        </p>
      </div>
    </div>
  );
};

export default ClientLogin;
