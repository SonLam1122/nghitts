import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

export function devApiMiddleware() {
  return {
    name: "onnx-wasm-plugin",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res, next) => {
        const url = req.url || "";

        // Handle /api/models endpoint (Vietnamese models in tts-model/vi/)
        if (url === "/models" || url === "/models/") {
          try {
            const modelsDir = path.join(
              __dirname,
              "public",
              "tts-model",
              "vi"
            );

            if (!fs.existsSync(modelsDir)) {
              res.writeHead(200, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              });
              res.end(JSON.stringify({ models: [] }));
              return;
            }

            const files = fs.readdirSync(modelsDir);
            const models = files
              .filter((file) => file.endsWith(".onnx.json"))
              .map((file) => file.replace(".onnx.json", ""))
              .filter((name) => name.length > 0)
              .sort();

            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(JSON.stringify({ models }));
          } catch (error) {
            console.error("Error listing local models:", error);
            res.writeHead(500, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(
              JSON.stringify({
                error: "Failed to list models",
                message: error.message,
              })
            );
          }
          return;
        }

        // Handle /api/piper/[lang]/models - list models for a language (i18n pages)
        const piperModelsMatch = url.match(/^\/piper\/([^/]+)\/models\/?$/);
        if (piperModelsMatch) {
          try {
            const lang = piperModelsMatch[1];
            const modelsDir = path.join(__dirname, "public", "tts-model", lang);
            if (!fs.existsSync(modelsDir)) {
              res.writeHead(200, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              });
              res.end(JSON.stringify({ models: [] }));
              return;
            }
            const files = fs.readdirSync(modelsDir);
            const models = files
              .filter((file) => file.endsWith(".onnx.json"))
              .map((file) => file.replace(".onnx.json", ""))
              .filter((name) => name.length > 0)
              .sort();
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(JSON.stringify({ models }));
          } catch (err) {
            console.error("Error listing piper lang models:", err);
            res.writeHead(500, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(
              JSON.stringify({
                error: "Failed to list models",
                message: err.message,
              })
            );
          }
          return;
        }

        // Handle /api/model/[name] endpoint (Vietnamese models in tts-model/vi/)
        const modelMatch = url.match(/^\/model\/(.+)$/);
        if (modelMatch) {
          try {
            const fileName = decodeURIComponent(modelMatch[1]);
            const modelsDir = path.join(
              __dirname,
              "public",
              "tts-model",
              "vi"
            );
            const filePath = path.join(modelsDir, fileName);

            const resolvedPath = path.resolve(filePath);
            const resolvedDir = path.resolve(modelsDir);
            if (!resolvedPath.startsWith(resolvedDir)) {
              res.writeHead(403, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              });
              res.end(JSON.stringify({ error: "Access denied" }));
              return;
            }

            if (!fs.existsSync(filePath)) {
              res.writeHead(404, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              });
              res.end(JSON.stringify({ error: "Model file not found" }));
              return;
            }

            let contentType = "application/octet-stream";
            if (fileName.endsWith(".json")) {
              contentType = "application/json";
            } else if (fileName.endsWith(".onnx")) {
              contentType = "application/octet-stream";
            }

            const fileStats = fs.statSync(filePath);
            const fileContent = fs.readFileSync(filePath);

            res.writeHead(200, {
              "Content-Type": contentType,
              "Content-Length": fileStats.size.toString(),
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=31536000, immutable",
            });
            res.end(fileContent);
          } catch (error) {
            console.error("Error serving model file:", error);
            res.writeHead(500, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(
              JSON.stringify({
                error: "Failed to serve model file",
                message: error.message,
              })
            );
          }
          return;
        }

        // Handle /api/asr/models - list ASR model folders (public/asr-model/)
        if (url === "/asr/models" || url === "/asr/models/") {
          try {
            const asrModelDir = path.join(__dirname, "public", "asr-model");
            if (!fs.existsSync(asrModelDir)) {
              res.writeHead(200, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              });
              res.end(JSON.stringify({ models: [] }));
              return;
            }
            const entries = fs.readdirSync(asrModelDir, {
              withFileTypes: true,
            });
            const models = entries
              .filter((e) => e.isDirectory())
              .map((e) => e.name)
              .sort();
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(JSON.stringify({ models }));
          } catch (err) {
            console.error("Error listing ASR models:", err);
            res.writeHead(500, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(
              JSON.stringify({
                error: "Failed to list ASR models",
                message: err.message,
              })
            );
          }
          return;
        }

        // Handle /api/model/asr/[model]/[name] - serve ASR model file from public/asr-model/[model]/
        const asrModelMatch = url.match(
          /^\/model\/asr\/([^/]+)\/([^/]+)\/?$/
        );
        if (asrModelMatch) {
          try {
            const modelDir = path.join(
              __dirname,
              "public",
              "asr-model",
              asrModelMatch[1]
            );
            const fileName = decodeURIComponent(asrModelMatch[2]);
            const filePath = path.join(modelDir, fileName);
            const resolvedPath = path.resolve(filePath);
            const resolvedDir = path.resolve(modelDir);
            if (!resolvedPath.startsWith(resolvedDir)) {
              res.writeHead(403, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              });
              res.end(JSON.stringify({ error: "Access denied" }));
              return;
            }
            if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
              res.writeHead(404, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              });
              res.end(JSON.stringify({ error: "Model file not found" }));
              return;
            }
            let contentType = "application/octet-stream";
            if (fileName.endsWith(".json")) contentType = "application/json";
            if (fileName.endsWith(".js"))
              contentType = "application/javascript";
            const fileStats = fs.statSync(filePath);
            const fileContent = fs.readFileSync(filePath);
            res.writeHead(200, {
              "Content-Type": contentType,
              "Content-Length": fileStats.size.toString(),
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=31536000, immutable",
            });
            res.end(fileContent);
          } catch (error) {
            console.error("Error serving ASR model file:", error);
            res.writeHead(500, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(
              JSON.stringify({
                error: "Failed to serve model file",
                message: error.message,
              })
            );
          }
          return;
        }

        next();
      });

      server.middlewares.use("/onnx-runtime", (req, res, next) => {
        if (req.url.includes("?import")) {
          req.url = req.url.replace("?import", "");
        }
        if (req.url.endsWith(".mjs")) {
          res.setHeader("Content-Type", "application/javascript");
          res.setHeader("Access-Control-Allow-Origin", "*");
        }
        next();
      });

      server.middlewares.use("/tts-model", (req, res, next) => {
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
        res.setHeader("ETag", '"model-v1"');
        next();
      });
    },
  };
}
