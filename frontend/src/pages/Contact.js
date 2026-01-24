import { useState } from 'react';
import { Mail, MessageSquare, MapPin, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../services/api';

const WHATSAPP_NUMBER = '1234567890';
const WHATSAPP_MESSAGE = 'Hi! I have a question about ToolStack.';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      setStatus({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    
    try {
      setSubmitting(true);
      setStatus({ type: '', message: '' });
      
      await api.post('/public/contact', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject: formData.subject,
        message: formData.message
      });
      
      setStatus({ 
        type: 'success', 
        message: 'Thank you for your message! We\'ll get back to you soon.' 
      });
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (error) {
      console.error('Contact form error:', error);
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to send message. Please try again.' 
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear status when user starts typing
    if (status.message) {
      setStatus({ type: '', message: '' });
    }
  };
  
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  
  return (
    <div className="text-white min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="contact-page-heading">Get in Touch</h1>
          <p className="text-toolstack-muted text-lg max-w-2xl mx-auto">
            Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Contact Info Cards */}
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 text-center hover:border-toolstack-orange transition-colors">
            <div className="w-12 h-12 bg-gradient-orange rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Email Us</h3>
            <p className="text-toolstack-muted text-sm mb-2">Our team is here to help</p>
            <a href="mailto:support@toolstack.com" className="text-toolstack-orange hover:underline">
              support@toolstack.com
            </a>
          </div>
          
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 text-center hover:border-toolstack-orange transition-colors">
            <div className="w-12 h-12 bg-gradient-orange rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">WhatsApp</h3>
            <p className="text-toolstack-muted text-sm mb-2">Quick questions? Chat with us</p>
            <a 
              href={whatsappUrl}
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-toolstack-orange hover:underline"
            >
              +{WHATSAPP_NUMBER}
            </a>
          </div>
          
          <div className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 text-center hover:border-toolstack-orange transition-colors">
            <div className="w-12 h-12 bg-gradient-orange rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Visit Us</h3>
            <p className="text-toolstack-muted text-sm mb-2">Come say hello at our office</p>
            <p className="text-toolstack-orange">
              San Francisco, CA
            </p>
          </div>
        </div>
        
        {/* WhatsApp CTA Banner */}
        <div className="mb-12 bg-[#25D366] rounded-2xl p-8 text-center">
          <MessageSquare size={48} className="mx-auto mb-4 text-white" />
          <h2 className="text-2xl font-bold text-white mb-2">Prefer WhatsApp?</h2>
          <p className="text-white/90 mb-6">
            Get instant responses to your questions. Chat with our team now!
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 bg-white text-[#25D366] rounded-full font-medium hover:bg-gray-100 transition-colors"
            data-testid="contact-whatsapp-cta"
          >
            Chat on WhatsApp
          </a>
        </div>
        
        {/* Contact Form */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-toolstack-card border border-toolstack-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-6">Send us a Message</h2>
            
            {/* Status Message */}
            {status.message && (
              <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                status.type === 'success' 
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {status.type === 'success' ? (
                  <CheckCircle size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
                <span>{status.message}</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    Your Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-toolstack-bg border border-toolstack-border rounded-lg text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors disabled:opacity-50"
                    placeholder="John Doe"
                    data-testid="contact-name-input"
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-toolstack-bg border border-toolstack-border rounded-lg text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors disabled:opacity-50"
                    placeholder="john@example.com"
                    data-testid="contact-email-input"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-2">
                    Phone Number <span className="text-toolstack-muted">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-toolstack-bg border border-toolstack-border rounded-lg text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors disabled:opacity-50"
                    placeholder="+1 (555) 000-0000"
                    data-testid="contact-phone-input"
                  />
                </div>
                
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-2">
                    Subject <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-toolstack-bg border border-toolstack-border rounded-lg text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors disabled:opacity-50"
                    placeholder="How can we help?"
                    data-testid="contact-subject-input"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  value={formData.message}
                  onChange={handleChange}
                  disabled={submitting}
                  rows={6}
                  className="w-full px-4 py-3 bg-toolstack-bg border border-toolstack-border rounded-lg text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors resize-none disabled:opacity-50"
                  placeholder="Tell us more about your inquiry..."
                  data-testid="contact-message-input"
                />
              </div>
              
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-gradient-orange text-white rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="contact-submit-btn"
              >
                {submitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Message'
                )}
              </button>
            </form>
          </div>
        </div>
        
        {/* Additional Info */}
        <div className="mt-12 text-center">
          <p className="text-toolstack-muted mb-4">
            Need immediate assistance? Our support team typically responds within 24 hours.
          </p>
          <p className="text-sm text-toolstack-muted">
            For urgent matters, please use our WhatsApp contact above.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Contact;
