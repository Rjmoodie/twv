#!/bin/bash

# Somatech Performance Audit Script
# This script performs a comprehensive performance audit of the application

set -e

echo "🔍 Starting Somatech Performance Audit..."
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "error")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "info")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_status "error" "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version)
print_status "info" "Node.js version: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(npm --version)
print_status "info" "npm version: $NPM_VERSION"

echo ""
print_status "info" "Step 1: Installing dependencies..."
npm install

echo ""
print_status "info" "Step 2: Running linting checks..."
if npm run lint; then
    print_status "success" "Linting passed"
else
    print_status "warning" "Linting issues found - review and fix"
fi

echo ""
print_status "info" "Step 3: Building application..."
BUILD_START=$(date +%s)
if npm run build; then
    BUILD_END=$(date +%s)
    BUILD_TIME=$((BUILD_END - BUILD_START))
    print_status "success" "Build completed in ${BUILD_TIME}s"
else
    print_status "error" "Build failed"
    exit 1
fi

echo ""
print_status "info" "Step 4: Analyzing bundle size..."
if npm run build:analyze; then
    print_status "success" "Bundle analysis completed"
else
    print_status "warning" "Bundle analysis failed - check if script exists"
fi

echo ""
print_status "info" "Step 5: Checking bundle size..."
if [ -d "dist" ]; then
    BUNDLE_SIZE=$(du -sh dist/ | cut -f1)
    print_status "info" "Bundle size: $BUNDLE_SIZE"
    
    # Check if bundle size is reasonable
    BUNDLE_SIZE_KB=$(du -sk dist/ | cut -f1)
    if [ "$BUNDLE_SIZE_KB" -gt 5120 ]; then  # 5MB
        print_status "warning" "Bundle size is large (>5MB) - consider optimization"
    else
        print_status "success" "Bundle size is reasonable"
    fi
else
    print_status "error" "dist directory not found"
fi

echo ""
print_status "info" "Step 6: Checking memory usage..."
MEMORY_USAGE=$(node -e "console.log(Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB')")
print_status "info" "Current memory usage: $MEMORY_USAGE"

echo ""
print_status "info" "Step 7: Running TypeScript checks..."
if npx tsc --noEmit; then
    print_status "success" "TypeScript compilation check passed"
else
    print_status "error" "TypeScript compilation errors found"
fi

echo ""
print_status "info" "Step 8: Checking for security vulnerabilities..."
if npm audit --audit-level=moderate; then
    print_status "success" "No moderate or higher security vulnerabilities found"
else
    print_status "warning" "Security vulnerabilities found - run 'npm audit fix'"
fi

echo ""
print_status "info" "Step 9: Checking outdated dependencies..."
OUTDATED_COUNT=$(npm outdated --depth=0 | wc -l)
if [ "$OUTDATED_COUNT" -eq 0 ]; then
    print_status "success" "All dependencies are up to date"
else
    print_status "warning" "$OUTDATED_COUNT outdated dependencies found"
    npm outdated --depth=0
fi

echo ""
print_status "info" "Step 10: Performance metrics summary..."

# Calculate performance metrics
BUILD_TIME_MINUTES=$(echo "scale=2; $BUILD_TIME / 60" | bc -l 2>/dev/null || echo "N/A")
BUNDLE_SIZE_MB=$(echo "scale=2; $BUNDLE_SIZE_KB / 1024" | bc -l 2>/dev/null || echo "N/A")

echo "📊 Performance Summary:"
echo "======================="
echo "Build Time: ${BUILD_TIME}s (${BUILD_TIME_MINUTES} minutes)"
echo "Bundle Size: $BUNDLE_SIZE ($BUNDLE_SIZE_MB MB)"
echo "Memory Usage: $MEMORY_USAGE"
echo "Node Version: $NODE_VERSION"
echo "npm Version: $NPM_VERSION"

echo ""
print_status "info" "Step 11: Performance recommendations..."

# Performance recommendations based on metrics
if [ "$BUNDLE_SIZE_KB" -gt 5120 ]; then
    echo "🔧 Bundle Optimization Recommendations:"
    echo "   • Implement code splitting for large chunks"
    echo "   • Use dynamic imports for heavy libraries"
    echo "   • Optimize images and assets"
    echo "   • Consider tree shaking unused code"
fi

if [ "$BUILD_TIME" -gt 60 ]; then
    echo "⚡ Build Performance Recommendations:"
    echo "   • Enable build caching"
    echo "   • Use parallel processing"
    echo "   • Optimize TypeScript compilation"
    echo "   • Consider incremental builds"
fi

echo ""
echo "🎯 Next Steps:"
echo "=============="
echo "1. Run 'npm run dev' to start development server"
echo "2. Open browser console and run debug commands:"
echo "   • systemHealthCheck()"
echo "   • supabaseDebug.testConnection()"
echo "   • mapPerformance.logMapEvent('debug_check')"
echo "3. Use Chrome DevTools Lighthouse for detailed performance analysis"
echo "4. Monitor Core Web Vitals in production"

echo ""
print_status "success" "Performance audit completed successfully!"
echo "=========================================="

# Optional: Start development server if requested
if [ "$1" = "--dev" ]; then
    echo ""
    print_status "info" "Starting development server..."
    npm run dev
fi 