import { useState, useEffect } from 'react';
import ClientLayoutEnhanced from '../../components/ClientLayoutEnhanced';
import { User, Mail, Calendar, Shield, Smartphone, Clock } from 'lucide-react';
import api from '../../services/api';
import { authService } from '../../services/authService';
import { useToast } from '../../components/Toast';

const ClientProfile = () => {
  const { showSuccess, showError } = useToast();
  const [profile, setProfile] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const user = authService.getCurrentUser();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const [profileRes, deviceRes] = await Promise.all([
        api.get('/client/profile'),
        api.get('/client/device-info').catch(() => ({ data: { device: null } }))
      ]);
      
      setProfile(profileRes.data.user || profileRes.data);
      setDeviceInfo(deviceRes.data.device);
    } catch (error) {
      showError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ClientLayoutEnhanced>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-toolstack-orange border-t-transparent"></div>
        </div>
      </ClientLayoutEnhanced>
    );
  }

  const userData = profile || user;

  return (
    <ClientLayoutEnhanced>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Profile</h1>
          <p className="text-toolstack-muted">View your account details and device information</p>
        </div>

        <div className="grid gap-6">
          {/* Account Information */}
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-orange rounded-full flex items-center justify-center">
                <User size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Account Information</h2>
                <p className="text-sm text-toolstack-muted">Your personal details</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs text-toolstack-muted uppercase tracking-wider">Full Name</label>
                <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                  <User size={18} className="text-toolstack-muted" />
                  <span className="text-white">{userData?.fullName || '-'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-toolstack-muted uppercase tracking-wider">Email Address</label>
                <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                  <Mail size={18} className="text-toolstack-muted" />
                  <span className="text-white">{userData?.email || '-'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-toolstack-muted uppercase tracking-wider">Account Status</label>
                <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                  <Shield size={18} className="text-toolstack-muted" />
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    userData?.status === 'active' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {userData?.status || 'Active'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-toolstack-muted uppercase tracking-wider">Member Since</label>
                <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                  <Calendar size={18} className="text-toolstack-muted" />
                  <span className="text-white">
                    {userData?.createdAt 
                      ? new Date(userData.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })
                      : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Device Information */}
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <Smartphone size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Device Binding</h2>
                <p className="text-sm text-toolstack-muted">Your registered device information</p>
              </div>
            </div>

            {userData?.devicePolicy?.enabled ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-blue-400 text-sm">
                    <Shield size={14} className="inline mr-2" />
                    Device binding is enabled for your account. Your login is restricted to this device only.
                  </p>
                </div>

                {deviceInfo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-toolstack-muted uppercase tracking-wider">Device ID</label>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <span className="text-white font-mono text-sm">
                          {deviceInfo.deviceIdHash?.substring(0, 20)}...
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-toolstack-muted uppercase tracking-wider">Last Seen</label>
                      <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                        <Clock size={16} className="text-toolstack-muted" />
                        <span className="text-white">
                          {deviceInfo.lastSeenAt 
                            ? new Date(deviceInfo.lastSeenAt).toLocaleString()
                            : 'Now'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-toolstack-border">
                  <p className="text-sm text-toolstack-muted">
                    If you need to access your account from a different device, please contact your administrator to reset your device binding.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-toolstack-muted text-sm">
                  Device binding is not enabled for your account. You can log in from any device.
                </p>
              </div>
            )}
          </div>

          {/* Support Section */}
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Need Help?</h2>
            <p className="text-toolstack-muted text-sm mb-4">
              If you have any questions about your account, tool access, or need assistance, 
              please contact your administrator.
            </p>
            <a
              href="mailto:support@toolstack.com"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-orange text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Mail size={16} />
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </ClientLayoutEnhanced>
  );
};

export default ClientProfile;
