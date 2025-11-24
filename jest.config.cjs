// jest.config.js
module.exports = {
    testEnvironment: 'jsdom', // Use jsdom to simulate browser environment
    preset: 'ts-jest',
    transform: {
      '^.+\\.tsx?$': 'ts-jest', // Transform TypeScript files using ts-jest
      '^.+\\.jsx?$': 'babel-jest', // Transform JS files using Babel
    },
    // Optional: Mock CSS/image imports if they cause errors
    moduleNameMapper: {
      '\\.(css|less|sass|scss)$': 'identity-obj-proxy', // Mocks CSS module imports
      '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/__mocks__/fileMock.js', // Mocks file imports
    },
    // Optional: Setup file to run before tests (e.g., global mocks)
    // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    // Specify the directory where your source files are located
    roots: ['<rootDir>/src'], // Adjust if your source files are elsewhere
    // Specify the test file pattern
    testMatch: [
      '**/__tests__/**/*.?(m)[jt]s?(x)',
      '**/?(*.)+(spec|test).?(m)[jt]s?(x)',
    ],
    // Collect coverage from source files, excluding certain patterns
    collectCoverageFrom: [
      'src/**/*.{js,jsx,ts,tsx}', // Adjust to match your source structure
      '!src/**/*.d.ts',
      '!src/main.ts', // Exclude main process file
      '!src/preload.ts', // Exclude preload scripts
      '!src/**/*.test.{js,jsx,ts,tsx}', // Exclude test files themselves
      '!src/**/index.ts', // Exclude index barrels if any
      // Add other files/patterns to exclude from coverage
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'clover'],
  };