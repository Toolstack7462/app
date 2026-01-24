import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    // Log the attempted route for debugging
    console.log('404 - Route not found:', window.location.pathname);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E1F24] to-[#24252B] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-white mb-4">404</h1>
          <h2 className="text-3xl font-semibold text-white mb-4">Page Not Found</h2>
          <p className="text-gray-400 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => navigate(-1)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            ← Go Back
          </button>
          
          <Link
            to="/"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Go to Home
          </Link>

          <div className="pt-4 border-t border-gray-700">
            <p className="text-gray-500 text-sm mb-4">Looking for:</p>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/admin/login" className="text-blue-400 hover:text-blue-300 text-sm">
                Admin Login
              </Link>
              <Link to="/client/login" className="text-blue-400 hover:text-blue-300 text-sm">
                Client Login
              </Link>
              <Link to="/tools" className="text-blue-400 hover:text-blue-300 text-sm">
                Tools
              </Link>
              <Link to="/contact" className="text-blue-400 hover:text-blue-300 text-sm">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
