import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Shield, Clock, HeadphonesIcon, CheckCircle2, Users, Layers, TrendingUp } from 'lucide-react';
import { toolsData, categories } from '../data/toolsData';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Home = () => {
  const [activeCategory, setActiveCategory] = useState('Academic');
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  
  // Get preview tools for active category (6 tools)
  const categoryPreviewTools = toolsData.filter(tool => tool.category === activeCategory).slice(0, 6);
  
  const statsCards = [
    { icon: Layers, value: '90+', label: 'Premium Tools', color: '#F47A20' },
    { icon: Zap, value: 'All-in-one', label: 'Subscription', color: '#F47A20' },
    { icon: HeadphonesIcon, value: '24/7', label: 'Support', color: '#F47A20' },
    { icon: TrendingUp, value: 'Fast', label: 'Easy Access', color: '#F47A20' }
  ];
  
  return (
    <div className="text-white">
      {/* Hero Section - Clean gradient background with improved spacing */}
      <section className="relative pt-28 pb-20 px-4 overflow-hidden">
        {/* Subtle curved accent - reduced opacity */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-[0.08] pointer-events-none">
          <svg viewBox="0 0 500 500" className="w-full h-full">
            <path d="M 0 250 Q 250 100 500 250 L 500 500 L 0 500 Z" fill="url(#gradient)" />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#F47A20', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#D65A12', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
          </svg>
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight" data-testid="hero-heading">
              One Subscription.
              <br />
              <span className="text-toolstack-orange">Unlimited Digital Tools.</span>
            </h1>
            <p className="text-xl text-toolstack-muted mb-8 max-w-2xl mx-auto leading-relaxed" data-testid="hero-subheading">
              Access premium AI, academic, SEO, and productivity tools in one place. No more juggling multiple subscriptions.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link 
                to="/join" 
                className="px-8 py-4 text-lg font-medium text-white bg-gradient-orange rounded-full hover:opacity-90 transition-all hover:scale-105"
                data-testid="hero-get-started-btn"
              >
                Get Started
              </Link>
              <Link 
                to="/tools" 
                className="px-8 py-4 text-lg font-medium text-white border border-toolstack-orange rounded-full hover:bg-toolstack-orange/10 transition-all"
                data-testid="hero-browse-tools-btn"
              >
                Browse Tools
              </Link>
            </div>
            
            <p className="text-sm text-toolstack-muted">
              Instant access • Cancel anytime • 24/7 support
            </p>
          </div>
        </div>
      </section>
      
      {/* Stats Cards Section - Premium Cards with improved padding */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div 
                  key={index}
                  className="bg-toolstack-card border border-toolstack-border rounded-xl p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-toolstack-orange/50 hover:shadow-lg hover:shadow-toolstack-orange/10"
                  data-testid={`stat-card-${index}`}
                >
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-gradient-orange rounded-full flex items-center justify-center">
                      <Icon size={24} className="text-white" />
                    </div>
                  </div>
                  <div className="text-4xl font-extrabold text-toolstack-orange mb-2">{stat.value}</div>
                  <div className="text-toolstack-muted text-sm">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      
      {/* Explore by Category Section - Improved */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Explore by Category
              <div className="w-24 h-1 bg-gradient-orange mx-auto mt-4 rounded-full"></div>
            </h2>
            <p className="text-toolstack-muted max-w-2xl mx-auto text-lg leading-relaxed">
              Discover tools across various categories designed to boost your productivity and creativity.
            </p>
          </div>
          
          {/* Category Pills - Improved styling */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeCategory === category
                    ? 'bg-gradient-orange text-white shadow-lg shadow-toolstack-orange/25'
                    : 'border border-toolstack-border text-toolstack-muted hover:border-toolstack-orange hover:text-white bg-toolstack-card/50'
                }`}
                data-testid={`category-${category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category}
              </button>
            ))}
          </div>
          
          {/* Category Preview Content - Smooth transitions */}
          <div className="mb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryPreviewTools.map((tool, index) => (
                <div 
                  key={tool.id} 
                  className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 hover:border-toolstack-orange transition-all duration-300 hover:-translate-y-1 hover:shadow-lg min-h-[200px] flex flex-col"
                  style={{
                    animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`
                  }}
                  data-testid={`preview-tool-card-${tool.id}`}
                >
                  <div className="text-4xl mb-4">{tool.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{tool.name}</h3>
                  <p className="text-toolstack-muted text-sm mb-4 line-clamp-2 flex-grow">{tool.description}</p>
                  <span className="inline-block px-3 py-1 bg-toolstack-orange/20 text-toolstack-orange text-xs rounded-full self-start">
                    {tool.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-center">
            <Link 
              to="/tools" 
              className="inline-block px-8 py-3 text-toolstack-orange border border-toolstack-orange rounded-full hover:bg-toolstack-orange/10 transition-all font-medium"
              data-testid="view-all-tools-btn"
            >
              View All {toolsData.length} Tools →
            </Link>
          </div>
        </div>
      </section>
      
      {/* How It Works - Improved visual emphasis */}
      <section className="py-20 px-4 bg-toolstack-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-toolstack-muted max-w-2xl mx-auto text-lg">
              Get started in three simple steps and unlock unlimited access to premium tools.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center bg-toolstack-card/50 border border-toolstack-border rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-gradient-orange rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-lg shadow-toolstack-orange/25">
                1
              </div>
              <h3 className="text-xl font-semibold mb-3">Choose a Plan</h3>
              <p className="text-toolstack-muted leading-relaxed">
                Select the subscription plan that fits your needs. All plans include access to our full tool library.
              </p>
            </div>
            
            <div className="text-center bg-toolstack-card/50 border border-toolstack-border rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-gradient-orange rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-lg shadow-toolstack-orange/25">
                2
              </div>
              <h3 className="text-xl font-semibold mb-3">Create Account</h3>
              <p className="text-toolstack-muted leading-relaxed">
                Sign up with your email and set up your account in less than a minute. No credit card required for trial.
              </p>
            </div>
            
            <div className="text-center bg-toolstack-card/50 border border-toolstack-border rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-gradient-orange rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-lg shadow-toolstack-orange/25">
                3
              </div>
              <h3 className="text-xl font-semibold mb-3">Start Using Tools</h3>
              <p className="text-toolstack-muted leading-relaxed">
                Instantly access all premium tools from your dashboard. Start boosting your productivity right away.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Pricing Preview */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-toolstack-muted max-w-2xl mx-auto mb-8 text-lg">
              Choose the plan that's right for you. All plans include full access to our tool library.
            </p>
            
            {/* Billing Toggle */}
            <div className="inline-flex items-center bg-toolstack-card border border-toolstack-border rounded-full p-1">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  billingPeriod === 'monthly' ? 'bg-gradient-orange text-white' : 'text-toolstack-muted'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  billingPeriod === 'yearly' ? 'bg-gradient-orange text-white' : 'text-toolstack-muted'
                }`}
              >
                Yearly <span className="text-toolstack-orange ml-1">(Save 20%)</span>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Starter Plan */}
            <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-lg">
              <h3 className="text-xl font-semibold mb-2">Starter</h3>
              <p className="text-toolstack-muted mb-6">Perfect for individuals</p>
              <div className="mb-6">
                <div className="text-3xl font-bold text-toolstack-orange">Launching Soon</div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle2 className="text-toolstack-orange mr-2 mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm">Access to 30+ tools</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="text-toolstack-orange mr-2 mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm">Email support</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="text-toolstack-orange mr-2 mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm">Basic features</span>
                </li>
              </ul>
              <Link to="/join" className="block w-full py-3 text-center border border-toolstack-orange text-toolstack-orange rounded-full hover:bg-toolstack-orange/10 transition-colors">
                Join Waitlist
              </Link>
            </div>
            
            {/* Pro Plan - Featured */}
            <div className="bg-toolstack-card border-2 border-toolstack-orange rounded-2xl p-8 relative transition-all hover:-translate-y-1 shadow-xl shadow-toolstack-orange/20 hover:shadow-2xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-orange rounded-full text-xs font-medium">
                Most Popular
              </div>
              <h3 className="text-xl font-semibold mb-2">Pro</h3>
              <p className="text-toolstack-muted mb-6">For professionals</p>
              <div className="mb-6">
                <div className="text-3xl font-bold text-toolstack-orange">Launching Soon</div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle2 className="text-toolstack-orange mr-2 mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm">Access to 90+ tools</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="text-toolstack-orange mr-2 mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm">Priority support</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="text-toolstack-orange mr-2 mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm">All premium features</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="text-toolstack-orange mr-2 mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm">Advanced analytics</span>
                </li>
              </ul>
              <Link to="/join" className="block w-full py-3 text-center bg-gradient-orange text-white rounded-full hover:opacity-90 transition-opacity">
                Join Waitlist
              </Link>
            </div>
            
            {/* Business Plan */}
            <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-lg">
              <h3 className="text-xl font-semibold mb-2">Business</h3>
              <p className="text-toolstack-muted mb-6">For teams & enterprises</p>
              <div className="mb-6">
                <div className="text-3xl font-bold text-toolstack-orange">Contact Sales</div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle2 className="text-toolstack-orange mr-2 mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm">Unlimited tools access</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="text-toolstack-orange mr-2 mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm">24/7 priority support</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="text-toolstack-orange mr-2 mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm">Team management</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="text-toolstack-orange mr-2 mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm">Custom integrations</span>
                </li>
              </ul>
              <a 
                href={`https://wa.me/1234567890?text=${encodeURIComponent("Hi ToolStack! I'm interested in the Business plan.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 text-center border border-toolstack-orange text-toolstack-orange rounded-full hover:bg-toolstack-orange/10 transition-colors"
              >
                Contact Us
              </a>
            </div>
          </div>
          
          <div className="text-center">
            <Link to="/pricing" className="text-toolstack-orange hover:underline font-medium">
              View Full Pricing Details →
            </Link>
          </div>
        </div>
      </section>
      
      {/* Testimonials - Equal heights */}
      <section className="py-20 px-4 bg-toolstack-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted by Professionals</h2>
            <p className="text-toolstack-muted max-w-2xl mx-auto text-lg">
              See what our users have to say about their experience with ToolStack.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 transition-all hover:-translate-y-1 flex flex-col min-h-[240px]">
              <div className="text-toolstack-orange mb-4">★★★★★</div>
              <p className="text-toolstack-muted mb-4 leading-relaxed flex-grow">
                "ToolStack has completely transformed how I work. Having all my essential tools in one subscription saves me time and money."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-orange rounded-full flex items-center justify-center font-bold mr-3">
                  SJ
                </div>
                <div>
                  <div className="font-semibold">Sarah Johnson</div>
                  <div className="text-sm text-toolstack-muted">Content Creator</div>
                </div>
              </div>
            </div>
            
            <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 transition-all hover:-translate-y-1 flex flex-col min-h-[240px]">
              <div className="text-toolstack-orange mb-4">★★★★★</div>
              <p className="text-toolstack-muted mb-4 leading-relaxed flex-grow">
                "As a researcher, I need access to multiple academic tools. ToolStack makes it incredibly easy and affordable."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-orange rounded-full flex items-center justify-center font-bold mr-3">
                  MC
                </div>
                <div>
                  <div className="font-semibold">Dr. Michael Chen</div>
                  <div className="text-sm text-toolstack-muted">Research Scientist</div>
                </div>
              </div>
            </div>
            
            <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 transition-all hover:-translate-y-1 flex flex-col min-h-[240px]">
              <div className="text-toolstack-orange mb-4">★★★★★</div>
              <p className="text-toolstack-muted mb-4 leading-relaxed flex-grow">
                "The variety of tools available is amazing. I can handle everything from design to SEO without switching platforms."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-orange rounded-full flex items-center justify-center font-bold mr-3">
                  EP
                </div>
                <div>
                  <div className="font-semibold">Emma Patel</div>
                  <div className="text-sm text-toolstack-muted">Digital Marketer</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* FAQ */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-toolstack-muted text-lg">
              Got questions? We've got answers.
            </p>
          </div>
          
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="bg-toolstack-card border border-toolstack-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                What is ToolStack?
              </AccordionTrigger>
              <AccordionContent className="text-toolstack-muted">
                ToolStack is a comprehensive subscription platform that gives you access to 90+ premium digital tools including AI, academic, SEO, graphics, and productivity tools – all in one affordable subscription.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2" className="bg-toolstack-card border border-toolstack-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                How does the subscription work?
              </AccordionTrigger>
              <AccordionContent className="text-toolstack-muted">
                Once you subscribe to a plan, you get instant access to all tools included in that tier. You can use them unlimited times throughout your subscription period. Cancel anytime with no penalties.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3" className="bg-toolstack-card border border-toolstack-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Can I switch plans later?
              </AccordionTrigger>
              <AccordionContent className="text-toolstack-muted">
                Yes! You can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4" className="bg-toolstack-card border border-toolstack-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Is there a free trial?
              </AccordionTrigger>
              <AccordionContent className="text-toolstack-muted">
                We offer a limited free trial for select tools so you can experience the platform before committing to a subscription. Contact our sales team to learn more.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5" className="bg-toolstack-card border border-toolstack-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                What payment methods do you accept?
              </AccordionTrigger>
              <AccordionContent className="text-toolstack-muted">
                We accept all major credit cards, debit cards, and PayPal. Business plans can also be invoiced.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-6" className="bg-toolstack-card border border-toolstack-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Do you offer refunds?
              </AccordionTrigger>
              <AccordionContent className="text-toolstack-muted">
                Yes, we offer a 7-day money-back guarantee. If you're not satisfied with our service, contact us within 7 days of your purchase for a full refund.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-7" className="bg-toolstack-card border border-toolstack-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Can I use ToolStack for commercial projects?
              </AccordionTrigger>
              <AccordionContent className="text-toolstack-muted">
                Yes! All our plans allow commercial use. The Business plan includes additional features specifically designed for commercial projects and teams.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-8" className="bg-toolstack-card border border-toolstack-border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                How do I get support?
              </AccordionTrigger>
              <AccordionContent className="text-toolstack-muted">
                We provide email support for all plans. Pro and Business plans get priority support with faster response times. Business plans also include 24/7 support.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
      
      {/* Final CTA */}
      <section className="py-20 px-4 bg-gradient-orange">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of professionals who are already boosting their productivity with ToolStack.
          </p>
          <Link 
            to="/join" 
            className="inline-block px-8 py-4 text-lg font-medium bg-white text-toolstack-orange rounded-full hover:bg-gray-100 transition-all hover:scale-105"
            data-testid="final-cta-btn"
          >
            Start Your Journey Today
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
