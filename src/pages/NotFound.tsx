import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, ArrowLeft, Search, HelpCircle, RefreshCw } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/somatech');
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate('/somatech');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl mx-auto text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-6">
            <span className="text-foreground font-bold text-2xl tabular-nums">404</span>
          </div>
          <CardTitle className="text-2xl font-semibold text-foreground mb-2">
            Page Not Found
          </CardTitle>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
          {location.pathname && (
            <p className="text-sm text-muted-foreground mt-2">
              Attempted URL: <code className="bg-muted px-2 py-1 rounded text-xs">{location.pathname}</code>
            </p>
          )}
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Button 
              onClick={handleGoBack}
              variant="outline" 
              className="w-full gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
            
            <Button 
              onClick={handleGoHome}
              className="w-full gap-2"
            >
              <Home className="h-4 w-4" />
              Home
            </Button>

            <Button 
              onClick={handleRefresh}
              variant="outline"
              className="w-full gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          
          <div className="pt-4 border-t border-border">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Popular Pages
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <Link 
                to="/somatech?module=dashboard" 
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                Dashboard
              </Link>
              <Link 
                to="/somatech?module=stock-analysis" 
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                Stock Analysis
              </Link>
              <Link 
                to="/somatech?module=business-valuation" 
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                Business Valuation
              </Link>
              <Link 
                to="/somatech?module=real-estate" 
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                Real Estate Calculator
              </Link>
              <Link 
                to="/somatech?module=cash-flow" 
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                Cash Flow Simulator
              </Link>
              <Link 
                to="/somatech?module=retirement-planning" 
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                Retirement Planning
              </Link>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <HelpCircle className="h-4 w-4" />
            <span>Need help? Contact support</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;