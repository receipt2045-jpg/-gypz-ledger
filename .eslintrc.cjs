// 훅 순서 위반(React error #310)처럼 tsc가 못 잡는 버그를 잡기 위한 최소 설정.
// 배포 전 `npm run lint`로 확인한다.
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-hooks'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
  ignorePatterns: ['dist', 'node_modules', '*.cjs'],
}
