/*
 * Build step for the Scania PDI presentation.
 *
 * Reads index.src.html (readable React + JSX source), compiles the JSX to
 * plain JS with Babel, and inlines React + ReactDOM + the compiled app into a
 * single self-contained index.html — no runtime CDN dependency, so the
 * deployed page loads instantly and works offline.
 *
 * Usage:  npm install && npm run build
 */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const root = __dirname;
const srcPath = path.join(root, 'index.src.html');
const outPath = path.join(root, 'index.html');

let html = fs.readFileSync(srcPath, 'utf8');

// Extract the JSX between the babel <script> tags.
const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
if (!m) throw new Error('babel script block not found in index.src.html');

const compiled = babel.transformSync(m[1], {
  presets: [['@babel/preset-react', { runtime: 'classic' }]],
  compact: false,
}).code;

// Resolve React + ReactDOM UMD production builds from node_modules.
// (React's package.json "exports" blocks direct subpath resolution, so we
// locate each package directory via its package.json and join the UMD path.)
const reactDir = path.dirname(require.resolve('react/package.json'));
const reactDomDir = path.dirname(require.resolve('react-dom/package.json'));
const react = fs.readFileSync(
  path.join(reactDir, 'umd', 'react.production.min.js'), 'utf8');
const reactDom = fs.readFileSync(
  path.join(reactDomDir, 'umd', 'react-dom.production.min.js'), 'utf8');

const inlineBlock =
`<script>/* React UMD (production) */
${react}
</script>
<script>/* ReactDOM UMD (production) */
${reactDom}
</script>
<script>/* Presentation app (JSX pre-compiled, no runtime dependencies) */
${compiled}
</script>`;

// Replace the three CDN <script> tags + the babel block with the inline block.
const startIdx = html.indexOf('<script crossorigin src="https://unpkg.com/react@18');
const endIdx = html.indexOf('</script>', html.indexOf('<script type="text/babel"')) + '</script>'.length;
if (startIdx === -1 || endIdx === -1) throw new Error('script region markers not found');

html = html.slice(0, startIdx) + inlineBlock + html.slice(endIdx);
fs.writeFileSync(outPath, html, 'utf8');
console.log('Built self-contained index.html (' + html.length + ' bytes)');
