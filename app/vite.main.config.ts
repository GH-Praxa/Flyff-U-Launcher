import { defineConfig } from 'vite';
export default defineConfig({
    build: {
        rollupOptions: {
            external: ['sharp'],
        },
    },
    define: {
        // Baked in at build time from CI secrets — empty string in local dev builds
        'process.env.TELEMETRY_WEBHOOK_URL': JSON.stringify(process.env.TELEMETRY_WEBHOOK_URL ?? ''),
        'process.env.LOGS_WEBHOOK_URL': JSON.stringify(process.env.LOGS_WEBHOOK_URL ?? ''),
    },
});
