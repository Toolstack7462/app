const ToolStackLogo = ({ className = "h-8" }) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <svg
        viewBox="0 0 40 40"
        className="h-full w-auto"
        style={{
          filter: 'drop-shadow(0 2px 10px rgba(244, 122, 32, 0.3))'
        }}
      >
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#F47A20', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#D65A12', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        
        {/* Top layer - orange gradient */}
        <path
          d="M 10 8 L 30 8 L 25 14 L 15 14 Z"
          fill="url(#logoGradient)"
        />
        
        {/* Middle layer - orange gradient */}
        <path
          d="M 8 16 L 32 16 L 27 22 L 13 22 Z"
          fill="url(#logoGradient)"
          opacity="0.8"
        />
        
        {/* Bottom layer - white */}
        <path
          d="M 6 24 L 34 24 L 29 30 L 11 30 Z"
          fill="#FFFFFF"
        />
      </svg>
      
      <span className="text-2xl font-bold">
        <span className="text-white">Tool</span>
        <span className="text-toolstack-orange">Stack</span>
      </span>
    </div>
  );
};

export default ToolStackLogo;
