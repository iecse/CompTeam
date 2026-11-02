import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(() => {
  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').pop() ?? 'CompTeamDemo'

  return {
    base: `/${repositoryName}/`,
    plugins: [react()],
  }
})
