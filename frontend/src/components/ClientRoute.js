import { Navigate } from 'react-router-dom';
import { authService } from '../services/authService';

/**
 * ClientRoute - Protected route for client users
 * IMPORTANT: Must NEVER redirect to admin login
 */
const ClientRoute = ({ children }) => {
  const user = authService.getCurrentUser();
  
  // If not authenticated OR not a CLIENT, redirect to CLIENT login
  // NEVER redirect to admin login from client routes
  if (!user || user.role !== 'CLIENT') {
    return <Navigate to="/client/login" replace />;
  }
  
  return children;
};

export default ClientRoute;
