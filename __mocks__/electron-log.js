/**
 * @fileoverview Global Jest mock for electron-log
 *
 * Prevents unit tests from writing to the real user-profile log file
 * (%APPDATA%/FlashForgeUI/logs/main.log). Without this, any main-process
 * module that imports electron-log at module level (AutoLaunchService,
 * AutoUpdateService, ...) pollutes the production log with test-fixture
 * output on every `pnpm test` run. Wired up via moduleNameMapper in
 * jest.config.cjs so it applies to every test automatically.
 */

const noop = () => {};

const logger = {
  error: noop,
  warn: noop,
  info: noop,
  verbose: noop,
  debug: noop,
  silly: noop,
  log: noop,
  transports: {
    file: { level: false },
    console: { level: false },
    ipc: { level: false },
    remote: { level: false },
  },
  scope: () => logger,
  create: () => logger,
  initialize: noop,
  errorHandler: { startCatching: noop, stopCatching: noop },
  eventLogger: { startLogging: noop, stopLogging: noop },
  hooks: [],
  variables: {},
};

module.exports = logger;
module.exports.default = logger;
