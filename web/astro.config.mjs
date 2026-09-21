// @ts-check
import {defineConfig} from 'astro/config'
import vercel from '@astrojs/vercel'

// Every page reads live workflow state, so the whole site renders on the server.
export default defineConfig({
  output: 'server',
  adapter: vercel({
    // The fallback drainer can run one Agent Actions prompt inside a status poll.
    maxDuration: 60,
    // The certificate renderer reads these from disk at request time.
    includeFiles: [
      'src/assets/fonts/fraunces-900.ttf',
      'src/assets/fonts/fraunces-700.ttf',
      'src/assets/fonts/special-elite.ttf',
      'src/assets/fonts/plex-400.ttf',
      'src/assets/fonts/plex-600.ttf',
      'node_modules/@resvg/resvg-wasm/index_bg.wasm',
      // satori loads its layout and shaping engines from disk too.
      'node_modules/satori/yoga.wasm',
      'node_modules/harfbuzzjs/hb.wasm',
      'node_modules/harfbuzzjs/hb-subset.wasm',
    ],
  }),
})
