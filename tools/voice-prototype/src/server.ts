// Test page and token endpoint for the prototype. Each call gets a new room; the agent worker is
// dispatched to it automatically (it has no agentName).
//
//   LIVEKIT_URL (default ws://localhost:7880), LIVEKIT_API_KEY / LIVEKIT_API_SECRET (default the
//   --dev server's devkey / secret), WEB_PORT (default 8090)

import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AccessToken } from 'livekit-server-sdk'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.WEB_PORT ?? 8090)
const URL_ = process.env.LIVEKIT_URL ?? 'ws://localhost:7880'
const KEY = process.env.LIVEKIT_API_KEY ?? 'devkey'
const SECRET = process.env.LIVEKIT_API_SECRET ?? 'secret'

createServer(async (req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(readFileSync(join(HERE, '..', 'public', 'index.html')))
    return
  }
  if (req.url === '/token') {
    const room = `proto-${Date.now().toString(36)}`
    const at = new AccessToken(KEY, SECRET, { identity: `tester-${Math.random().toString(36).slice(2, 8)}`, ttl: '15m' })
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ url: URL_, token: await at.toJwt(), room }))
    return
  }
  res.writeHead(404).end()
}).listen(PORT, '127.0.0.1', () => console.log(`[web] http://127.0.0.1:${PORT}  (LiveKit ${URL_})`))
