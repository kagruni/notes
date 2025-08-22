#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const LIBRARIES_JSON_URL = 'https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries.json';
const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'excalidraw-libraries');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper function to download a file
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    // Validate URL
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }
    
    // Handle both http and https URLs
    const protocol = url.startsWith('https:') ? https : require('http');
    
    const file = fs.createWriteStream(outputPath);
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirects
        file.close();
        fs.unlinkSync(outputPath); // Clean up empty file
        downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
      } else {
        file.close();
        fs.unlinkSync(outputPath); // Clean up empty file
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage} for ${url}`));
      }
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath); // Clean up empty file
      }
      reject(new Error(`Download failed for ${url}: ${err.message}`));
    });
    
    request.setTimeout(30000, () => {
      request.abort();
      file.close();
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

// Helper function to get JSON from URL
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Convert relative library source to full URL
function getLibraryUrl(source) {
  // If it's already a full URL, return as is
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return source;
  }
  
  // Convert relative path to GitHub raw URL
  return `${GITHUB_BASE_URL}/${source}`;
}

// Generate a safe filename from library name
function generateFilename(library) {
  const safeName = library.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim('-'); // Remove leading/trailing hyphens
  
  return `${safeName}.excalidrawlib`;
}

async function downloadAllLibraries() {
  try {
    console.log('🔍 Fetching library list...');
    const libraries = await fetchJSON(LIBRARIES_JSON_URL);
    
    console.log(`📚 Found ${libraries.length} libraries to download`);
    
    const downloadedLibraries = [];
    const failed = [];
    
    // Download libraries in batches to avoid overwhelming servers
    const batchSize = 5;
    for (let i = 0; i < libraries.length; i += batchSize) {
      const batch = libraries.slice(i, i + batchSize);
      
      console.log(`\n📦 Downloading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(libraries.length / batchSize)}...`);
      
      await Promise.all(batch.map(async (library) => {
        const filename = generateFilename(library);
        const outputPath = path.join(OUTPUT_DIR, filename);
        const fullUrl = getLibraryUrl(library.source);
        
        try {
          console.log(`  ⬇️  ${library.name} -> ${filename}`);
          await downloadFile(fullUrl, outputPath);
          
          // Verify the downloaded file
          const stats = fs.statSync(outputPath);
          if (stats.size === 0) {
            throw new Error('Downloaded file is empty');
          }
          
          downloadedLibraries.push({
            ...library,
            filename,
            downloadedAt: new Date().toISOString(),
            fileSize: stats.size
          });
          
          console.log(`  ✅ ${library.name} (${Math.round(stats.size / 1024)}KB)`);
        } catch (err) {
          console.error(`  ❌ Failed to download ${library.name}: ${err.message}`);
          failed.push({
            library: library.name,
            error: err.message,
            source: library.source,
            fullUrl: fullUrl
          });
          
          // Clean up failed download
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        }
      }));
      
      // Small delay between batches
      if (i + batchSize < libraries.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Create master index file
    const indexData = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      totalLibraries: downloadedLibraries.length,
      libraries: downloadedLibraries,
      failed: failed
    };
    
    const indexPath = path.join(OUTPUT_DIR, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
    
    console.log(`\n🎉 Download complete!`);
    console.log(`✅ Successfully downloaded: ${downloadedLibraries.length} libraries`);
    console.log(`❌ Failed downloads: ${failed.length} libraries`);
    console.log(`📁 Libraries saved to: ${OUTPUT_DIR}`);
    console.log(`📋 Index file created: ${indexPath}`);
    
    if (failed.length > 0) {
      console.log('\n❌ Failed downloads:');
      failed.forEach(f => {
        console.log(`  - ${f.library}: ${f.error}`);
      });
    }
    
    // Calculate total size
    const totalSize = downloadedLibraries.reduce((sum, lib) => sum + lib.fileSize, 0);
    console.log(`📊 Total size: ${Math.round(totalSize / 1024 / 1024 * 100) / 100}MB`);
    
  } catch (error) {
    console.error('💥 Error downloading libraries:', error.message);
    process.exit(1);
  }
}

// Run the download
if (require.main === module) {
  downloadAllLibraries();
}

module.exports = { downloadAllLibraries };