import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const remoteDevApiOrigin = "https://nghitts.app";

function listLocalModels(modelsDir) {
  if (!fs.existsSync(modelsDir)) {
    return [];
  }

  return fs.readdirSync(modelsDir)
    .filter(file => file.endsWith('.onnx.json'))
    .map(file => file.replace('.onnx.json', ''))
    .filter(name => name.length > 0)
    .sort();
}

async function proxyRemoteApi(pathname, res) {
  const remoteUrl = `${remoteDevApiOrigin}${pathname}`;
  const response = await fetch(remoteUrl);

  if (!response.ok) {
    res.writeHead(response.status, {
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(await response.text());
    return;
  }

  const body = Buffer.from(await response.arrayBuffer());
  res.writeHead(200, {
    'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
    'Content-Length': body.length.toString(),
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': response.headers.get('cache-control') || 'public, max-age=31536000, immutable',
  });
  res.end(body);
}

function serveLocalFile(filePath, fileName, res) {
  let contentType = 'application/octet-stream';
  if (fileName.endsWith('.json')) contentType = 'application/json';
  if (fileName.endsWith('.js')) contentType = 'application/javascript';

  const fileStats = fs.statSync(filePath);
  const fileContent = fs.readFileSync(filePath);

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': fileStats.size.toString(),
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  res.end(fileContent);
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    tailwindcss(), 
    vue(),
    {
      name: 'onnx-wasm-plugin',
      configureServer(server) {
        // Local development API middleware - only active in dev mode
        // This middleware intercepts /api requests and serves from local filesystem
        // In production, requests will pass through to Cloudflare Pages Functions
        server.middlewares.use('/api', async (req, res, next) => {
          const url = req.url || '';
          
          // Handle /api/models endpoint (Vietnamese models in tts-model/vi/)
          if (url === '/models' || url === '/models/') {
            try {
              const modelsDir = path.join(__dirname, 'public', 'tts-model', 'vi');
              const models = listLocalModels(modelsDir);

              if (models.length === 0) {
                await proxyRemoteApi('/api/models', res);
                return;
              }

              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ models }));
            } catch (error) {
              console.error('Error listing local models:', error);
              res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: 'Failed to list models', message: error.message }));
            }
            return;
          }

          // Handle /api/piper/[lang]/models - list models for a language (i18n pages)
          const piperModelsMatch = url.match(/^\/piper\/([^/]+)\/models\/?$/);
          if (piperModelsMatch) {
            try {
              const lang = piperModelsMatch[1];
              const modelsDir = path.join(__dirname, 'public', 'tts-model', lang);
              const models = listLocalModels(modelsDir);

              if (models.length === 0) {
                await proxyRemoteApi(`/api/piper/${encodeURIComponent(lang)}/models`, res);
                return;
              }

              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ models }));
            } catch (err) {
              console.error('Error listing piper lang models:', err);
              res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: 'Failed to list models', message: err.message }));
            }
            return;
          }

          // Handle /api/model/piper/[lang]/[name] - serve i18n TTS model file locally or from production fallback
          const piperModelFileMatch = url.match(/^\/model\/piper\/([^/]+)\/(.+)$/);
          if (piperModelFileMatch) {
            try {
              const lang = decodeURIComponent(piperModelFileMatch[1]);
              const rawFileName = piperModelFileMatch[2];
              const fileName = decodeURIComponent(rawFileName);
              const modelsDir = path.join(__dirname, 'public', 'tts-model', lang);
              const filePath = path.join(modelsDir, fileName);
              const resolvedPath = path.resolve(filePath);
              const resolvedDir = path.resolve(modelsDir);

              if (!resolvedPath.startsWith(resolvedDir)) {
                res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Access denied' }));
                return;
              }

              if (!fs.existsSync(filePath)) {
                await proxyRemoteApi(`/api/model/piper/${encodeURIComponent(lang)}/${rawFileName}`, res);
                return;
              }

              serveLocalFile(filePath, fileName, res);
            } catch (error) {
              console.error('Error serving piper model file:', error);
              res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: 'Failed to serve model file', message: error.message }));
            }
            return;
          }

          // Handle /api/model/asr/[model]/[name] - serve ASR model file from public/asr-model/[model]/
          const asrModelMatch = url.match(/^\/model\/asr\/([^/]+)\/([^/]+)\/?$/);
          if (asrModelMatch) {
            try {
              const modelName = decodeURIComponent(asrModelMatch[1]);
              const rawFileName = asrModelMatch[2];
              const modelDir = path.join(__dirname, 'public', 'asr-model', modelName);
              const fileName = decodeURIComponent(rawFileName);
              const filePath = path.join(modelDir, fileName);
              const resolvedPath = path.resolve(filePath);
              const resolvedDir = path.resolve(modelDir);
              if (!resolvedPath.startsWith(resolvedDir)) {
                res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Access denied' }));
                return;
              }
              if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
                await proxyRemoteApi(`/api/model/asr/${encodeURIComponent(modelName)}/${rawFileName}`, res);
                return;
              }
              serveLocalFile(filePath, fileName, res);
            } catch (error) {
              console.error('Error serving ASR model file:', error);
              res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: 'Failed to serve model file', message: error.message }));
            }
            return;
          }

          // Handle /api/model/[name] endpoint (Vietnamese models in tts-model/vi/)
          const modelMatch = url.match(/^\/model\/([^/]+)$/);
          if (modelMatch) {
            try {
              const rawFileName = modelMatch[1];
              const fileName = decodeURIComponent(modelMatch[1]);
              const modelsDir = path.join(__dirname, 'public', 'tts-model', 'vi');
              const filePath = path.join(modelsDir, fileName);

              // Security check: ensure file is within models directory
              const resolvedPath = path.resolve(filePath);
              const resolvedDir = path.resolve(modelsDir);
              if (!resolvedPath.startsWith(resolvedDir)) {
                res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Access denied' }));
                return;
              }

              // Check if file exists
              if (!fs.existsSync(filePath)) {
                await proxyRemoteApi(`/api/model/${rawFileName}`, res);
                return;
              }

              serveLocalFile(filePath, fileName, res);
            } catch (error) {
              console.error('Error serving model file:', error);
              res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: 'Failed to serve model file', message: error.message }));
            }
            return;
          }

          // Handle /api/asr/models - list ASR model folders (public/asr-model/)
          if (url === '/asr/models' || url === '/asr/models/') {
            try {
              const asrModelDir = path.join(__dirname, 'public', 'asr-model');
              if (!fs.existsSync(asrModelDir)) {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ models: [] }));
                return;
              }
              const entries = fs.readdirSync(asrModelDir, { withFileTypes: true });
              const models = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ models }));
            } catch (err) {
              console.error('Error listing ASR models:', err);
              res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: 'Failed to list ASR models', message: err.message }));
            }
            return;
          }

          // If no match, pass through (for production/Cloudflare Pages Functions)
          next();
        });

        server.middlewares.use('/onnx-runtime', (req, res, next) => {
          // Strip ?import parameter from ONNX requests
          if (req.url.includes('?import')) {
            req.url = req.url.replace('?import', '');
          }
          if (req.url.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Access-Control-Allow-Origin', '*');
          }
          next();
        });
        
        // Add caching for model files
        server.middlewares.use('/tts-model', (req, res, next) => {
          // Cache model files for 7 days (604800 seconds)
          res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
          res.setHeader('ETag', `"model-v1"`);
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: { format: "es" },
  build: {
    target: "esnext",
  },
  assetsInclude: ['**/*.wasm'],
  logLevel: "info",
});
