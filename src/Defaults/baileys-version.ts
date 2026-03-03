import { createRequire } from 'module'
import type { WAVersion } from '../Types'

const require = createRequire(import.meta.url)
const baileysVersionData = require('./baileys-version.json') as { version: WAVersion }

export const BAILEYS_VERSION = baileysVersionData.version as WAVersion
