import { Link, useLocation } from 'react-router-dom';
import ToolStackLogo from './ToolStackLogo';

const Navbar = () => {
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[rgba(30,31,36,0.9)] backdrop-blur-md border-b border-toolstack-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Enhanced */}
          <Link to="/" className="flex items-center" data-testid="navbar-logo">
            <ToolStackLogo className="h-10" />
          </Link>
          
          {/* Center Links - Desktop with improved spacing */}
          <div className="hidden md:flex items-center space-x-10">
            <Link 
              to="/tools" 
              className={`text-sm font-medium transition-all relative group ${
                isActive('/tools') ? 'text-toolstack-orange' : 'text-white hover:text-toolstack-orange'
              }`}
              data-testid="nav-tools"
            >
              Tools
              <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-toolstack-orange transform transition-all ${
                isActive('/tools') ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
              }`}></span>
            </Link>
            <Link 
              to="/pricing" 
              className={`text-sm font-medium transition-all relative group ${
                isActive('/pricing') ? 'text-toolstack-orange' : 'text-white hover:text-toolstack-orange'
              }`}
              data-testid="nav-pricing"
            >
              Pricing
              <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-toolstack-orange transform transition-all ${
                isActive('/pricing') ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
              }`}></span>
            </Link>
            <Link 
              to="/blog" 
              className={`text-sm font-medium transition-all relative group ${
                isActive('/blog') ? 'text-toolstack-orange' : 'text-white hover:text-toolstack-orange'
              }`}
              data-testid="nav-blog"
            >
              Blog
              <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-toolstack-orange transform transition-all ${
                isActive('/blog') ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
              }`}></span>
            </Link>
            <Link 
              to="/about" 
              className={`text-sm font-medium transition-all relative group ${
                isActive('/about') ? 'text-toolstack-orange' : 'text-white hover:text-toolstack-orange'
              }`}
              data-testid="nav-about"
            >
              About
              <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-toolstack-orange transform transition-all ${
                isActive('/about') ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
              }`}></span>
            </Link>
            <Link 
              to="/contact" 
              className={`text-sm font-medium transition-all relative group ${
                isActive('/contact') ? 'text-toolstack-orange' : 'text-white hover:text-toolstack-orange'
              }`}
              data-testid="nav-contact"
            >
              Contact
              <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-toolstack-orange transform transition-all ${
                isActive('/contact') ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
              }`}></span>
            </Link>
          </div>
          
          {/* Right CTAs */}
          <div className="flex items-center space-x-3">
            <Link 
              to="/login" 
              className="hidden sm:block px-5 py-2 text-sm font-medium text-white border border-toolstack-orange rounded-full hover:bg-toolstack-orange/10 transition-colors"
              data-testid="nav-login"
            >
              Login
            </Link>
            <Link 
              to="/join" 
              className="px-5 py-2 text-sm font-medium text-white bg-gradient-orange rounded-full hover:opacity-90 transition-opacity"
              data-testid="nav-get-started"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
