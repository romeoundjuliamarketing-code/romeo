module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  testMatch: ['**/src/utils/*.test.ts', '**/src/lib/*.test.ts', '**/src/i18n/*.test.ts'],
  // Jest liest .gitignore nicht: ohne diese Liste greift das **-Glob auch in
  // .claude/worktrees/<branch>/src/utils/ und testet fremde Branches mit.
  testPathIgnorePatterns: ['/node_modules/', '/\\.claude/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
