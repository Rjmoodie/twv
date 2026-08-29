import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, ThumbsUp, ThumbsDown, Send, Star, Lightbulb, Bug, Heart, TrendingUp, CheckCircle, Clock, X } from "lucide-react";
import { Label } from "@/components/ui/label";

interface Feedback {
  id: string;
  type: 'feedback' | 'feature_request' | 'bug_report' | 'testimonial';
  title: string;
  description: string;
  category: string | null;
  priority: number;
  status: 'submitted' | 'reviewing' | 'planned' | 'in_progress' | 'completed' | 'declined';
  votes_count: number;
  admin_response: string | null;
  created_at: string;
  user_id: string | null;
  user_vote?: 'up' | 'down' | null;
}

const fetchFeedback = async (userId: string | null) => {
  const { data, error } = await supabase
    .from('user_feedback')
    // Left-embed votes: an inner join hides every feedback item that has not
    // received its first vote. user_id is required to identify this viewer's
    // vote without exposing or inferring somebody else's state.
    .select('*, feature_votes(user_id, vote_type)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(item => {
    const userVote = item.feature_votes?.find((vote: any) => vote.user_id === userId);
    return {
      ...item,
      type: item.type as Feedback['type'],
      status: item.status as Feedback['status'],
      user_vote: userVote?.vote_type || null
    };
  });
};

const submitFeedback = async (formData: any) => {
  const { data, error } = await supabase
    .from('user_feedback')
    .insert([formData]);
  if (error) throw error;
  return data;
};

const FeedbackHub = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('view');
  const [filter, setFilter] = useState<'all' | 'feature_request' | 'bug_report' | 'feedback' | 'testimonial'>('all');
  const [formData, setFormData] = useState({
    type: 'feedback' as const,
    title: '',
    description: '',
    category: '',
  });
  const queryClient = useQueryClient();

  const { data: feedback, isLoading, error } = useQuery({
    queryKey: ['user-feedback', user?.id],
    queryFn: () => fetchFeedback(user?.id || null),
    staleTime: 60000
  });

  const mutation = useMutation({
    mutationFn: submitFeedback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-feedback', user?.id] });
      toast({ title: 'Thank you for your feedback!', description: 'We appreciate your input and will review it soon.' });
      setFormData({ type: 'feedback', title: '', description: '', category: '' });
      setSubmitting(false);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to submit feedback', description: error.message, variant: 'destructive' });
      setSubmitting(false);
    }
  });

  const handleSubmit = () => {
    setSubmitting(true);
    mutation.mutate({ ...formData, user_id: user?.id });
  };

  if (isLoading) return <div>Loading feedback...</div>;
  if (error) return <div className="text-destructive">Failed to load feedback</div>;

  const vote = async (feedbackId: string, voteType: 'up' | 'down') => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to vote on feedback",
        variant: "destructive",
      });
      return;
    }

    try {
      const existingFeedback = feedback.find(f => f.id === feedbackId);
      const existingVote = existingFeedback?.user_vote;

      if (existingVote === voteType) {
        // Remove vote
        const { error } = await supabase
          .from('feature_votes')
          .delete()
          .eq('feedback_id', feedbackId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Add or update vote
        const { error } = await supabase
          .from('feature_votes')
          .upsert({
            feedback_id: feedbackId,
            user_id: user.id,
            vote_type: voteType
          });

        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['user-feedback', user?.id] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to vote",
        variant: "destructive",
      });
    }
  };

  const getTypeIcon = (type: Feedback['type']) => {
    switch (type) {
      case 'feature_request':
        return <Lightbulb className="h-4 w-4" />;
      case 'bug_report':
        return <Bug className="h-4 w-4" />;
      case 'testimonial':
        return <Heart className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: Feedback['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary"><TrendingUp className="h-3 w-3 mr-1" />In Progress</Badge>;
      case 'planned':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Planned</Badge>;
      case 'declined':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Declined</Badge>;
      case 'reviewing':
        return <Badge variant="outline">Under Review</Badge>;
      default:
        return <Badge variant="outline">Submitted</Badge>;
    }
  };

  const getFilteredFeedback = () => {
    if (filter === 'all') return feedback;
    return feedback.filter(item => item.type === filter);
  };

  const filteredFeedback = getFilteredFeedback();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feedback Hub</h1>
          <p className="text-muted-foreground">
            Share your thoughts, request features, and help shape TW Ventures
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="view">View Feedback</TabsTrigger>
            <TabsTrigger value="submit">Submit Feedback</TabsTrigger>
          </TabsList>

          {/* View Feedback */}
          <TabsContent value="view" className="space-y-6">
            {/* Filters */}
            <div className="flex gap-2">
              <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Feedback</SelectItem>
                  <SelectItem value="feature_request">Feature Requests</SelectItem>
                  <SelectItem value="bug_report">Bug Reports</SelectItem>
                  <SelectItem value="feedback">General Feedback</SelectItem>
                  <SelectItem value="testimonial">Testimonials</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Feedback List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFeedback.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(item.type)}
                              <h3 className="font-semibold">{item.title}</h3>
                              {getStatusBadge(item.status)}
                            </div>
                            <p className="text-muted-foreground">{item.description}</p>
                            {item.category && (
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Voting */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Button
                                variant={item.user_vote === 'up' ? "default" : "outline"}
                                size="sm"
                                onClick={() => vote(item.id, 'up')}
                                disabled={!user}
                              >
                                <ThumbsUp className="h-3 w-3" />
                              </Button>
                              <span className="text-sm font-medium px-2">
                                {item.votes_count}
                              </span>
                              <Button
                                variant={item.user_vote === 'down' ? "default" : "outline"}
                                size="sm"
                                onClick={() => vote(item.id, 'down')}
                                disabled={!user}
                              >
                                <ThumbsDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {item.admin_response && (
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="text-sm font-medium mb-1">Team Response:</div>
                            <div className="text-sm text-muted-foreground">
                              {item.admin_response}
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                          Submitted {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredFeedback.length === 0 && (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No feedback yet</h3>
                    <p className="text-muted-foreground">
                      Be the first to share your thoughts and suggestions!
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Submit Feedback */}
          <TabsContent value="submit">
            <Card>
              <CardHeader>
                <CardTitle>Submit Feedback</CardTitle>
                <CardDescription>
                  Help us improve TW Ventures by sharing your experience and suggestions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select feedback type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feedback">General Feedback</SelectItem>
                      <SelectItem value="feature_request">Feature Request</SelectItem>
                      <SelectItem value="bug_report">Bug Report</SelectItem>
                      <SelectItem value="testimonial">Testimonial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Brief summary of your feedback"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Detailed description of your feedback"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category (Optional)</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="e.g., Stock Analysis, Dashboard, Real Estate"
                  />
                </div>

                <Button 
                  onClick={handleSubmit} 
                  disabled={submitting || !formData.title || !formData.description}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FeedbackHub;
