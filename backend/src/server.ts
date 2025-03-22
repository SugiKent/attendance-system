import app from './app';
import logger from './utils/logger';

const PORT = process.env.PORT || 5000;

// グローバルな未処理の例外ハンドラー
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  logger.debug('Stack trace:', error.stack);
  // プロセスを終了しない - エラーをログに記録するだけ
});

// グローバルな未処理のPromise拒否ハンドラー
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection at:', promise);
  logger.debug('Reason:', reason);
  // プロセスを終了しない - エラーをログに記録するだけ
});

// サーバー起動時のエラーハンドリング
try {
  const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.debug(`Database URL: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@')}`);
    logger.debug('Server configuration:', {
      port: PORT,
      env: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage()
    });
    
    // 現在のログレベルを明示的に表示
    logger.info(`Current log level from environment: ${process.env.LOG_LEVEL || 'not set'}`);
    
    // 定期的なデバッグログ出力を設定
    setInterval(() => {
      logger.debug('定期的なデバッグログ - アプリケーションは正常に動作しています', {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      });
    }, 30000); // 30秒ごとに出力
  });

  // サーバーエラーハンドリング
  server.on('error', (error: NodeJS.ErrnoException) => {
    logger.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use`);
    }
  });
} catch (error) {
  logger.error('Failed to start server:', error);
}
