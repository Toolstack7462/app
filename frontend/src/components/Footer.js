import { Link } from 'react-router-dom';
import { Facebook, Twitter, Linkedin, Instagram } from 'lucide-react';
import ToolStackLogo from './ToolStackLogo';

const Footer = () => {
  return (
    <footer className="bg-toolstack-card border-t border-toolstack-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Logo & Description */}
          <div className="col-span-1 md:col-span-2">
            <Link to="/" className="inline-block mb-4">
              <ToolStackLogo />
            </Link>
            <p className="text-toolstack-muted text-sm mb-4">
              One subscription. Unlimited digital tools. Access premium AI, academic, SEO, and productivity tools in one place.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-toolstack-muted hover:text-toolstack-orange transition-colors" aria-label="Facebook">
                <Facebook size={20} />
              </a>
              <a href="#" className="text-toolstack-muted hover:text-toolstack-orange transition-colors" aria-label="Twitter">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-toolstack-muted hover:text-toolstack-orange transition-colors" aria-label="LinkedIn">
                <Linkedin size={20} />
              </a>
              <a href="#" className="text-toolstack-muted hover:text-toolstack-orange transition-colors" aria-label="Instagram">
                <Instagram size={20} />
              </a>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/tools" className="text-toolstack-muted hover:text-toolstack-orange text-sm transition-colors">Browse Tools</Link></li>
              <li><Link to="/pricing" className="text-toolstack-muted hover:text-toolstack-orange text-sm transition-colors">Pricing</Link></li>
              <li><Link to="/about" className="text-toolstack-muted hover:text-toolstack-orange text-sm transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="text-toolstack-muted hover:text-toolstack-orange text-sm transition-colors">Contact</Link></li>
            </ul>
          </div>
          
          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-toolstack-muted hover:text-toolstack-orange text-sm transition-colors">Terms of Service</a></li>
              <li><a href="#" className="text-toolstack-muted hover:text-toolstack-orange text-sm transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-toolstack-muted hover:text-toolstack-orange text-sm transition-colors">Refund Policy</a></li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="pt-8 border-t border-toolstack-border">
          <p className="text-center text-toolstack-muted text-sm">
            © {new Date().getFullYear()} ToolStack. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
