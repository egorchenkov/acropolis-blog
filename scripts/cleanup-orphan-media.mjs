import { readFileSync, readdirSync, unlinkSync, existsSync } from 'fs';
import { join, basename } from 'path';

const BLOG_DIR = 'src/content/blog';
const UPLOADS_DIR = 'public/uploads';

// Collect all image references from blog posts
const referenced = new Set();

function scanDir(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      scanDir(join(dir, entry.name));
    } else if (entry.name.endsWith('.md')) {
      const content = readFileSync(join(dir, entry.name), 'utf-8');
      const matches = content.matchAll(/\/uploads\/([^\s"')>\]]+)/g);
      for (const m of matches) {
        referenced.add(m[1]);
      }
    }
  }
}

scanDir(BLOG_DIR);

// Compare with actual files in uploads
if (!existsSync(UPLOADS_DIR)) {
  console.log('No uploads directory found.');
  process.exit(0);
}

let removed = 0;
for (const file of readdirSync(UPLOADS_DIR)) {
  if (file === '.gitkeep') continue;
  if (!referenced.has(file)) {
    const filePath = join(UPLOADS_DIR, file);
    unlinkSync(filePath);
    removed++;
    console.log(`Removed orphan: ${file}`);
  }
}

if (removed > 0) {
  console.log(`Removed ${removed} orphaned media file(s).`);
} else {
  console.log('No orphaned media files found.');
}
