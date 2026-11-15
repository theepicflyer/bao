import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// the server `npm run dev` proxies to; BAO_BACKEND points it elsewhere (another port, say)
	const backend = loadEnv(mode, '.', 'BAO_').BAO_BACKEND || 'http://localhost:8000';

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				// SPA: the backend serves index.html for every client-side route.
				adapter: adapter({ fallback: 'index.html' })
			})
		],
		// warren/web ships TypeScript and .svelte.ts source, which the dev server's dependency pre-bundling can't
		// compile; Vite transforms it like the app's own files instead.
		optimizeDeps: { exclude: ['warren'] },
		server: {
			proxy: {
				'/api': { target: backend, changeOrigin: false },
				'/auth': { target: backend, changeOrigin: false },
				'/mcp': { target: backend, changeOrigin: false },
				'/oauth': { target: backend, changeOrigin: false },
				'/.well-known': { target: backend, changeOrigin: false }
			}
		}
	};
});
