import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const { ensureTestAdmin } = require('../../backend/test/helpers/testAdmin')

export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
  const { token, shop } = await ensureTestAdmin()

  const authDir = path.join(__dirname, '.auth')
  fs.mkdirSync(authDir, { recursive: true })

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          { name: 'token', value: token },
          { name: 'shopSlug', value: shop },
        ],
      },
    ],
  }

  fs.writeFileSync(path.join(authDir, 'admin.json'), JSON.stringify(storageState, null, 2))
}
