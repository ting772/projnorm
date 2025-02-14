import inquirer from 'inquirer'
import { access, constants } from 'node:fs/promises'
import { cwd } from 'node:process'
import { resolve } from 'node:path'
import { info, error, execShell, writejson, updateJsonFile } from './utils/utils.js'
import { writeFile } from 'node:fs/promises';

/**
 * 依赖安装映射表
 */
const installMap = {
  useHusky: ["husky"],
  useLintStaged: ["lint-staged"],
  useCommitizen: ["commitizen", "cz-conventional-changelog"],
  useEslint: ["eslint", "@eslint/js"],
  usePrettier: ["prettier"]
}

function noteCwd() {
  info(`当前工作目录:${cwd()}`)
}

function checkPkgFile() {
  return access(resolve(cwd(), 'package.json'), constants.R_OK | constants.W_OK).catch(err => {
    if (err.code == 'ENOENT') {
      error('当前工作目录非npm项目根目录，请先执行npm init命令创建package.json文件')
    } else {
      console.error(err)
    }
    process.exit(-1)
  })
}

function checkGitProject() {
  return access(resolve(cwd(), '.git'), constants.R_OK).catch(err => {
    if (err.code == 'ENOENT') {
      error('当前工作目录不是git仓库，请先执行git init初始git仓库')
    } else {
      console.error(err)
    }
    process.exit(-1)
  })
}

function askQuestions() {
  let questions = [
    {
      type: "confirm",
      name: "useHusky",
      message: "是否安装husky",
      default: true
    },
    {
      type: "confirm",
      name: "useLintStaged",
      message: "是否安装lint-staged",
      default: true
    },
    {
      type: "confirm",
      name: "useCommitizen",
      message: "是否安装commitizen",
      default: true
    },
    {
      type: "confirm",
      name: "useEslint",
      message: "是否安装eslint",
      default: true
    },
    {
      type: "confirm",
      name: "usePrettier",
      message: "是否安装prettier",
      default: true
    },
  ]

  return inquirer.prompt(questions).catch(err => {
    if (err.name == 'ExitPromptError') {
      info('用户关闭了输入')
    } else {
      console.error(err)
    }
    process.exit(-1)
  })
}

async function install(cfg) {
  let deps = []
  for (let key in cfg) {
    deps = deps.concat(cfg[key] ? installMap[key] : [])
  }

  //同时使用prettier和eslint,安装eslint-config-prettier来关闭eslint样式检查
  if (cfg.usePrettier && cfg.useEslint) {
    deps.push("eslint-config-prettier")
  }
  await execShell({ shell: `npm install --save-dev ${deps.join(' ')}` })
  return cfg
}

const configsMap = {
  useHusky: async () => {
    await execShell({ shell: `npx husky init` })
  },
  useCommitizen: async (config) => {
    await updateJsonFile(`${resolve(cwd(), 'package.json')}`, (pkgObj) => {
      /**
           * 追加cz命令
           *  "scripts": {
                "commit": "cz"
              }
           */
      if (!pkgObj.scripts.commit) {
        pkgObj.scripts.commit = "cz"
      }

      /**
       * 追加
       * {
            "config": {
              "commitizen": {
                "path": "cz-conventional-changelog"
              }
            }
          }
       */
      if (!pkgObj.config) {
        pkgObj.config = {}
      }
      if (!pkgObj.config.commitizen) {
        pkgObj.config.commitizen = {
          path: "cz-conventional-changelog"
        }
      }
    })
    //如果安装了husky，创建prepare-commit-msg钩子文件
    if (config.useHusky) {
      await execShell({ shell: "touch .husky/prepare-commit-msg" })
      let shell = 'exec </dev/tty >&0 && node_modules/.bin/cz --hook'
      await execShell({ shell: `echo ${shell}`, output: '.husky/prepare-commit-msg' })
    }
  },
  useLintStaged: async (config) => {
    //生成.lintstagedrc.json文件
    await execShell({ shell: "touch .lintstagedrc.json" })

    /**
     *  代码检查
     *  {
     *    "*.js": ["prettier -w", "eslint"]
     *  }
     *
     */

    let obj = {}
    if (config.usePrettier || config.useEslint) {
      obj = {
        "*.js": []
      }

      if (config.usePrettier) {
        obj["*.js"].push("prettier -w")
      }

      if (config.useEslint) {
        obj["*.js"].push("eslint")
      }
    }

    await writejson(".lintstagedrc.json", obj)
    //添加git钩子
    await execShell({ shell: "touch .husky/pre-commit" })
    await execShell({ shell: "echo lint-staged", output: ".husky/pre-commit" })
  },
  usePrettier: async () => {
    //生成.prettierignore、prettierrc
    await execShell({ shell: 'touch .prettierignore' })
    await execShell({ shell: 'touch .prettierrc' })
    await writejson('.prettierrc',
      {
        trailingComma: "es5",
        tabWidth: 4,
        semi: false,
        singleQuote: true,
        end_of_line: 'lf',
        max_line_length: 80
      }
    )
  },
  useEslint: async (config) => {
    //创建eslint.config.js
    await execShell({ shell: 'touch eslint.config.js' })

    //写入eslint.config.js规则
    let content = [
      'import pluginJs from "@eslint/js"',
      config.usePrettier ? 'import eslintConfigPrettier from "eslint-config-prettier";' : '',
      "\nexport default [",
      "  pluginJs.configs.recommended" + (config.usePrettier ? ',' : ''),
      config.usePrettier ? '  eslintConfigPrettier' : '',
      "]"
    ].filter(Boolean)

    await writeFile("eslint.config.js", content.join('\n'))
  }
}

async function setupConfigs(config) {
  try {
    for (let key in config) {
      if (config[key] && typeof configsMap[key] == 'function') {
        await configsMap[key](config)
      }
    }
  } catch (err) {
    error(err.message)
  }
}

async function run() {
  let tasks = [noteCwd, checkPkgFile, checkGitProject, askQuestions, install, setupConfigs]
  await tasks.reduce((acc, fn) => acc.then(fn), Promise.resolve())
}

run()