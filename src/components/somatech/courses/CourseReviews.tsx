import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Star, 
  ThumbsUp, 
  MessageSquare, 
  User, 
  Calendar,
  Filter,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { useAuth } from '@/components/somatech/AuthProvider';

interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  createdAt: string;
  isVerified: boolean;
}

interface CourseReviewsProps {
  courseId: string;
  courseTitle: string;
}

const CourseReviews: React.FC<CourseReviewsProps> = ({ courseId, courseTitle }) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newReview, setNewReview] = useState({
    rating: 0,
    title: '',
    content: ''
  });
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'rating' | 'helpful'>('newest');
  const [filterRating, setFilterRating] = useState<number | null>(null);

  // Mock reviews data
  useEffect(() => {
    const mockReviews: Review[] = [
      {
        id: '1',
        userId: 'user1',
        userName: 'Alex Johnson',
        rating: 5,
        title: 'Excellent course!',
        content: 'This course completely changed my understanding of financial analysis. The instructor explains complex concepts in a way that\'s easy to understand. Highly recommended!',
        helpful: 12,
        createdAt: '2024-01-10',
        isVerified: true
      },
      {
        id: '2',
        userId: 'user2',
        userName: 'Sarah Chen',
        rating: 4,
        title: 'Great content, could use more examples',
        content: 'The course content is solid and well-structured. I learned a lot about financial statements. Would love to see more real-world examples in the next version.',
        helpful: 8,
        createdAt: '2024-01-08',
        isVerified: true
      },
      {
        id: '3',
        userId: 'user3',
        userName: 'Mike Rodriguez',
        rating: 5,
        title: 'Perfect for beginners',
        content: 'As someone new to financial analysis, this course was exactly what I needed. The step-by-step approach made everything clear.',
        helpful: 15,
        createdAt: '2024-01-05',
        isVerified: false
      },
      {
        id: '4',
        userId: 'user4',
        userName: 'Emily Davis',
        rating: 3,
        title: 'Good but could be better',
        content: 'The course covers the basics well, but I expected more advanced topics. The instructor is knowledgeable but the pace could be faster.',
        helpful: 3,
        createdAt: '2024-01-03',
        isVerified: true
      }
    ];

    setReviews(mockReviews);
    setLoading(false);
  }, [courseId]);

  const handleSubmitReview = async () => {
    if (!user || newReview.rating === 0 || !newReview.title || !newReview.content) {
      return;
    }

    setSubmitting(true);
    try {
      // In production, this would submit to the backend
      const review: Review = {
        id: Date.now().toString(),
        userId: user.id,
        userName: user.user_metadata?.full_name || 'Anonymous',
        rating: newReview.rating,
        title: newReview.title,
        content: newReview.content,
        helpful: 0,
        createdAt: new Date().toISOString().split('T')[0],
        isVerified: true
      };

      setReviews(prev => [review, ...prev]);
      setNewReview({ rating: 0, title: '', content: '' });
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleHelpful = (reviewId: string) => {
    setReviews(prev => prev.map(review => 
      review.id === reviewId 
        ? { ...review, helpful: review.helpful + 1 }
        : review
    ));
  };

  const sortedAndFilteredReviews = reviews
    .filter(review => filterRating === null || review.rating === filterRating)
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest': {
          const ta = new Date(a.createdAt).getTime();
          const tb = new Date(b.createdAt).getTime();
          if (isNaN(ta) || isNaN(tb)) return 0;
          return tb - ta;
        }
        case 'oldest': {
          const ta = new Date(a.createdAt).getTime();
          const tb = new Date(b.createdAt).getTime();
          if (isNaN(ta) || isNaN(tb)) return 0;
          return ta - tb;
        }
        case 'rating':
          return b.rating - a.rating;
        case 'helpful':
          return b.helpful - a.helpful;
        default:
          return 0;
      }
    });

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length,
    percentage: reviews.length > 0 
      ? (reviews.filter(r => r.rating === rating).length / reviews.length) * 100 
      : 0
  }));

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
      {/* Review Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Star className="h-5 w-5" />
            <span>Course Reviews</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Rating Overview */}
            <div>
              <div className="flex items-center space-x-4 mb-4">
                <div className="text-center">
                  <div className="text-4xl font-bold tabular-nums">
                    {averageRating.toFixed(1)}
                  </div>
                  <div className="flex items-center justify-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= Math.round(averageRating)
                            ? 'text-yellow-500 fill-current'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Based on {reviews.length} reviews
                  </div>
                </div>
              </div>

              {/* Rating Distribution */}
              <div className="space-y-2">
                {ratingDistribution.map(({ rating, count, percentage }) => (
                  <div key={rating} className="flex items-center space-x-2">
                    <span className="text-sm w-8">{rating}</span>
                    <Star className="h-3 w-3 text-yellow-500 fill-current" />
                    <Progress value={percentage} className="flex-1 h-2" />
                    <span className="text-sm text-muted-foreground w-8">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Filters and Sort */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Sort by</label>
                <div className="flex space-x-2">
                  {[
                    { value: 'newest', label: 'Newest', icon: SortDesc },
                    { value: 'oldest', label: 'Oldest', icon: SortAsc },
                    { value: 'rating', label: 'Rating', icon: Star },
                    { value: 'helpful', label: 'Helpful', icon: ThumbsUp }
                  ].map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={sortBy === value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSortBy(value as typeof sortBy)}
                      className="flex items-center space-x-1"
                    >
                      <Icon className="h-3 w-3" />
                      <span>{label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Filter by rating</label>
                <div className="flex space-x-2">
                  <Button
                    variant={filterRating === null ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterRating(null)}
                  >
                    All
                  </Button>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <Button
                      key={rating}
                      variant={filterRating === rating ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterRating(rating)}
                      className="flex items-center space-x-1"
                    >
                      <Star className="h-3 w-3" />
                      <span>{rating}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Write Review */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Write a Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rating</label>
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        star <= newReview.rating
                          ? 'text-yellow-500 fill-current'
                          : 'text-muted-foreground/30 hover:text-yellow-400'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Review Title</label>
              <input
                type="text"
                value={newReview.title}
                onChange={(e) => setNewReview(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Summarize your experience"
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Your Review</label>
              <Textarea
                value={newReview.content}
                onChange={(e) => setNewReview(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Share your thoughts about this course..."
                rows={4}
              />
            </div>

            <Button
              onClick={handleSubmitReview}
              disabled={submitting || newReview.rating === 0 || !newReview.title || !newReview.content}
              className="w-full"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Reviews ({sortedAndFilteredReviews.length})
          </h3>
        </div>

        {sortedAndFilteredReviews.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
              <p className="text-muted-foreground">
                Be the first to share your thoughts about this course!
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedAndFilteredReviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-muted rounded-md flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{review.userName}</span>
                        {review.isVerified && (
                          <Badge variant="secondary" className="text-xs">
                            Verified
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3 w-3 ${
                                star <= review.rating
                                  ? 'text-yellow-500 fill-current'
                                  : 'text-muted-foreground/30'
                              }`}
                            />
                          ))}
                        </div>
                        <span>•</span>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{review.createdAt}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className="font-semibold mb-2">{review.title}</h4>
                <p className="text-foreground mb-3">{review.content}</p>

                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleHelpful(review.id)}
                    className="flex items-center space-x-1 text-muted-foreground hover:text-muted-foreground"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    <span>Helpful ({review.helpful})</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default CourseReviews;


