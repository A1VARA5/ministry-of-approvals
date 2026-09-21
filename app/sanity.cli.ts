import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  app: {
    organizationId: 'ovl8j3dr5',
    entry: './src/App.tsx',
    title: 'Ministry Back Office',
  },
  deployment: {appId: 'itbdo7i85h2ygpi8pfojqvqn'},
})
