import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 侧边栏「YUK 工具箱」：构建产物由平台服务挂在 <LBP_PUBLIC_BASE_URL>/sidebar/ 下。
// 资源路径用相对路径，挂在哪个前缀下都能用；接口地址在运行时按页面地址推出来（见 src/api.ts）。
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5174,
    proxy: { '/api': 'http://127.0.0.1:8100' },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 3000,
  },
});
