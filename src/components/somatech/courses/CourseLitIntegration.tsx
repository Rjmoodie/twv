import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Play, Clock, Users, Star, Lock, TrendingUp, Heart } from 'lucide-react';
import { useAuth } from '@/components/somatech/AuthProvider';
import { CourseAccessGuard } from './CourseAccessGuard';
import CoursePlayer from './CoursePlayer';
import CourseProgress from './CourseProgress';
import CourseSearch from './CourseSearch';
import CourseBookmarks from './CourseBookmarks';
import { courseService, Course } from '@/services/courseService';

interface CourseLitIntegrationProps {
  className?: string;
}

type ActiveTab = 'courses' | 'progress' | 'bookmarks';

/** Parse "4h 30m", "2h", "45m", "1.5" → decimal hours */
function parseDurationHours(duration: string): number {
  const hoursMatch = duration.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minutesMatch = duration.match(/(\d+)\s*m/i);
  const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
  // Fallback: try treating the whole string as a plain number (hours)
  if (!hoursMatch && !minutesMatch) {
    const plain = parseFloat(duration);
    return isNaN(plain) ? 0 : plain;
  }
  return hours + minutes / 60;
}

const CourseLitIntegration: React.FC<CourseLitIntegrationProps> = ({ className }) => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('courses');
  const [bookmarkedCourses, setBookmarkedCourses] = useState<string[]>([]);

  useEffect(() => {
    const loadCourses = async () => {
      try {
        setLoading(true);
        const coursesData = await courseService.getCourses();
        setCourses(coursesData);
      } catch (error) {
        console.error('Error loading courses:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCourses();
  }, []);

  useEffect(() => {
    if (user?.id) {
      try {
        const bookmarks = localStorage.getItem(`bookmarks_${user.id}`);
        if (bookmarks) setBookmarkedCourses(JSON.parse(bookmarks));
      } catch {
        // ignore malformed localStorage value
      }
    }
  }, [user?.id]);

  const handleCourseClick = (courseId: string) => setSelectedCourseId(courseId);
  const handleBackToCourses = () => setSelectedCourseId(null);

  const toggleBookmark = (courseId: string) => {
    if (!user?.id) return;
    const updated = bookmarkedCourses.includes(courseId)
      ? bookmarkedCourses.filter(id => id !== courseId)
      : [...bookmarkedCourses, courseId];
    setBookmarkedCourses(updated);
    localStorage.setItem(`bookmarks_${user.id}`, JSON.stringify(updated));
  };

  if (selectedCourseId) {
    return <CoursePlayer courseId={selectedCourseId} onBack={handleBackToCourses} />;
  }

  const tabHeader = (title: string, subtitle: string) => (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => setActiveTab('courses')}>
        All Courses
      </Button>
    </div>
  );

  if (activeTab === 'progress') {
    return (
      <div className={`space-y-6 ${className}`}>
        {tabHeader('Learning Progress', 'Track your course progress and completions')}
        <CourseProgress userId={user?.id || ''} />
      </div>
    );
  }

  if (activeTab === 'bookmarks') {
    return (
      <div className={`space-y-6 ${className}`}>
        {tabHeader('Saved Courses', 'Courses you have bookmarked for later')}
        <CourseBookmarks onCourseSelect={handleCourseClick} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Courses</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-muted rounded-t-lg" />
              <CardContent className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded" />
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="flex justify-between mt-2">
                  <div className="h-3 bg-muted rounded w-16" />
                  <div className="h-3 bg-muted rounded w-12" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const avgRating = courses.length > 0
    ? (courses.reduce((sum, c) => sum + c.rating, 0) / courses.length).toFixed(1)
    : '—';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">Courses</h1>
            <p className="text-sm text-muted-foreground">
              Financial analysis and investment curriculum
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Available</p>
          <p className="text-xl font-semibold tabular-nums">{courses.length}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'courses' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('courses')}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          All Courses
        </Button>
        <Button
          variant={activeTab === 'bookmarks' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('bookmarks')}
        >
          <Heart className="h-4 w-4 mr-2" />
          Saved
          {bookmarkedCourses.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1 text-xs">
              {bookmarkedCourses.length}
            </Badge>
          )}
        </Button>
        <Button
          variant={activeTab === 'progress' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('progress')}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Progress
        </Button>
      </div>

      {/* Search — only on courses tab */}
      {activeTab === 'courses' && (
        <CourseSearch
          onCoursesChange={setCourses}
          onLoadingChange={setLoading}
        />
      )}

      {/* Course Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <CourseAccessGuard
            key={course.id}
            fallback={
              <Card className="relative overflow-hidden">
                <div className="h-48 bg-muted flex items-center justify-center">
                  <Lock className="h-10 w-10 text-muted-foreground" />
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">{course.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {course.description}
                  </p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {course.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {course.students.toLocaleString()}
                    </span>
                  </div>
                  <Button className="w-full" variant="outline" disabled>
                    <Lock className="h-4 w-4 mr-2" />
                    Upgrade to Access
                  </Button>
                </CardContent>
              </Card>
            }
          >
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow duration-150"
              onClick={() => handleCourseClick(course.id)}
            >
              <div className="relative h-48 bg-muted flex items-center justify-center border-b border-border">
                <Play className="h-12 w-12 text-muted-foreground" />
                <button
                  className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center rounded-md hover:bg-background/60 transition-colors"
                  onClick={(e) => { e.stopPropagation(); toggleBookmark(course.id); }}
                  aria-label={bookmarkedCourses.includes(course.id) ? 'Remove bookmark' : 'Bookmark course'}
                >
                  <Heart
                    className={`h-4 w-4 ${
                      bookmarkedCourses.includes(course.id)
                        ? 'text-foreground fill-current'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              </div>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {course.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-muted-foreground fill-current" />
                    <span className="text-sm tabular-nums">{course.rating}</span>
                  </div>
                </div>

                <h3 className="font-semibold mb-1 line-clamp-2">{course.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {course.description}
                </p>

                <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {course.duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {course.students.toLocaleString()}
                  </span>
                </div>

                <Button className="w-full" size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Start Course
                </Button>
              </CardContent>
            </Card>
          </CourseAccessGuard>
        ))}
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{courses.length}</p>
              <p className="text-sm text-muted-foreground">Courses</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {courses.reduce((sum, c) => sum + c.students, 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Students</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {courses.reduce((sum, c) => sum + parseDurationHours(c.duration), 0).toFixed(1)}h
              </p>
              <p className="text-sm text-muted-foreground">Content</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{avgRating}</p>
              <p className="text-sm text-muted-foreground">Avg Rating</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourseLitIntegration;
