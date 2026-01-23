import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Tag } from 'lucide-react';
import { getBlogPost, getRelatedPosts } from '../data/blogData';
import { useEffect } from 'react';

const BlogDetail = () => {
  const { slug } = useParams();
  const post = getBlogPost(slug);
  const relatedPosts = getRelatedPosts(slug, 3);
  
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
    
    // Set page title
    if (post) {
      document.title = `${post.title} | ToolStack Blog`;
    }
  }, [post]);
  
  if (!post) {
    return (
      <div className="text-white min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Article Not Found</h1>
          <p className="text-toolstack-muted mb-8">The article you're looking for doesn't exist.</p>
          <Link to="/blog" className="inline-block px-6 py-3 bg-gradient-orange text-white rounded-full hover:opacity-90 transition-opacity">
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="text-white min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link 
          to="/blog" 
          className="inline-flex items-center gap-2 text-toolstack-muted hover:text-toolstack-orange transition-colors mb-8"
          data-testid="back-to-blog"
        >
          <ArrowLeft size={20} />
          <span>Back to Blog</span>
        </Link>
        
        {/* Article Header */}
        <article>
          {/* Category Tag */}
          <div className="mb-4">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-toolstack-orange/20 text-toolstack-orange text-sm rounded-full">
              <Tag size={14} />
              {post.category}
            </span>
          </div>
          
          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight" data-testid="blog-title">
            {post.title}
          </h1>
          
          {/* Meta */}
          <div className="flex items-center gap-6 text-toolstack-muted mb-8 pb-8 border-b border-toolstack-border">
            <div className="flex items-center gap-2">
              <Calendar size={18} />
              <span>{post.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={18} />
              <span>{post.readTime}</span>
            </div>
          </div>
          
          {/* Cover Gradient */}
          <div 
            className="h-64 md:h-96 w-full rounded-2xl mb-12"
            style={{ background: post.coverGradient }}
          ></div>
          
          {/* Article Content */}
          <div 
            className="prose prose-invert prose-lg max-w-none mb-16"
            style={{
              '--tw-prose-body': '#A1A1AA',
              '--tw-prose-headings': '#FFFFFF',
              '--tw-prose-links': '#F47A20',
              '--tw-prose-bold': '#FFFFFF',
              '--tw-prose-quotes': '#A1A1AA'
            }}
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>
        
        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-16 pt-16 border-t border-toolstack-border">
            <h2 className="text-2xl font-bold mb-8">Related Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map(relatedPost => (
                <Link
                  key={relatedPost.slug}
                  to={`/blog/${relatedPost.slug}`}
                  className="group bg-toolstack-card border border-toolstack-border rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-toolstack-orange"
                  data-testid={`related-post-${relatedPost.slug}`}
                >
                  <div 
                    className="h-32 w-full"
                    style={{ background: relatedPost.coverGradient }}
                  ></div>
                  <div className="p-4">
                    <span className="inline-block px-2 py-1 bg-toolstack-orange/20 text-toolstack-orange text-xs rounded-full mb-2">
                      {relatedPost.category}
                    </span>
                    <h3 className="text-sm font-semibold mb-2 line-clamp-2 group-hover:text-toolstack-orange transition-colors">
                      {relatedPost.title}
                    </h3>
                    <div className="text-xs text-toolstack-muted">
                      {relatedPost.readTime}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* CTA Section */}
        <div className="mt-16 bg-gradient-orange rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-3">Get Access to All Tools Mentioned</h3>
          <p className="text-lg mb-6 opacity-90">
            Subscribe to ToolStack and unlock 90+ premium tools with one simple subscription.
          </p>
          <Link 
            to="/join" 
            className="inline-block px-8 py-3 bg-white text-toolstack-orange rounded-full font-medium hover:bg-gray-100 transition-colors"
          >
            Get Started Today
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BlogDetail;
