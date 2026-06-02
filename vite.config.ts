import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    // Android 模拟器：HMR WebSocket 需要用 Tauri 提供的宿主机 IP
    ...(host && {
      hmr: {
        host,
        clientPort: 5173,
      },
    }),
  },
})
