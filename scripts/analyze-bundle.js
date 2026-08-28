#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bundle analysis script
function analyzeBundle() {
  console.log('🔍 Analyzing bundle size...\n');

  try {
    if (!process.argv.includes('--no-build')) {
      console.log('📦 Building project...');
      execSync('npm run build', { stdio: 'inherit' });
    } else {
      console.log('📦 Using existing build output...');
    }

    // Read the dist directory
    const distPath = path.join(__dirname, '../dist');
    if (!fs.existsSync(distPath)) {
      console.error('❌ Build output directory not found. Build may have failed.');
      return;
    }

    const walkFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
    });
    const outputFiles = walkFiles(distPath);

    // Get all JS files
    const jsFiles = outputFiles
      .filter(filePath => filePath.endsWith('.js'))
      .map(filePath => {
        const file = path.relative(distPath, filePath);
        const stats = fs.statSync(filePath);
        const sizeInKB = (stats.size / 1024).toFixed(2);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        return {
          name: file,
          size: stats.size,
          sizeKB: parseFloat(sizeInKB),
          sizeMB: parseFloat(sizeInMB)
        };
      })
      .sort((a, b) => b.size - a.size);

    // Get all CSS files
    const cssFiles = outputFiles
      .filter(filePath => filePath.endsWith('.css'))
      .map(filePath => {
        const file = path.relative(distPath, filePath);
        const stats = fs.statSync(filePath);
        const sizeInKB = (stats.size / 1024).toFixed(2);
        
        return {
          name: file,
          size: stats.size,
          sizeKB: parseFloat(sizeInKB)
        };
      })
      .sort((a, b) => b.size - a.size);

    // Calculate totals
    const totalJS = jsFiles.reduce((sum, file) => sum + file.size, 0);
    const totalCSS = cssFiles.reduce((sum, file) => sum + file.size, 0);
    const totalSize = totalJS + totalCSS;

    console.log('📊 Bundle Analysis Results:\n');

    // Display JS files
    console.log('📄 JavaScript Files:');
    console.log('─'.repeat(80));
    jsFiles.forEach((file, index) => {
      const warning = file.sizeMB > 0.5 ? '⚠️  ' : '   ';
      console.log(`${warning}${(index + 1).toString().padStart(2)}. ${file.name.padEnd(50)} ${file.sizeKB} KB (${file.sizeMB} MB)`);
    });

    console.log('\n🎨 CSS Files:');
    console.log('─'.repeat(80));
    cssFiles.forEach((file, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${file.name.padEnd(50)} ${file.sizeKB} KB`);
    });

    console.log('\n📈 Summary:');
    console.log('─'.repeat(80));
    console.log(`Total JavaScript: ${(totalJS / 1024).toFixed(2)} KB (${(totalJS / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`Total CSS: ${(totalCSS / 1024).toFixed(2)} KB (${(totalCSS / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`Total Bundle: ${(totalSize / 1024).toFixed(2)} KB (${(totalSize / (1024 * 1024)).toFixed(2)} MB)`);

    // Performance recommendations
    console.log('\n💡 Performance Recommendations:');
    console.log('─'.repeat(80));

    const largeFiles = jsFiles.filter(file => file.sizeMB > 0.5);
    if (largeFiles.length > 0) {
      console.log('⚠️  Large files detected (>500KB):');
      largeFiles.forEach(file => {
        console.log(`   • ${file.name} (${file.sizeMB} MB) - Consider code splitting or lazy loading`);
      });
    }

    if (totalSize > 2 * 1024 * 1024) { // 2MB
      console.log('⚠️  Total bundle size is large (>2MB) - Consider:');
      console.log('   • Implementing more aggressive code splitting');
      console.log('   • Lazy loading non-critical components');
      console.log('   • Tree shaking unused dependencies');
      console.log('   • Using dynamic imports for heavy libraries');
    }

    if (jsFiles.length > 20) {
      console.log('⚠️  Many JavaScript chunks detected - Consider:');
      console.log('   • Consolidating small chunks');
      console.log('   • Reviewing manual chunk configuration');
    }

    // Check for common optimization opportunities
    console.log('\n🔧 Optimization Opportunities:');
    console.log('─'.repeat(80));
    
    const hasRecharts = jsFiles.some(file => file.name.includes('recharts') || file.name.includes('YAxis'));
    if (hasRecharts) {
      console.log('📊 Recharts detected - Consider lazy loading chart components');
    }

    const hasMapbox = jsFiles.some(file => file.name.includes('mapbox'));
    if (hasMapbox) {
      console.log('🗺️  Mapbox detected - Consider lazy loading map components');
    }

    const hasFramerMotion = jsFiles.some(file => file.name.includes('framer'));
    if (hasFramerMotion) {
      console.log('🎬 Framer Motion detected - Consider lazy loading animations');
    }

    console.log('\n✅ Bundle analysis complete!');

  } catch (error) {
    console.error('❌ Bundle analysis failed:', error.message);
    process.exit(1);
  }
}

// Run the analysis
analyzeBundle();
