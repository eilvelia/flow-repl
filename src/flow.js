// @flow

import fs from 'fs'
import { spawn } from 'child_process'
import Debug from 'debug'

const debug = Debug('flow-repl:flow')

export type Pos = [number, number]
// export type Loc = {
//   start: Pos,
//   end: Pos
// }

export opaque type FlowServer = child_process$ChildProcess

export class Flow {
  +cwd: string;
  +bin: string;

  constructor (cwd: string, bin: string) {
    this.cwd = cwd
    this.bin = bin
    debug('new Flow', this.cwd, this.bin)
  }

  spawnFlow (args: string[], contents: string): Promise<string> {
    debug('spawnFlow', args)
    const p = spawn(this.bin, args, { cwd: this.cwd })
    let result = ''
    let resulterr = ''
    p.stdout.on('data', data => {
      result += data
    })
    p.stderr.on('data', data => {
      resulterr += data
    })
    p.stdin.write(contents)
    p.stdin.end()
    return new Promise((resolve, reject) => {
      p.on('close', code => {
        if (resulterr) console.error(resulterr)
        if (code !== 0) return reject(result)
        resolve(result)
      })
    })
  }

  startServer (): FlowServer {
    const p = spawn(this.bin, ['server'], { cwd: this.cwd })
    p.stderr.pipe(process.stderr)
    p.on('close', code => {
      debug('server close', code)
      if (code !== 0 && code != null) {
        console.error(`Flow server has exited with code ${code}`)
        process.exit(1)
      }
    })
    return p
  }

  stopServer (p: FlowServer) {
    debug('stopServer')
    p.kill('SIGTERM')
  }

  async typeAtPos (contents: string, pos: Pos): Promise<string> {
    const [line, column] = pos.map(String)
    const data = await this.spawnFlow(
      ['type-at-pos', '--quiet', '--json', line, column], contents)
    const { type } = JSON.parse(data)
    return type
  }

  async checkContents (contents: string): Promise<void> {
    await this.spawnFlow(
      ['check-contents', '--quiet', '--color', 'always', '--message-width', '80'],
      contents
    )
  }
}
