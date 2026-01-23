import { Navigate } from 'react-router-dom';
import { authService } from '../services/authService';

const ClientRoute = ({ children }) => {
  const user = authService.getCurrentUser();
  
  if (!user || user.role !== 'CLIENT') {
    return <Navigate to="/client/login" replace />;
  }
  
  return children;
};

export default ClientRoute;
