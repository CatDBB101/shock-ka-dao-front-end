import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Connect, type Plugin } from 'vite'
import { createReadStream, statSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'

/**
 * Serve public/data/* with correct HTTP Range responses.
 * Vite's built-in static server answers `Range: bytes=0-0` with the whole file,
 * which makes DuckDB-WASM fall back to full downloads and fail after a reload.
 * Real static hosts (Vercel, Netlify, S3, HF) handle ranges correctly — this mimics them locally.
 */
function dataRangeServer(): Plugin {
  const root = join(process.cwd(), 'public', 'data')
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = (req.url ?? '').split('?')[0] ?? ''
    if (!url.startsWith('/data/') || (req.method !== 'GET' && req.method !== 'HEAD')) return next()
    const file = normalize(join(root, decodeURIComponent(url.slice('/data/'.length))))
    if (!file.startsWith(root + sep)) return next()
    let size: number
    try {
      const st = statSync(file)
      if (!st.isFile()) return next()
      size = st.size
    } catch {
      return next()
    }
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
    res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : 'application/octet-stream')
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
    let start = 0
    let end = size - 1
    if (m && (m[1] || m[2])) {
      if (m[1]) {
        start = Number(m[1])
        end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
      } else {
        start = Math.max(0, size - Number(m[2]))
      }
      if (start > end || start >= size) {
        res.statusCode = 416
        res.setHeader('Content-Range', `bytes */${size}`)
        return res.end()
      }
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
    }
    res.setHeader('Content-Length', String(end - start + 1))
    if (req.method === 'HEAD') return res.end()
    createReadStream(file, { start, end }).pipe(res)
  }
  return {
    name: 'fc-data-range-server',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), dataRangeServer()],
  build: { chunkSizeWarningLimit: 1200 },
})
