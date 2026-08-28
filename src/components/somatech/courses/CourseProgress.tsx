import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  Clock, 
  CheckCircle, 
  Award, 
  TrendingUp,
  Calendar,
  Target
} from 'lucide-react';

interface CourseProgress {
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  completedLessons: number;
  progress: number;
  timeSpent: number;
  lastAccessed: string;
  certificateEarned: boolean;
}

interface CourseProgressProps {
  userId: string;
}

const CourseProgress: React.FC<CourseProgressProps> = ({ userId }) => {
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock progress data - replace with actual API calls
    const mockProgress: CourseProgress[] = [
      {
        courseId: '1',
        courseTitle: 'Financial Statement Analysis Mastery',
        totalLessons: 5,
        completedLessons: 1,
        progress: 20,
        timeSpent: 15, // minutes
        lastAccessed: '2024-01-15',
        certificateEarned: false
      },
      {
        courseId: '2',
        courseTitle: 'DCF Modeling & Valuation',
        totalLessons: 8,
        completedLessons: 0,
        progress: 0,
        timeSpent: 0,
        lastAccessed: '2024-01-14',
        certificateEarned: false
      },
      {
        courseId: '3',
        courseTitle: 'Options Trading Strategies',
        totalLessons: 6,
        completedLessons: 6,
        progress: 100,
        timeSpent: 345, // minutes
        lastAccessed: '2024-01-13',
        certificateEarned: true
      }
    ];

    setProgress(mockProgress);
    setLoading(false);
  }, [userId]);

  const totalCourses = progress.length;
  const completedCourses = progress.filter(c => c.progress === 100).length;
  const totalTimeSpent = progress.reduce((sum, c) => sum + c.timeSpent, 0);
  const averageProgress = progress.length > 0 
    ? Math.round(progress.reduce((sum, c) => sum + c.progress, 0) / progress.length)
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Courses</p>
                <p className="text-2xl font-bold">{totalCourses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-accent" />
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold">{completedCourses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Avg Progress</p>
                <p className="text-2xl font-bold">{averageProgress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm text-gray-600">Time Spent</p>
                <p className="text-2xl font-bold">{Math.round(totalTimeSpent / 60)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course Progress List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Course Progress</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {progress.map((course) => (
              <div key={course.courseId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{course.courseTitle}</h3>
                    <p className="text-sm text-gray-600">
                      {course.completedLessons} of {course.totalLessons} lessons completed
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {course.certificateEarned && (
                      <Badge variant="secondary" className="bg-accent/10 text-accent">
                        <Award className="h-3 w-3 mr-1" />
                        Certificate
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {course.progress}%
                    </Badge>
                  </div>
                </div>
                
                <Progress value={course.progress} className="h-2 mb-3" />
                
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{course.timeSpent} min</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>Last accessed: {course.lastAccessed}</span>
                    </span>
                  </div>
                  <Button variant="outline" size="sm">
                    Continue Course
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Award className="h-5 w-5" />
            <span>Achievements</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <div className="h-10 w-10 bg-blue-100 rounded-md flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">First Course Started</p>
                <p className="text-sm text-gray-600">Completed your first lesson</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <div className="h-10 w-10 bg-accent/10 rounded-md flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-medium">Course Completed</p>
                <p className="text-sm text-gray-600">Finished your first course</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <div className="h-10 w-10 bg-purple-100 rounded-md flex items-center justify-center">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Certificate Earned</p>
                <p className="text-sm text-gray-600">Received your first certificate</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourseProgress;


