import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'v6745vem',
    dataset: 'ministry',
  },
  studioHost: 'ministry-of-approvals',
  deployment: {
    // Pinned on purpose: the Workflows 0.33 plugin peers on @sanity/ui 3, which means Studio 6.9.x.
    // An auto update to 6.10+ would pull @sanity/ui 4 and break the plugin.
    autoUpdates: false,
    appId: 'u2dpkzwo172lj63g73giev8m',
  },
})
