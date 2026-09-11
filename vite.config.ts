import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { healvoAiPlugin } from './server/aiChat.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Loaded here (server-side config), not exposed to client code — GROQ_API_KEY
  // never gets the VITE_ prefix Vite requires to ship a var to the browser.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), healvoAiPlugin(env)],
  }
})
