#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Normalize line endings to LF (Unix-style)
 * Fixes #166: Templates shipped with CRLF cause git changes on Linux/WSL
 */
function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Copy a file, normalizing line endings for markdown files
 */
function copyFile(srcPath, destPath) {
  if (srcPath.endsWith('.md')) {
    const content = fs.readFileSync(srcPath, 'utf-8');
    fs.writeFileSync(destPath, normalizeLineEndings(content), 'utf-8');
  } else {
    fs.copyFileSync(srcPath, destPath);
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

// Copy markdown directory
const markdownSrc = path.join(__dirname, '..', 'src', 'markdown');
const markdownDest = path.join(__dirname, '..', 'dist', 'markdown');

if (fs.existsSync(markdownSrc)) {
  copyDir(markdownSrc, markdownDest);
  console.log('✓ Copied markdown files');
}
