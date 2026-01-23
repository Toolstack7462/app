import { useState } from 'react';
import { Search } from 'lucide-react';
import { toolsData, categories } from '../data/toolsData';

const Tools = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const filteredTools = toolsData.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
  return (
    <div className="text-white min-h-screen pt-24 pb-16 px-4">{/* Removed bg-toolstack-bg */}
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="tools-page-heading">Browse All Tools</h1>
          <p className="text-toolstack-muted text-lg max-w-2xl mx-auto">
            Explore our comprehensive library of 90+ premium digital tools across all categories.
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-toolstack-muted" size={20} />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-toolstack-card border border-toolstack-border rounded-full text-white placeholder-toolstack-muted focus:outline-none focus:border-toolstack-orange transition-colors"
              data-testid="tools-search-input"
            />
          </div>
        </div>
        
        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === 'All'
                ? 'bg-gradient-orange text-white'
                : 'border border-toolstack-border text-toolstack-muted hover:border-toolstack-orange'
            }`}
            data-testid="category-all"
          >
            All Tools
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-gradient-orange text-white'
                  : 'border border-toolstack-border text-toolstack-muted hover:border-toolstack-orange'
              }`}
              data-testid={`filter-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {category}
            </button>
          ))}
        </div>
        
        {/* Results Count */}
        <div className="mb-6">
          <p className="text-toolstack-muted">
            Showing <span className="text-white font-semibold">{filteredTools.length}</span> tool{filteredTools.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Tools Grid */}
        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTools.map(tool => (
              <div 
                key={tool.id}
                className="bg-toolstack-card border border-toolstack-border rounded-xl p-6 hover:border-toolstack-orange transition-all group"
                data-testid={`tool-${tool.id}`}
              >
                <div className="text-4xl mb-4">{tool.icon}</div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-toolstack-orange transition-colors">{tool.name}</h3>
                <p className="text-toolstack-muted text-sm mb-4">{tool.description}</p>
                <div className="flex items-center justify-between">
                  <span className="inline-block px-3 py-1 bg-toolstack-orange/20 text-toolstack-orange text-xs rounded-full">
                    {tool.category}
                  </span>
                  <button className="text-toolstack-orange hover:underline text-sm font-medium">
                    Learn More →
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-toolstack-muted text-lg mb-4">No tools found matching your criteria.</p>
            <button 
              onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
              className="text-toolstack-orange hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
        
        {/* CTA Banner */}
        <div className="mt-20 bg-gradient-orange rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Access All These Tools?</h2>
          <p className="text-lg mb-6 opacity-90">
            Subscribe now and get instant access to our entire tool library.
          </p>
          <button className="px-8 py-3 bg-white text-toolstack-orange rounded-full font-medium hover:bg-gray-100 transition-colors">
            Request Access
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tools;
