import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const useHttps = env.USE_LOCAL_HTTPS === 'true'

  return defineConfig({
    plugins: [
      react(),
      ...(useHttps ? [mkcert()] : [])
    ],

    server: {
      host: '0.0.0.0',
      port: 5173,
      https: useHttps,

      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true
        },
        "/media": {
          target: "http://localhost:3001",
          changeOrigin: true
        },
        "/upload": {
          target: "http://localhost:3001",
          changeOrigin: true
        }
      }
    }
  })
}
