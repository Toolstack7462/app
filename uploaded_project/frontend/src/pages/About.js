import { Target, Users, Zap, Heart } from 'lucide-react';

const About = () => {
  return (
    <div className="text-white min-h-screen pt-24 pb-16 px-4">{/* Removed bg-toolstack-bg */}
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="about-page-heading">About ToolStack</h1>
          <p className="text-toolstack-muted text-lg max-w-2xl mx-auto">
            We're on a mission to democratize access to premium digital tools for everyone.
          </p>
        </div>
        
        {/* Mission Section */}
        <div className="mb-20">
          <div className="bg-gradient-orange rounded-2xl p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
            <p className="text-lg opacity-90 max-w-3xl mx-auto">
              To empower individuals, professionals, and businesses by providing affordable access to the world's best digital tools through a single, unified subscription platform.
            </p>
          </div>
        </div>
        
        {/* Story Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-8">Our Story</h2>
          <div className="max-w-4xl mx-auto">
            <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-8">
              <p className="text-toolstack-muted mb-4">
                ToolStack was born from a simple observation: professionals and creators were spending hundreds of dollars each month on multiple tool subscriptions. Academic researchers needed plagiarism checkers, students required AI writing assistants, marketers wanted SEO tools, and designers needed creative software.
              </p>
              <p className="text-toolstack-muted mb-4">
                Managing dozens of subscriptions was not only expensive but also incredibly time-consuming. We knew there had to be a better way.
              </p>
              <p className="text-toolstack-muted">
                In 2024, we launched ToolStack with a vision: one subscription that gives you access to all the premium tools you need. Today, we're proud to serve thousands of users worldwide, helping them save money and boost their productivity.
              </p>
            </div>
          </div>
        </div>
        
        {/* Values Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-orange rounded-full flex items-center justify-center mx-auto mb-4">
                <Target size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Accessibility</h3>
              <p className="text-toolstack-muted text-sm">
                Making premium tools accessible to everyone, regardless of budget.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-orange rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Community</h3>
              <p className="text-toolstack-muted text-sm">
                Building a supportive community of creators and professionals.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-orange rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Innovation</h3>
              <p className="text-toolstack-muted text-sm">
                Constantly adding new tools and features to stay ahead.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-orange rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Excellence</h3>
              <p className="text-toolstack-muted text-sm">
                Delivering the highest quality service and support.
              </p>
            </div>
          </div>
        </div>
        
        {/* Team Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">Meet Our Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-orange rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                JD
              </div>
              <h3 className="text-xl font-semibold mb-1">John Doe</h3>
              <p className="text-toolstack-orange text-sm mb-2">CEO & Founder</p>
              <p className="text-toolstack-muted text-sm">
                Former tech executive with a passion for making tools accessible.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-orange rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                SK
              </div>
              <h3 className="text-xl font-semibold mb-1">Sarah Kim</h3>
              <p className="text-toolstack-orange text-sm mb-2">Chief Product Officer</p>
              <p className="text-toolstack-muted text-sm">
                Product visionary focused on user experience and innovation.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-orange rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                MR
              </div>
              <h3 className="text-xl font-semibold mb-1">Mike Rodriguez</h3>
              <p className="text-toolstack-orange text-sm mb-2">Head of Engineering</p>
              <p className="text-toolstack-muted text-sm">
                Building robust infrastructure to serve thousands of users.
              </p>
            </div>
          </div>
        </div>
        
        {/* Stats Section */}
        <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-toolstack-orange mb-2">5K+</div>
              <div className="text-toolstack-muted">Active Users</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-toolstack-orange mb-2">90+</div>
              <div className="text-toolstack-muted">Premium Tools</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-toolstack-orange mb-2">50+</div>
              <div className="text-toolstack-muted">Countries</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-toolstack-orange mb-2">4.9/5</div>
              <div className="text-toolstack-muted">User Rating</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
