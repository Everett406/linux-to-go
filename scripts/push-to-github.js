#!/usr/bin/env node
/**
 * GitHub Push Script
 * Uses GitHub API to push files when git push is unavailable
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN || process.argv[2];
const REPO = 'Everett406/linux-to-go';
const BRANCH = 'main';

if (!TOKEN) {
  console.error('Usage: GITHUB_TOKEN=<token> node push-to-github.js');
  process.exit(1);
}

function apiRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'linux-to-go',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(JSON.stringify(data)) } : {})
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(`GitHub API ${res.statusCode}: ${json.message || body}`));
          }
        } catch (e) {
          reject(new Error(`Invalid JSON: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function getFiles(dir, prefix = '') {
  const files = [];
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;

    const fullPath = path.join(dir, entry);
    const relativePath = prefix ? `${prefix}/${entry}` : entry;
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getFiles(fullPath, relativePath));
    } else {
      files.push({
        path: relativePath,
        content: fs.readFileSync(fullPath, 'base64')
      });
    }
  }

  return files;
}

async function push() {
  console.log('Scanning files...');
  const files = getFiles('D:\\linux-to-go');
  console.log(`Found ${files.length} files`);

  // Get the latest commit SHA
  console.log('Getting branch info...');
  const branchInfo = await apiRequest('GET', `/repos/${REPO}/git/refs/heads/${BRANCH}`);
  const latestCommitSha = branchInfo.object.sha;

  // Get the tree
  console.log('Getting tree...');
  const commit = await apiRequest('GET', `/repos/${REPO}/git/commits/${latestCommitSha}`);
  const baseTreeSha = commit.tree.sha;

  // Create new tree
  console.log('Creating new tree...');
  const treeData = {
    base_tree: baseTreeSha,
    tree: files.map(f => ({
      path: f.path,
      mode: '100644',
      type: 'blob',
      content: Buffer.from(f.content, 'base64').toString('utf-8')
    }))
  };

  const newTree = await apiRequest('POST', `/repos/${REPO}/git/trees`, treeData);

  // Create commit
  console.log('Creating commit...');
  const newCommit = await apiRequest('POST', `/repos/${REPO}/git/commits`, {
    message: 'Initial commit: Linux To Go project files',
    tree: newTree.sha,
    parents: [latestCommitSha]
  });

  // Update branch ref
  console.log('Updating branch...');
  await apiRequest('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, {
    sha: newCommit.sha
  });

  console.log('Done! Pushed to https://github.com/' + REPO);
}

push().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
