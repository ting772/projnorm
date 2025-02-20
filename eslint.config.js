import pluginJs from '@eslint/js'
import globals from 'globals'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  pluginJs.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
]
