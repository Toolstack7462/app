import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';

const Pricing = () => {
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  
  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for individuals getting started',
      price: 'Coming Soon',
      features: [
        { text: 'Access to 30+ tools', included: true },
        { text: 'Email support', included: true },
        { text: 'Basic features', included: true },
        { text: 'Standard analytics', included: true },
        { text: 'Priority support', included: false },
        { text: 'Team management', included: false },
        { text: 'Custom integrations', included: false }
      ],
      cta: 'Join Waitlist',
      ctaLink: '/join',
      highlighted: false
    },
    {
      name: 'Pro',
      description: 'Best for professionals and power users',
      price: 'Coming Soon',
      features: [
        { text: 'Access to 90+ tools', included: true },
        { text: 'Priority support', included: true },
        { text: 'All premium features', included: true },
        { text: 'Advanced analytics', included: true },
        { text: 'API access', included: true },
        { text: 'Team management', included: false },
        { text: 'Custom integrations', included: false }
      ],
      cta: 'Join Waitlist',
      ctaLink: '/join',
      highlighted: true
    },
    {
      name: 'Business',
      description: 'For teams and enterprises',
      price: 'Contact Sales',
      features: [
        { text: 'Unlimited tools access', included: true },
        { text: '24/7 priority support', included: true },
        { text: 'All premium features', included: true },
        { text: 'Advanced analytics', included: true },
        { text: 'API access', included: true },
        { text: 'Team management', included: true },
        { text: 'Custom integrations', included: true }
      ],
      cta: 'Contact Sales',
      ctaLink: '/contact',
      highlighted: false
    }
  ];
  
  return (
    <div className="text-white min-h-screen pt-24 pb-16 px-4">{/* Removed bg-toolstack-bg */}
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="pricing-page-heading">Simple, Transparent Pricing</h1>
          <p className="text-toolstack-muted text-lg max-w-2xl mx-auto mb-8">
            Choose the plan that fits your needs. All plans include access to our premium tool library.
          </p>
          
          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-toolstack-card border border-toolstack-border rounded-full p-1">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingPeriod === 'monthly' ? 'bg-gradient-orange text-white' : 'text-toolstack-muted'
              }`}
              data-testid="billing-monthly"
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingPeriod === 'yearly' ? 'bg-gradient-orange text-white' : 'text-toolstack-muted'
              }`}
              data-testid="billing-yearly"
            >
              Yearly <span className="text-toolstack-orange ml-1">(Save 20%)</span>
            </button>
          </div>
        </div>
        
        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <div 
              key={index}
              className={`rounded-2xl p-8 relative ${
                plan.highlighted 
                  ? 'bg-toolstack-card border-2 border-toolstack-orange' 
                  : 'bg-toolstack-card border border-toolstack-border'
              }`}
              data-testid={`pricing-plan-${plan.name.toLowerCase()}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-orange rounded-full text-xs font-medium">
                  Most Popular
                </div>
              )}
              
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <p className="text-toolstack-muted mb-6">{plan.description}</p>
              
              <div className="mb-8">
                <div className="text-3xl font-bold text-toolstack-orange">{plan.price}</div>
              </div>
              
              <Link 
                to={plan.ctaLink}
                className={`block w-full py-3 text-center rounded-full font-medium mb-8 transition-all ${
                  plan.highlighted
                    ? 'bg-gradient-orange text-white hover:opacity-90'
                    : 'border border-toolstack-orange text-toolstack-orange hover:bg-toolstack-orange/10'
                }`}
                data-testid={`pricing-cta-${plan.name.toLowerCase()}`}
              >
                {plan.cta}
              </Link>
              
              <ul className="space-y-3">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    {feature.included ? (
                      <CheckCircle2 className="text-toolstack-orange mr-2 mt-0.5 flex-shrink-0" size={20} />
                    ) : (
                      <X className="text-toolstack-muted mr-2 mt-0.5 flex-shrink-0" size={20} />
                    )}
                    <span className={feature.included ? 'text-white' : 'text-toolstack-muted'}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        {/* Feature Comparison Table */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Compare Plans</h2>
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-toolstack-border">
                    <th className="text-left p-6 font-semibold">Features</th>
                    <th className="text-center p-6 font-semibold">Starter</th>
                    <th className="text-center p-6 font-semibold text-toolstack-orange">Pro</th>
                    <th className="text-center p-6 font-semibold">Business</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-toolstack-border">
                    <td className="p-6 text-toolstack-muted">Number of Tools</td>
                    <td className="text-center p-6">30+</td>
                    <td className="text-center p-6 text-toolstack-orange">90+</td>
                    <td className="text-center p-6">Unlimited</td>
                  </tr>
                  <tr className="border-b border-toolstack-border">
                    <td className="p-6 text-toolstack-muted">Support</td>
                    <td className="text-center p-6">Email</td>
                    <td className="text-center p-6 text-toolstack-orange">Priority</td>
                    <td className="text-center p-6">24/7 Priority</td>
                  </tr>
                  <tr className="border-b border-toolstack-border">
                    <td className="p-6 text-toolstack-muted">API Access</td>
                    <td className="text-center p-6">–</td>
                    <td className="text-center p-6 text-toolstack-orange">✓</td>
                    <td className="text-center p-6">✓</td>
                  </tr>
                  <tr className="border-b border-toolstack-border">
                    <td className="p-6 text-toolstack-muted">Team Management</td>
                    <td className="text-center p-6">–</td>
                    <td className="text-center p-6 text-toolstack-orange">–</td>
                    <td className="text-center p-6">✓</td>
                  </tr>
                  <tr>
                    <td className="p-6 text-toolstack-muted">Custom Integrations</td>
                    <td className="text-center p-6">–</td>
                    <td className="text-center p-6 text-toolstack-orange">–</td>
                    <td className="text-center p-6">✓</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Pricing FAQs</h2>
          <div className="space-y-6">
            <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6">
              <h3 className="font-semibold mb-2">Can I change my plan later?</h3>
              <p className="text-toolstack-muted text-sm">
                Yes, you can upgrade or downgrade your plan at any time. Changes will take effect in your next billing cycle.
              </p>
            </div>
            <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6">
              <h3 className="font-semibold mb-2">Do you offer a free trial?</h3>
              <p className="text-toolstack-muted text-sm">
                We offer a limited free trial for select tools. Contact our sales team to learn more about trial options.
              </p>
            </div>
            <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6">
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-toolstack-muted text-sm">
                We accept all major credit cards, debit cards, and PayPal. Business plans can also be invoiced.
              </p>
            </div>
            <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6">
              <h3 className="font-semibold mb-2">Is there a money-back guarantee?</h3>
              <p className="text-toolstack-muted text-sm">
                Yes, we offer a 7-day money-back guarantee. If you're not satisfied, contact us for a full refund.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
