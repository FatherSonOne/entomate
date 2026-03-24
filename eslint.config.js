import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
      }
    }
  },
  { ignores: ['**/dist/', '**/node_modules/', '**/coverage/'] }
]
