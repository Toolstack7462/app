import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { authService } from '../../services/authService';
import ToolStackLogo from '../../components/ToolStackLogo';
import { useToast } from '../../components/Toast';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      setLoading(true);
      await authService.adminLogin(formData.email, formData.password);
      navigate('/admin/dashboard');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Login failed';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  };
  
  const handleChange = (e) => {
    const fieldName = e.target.name === 'admin-login-email' ? 'email' : e.target.name;
    setFormData({
      ...formData,
      [fieldName]: e.target.value
    });
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-24">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <ToolStackLogo className="h-12" />
          </Link>
          <h1 className="text-3xl font-bold mb-2 text-white">Admin Login</h1>
          <p className="text-toolstack-muted">Access the admin panel</p>
        </div>
        
        {/* Login Form */}
        <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-white">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-toolstack-muted" size={20} />
                <input
                  type="email"
                  id="admin-login-email"
                  name="admin-login-email"
                  autoComplete="off"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-toolstack-border rounded-xl text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
                  placeholder="Enter your email"
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
              data-testid="admin-login-btn"
            >
              {loading ? 'Logging in...' : 'Login to Admin Panel'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <Link to="/" className="text-toolstack-muted hover:text-toolstack-orange text-sm transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
