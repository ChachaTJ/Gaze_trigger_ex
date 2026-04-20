import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.js'),
            name: 'HeadTracker',
            fileName: (format) => `head-tracker.${format}.js`
        },
        rollupOptions: {
            // Human.js는 외부 의존성으로 처리하거나 번들에 포함
            // 번들에 포함하려면 아래 주석 해제
            // external: ['@vladmandic/human'],
        },
        outDir: 'dist',
        sourcemap: true
    },
    define: {
        'process.env.NODE_ENV': '"production"'
    }
});
