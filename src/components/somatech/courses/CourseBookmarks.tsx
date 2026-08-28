import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, BookOpen, Clock, Users, Star, Play, Trash2 } from 'lucide-react';
import { courseService, type Course } from '@/services/courseService';
import { useAuth } from '@/components/somatech/AuthProvider';

interface CourseBookmarksProps {
  onCourseSelect: (courseId: string) => void;
}

const CourseBookmarks: React.FC<CourseBookmarksProps> = ({ onCourseSelect }) => {
  const { user } = useAuth();
  const [bookmarkedCourses, setBookmarkedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBookmarks = async () => {
      try {
        setLoading(true);
        const bookmarks = localStorage.getItem(`bookmarks_${user?.id}`);
        if (bookmarks) {
          const parsed = JSON.parse(bookmarks);
          const courseIds = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
          const courses = await courseService.getCourses();
          const filtered = courses.filter(course => courseIds.includes(course.id));
          setBookmarkedCourses(filtered);
        }
      } catch (error) {
        console.error('Error loading bookmarks:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      loadBookmarks();
    }
  }, [user?.id]);

  const removeBookmark = async (courseId: string) => {
    try {
      if (user?.id) {
        const bookmarks = localStorage.getItem(`bookmarks_${user.id}`);
        if (bookmarks) {
          const courseIds = JSON.parse(bookmarks);
          const updatedIds = courseIds.filter((id: string) => id !== courseId);
          localStorage.setItem(`bookmarks_${user.id}`, JSON.stringify(updatedIds));
          
          setBookmarkedCourses(prev => prev.filter(course => course.id !== courseId));
        }
      }
    } catch (error) {
      console.error('Error removing bookmark:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Heart className="h-6 w-6 text-destructive" />
          <h2 className="text-xl font-semibold">My Bookmarks</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-muted rounded-t-lg"></div>
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-3 bg-muted rounded mb-4"></div>
                <div className="flex justify-between">
                  <div className="h-3 bg-muted rounded w-16"></div>
                  <div className="h-3 bg-muted rounded w-12"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (bookmarkedCourses.length === 0) {
    return (
      <div className="text-center py-12">
        <Heart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Bookmarked Courses</h3>
        <p className="text-muted-foreground mb-4">
          Start bookmarking courses you want to take later by clicking the heart icon on any course.
        </p>
        <Button onClick={() => onCourseSelect('')}>
          Browse All Courses
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Heart className="h-6 w-6 text-destructive" />
          <h2 className="text-xl font-semibold">My Bookmarks</h2>
          <Badge variant="secondary">{bookmarkedCourses.length}</Badge>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bookmarkedCourses.map((course) => (
          <Card key={course.id} className="hover:shadow-md transition-shadow duration-150">
            <div className="aspect-video bg-muted rounded-t-lg flex items-center justify-center border-b border-border">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg line-clamp-2">{course.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBookmark(course.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {course.description}
              </p>
              
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{course.duration}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span>{course.students.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  <span>{course.rating}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <Badge variant="outline">{course.category}</Badge>
                <Button 
                  size="sm" 
                  onClick={() => onCourseSelect(course.id)}
                  className="flex items-center space-x-1"
                >
                  <Play className="h-4 w-4" />
                  <span>Start Course</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CourseBookmarks;
