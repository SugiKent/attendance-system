const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

type LogLevel = keyof typeof LOG_LEVELS;

// 環境変数からログレベルを取得（デフォルトはinfo）
const currentLogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

// 現在のログレベル値を取得
const currentLevelValue = LOG_LEVELS[currentLogLevel];

// 起動時にログレベルを表示
console.log(`Current log level: ${currentLogLevel} (${currentLevelValue})`);

// 各ログレベルの関数を作成
const logger = {
  error: (message: string, ...args: any[]) => {
    if (LOG_LEVELS.error <= currentLevelValue) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (LOG_LEVELS.warn <= currentLevelValue) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (LOG_LEVELS.info <= currentLevelValue) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  http: (message: string, ...args: any[]) => {
    if (LOG_LEVELS.http <= currentLevelValue) {
      console.log(`[HTTP] ${message}`, ...args);
    }
  },
  verbose: (message: string, ...args: any[]) => {
    if (LOG_LEVELS.verbose <= currentLevelValue) {
      console.log(`[VERBOSE] ${message}`, ...args);
    }
  },
  debug: (message: string, ...args: any[]) => {
    if (LOG_LEVELS.debug <= currentLevelValue) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  silly: (message: string, ...args: any[]) => {
    if (LOG_LEVELS.silly <= currentLevelValue) {
      console.log(`[SILLY] ${message}`, ...args);
    }
  }
};

export default logger;
