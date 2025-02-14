import chalk from 'chalk'
import ora from 'ora';
import { $ } from 'execa';
import jsonfile from 'jsonfile'

export function info(...args) {
  console.log(chalk.blue(...args))
}

export function warn(...args) {
  console.log(chalk.hex('#FFA500')(...args))
}

export function error(...args) {
  console.log(chalk.red(...args))
}

export function loading(text) {
  return ora(chalk.green(text)).start()
}

export function succeed(...args) {
  console.log(chalk.green(...args))
}

export async function execShell({ shell, output }) {
  const spinner = loading(shell)
  let [cmd, ...args] = shell.split(/\s+/).filter(Boolean)
  try {
    if (output) {
      await $({ stdout: { file: `${output}` } })(cmd, args)
    } else {
      await $(cmd, args)
    }
    spinner.succeed(`${shell} 执行完成`)
  } catch (err) {
    spinner.fail(err.shortMessage ?? err.message)
    process.exit(-1)
  }
}

export function writejson(file, obj, options) {
  return jsonfile.writeFile(
    file,
    obj,
    { spaces: 2, finalEOL: false, ...options }
  ).then(() => {
    succeed(`${file}写入成功`)
  }).catch(err => {
    error(`${file}写入失败`, err.message)
  })
}

export async function updateJsonFile(file, update) {
  let obj = await jsonfile.readFile(file)
  await writejson(file, update(obj) ?? obj)
}