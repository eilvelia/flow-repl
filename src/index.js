// @flow

import fs from 'fs'
import path from 'path'
import repl from 'repl'
import vm from 'vm'
import flowRemoveTypes from 'flow-remove-types'
import { getTmpDir } from './get-temp-dir'
import { Flow } from './flow'

const BASIC_FLOW_CONFIG = `
[ignore]

[include]

[options]
`

const FLOWCONFIG_FILE = '.flowconfig'

const REPL_INIT = [
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'https',
  'net',
  'os',
  'path',
  'punycode',
  'querystring',
  'readline',
  'stream',
  'string_decoder',
  // 'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'zlib',
].map(x => `var ${x} = require('${x}')`).join('; ')

const initLines = [REPL_INIT, '', '', '', '']

function initTmpDir (dir: string) {
  fs.mkdirSync(dir)
  fs.writeFileSync(path.join(dir, FLOWCONFIG_FILE), BASIC_FLOW_CONFIG)
}

function deinitTmpDir (dir: string) {
  fs.unlinkSync(path.join(dir, FLOWCONFIG_FILE))
  fs.rmdirSync(tmpdir)
}

function writeFileAsync (file: string, data: Buffer | string): Promise<void> {
  return new Promise((resolve, reject) =>
    fs.writeFile(file, data, err => {
      if (err) return reject(err)
      resolve()
    }))
}

const bin = process.env.FLOWREPL_BIN || 'flow'

// ---

const tmpdir = getTmpDir()
const flow = new Flow(tmpdir, bin)

initTmpDir(tmpdir)

const flowServer = flow.startServer()

const deinit = () => {
  deinitTmpDir(tmpdir)
  flow.stopServer(flowServer)
}

let lines = initLines

function startRepl () {
  const checkContents = str => flow.checkContents(str)
    .then(() => true)
    .catch(e => {
      if (typeof e === 'string')
        // $FlowFixMe: libdefs
        server.outputStream.write(e + '\n')
      else
        console.error(e)
      return false
    })
  const replEval = async (
    cmd: string,
    context: vm$Context,
    filename: string,
    callback: (err: Error | null, result: any) => mixed
  ) => {
    const diffLines = cmd.trim().split('\n').map(x => x.trim() + ' ;')
    const newLines = [...lines, ...diffLines]
    const success = await checkContents(newLines.join('\n'))
    if (!success)
      return callback(null)
    lines = newLines
    try {
      const newCmd = flowRemoveTypes(cmd, { all: true })
      const result = vm.runInContext(newCmd, context, { filename })
      callback(null, result)
    } catch (e) {
      callback(e)
    }
  }
  const server = repl.start({
    prompt: '> ',
    eval: replEval
  })
  server.on('exit', deinit)
  server.on('reset', () => lines = initLines)
  const action = async (name: string) => {
    if (name) {
      const newLines = [...lines, name.trim()]
      const pos = [newLines.length, 1]
      const type = await flow.typeAtPos(newLines.join('\n'), pos)
      // $FlowFixMe: libdefs
      server.outputStream.write(type + '\n')
    }
    server.displayPrompt()
  }
  const help = 'Show the type of a variable'
  // $FlowFixMe: libdefs
  server.defineCommand('type', { help, action })
  // $FlowFixMe: libdefs
  server.defineCommand('t', { help, action })
}

startRepl()

process.on('SIGINT', deinit)
process.on('SIGTERM', deinit)
