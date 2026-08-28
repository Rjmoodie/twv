import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { courseService, Course, Lesson } from '@/services/courseService';
import { useAuth } from '@/components/somatech/AuthProvider';
import CourseReviews from './CourseReviews';
import CourseDiscussion from './CourseDiscussion';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  Settings, 
  BookOpen, 
  CheckCircle, 
  Clock,
  User,
  Star,
  ArrowLeft,
  ArrowRight,
  Download,
  Share2,
  MessageSquare
} from 'lucide-react';

// Types are now imported from courseService

interface CoursePlayerProps {
  courseId: string;
  onBack: () => void;
}

const CoursePlayer: React.FC<CoursePlayerProps> = ({ courseId, onBack }) => {
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(50);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'lessons' | 'reviews' | 'discussion'>('lessons');

  // Load course data
  useEffect(() => {
    const loadCourse = async () => {
      try {
        setLoading(true);
        const courseData = await courseService.getCourseById(courseId);
        if (courseData) {
          setCourse(courseData);
        }
      } catch (error) {
        console.error('Error loading course:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [courseId, user?.id]);

  const currentLesson = course?.lessons[currentLessonIndex];

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNextLesson = () => {
    if (course && currentLessonIndex < course.lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
      setProgress(0);
    }
  };

  const handlePreviousLesson = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
      setProgress(0);
    }
  };

  const handleLessonComplete = async () => {
    if (course && currentLesson && user?.id) {
      try {
        // Mark lesson as complete in the service
        const success = await courseService.markLessonComplete(user.id, courseId, currentLesson.id);
        
        if (success) {
          // Update local state
          const updatedLessons = course.lessons.map((lesson, index) => 
            index === currentLessonIndex ? { ...lesson, isCompleted: true } : lesson
          );
          setCourse({ ...course, lessons: updatedLessons });
          
          // Auto-advance to next lesson if available
          if (currentLessonIndex < course.lessons.length - 1) {
            setCurrentLessonIndex(currentLessonIndex + 1);
            setProgress(0);
          }
        }
      } catch (error) {
        console.error('Error marking lesson complete:', error);
      }
    }
  };

  const handleProgressUpdate = async (timeSpent: number) => {
    if (currentLesson && user?.id) {
      try {
        await courseService.updateLessonProgress(user.id, courseId, currentLesson.id, timeSpent);
      } catch (error) {
        console.error('Error updating progress:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading course content...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Course Not Found</h3>
          <p className="text-gray-600 mb-4">The requested course could not be found.</p>
          <Button onClick={onBack}>Back to Courses</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              by {course.instructor} • {course.students.toLocaleString()} students
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Course Progress</span>
            <span className="text-sm text-gray-600">{course.progress}% Complete</span>
          </div>
          <Progress value={course.progress} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video bg-muted flex items-center justify-center relative border-b border-border">
                <div className="text-center">
                  <Play className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="text-base font-medium mb-1">{currentLesson?.title}</h3>
                  <p className="text-sm text-muted-foreground">{currentLesson?.duration}</p>
                </div>
                
                {/* Video Controls */}
                <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 rounded-lg p-3">
                  <div className="flex items-center space-x-4">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handlePlayPause}
                      className="text-white hover:bg-white/20"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    
                    <div className="flex-1">
                      <Progress value={progress} className="h-1" />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Volume2 className="h-4 w-4 text-white" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="w-20"
                      />
                    </div>
                    
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lesson Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{currentLesson?.title}</span>
                <Badge variant="secondary">{currentLesson?.duration}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {currentLesson?.description}
              </p>
              <div className="prose dark:prose-invert max-w-none">
                <p>{currentLesson?.content}</p>
              </div>
              
              <div className="flex items-center justify-between mt-6">
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={handlePreviousLesson}
                    disabled={currentLessonIndex === 0}
                  >
                    <SkipBack className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  <Button 
                    onClick={handleNextLesson}
                    disabled={currentLessonIndex === course.lessons.length - 1}
                  >
                    Next
                    <SkipForward className="h-4 w-4 ml-2" />
                  </Button>
                </div>
                
                <Button 
                  onClick={handleLessonComplete}
                  disabled={currentLesson?.isCompleted}
                  className="bg-accent hover:bg-accent"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {currentLesson?.isCompleted ? 'Completed' : 'Mark Complete'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Course Sidebar */}
        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <Button
              variant={activeTab === 'lessons' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('lessons')}
              className="flex-1"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Lessons
            </Button>
            <Button
              variant={activeTab === 'reviews' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('reviews')}
              className="flex-1"
            >
              <Star className="h-4 w-4 mr-2" />
              Reviews
            </Button>
            <Button
              variant={activeTab === 'discussion' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('discussion')}
              className="flex-1"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Discussion
            </Button>
          </div>

          {activeTab === 'lessons' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Course Content</CardTitle>
              </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {course.lessons.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      index === currentLessonIndex
                        ? 'bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => setCurrentLessonIndex(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {lesson.isCompleted ? (
                            <CheckCircle className="h-5 w-5 text-accent" />
                          ) : lesson.isLocked ? (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-blue-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{lesson.title}</p>
                          <p className="text-xs text-gray-500">{lesson.duration}</p>
                        </div>
                      </div>
                      {lesson.isCompleted && (
                        <CheckCircle className="h-4 w-4 text-accent" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          )}

          {activeTab === 'reviews' && (
            <div className="max-h-96 overflow-y-auto">
              <CourseReviews 
                courseId={courseId} 
                courseTitle={course.title} 
              />
            </div>
          )}

          {activeTab === 'discussion' && (
            <div className="max-h-96 overflow-y-auto">
              <CourseDiscussion 
                courseId={courseId} 
                courseTitle={course.title} 
              />
            </div>
          )}

          {/* Course Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Course Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Rating</span>
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  <span className="text-sm font-medium">{course.rating}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Students</span>
                <span className="text-sm font-medium">{course.students.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Duration</span>
                <span className="text-sm font-medium">{course.duration}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Lessons</span>
                <span className="text-sm font-medium">{course.lessons.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CoursePlayer;
