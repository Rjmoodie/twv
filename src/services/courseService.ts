import { supabase } from '@/integrations/supabase/client';

export interface Lesson {
  id: string;
  title: string;
  description: string;
  duration: string;
  videoUrl?: string;
  content: string;
  isCompleted: boolean;
  isLocked: boolean;
  order: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  rating: number;
  students: number;
  duration: string;
  thumbnail: string;
  lessons: Lesson[];
  progress: number;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  price: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseProgress {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  isCompleted: boolean;
  timeSpent: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserCourseProgress {
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  completedLessons: number;
  progress: number;
  timeSpent: number;
  lastAccessed: string;
  certificateEarned: boolean;
}

class CourseService {
  private static instance: CourseService;
  private courses: Course[] = [];
  private userProgress: Map<string, CourseProgress[]> = new Map();

  static getInstance(): CourseService {
    if (!CourseService.instance) {
      CourseService.instance = new CourseService();
    }
    return CourseService.instance;
  }

  // Mock data for development - replace with actual API calls
  private getMockCourses(): Course[] {
    return [
      {
        id: '1',
        title: 'Financial Statement Analysis Mastery',
        description: 'Learn to read and analyze financial statements like a professional investor',
        instructor: 'SomaTech Team',
        rating: 4.8,
        students: 1247,
        duration: '4h 30m',
        thumbnail: '/api/placeholder/300/200',
        progress: 0,
        category: 'Fundamentals',
        level: 'beginner',
        price: 0,
        isPublished: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-15',
        lessons: [
          {
            id: '1-1',
            title: 'Introduction to Financial Statements',
            description: 'Understanding the three main financial statements',
            duration: '15:30',
            content: 'Financial statements are the foundation of financial analysis. In this lesson, we\'ll explore the three main statements: Balance Sheet, Income Statement, and Cash Flow Statement. We\'ll learn how to read each statement and understand what information they provide about a company\'s financial health.',
            isCompleted: false,
            isLocked: false,
            order: 1
          },
          {
            id: '1-2',
            title: 'Reading the Balance Sheet',
            description: 'Assets, liabilities, and equity explained',
            duration: '22:45',
            content: 'The balance sheet shows what a company owns (assets), what it owes (liabilities), and what\'s left over (equity). We\'ll break down each section in detail and learn how to analyze the balance sheet for investment decisions.',
            isCompleted: false,
            isLocked: false,
            order: 2
          },
          {
            id: '1-3',
            title: 'Income Statement Analysis',
            description: 'Revenue, expenses, and profitability metrics',
            duration: '28:15',
            content: 'The income statement shows how much money a company made and spent over a period. We\'ll analyze key profitability ratios and trends to understand a company\'s earning power.',
            isCompleted: false,
            isLocked: false,
            order: 3
          },
          {
            id: '1-4',
            title: 'Cash Flow Statement Deep Dive',
            description: 'Operating, investing, and financing activities',
            duration: '31:20',
            content: 'Cash flow is the lifeblood of any business. We\'ll examine how cash moves through operating, investing, and financing activities to understand a company\'s cash generation ability.',
            isCompleted: false,
            isLocked: false,
            order: 4
          },
          {
            id: '1-5',
            title: 'Financial Ratios and Analysis',
            description: 'Key ratios for investment decisions',
            duration: '35:10',
            content: 'Learn the most important financial ratios used by professional investors to evaluate companies and make investment decisions. We\'ll cover profitability, liquidity, and efficiency ratios.',
            isCompleted: false,
            isLocked: false,
            order: 5
          }
        ]
      },
      {
        id: '2',
        title: 'DCF Modeling & Valuation',
        description: 'Learn advanced techniques for discounted cash flow valuation and intrinsic value calculation',
        instructor: 'SomaTech Team',
        rating: 4.9,
        students: 892,
        duration: '6h 15m',
        thumbnail: '/api/placeholder/300/200',
        progress: 0,
        category: 'Valuation',
        level: 'intermediate',
        price: 0,
        isPublished: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-15',
        lessons: [
          {
            id: '2-1',
            title: 'Introduction to DCF Modeling',
            description: 'Understanding the fundamentals of discounted cash flow',
            duration: '20:00',
            content: 'Learn the core concepts of DCF modeling and why it\'s considered the gold standard for company valuation.',
            isCompleted: false,
            isLocked: false,
            order: 1
          },
          {
            id: '2-2',
            title: 'Building Revenue Projections',
            description: 'Creating realistic revenue forecasts',
            duration: '25:30',
            content: 'Master the art of building revenue projections based on historical trends and market analysis.',
            isCompleted: false,
            isLocked: false,
            order: 2
          },
          {
            id: '2-3',
            title: 'Cost Structure Analysis',
            description: 'Understanding and projecting costs',
            duration: '22:15',
            content: 'Learn how to analyze and project various cost components in your DCF model.',
            isCompleted: false,
            isLocked: false,
            order: 3
          },
          {
            id: '2-4',
            title: 'WACC Calculation',
            description: 'Determining the weighted average cost of capital',
            duration: '18:45',
            content: 'Calculate the weighted average cost of capital (WACC) for your DCF model.',
            isCompleted: false,
            isLocked: false,
            order: 4
          },
          {
            id: '2-5',
            title: 'Terminal Value and Final Valuation',
            description: 'Completing the DCF model',
            duration: '30:20',
            content: 'Learn how to calculate terminal value and arrive at your final company valuation.',
            isCompleted: false,
            isLocked: false,
            order: 5
          }
        ]
      },
      {
        id: '3',
        title: 'Options Trading Strategies',
        description: 'Explore various options trading strategies, risk management, and profit maximization techniques',
        instructor: 'SomaTech Team',
        rating: 4.7,
        students: 1563,
        duration: '5h 45m',
        thumbnail: '/api/placeholder/300/200',
        progress: 0,
        category: 'Trading',
        level: 'advanced',
        price: 0,
        isPublished: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-15',
        lessons: [
          {
            id: '3-1',
            title: 'Options Basics',
            description: 'Understanding calls, puts, and option mechanics',
            duration: '25:00',
            content: 'Learn the fundamentals of options trading including calls, puts, and basic option mechanics.',
            isCompleted: false,
            isLocked: false,
            order: 1
          },
          {
            id: '3-2',
            title: 'Covered Call Strategy',
            description: 'Generating income with covered calls',
            duration: '20:30',
            content: 'Master the covered call strategy for generating income from your stock holdings.',
            isCompleted: false,
            isLocked: false,
            order: 2
          },
          {
            id: '3-3',
            title: 'Protective Put Strategy',
            description: 'Protecting your portfolio with puts',
            duration: '18:15',
            content: 'Learn how to use protective puts to hedge your portfolio against downside risk.',
            isCompleted: false,
            isLocked: false,
            order: 3
          },
          {
            id: '3-4',
            title: 'Straddle and Strangle Strategies',
            description: 'Volatility trading strategies',
            duration: '22:45',
            content: 'Explore straddle and strangle strategies for trading volatility.',
            isCompleted: false,
            isLocked: false,
            order: 4
          },
          {
            id: '3-5',
            title: 'Risk Management in Options',
            description: 'Managing risk in options trading',
            duration: '19:30',
            content: 'Learn essential risk management techniques for options trading.',
            isCompleted: false,
            isLocked: false,
            order: 5
          }
        ]
      },
      {
        id: '4',
        title: 'Real Estate Investment Analysis',
        description: 'A comprehensive guide to analyzing real estate investments, including BRRRR and cash flow models',
        instructor: 'SomaTech Team',
        rating: 4.6,
        students: 743,
        duration: '3h 20m',
        thumbnail: '/api/placeholder/300/200',
        progress: 0,
        category: 'Real Estate',
        level: 'intermediate',
        price: 0,
        isPublished: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-15',
        lessons: [
          {
            id: '4-1',
            title: 'Real Estate Investment Fundamentals',
            description: 'Understanding real estate as an investment',
            duration: '18:00',
            content: 'Learn the fundamentals of real estate investment and why it\'s a popular investment choice.',
            isCompleted: false,
            isLocked: false,
            order: 1
          },
          {
            id: '4-2',
            title: 'Cash Flow Analysis',
            description: 'Analyzing rental property cash flow',
            duration: '25:15',
            content: 'Master cash flow analysis for rental properties including income and expense calculations.',
            isCompleted: false,
            isLocked: false,
            order: 2
          },
          {
            id: '4-3',
            title: 'BRRRR Strategy',
            description: 'Buy, Rehab, Rent, Refinance, Repeat',
            duration: '22:30',
            content: 'Learn the BRRRR strategy for building a real estate portfolio with minimal capital.',
            isCompleted: false,
            isLocked: false,
            order: 3
          },
          {
            id: '4-4',
            title: 'Market Analysis and Due Diligence',
            description: 'Researching real estate markets',
            duration: '20:45',
            content: 'Learn how to analyze real estate markets and conduct proper due diligence.',
            isCompleted: false,
            isLocked: false,
            order: 4
          }
        ]
      }
    ];
  }

  async getCourses(): Promise<Course[]> {
    try {
      // In production, this would fetch from Supabase
      // const { data, error } = await supabase.from('courses').select('*').eq('is_published', true);
      
      // For now, return mock data
      this.courses = this.getMockCourses();
      console.log(`📚 CourseService: Loaded ${this.courses.length} courses from mock data`);
      console.log('📚 CourseService: Course titles:', this.courses.map(c => c.title));
      return this.courses;
    } catch (error) {
      console.error('❌ CourseService: Error fetching courses:', error);
      return this.getMockCourses();
    }
  }

  async getCourseById(courseId: string): Promise<Course | null> {
    try {
      const courses = await this.getCourses();
      return courses.find(course => course.id === courseId) || null;
    } catch (error) {
      console.error('Error fetching course:', error);
      return null;
    }
  }

  async getUserProgress(userId: string): Promise<UserCourseProgress[]> {
    try {
      // In production, this would fetch from Supabase
      // const { data, error } = await supabase
      //   .from('course_progress')
      //   .select('*')
      //   .eq('user_id', userId);

      // Mock progress data
      const mockProgress: UserCourseProgress[] = [
        {
          courseId: '1',
          courseTitle: 'Financial Statement Analysis Mastery',
          totalLessons: 5,
          completedLessons: 1,
          progress: 20,
          timeSpent: 15,
          lastAccessed: '2024-01-15',
          certificateEarned: false
        },
        {
          courseId: '2',
          courseTitle: 'DCF Modeling & Valuation',
          totalLessons: 5,
          completedLessons: 0,
          progress: 0,
          timeSpent: 0,
          lastAccessed: '2024-01-14',
          certificateEarned: false
        },
        {
          courseId: '3',
          courseTitle: 'Options Trading Strategies',
          totalLessons: 5,
          completedLessons: 5,
          progress: 100,
          timeSpent: 345,
          lastAccessed: '2024-01-13',
          certificateEarned: true
        }
      ];

      return mockProgress;
    } catch (error) {
      console.error('Error fetching user progress:', error);
      return [];
    }
  }

  async markLessonComplete(userId: string, courseId: string, lessonId: string): Promise<boolean> {
    try {
      // In production, this would save to Supabase
      // const { error } = await supabase
      //   .from('course_progress')
      //   .upsert({
      //     user_id: userId,
      //     course_id: courseId,
      //     lesson_id: lessonId,
      //     is_completed: true,
      //     completed_at: new Date().toISOString()
      //   });

      // For now, just log the completion
      console.log(`Lesson ${lessonId} marked complete for user ${userId} in course ${courseId}`);
      return true;
    } catch (error) {
      console.error('Error marking lesson complete:', error);
      return false;
    }
  }

  async updateLessonProgress(userId: string, courseId: string, lessonId: string, timeSpent: number): Promise<boolean> {
    try {
      // In production, this would update Supabase
      console.log(`Updated progress for lesson ${lessonId}: ${timeSpent} minutes`);
      return true;
    } catch (error) {
      console.error('Error updating lesson progress:', error);
      return false;
    }
  }

  async getCourseProgress(userId: string, courseId: string): Promise<CourseProgress[]> {
    try {
      // In production, this would fetch from Supabase
      const key = `${userId}-${courseId}`;
      return this.userProgress.get(key) || [];
    } catch (error) {
      console.error('Error fetching course progress:', error);
      return [];
    }
  }

  async searchCourses(query: string, category?: string, level?: string): Promise<Course[]> {
    try {
      const courses = await this.getCourses();
      let filtered = courses;

      if (query) {
        filtered = filtered.filter(course => 
          course.title.toLowerCase().includes(query.toLowerCase()) ||
          course.description.toLowerCase().includes(query.toLowerCase()) ||
          course.instructor.toLowerCase().includes(query.toLowerCase())
        );
      }

      if (category) {
        filtered = filtered.filter(course => course.category === category);
      }

      if (level) {
        filtered = filtered.filter(course => course.level === level);
      }

      return filtered;
    } catch (error) {
      console.error('Error searching courses:', error);
      return [];
    }
  }

  async getCourseCategories(): Promise<string[]> {
    try {
      const courses = await this.getCourses();
      const categories = [...new Set(courses.map(course => course.category))];
      return categories.sort();
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  // Admin course management functions
  async createCourse(courseData: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>): Promise<Course | null> {
    try {
      const newCourse: Course = {
        ...courseData,
        id: `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // In a real implementation, this would save to database
      // For now, we'll add to mock data
      this.courses.push(newCourse);
      
      console.log('📚 Course created:', newCourse.title);
      return newCourse;
    } catch (error) {
      console.error('Error creating course:', error);
      return null;
    }
  }

  async updateCourse(courseId: string, updates: Partial<Course>): Promise<Course | null> {
    try {
      const courseIndex = this.courses.findIndex(c => c.id === courseId);
      if (courseIndex === -1) {
        throw new Error('Course not found');
      }

      this.courses[courseIndex] = {
        ...this.courses[courseIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      console.log('📚 Course updated:', this.courses[courseIndex].title);
      return this.courses[courseIndex];
    } catch (error) {
      console.error('Error updating course:', error);
      return null;
    }
  }

  async deleteCourse(courseId: string): Promise<boolean> {
    try {
      const courseIndex = this.courses.findIndex(c => c.id === courseId);
      if (courseIndex === -1) {
        throw new Error('Course not found');
      }

      const deletedCourse = this.courses.splice(courseIndex, 1)[0];
      console.log('📚 Course deleted:', deletedCourse.title);
      return true;
    } catch (error) {
      console.error('Error deleting course:', error);
      return false;
    }
  }

  async publishCourse(courseId: string): Promise<boolean> {
    try {
      const result = await this.updateCourse(courseId, { isPublished: true });
      return result !== null;
    } catch (error) {
      console.error('Error publishing course:', error);
      return false;
    }
  }

  async unpublishCourse(courseId: string): Promise<boolean> {
    try {
      const result = await this.updateCourse(courseId, { isPublished: false });
      return result !== null;
    } catch (error) {
      console.error('Error unpublishing course:', error);
      return false;
    }
  }

  async getCourseStats(): Promise<{
    totalCourses: number;
    publishedCourses: number;
    draftCourses: number;
    totalStudents: number;
    averageRating: number;
  }> {
    try {
      const courses = await this.getCourses();
      const totalCourses = courses.length;
      const publishedCourses = courses.filter(c => c.isPublished).length;
      const draftCourses = totalCourses - publishedCourses;
      const totalStudents = courses.reduce((sum, c) => sum + c.students, 0);
      const averageRating = courses.length > 0 
        ? courses.reduce((sum, c) => sum + c.rating, 0) / courses.length 
        : 0;

      return {
        totalCourses,
        publishedCourses,
        draftCourses,
        totalStudents,
        averageRating: Math.round(averageRating * 10) / 10
      };
    } catch (error) {
      console.error('Error getting course stats:', error);
      return {
        totalCourses: 0,
        publishedCourses: 0,
        draftCourses: 0,
        totalStudents: 0,
        averageRating: 0
      };
    }
  }
}

export const courseService = CourseService.getInstance();
