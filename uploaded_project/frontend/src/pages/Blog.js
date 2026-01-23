import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Calendar, Clock } from 'lucide-react';
import { blogPosts } from '../data/blogData';

const Blog = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const categories = ['All', 'AI', 'Academic', 'SEO', 'Productivity', 'Career'];
  
  const filteredPosts = blogPosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
  return (
    <div className="text-white min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="blog-page-heading">ToolStack Blog</h1>
          <p className="text-toolstack-muted text-lg max-w-2xl mx-auto">
            Tips, updates, and guides for AI, academic, SEO, and productivity tools.
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-toolstack-muted" size={20} />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-toolstack-card border border-toolstack-border rounded-full text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
              data-testid="blog-search-input"
            />
          </div>
        </div>
        
        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                selectedCategory === category
                  ? 'bg-gradient-orange text-white shadow-lg shadow-toolstack-orange/25'
                  : 'border border-toolstack-border text-toolstack-muted hover:border-toolstack-orange hover:text-white bg-toolstack-card/50'
              }`}
              data-testid={`blog-category-${category.toLowerCase()}`}
            >
              {category}
            </button>
          ))}
        </div>
        
        {/* Blog Posts Grid */}
        {filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map(post => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group bg-toolstack-card border border-toolstack-border rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:border-toolstack-orange hover:shadow-lg"
                data-testid={`blog-post-${post.slug}`}
              >
                {/* Cover Image - Gradient placeholder */}
                <div 
                  className="h-48 w-full"
                  style={{ background: post.coverGradient }}
                ></div>
                
                {/* Content */}
                <div className="p-6">
                  {/* Category Tag */}
                  <span className="inline-block px-3 py-1 bg-toolstack-orange/20 text-toolstack-orange text-xs rounded-full mb-3">
                    {post.category}
                  </span>
                  
                  {/* Title */}
                  <h2 className="text-xl font-bold mb-3 group-hover:text-toolstack-orange transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  
                  {/* Excerpt */}
                  <p className="text-toolstack-muted text-sm mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  
                  {/* Meta */}
                  <div className="flex items-center gap-4 text-xs text-toolstack-muted">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>{post.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{post.readTime}</span>
                    </div>
                  </div>
                  
                  {/* Read More */}
                  <div className="mt-4 text-toolstack-orange font-medium text-sm group-hover:underline">
                    Read More →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-toolstack-muted text-lg mb-4">No articles found matching your criteria.</p>
            <button 
              onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
              className="text-toolstack-orange hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Blog;
