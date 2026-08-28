import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  User, 
  Calendar, 
  ThumbsUp, 
  Reply,
  Pin,
  Filter,
  Search,
  Plus
} from 'lucide-react';
import { useAuth } from '@/components/somatech/AuthProvider';

interface DiscussionPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  title: string;
  content: string;
  isPinned: boolean;
  isResolved: boolean;
  replies: DiscussionReply[];
  likes: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

interface DiscussionReply {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  likes: number;
  createdAt: string;
  isInstructor: boolean;
}

interface CourseDiscussionProps {
  courseId: string;
  courseTitle: string;
}

const CourseDiscussion: React.FC<CourseDiscussionProps> = ({ courseId, courseTitle }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    tags: [] as string[]
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);

  // Mock discussion data
  useEffect(() => {
    const mockPosts: DiscussionPost[] = [
      {
        id: '1',
        userId: 'user1',
        userName: 'Alex Johnson',
        title: 'Question about DCF calculations',
        content: 'I\'m having trouble understanding how to calculate the terminal value in the DCF model. Can someone explain the formula and provide an example?',
        isPinned: true,
        isResolved: false,
        likes: 8,
        createdAt: '2024-01-10',
        updatedAt: '2024-01-10',
        tags: ['DCF', 'Valuation', 'Question'],
        replies: [
          {
            id: '1-1',
            userId: 'instructor1',
            userName: 'SomaTech Instructor',
            content: 'Great question! The terminal value represents the value of the company beyond the explicit forecast period. There are two main methods: Gordon Growth Model and Exit Multiple Method. Let me explain both...',
            likes: 12,
            createdAt: '2024-01-10',
            isInstructor: true
          }
        ]
      },
      {
        id: '2',
        userId: 'user2',
        userName: 'Sarah Chen',
        title: 'Real-world example for financial ratios',
        content: 'Does anyone have a good real-world example of how to apply the P/E ratio in investment decisions? I understand the concept but need practical application.',
        isPinned: false,
        isResolved: true,
        likes: 5,
        createdAt: '2024-01-08',
        updatedAt: '2024-01-09',
        tags: ['Financial Ratios', 'P/E Ratio', 'Example'],
        replies: [
          {
            id: '2-1',
            userId: 'user3',
            userName: 'Mike Rodriguez',
            content: 'I can share an example from my recent analysis of Apple Inc. Their P/E ratio was 28.5, which I compared to the industry average of 22.3...',
            likes: 7,
            createdAt: '2024-01-08',
            isInstructor: false
          }
        ]
      },
      {
        id: '3',
        userId: 'user4',
        userName: 'Emily Davis',
        title: 'Study group for final project',
        content: 'Anyone interested in forming a study group to work on the final DCF project together? We can meet virtually and share ideas.',
        isPinned: false,
        isResolved: false,
        likes: 3,
        createdAt: '2024-01-05',
        updatedAt: '2024-01-05',
        tags: ['Study Group', 'Project', 'Collaboration'],
        replies: []
      }
    ];

    setPosts(mockPosts);
    setLoading(false);
  }, [courseId]);

  const handleSubmitPost = async () => {
    if (!user || !newPost.title || !newPost.content) {
      return;
    }

    setSubmitting(true);
    try {
      const post: DiscussionPost = {
        id: Date.now().toString(),
        userId: user.id,
        userName: user.user_metadata?.full_name || 'Anonymous',
        title: newPost.title,
        content: newPost.content,
        isPinned: false,
        isResolved: false,
        likes: 0,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        tags: newPost.tags,
        replies: []
      };

      setPosts(prev => [post, ...prev]);
      setNewPost({ title: '', content: '', tags: [] });
      setShowNewPost(false);
    } catch (error) {
      console.error('Error submitting post:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = (postId: string) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, likes: post.likes + 1 }
        : post
    ));
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = filterTag === null || post.tags.includes(filterTag);
    return matchesSearch && matchesTag;
  });

  const allTags = [...new Set(posts.flatMap(post => post.tags))];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <MessageSquare className="h-6 w-6" />
            <span>Course Discussion</span>
          </h2>
          <p className="text-muted-foreground">Ask questions and discuss with fellow students</p>
        </div>
        <Button onClick={() => setShowNewPost(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search discussions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant={filterTag === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterTag(null)}
              >
                All Topics
              </Button>
              {allTags.slice(0, 5).map((tag) => (
                <Button
                  key={tag}
                  variant={filterTag === tag ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterTag(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Post Form */}
      {showNewPost && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Discussion Post</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Post Title</label>
              <input
                type="text"
                value={newPost.title}
                onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                placeholder="What's your question or topic?"
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Post Content</label>
              <Textarea
                value={newPost.content}
                onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Describe your question or share your thoughts..."
                rows={4}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowNewPost(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitPost}
                  disabled={submitting || !newPost.title || !newPost.content}
                >
                  {submitting ? 'Posting...' : 'Post Discussion'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discussion Posts */}
      <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No discussions yet</h3>
              <p className="text-muted-foreground mb-4">
                Start the conversation by asking a question or sharing your thoughts!
              </p>
              <Button onClick={() => setShowNewPost(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Post
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredPosts.map((post) => (
            <Card key={post.id} className={post.isPinned ? 'border-border bg-muted/50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-muted rounded-md flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{post.userName}</span>
                        {post.isPinned && (
                          <Badge variant="secondary" className="text-xs">
                            <Pin className="h-3 w-3 mr-1" />
                            Pinned
                          </Badge>
                        )}
                        {post.isResolved && (
                          <Badge variant="secondary" className="text-xs bg-accent/10 text-accent">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{post.createdAt}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
                <p className="text-foreground mb-3">{post.content}</p>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex space-x-2">
                    {post.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(post.id)}
                      className="flex items-center space-x-1 text-muted-foreground hover:text-muted-foreground"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      <span>{post.likes}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center space-x-1 text-muted-foreground hover:text-muted-foreground"
                    >
                      <Reply className="h-4 w-4" />
                      <span>{post.replies.length} replies</span>
                    </Button>
                  </div>
                </div>

                {/* Replies */}
                {post.replies.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <div className="space-y-3">
                      {post.replies.map((reply) => (
                        <div key={reply.id} className="flex items-start space-x-3">
                          <div className="h-8 w-8 bg-muted rounded-md flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-sm">{reply.userName}</span>
                              {reply.isInstructor && (
                                <Badge variant="secondary" className="text-xs">
                                  Instructor
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500">{reply.createdAt}</span>
                            </div>
                            <p className="text-sm text-foreground">{reply.content}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 h-6 px-2 text-xs"
                            >
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              {reply.likes}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default CourseDiscussion;


