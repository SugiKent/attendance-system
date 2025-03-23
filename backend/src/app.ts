import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger';

// Import routes
import authRoutes from './routes/authRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import leaveRoutes from './routes/leaveRoutes';
import reportRoutes from './routes/reportRoutes';
import adminRoutes from './routes/adminRoutes';
import companyRoutes from './routes/companyRoutes';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Initialize Prisma client with conditional logging based on LOG_LEVEL
const isPrismaDebugEnabled = process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'silly';
const isPrismaVerboseEnabled = isPrismaDebugEnabled || process.env.LOG_LEVEL === 'verbose';

// Prismaのログ設定を環境変数に基づいて調整
const prismaLogConfig: any[] = [];

// エラーは常にログに記録
prismaLogConfig.push({
  emit: 'event',
  level: 'error',
});

// 警告は常にログに記録
prismaLogConfig.push({
  emit: 'event',
  level: 'warn',
});

// verboseレベル以上の場合はinfoも記録
if (isPrismaVerboseEnabled) {
  prismaLogConfig.push({
    emit: 'event',
    level: 'info',
  });
}

// debugレベル以上の場合はqueryも記録
if (isPrismaDebugEnabled) {
  prismaLogConfig.push({
    emit: 'event',
    level: 'query',
  });
}

export const prisma = new PrismaClient({
  log: prismaLogConfig,
});

// Prismaのイベントリスナーを設定
// @ts-ignore - Prismaのイベントタイプが正確に定義されていない場合の対処
prisma.$on('error', (e: any) => {
  logger.error('Prisma error:', e);
});

// @ts-ignore - Prismaのイベントタイプが正確に定義されていない場合の対処
prisma.$on('warn', (e: any) => {
  logger.warn('Prisma warning:', e);
});

// @ts-ignore - Prismaのイベントタイプが正確に定義されていない場合の対処
prisma.$on('info', (e: any) => {
  logger.info('Prisma info:', e);
});

// @ts-ignore - Prismaのイベントタイプが正確に定義されていない場合の対処
prisma.$on('query', (e: any) => {
  // クエリログは詳細すぎるため、デバッグレベルでのみ出力
  logger.debug('Prisma query:', e);
});

// Prismaのログレベル設定を表示
logger.info('Prisma logging configuration:', {
  error: true,
  warn: true,
  info: isPrismaVerboseEnabled,
  query: isPrismaDebugEnabled
});

// データベース接続テスト
async function testDatabaseConnection() {
  try {
    logger.info('Testing database connection...');
    await prisma.$connect();
    logger.info('Database connection successful');
    logger.debug('Database connection details:', { 
      url: process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@'),
      provider: 'postgresql'
    });
  } catch (error) {
    logger.error('Database connection failed:', error);
    // プロセスを終了しない - エラーをログに記録するだけ
  }
}

// アプリケーション起動時にデータベース接続をテスト
testDatabaseConnection();

// CORSミドルウェアの設定 - 環境変数から設定を読み込む
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: process.env.CORS_METHODS?.split(',') || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: process.env.CORS_ALLOWED_HEADERS?.split(',') || ['Content-Type', 'Authorization', 'X-Company-ID', 'X-Requested-With', 'Origin', 'Accept', 'Access-Control-Allow-Headers'],
  credentials: process.env.CORS_CREDENTIALS === 'true',
  maxAge: parseInt(process.env.CORS_MAX_AGE || '86400'),
  preflightContinue: process.env.CORS_PREFLIGHT_CONTINUE === 'true',
  optionsSuccessStatus: parseInt(process.env.CORS_OPTIONS_SUCCESS_STATUS || '204')
}));

// Helmet.jsによるセキュリティヘッダー設定（CORS互換性を確保）
app.use(helmet({
  crossOriginResourcePolicy: { 
    policy: (process.env.HELMET_CROSS_ORIGIN_POLICY as 'same-origin' | 'cross-origin' | 'same-site') || 'cross-origin' 
  },
  contentSecurityPolicy: process.env.DISABLE_CONTENT_SECURITY_POLICY === 'true' ? false : undefined
}));

// OPTIONSリクエストを確実に処理するミドルウェア
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// ペイロードサイズの制限
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 全体的なレート制限
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分間
  max: 100, // IPアドレスごとに100リクエストまで
  standardHeaders: true, // 'RateLimit-*' ヘッダーを含める
  legacyHeaders: false, // 'X-RateLimit-*' ヘッダーを無効化
  message: { error: 'リクエスト数が多すぎます。しばらく経ってから再試行してください。' }
});

// 全体的なレート制限を適用（OPTIONSリクエストを除外）
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  return generalLimiter(req, res, next);
});

// 認証エンドポイント用の厳格なレート制限
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分間
  max: 10, // IPアドレスごとに10リクエストまで
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '認証リクエスト数が多すぎます。しばらく経ってから再試行してください。' }
});

// Logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.http(`${req.method} ${req.path}`);
  // Always call debug - the logger will handle whether to output based on the log level
  logger.debug('Request details:', {
    method: req.method,
    path: req.path,
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'authorization': req.headers['authorization'] ? '[PRESENT]' : '[ABSENT]',
      'x-company-id': req.headers['x-company-id']
    }
  });
  next();
});

// Routes
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'ポケット勤怠 API' });
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// デバッグログをテストするためのエンドポイント
app.get('/debug-test', (_req: Request, res: Response) => {
  logger.debug('デバッグテストエンドポイントが呼び出されました');
  logger.info('これはinfoレベルのログです');
  logger.warn('これはwarnレベルのログです');
  logger.error('これはerrorレベルのログです');
  
  // オブジェクトのログ出力もテスト
  logger.debug('デバッグオブジェクト:', { 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    aws_region: process.env.AWS_REGION,
    aws_access_key: process.env.AWS_ACCESS_KEY_ID
  });
  
  res.json({ 
    message: 'デバッグログをコンソールで確認してください',
    currentLogLevel: process.env.LOG_LEVEL || 'not set'
  });
});

// API routes - レート制限をOPTIONSリクエスト以外に適用
app.use('/api/auth/login', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  return authLimiter(req, res, next);
});

app.use('/api/auth/register', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  return authLimiter(req, res, next);
});
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/companies', companyRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Server error:', err);
  logger.debug('Error stack:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
