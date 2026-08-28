import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X, Star, Clock, Users, BookOpen } from 'lucide-react';
import { courseService, Course } from '@/services/courseService';

interface CourseSearchProps {
  onCoursesChange: (courses: Course[]) => void;
  onLoadingChange: (loading: boolean) => void;
}

const CourseSearch: React.FC<CourseSearchProps> = ({ onCoursesChange, onLoadingChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const levels = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' }
  ];

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await courseService.getCourseCategories();
        setCategories(cats);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const searchCourses = async () => {
      try {
        setLoading(true);
        onLoadingChange(true);
        
        const results = await courseService.searchCourses(
          searchQuery,
          selectedCategory === 'all' ? undefined : selectedCategory,
          selectedLevel === 'all' ? undefined : selectedLevel
        );
        
        onCoursesChange(results);
      } catch (error) {
        console.error('Error searching courses:', error);
        onCoursesChange([]);
      } finally {
        setLoading(false);
        onLoadingChange(false);
      }
    };

    const timeoutId = setTimeout(searchCourses, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedCategory, selectedLevel, onCoursesChange, onLoadingChange]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedLevel('all');
  };

  const hasActiveFilters = searchQuery || (selectedCategory !== 'all') || (selectedLevel !== 'all');

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Search className="h-5 w-5" />
          <span>Search & Filter Courses</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search courses, instructors, or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Level</label>
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger>
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {levels.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-600">Active filters:</span>
            {searchQuery && (
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Search className="h-3 w-3" />
                <span>"{searchQuery}"</span>
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setSearchQuery('')}
                />
              </Badge>
            )}
            {selectedCategory !== 'all' && (
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Filter className="h-3 w-3" />
                <span>{selectedCategory}</span>
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setSelectedCategory('all')}
                />
              </Badge>
            )}
            {selectedLevel !== 'all' && (
              <Badge variant="secondary" className="flex items-center space-x-1">
                <BookOpen className="h-3 w-3" />
                <span>{levels.find(l => l.value === selectedLevel)?.label}</span>
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setSelectedLevel('all')}
                />
              </Badge>
            )}
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">Searching courses...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CourseSearch;
