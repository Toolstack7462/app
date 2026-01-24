import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import ToolStackLogo from '../components/ToolStackLogo';
import { useToast } from '../components/Toast';
import { authService } from '../services/authService';

const Login = () => {
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
      const errorMsg = error.response?.data?.error || 'Login failed. Please check your credentials.';
      showError(errorMsg);
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
    <div className="text-white min-h-screen flex items-center justify-center px-4 py-24">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <ToolStackLogo className="h-12" />
          </Link>
          <h1 className="text-3xl font-bold mb-2" data-testid="login-page-heading">Welcome Back</h1>
          <p className="text-toolstack-muted">Log in to access your tools</p>
        </div>
        
        {/* Login Form */}
        <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
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
                  className="w-full pl-12 pr-4 py-3 bg-toolstack-bg border border-toolstack-border rounded-lg text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                  placeholder="you@example.com"
                  data-testid="login-email-input"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
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
                  className="w-full pl-12 pr-12 py-3 bg-toolstack-bg border border-toolstack-border rounded-lg text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                  placeholder="••••••••"
                  data-testid="login-password-input"
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
            
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm text-toolstack-muted">Remember me</span>
              </label>
              <span className="text-sm text-toolstack-muted">
                Forgot password?
              </span>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-orange text-white rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              data-testid="login-submit-btn"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-toolstack-muted text-sm">
              Don&apos;t have an account?{' '}
              <Link to="/join" className="text-toolstack-orange hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
        
        {/* Admin Login Link */}
        <div className="mt-6 text-center">
          <Link to="/admin/login" className="text-toolstack-muted hover:text-toolstack-orange text-sm transition-colors">
            Admin Login →
          </Link>
        </div>
        
        {/* Additional Links */}
        <div className="mt-4 text-center">
          <Link to="/" className="text-toolstack-muted hover:text-toolstack-orange text-sm transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
