import { Navigate } from 'react-router-dom';
import { authService } from '../services/authService';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'];

const AdminRoute = ({ children }) => {
  const user = authService.getCurrentUser();
  
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/admin/login" replace />;
  }
  
  return children;
};

export default AdminRoute;
