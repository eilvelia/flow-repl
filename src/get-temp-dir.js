// @flow

import os from 'os'
import path from 'path'
import crypto from 'crypto'

export function getTmpDir(): string {
  const rand = crypto.randomBytes(16).toString('hex')
  return path.join(os.tmpdir(), `flowrepl${rand}`)
}
