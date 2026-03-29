module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'services/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    '!services/logger.js',
    '!utils/log.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary'],
  verbose: true
};
