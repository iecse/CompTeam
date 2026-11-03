import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(() => {
  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').pop() ?? 'CompTeam'

  return {
    root: 'site',
    base: `/${repositoryName}/`,
    publicDir: '../public',
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
    plugins: [react()],
  }
})
