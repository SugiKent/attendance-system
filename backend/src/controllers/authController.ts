import { Request, Response } from 'express';
import { prisma } from '../app';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { emailService } from '../services/emailService';
import { passwordSchema } from '../utils/passwordUtils';
import logger from '../utils/logger';

// 入力バリデーションスキーマ
const profileUpdateSchema = z.object({
  name: z.string().min(1, '名前は必須です'),
  email: z.string().email('有効なメールアドレスを入力してください'),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, '現在のパスワードは必須です'),
  newPassword: passwordSchema,
});

const registerSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: passwordSchema,
  name: z.string().min(1, '名前は必須です'),
  companyId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(1, 'パスワードは必須です'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'トークンは必須です'),
  userId: z.string().min(1, 'ユーザーIDは必須です'),
});

const resendVerificationSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
});

// JWTトークン生成関数
const generateToken = (userId: string, companyId: string | null, role: string): string => {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.sign({ userId, companyId, role }, secret, { expiresIn: '24h' });
};

// 認証トークン生成関数
const generateVerificationToken = (): string => {
  return uuidv4();
};

// 認証トークン有効期限設定関数（24時間）
const getVerificationTokenExpiry = (): Date => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
};

export const authController = {
  // メールアドレス認証
  verifyEmail: async (req: Request, res: Response) => {
    try {
      // リクエストボディのバリデーション
      const validatedData = verifyEmailSchema.parse(req.body);
      
      // ユーザーの検索
      const user = await prisma.user.findUnique({
        where: { id: validatedData.userId },
      });
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'ユーザーが見つかりません',
        });
      }
      
      // 既に認証済みの場合
      if (user.isEmailVerified) {
        return res.status(400).json({
          status: 'error',
          message: 'このメールアドレスは既に認証されています',
        });
      }
      
      // トークンの検証
      if (
        !user.verificationToken ||
        user.verificationToken !== validatedData.token ||
        !user.verificationTokenExpiry ||
        new Date() > user.verificationTokenExpiry
      ) {
        return res.status(400).json({
          status: 'error',
          message: '無効または期限切れの認証トークンです',
        });
      }
      
      // ユーザーを認証済みに更新
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
        },
      });
      
      // パスワードを除外したユーザー情報を返却
      const { password, ...userWithoutPassword } = updatedUser;
      
      // JWTトークンの生成
      const token = generateToken(updatedUser.id, updatedUser.companyId, updatedUser.role);
      
      return res.status(200).json({
        status: 'success',
        message: 'メールアドレスが正常に認証されました',
        data: {
          user: userWithoutPassword,
          token,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: error.errors[0].message,
        });
      }
      
      logger.error('Verify email error:', error);
      logger.debug('Verify email error details:', { 
        userId: req.body.userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return res.status(500).json({
        status: 'error',
        message: 'メールアドレス認証中にエラーが発生しました',
      });
    }
  },
  
  // 認証トークン再送信
  resendVerification: async (req: Request, res: Response) => {
    try {
      // リクエストボディのバリデーション
      const validatedData = resendVerificationSchema.parse(req.body);
      
      // ユーザーの検索
      const user = await prisma.user.findFirst({
        where: { email: validatedData.email },
      });
      
      if (!user) {
        // セキュリティのため、ユーザーが存在しない場合でも成功レスポンスを返す
        return res.status(200).json({
          status: 'success',
          message: '認証メールを送信しました（存在する場合）',
        });
      }
      
      // 既に認証済みの場合
      if (user.isEmailVerified) {
        return res.status(400).json({
          status: 'error',
          message: 'このメールアドレスは既に認証されています',
        });
      }
      
      // 新しい認証トークンを生成
      const verificationToken = generateVerificationToken();
      const verificationTokenExpiry = getVerificationTokenExpiry();
      
      // ユーザー情報を更新
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationToken,
          verificationTokenExpiry,
        },
      });
      
      // 認証メールを送信
      await emailService.sendVerificationEmail({
        to: user.email,
        userName: user.name,
        verificationToken,
        userId: user.id
      });
      
      return res.status(200).json({
        status: 'success',
        message: '認証メールを再送信しました',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: error.errors[0].message,
        });
      }
      
      logger.error('Resend verification error:', error);
      logger.debug('Resend verification error details:', { 
        email: req.body.email,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return res.status(500).json({
        status: 'error',
        message: '認証メール再送信中にエラーが発生しました',
      });
    }
  },
  // プロフィール更新
  updateProfile: async (req: Request, res: Response) => {
    try {
      // リクエストからユーザーIDを取得（認証ミドルウェアで設定）
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          status: 'error',
          message: '認証が必要です',
        });
      }
      
      // リクエストボディのバリデーション
      const validatedData = profileUpdateSchema.parse(req.body);
      
      // メールアドレスの重複チェック（自分以外）
      if (validatedData.email) {
        const existingUser = await prisma.user.findFirst({
          where: {
            email: validatedData.email,
            id: { not: userId },
          },
        });
        
        if (existingUser) {
          return res.status(400).json({
            status: 'error',
            message: 'このメールアドレスは既に使用されています',
          });
        }
      }
      
      // ユーザー情報の更新
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name: validatedData.name,
          email: validatedData.email,
        },
      });
      
      // パスワードを除外したユーザー情報を返却
      const { password, ...userWithoutPassword } = updatedUser;
      
      return res.status(200).json({
        status: 'success',
        data: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: error.errors[0].message,
        });
      }
      
      logger.error('Update profile error:', error);
      logger.debug('Update profile error details:', { 
        userId: req.user?.id,
        requestData: req.body,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return res.status(500).json({
        status: 'error',
        message: 'プロフィール更新中にエラーが発生しました',
      });
    }
  },
  
  // パスワード変更
  changePassword: async (req: Request, res: Response) => {
    try {
      // リクエストからユーザーIDを取得（認証ミドルウェアで設定）
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          status: 'error',
          message: '認証が必要です',
        });
      }
      
      // リクエストボディのバリデーション
      const validatedData = passwordChangeSchema.parse(req.body);
      
      // ユーザー情報の取得
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'ユーザーが見つかりません',
        });
      }
      
      // 現在のパスワードの検証
      const isPasswordValid = await bcrypt.compare(
        validatedData.currentPassword,
        user.password
      );
      
      if (!isPasswordValid) {
        return res.status(400).json({
          status: 'error',
          message: '現在のパスワードが正しくありません',
        });
      }
      
      // 新しいパスワードのハッシュ化
      const hashedPassword = await bcrypt.hash(validatedData.newPassword, 10);
      
      // パスワードの更新
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
        },
      });
      
      return res.status(200).json({
        status: 'success',
        message: 'パスワードが正常に変更されました',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: error.errors[0].message,
        });
      }
      
      logger.error('Change password error:', error);
      logger.debug('Change password error details:', { 
        userId: req.user?.id,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return res.status(500).json({
        status: 'error',
        message: 'パスワード変更中にエラーが発生しました',
      });
    }
  },
  
  // 初期セットアップ（最初の管理者ユーザー作成）
  setupAdmin: async (req: Request, res: Response) => {
    try {
      // リクエスト受信時のデバッグログ
      logger.debug('管理者アカウント作成リクエスト受信:', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        body: { email: req.body.email, name: req.body.name }  // パスワードは記録しない
      });

      // リクエストボディのバリデーション
      const validatedData = registerSchema.parse(req.body);
      logger.debug('バリデーション成功:', { email: validatedData.email, name: validatedData.name });
      
      // 管理者ユーザーが既に存在するか確認
      const adminExists = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });
      
      if (adminExists) {
        logger.info(`管理者ユーザー作成失敗: 管理者が既に存在します`);
        return res.status(403).json({
          status: 'error',
          message: '管理者ユーザーは既に存在します。このエンドポイントは使用できません。',
        });
      }
      
      // メールアドレスの重複チェック
      const existingUser = await prisma.user.findFirst({
        where: { email: validatedData.email },
      });
      
      if (existingUser) {
        logger.info(`管理者ユーザー作成失敗: メールアドレス重複 - ${validatedData.email}`);
        return res.status(400).json({
          status: 'error',
          message: 'このメールアドレスは既に登録されています',
        });
      }
      
      // 処理開始時のログ
      logger.info(`管理者ユーザー作成処理開始: ${validatedData.email}`);
      
      // パスワードのハッシュ化
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      logger.debug('パスワードハッシュ化完了');
      
      // 管理者ユーザーの作成
      const newAdmin = await prisma.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          name: validatedData.name,
          role: 'ADMIN', // 管理者ロールを設定
        },
      });
      
      // 処理成功時のログ
      logger.info(`管理者ユーザー作成成功: ${newAdmin.email} (ID: ${newAdmin.id})`);
      logger.debug('管理者ユーザー作成詳細:', {
        userId: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role,
        timestamp: new Date().toISOString()
      });
      
      // パスワードを除外したユーザー情報を返却
      const { password, ...userWithoutPassword } = newAdmin;
      
      // JWTトークンの生成
      const token = generateToken(newAdmin.id, null, newAdmin.role);
      
      return res.status(201).json({
        status: 'success',
        data: {
          user: userWithoutPassword,
          token,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: error.errors[0].message,
        });
      }
      
      logger.error('Setup admin error:', error);
      logger.debug('Setup admin error details:', { 
        requestData: { email: req.body.email, name: req.body.name },
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return res.status(500).json({
        status: 'error',
        message: '管理者ユーザー作成中にエラーが発生しました',
      });
    }
  },
  
  // ユーザー登録（管理者のみ実行可能）
  register: async (req: Request, res: Response) => {
    try {
      // TEMP-DEBUG: アカウント登録フロー確認用（後で削除）
      logger.info('[TEMP-DEBUG] [アカウント登録] ステップ5: 登録処理開始 - 管理者ID: ' + req.user?.id);
      
      // リクエスト受信時のデバッグログ
      logger.debug('アカウント作成リクエスト受信:', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        body: { email: req.body.email, name: req.body.name }  // パスワードは記録しない
      });

      // リクエストボディのバリデーション
      const validatedData = registerSchema.parse(req.body);
      logger.debug('バリデーション成功:', { email: validatedData.email, name: validatedData.name });
      
      // メールアドレスの重複チェック
      const existingUser = await prisma.user.findFirst({
        where: { email: validatedData.email },
      });
      
      if (existingUser) {
        logger.info(`ユーザー登録失敗: メールアドレス重複 - ${validatedData.email}`);
        return res.status(400).json({
          status: 'error',
          message: 'このメールアドレスは既に登録されています',
        });
      }
      
      // 処理開始時のログ
      logger.info(`ユーザー登録処理開始: ${validatedData.email}`);
      
      // パスワードのハッシュ化
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      logger.debug('パスワードハッシュ化完了');
      
      // 認証トークンの生成
      const verificationToken = generateVerificationToken();
      const verificationTokenExpiry = getVerificationTokenExpiry();
      logger.debug('認証トークン生成完了', { 
        tokenExpiry: verificationTokenExpiry.toISOString() 
      });
      
      // 企業IDの設定
      let companyId = undefined;
      
      // リクエスト元が管理者の場合
      if (req.user) {
        // スーパー管理者の場合は指定された企業IDを使用
        if (req.user.role === 'SUPER_ADMIN' && validatedData.companyId) {
          companyId = validatedData.companyId;
        } 
        // 管理者の場合は自分の所属企業を設定
        else if (req.user.role === 'ADMIN' && req.user.companyId) {
          companyId = req.user.companyId;
        }
      }
      
      // ユーザーの作成
      const newUser = await prisma.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          name: validatedData.name,
          role: 'EMPLOYEE', // デフォルトは一般従業員
          isEmailVerified: false,
          verificationToken,
          verificationTokenExpiry,
          companyId,
        },
      });
      
      // 処理成功時のログ
      logger.info(`ユーザー登録成功: ${newUser.email} (ID: ${newUser.id})`);
      // TEMP-DEBUG: アカウント登録フロー確認用（後で削除）
      logger.info('[TEMP-DEBUG] [アカウント登録] ステップ5: 登録処理成功 - ユーザーID: ' + newUser.id);
      
      logger.debug('ユーザー登録詳細:', {
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        isEmailVerified: newUser.isEmailVerified,
        timestamp: new Date().toISOString()
      });
      
      // 認証メールを送信
      try {
        // TEMP-DEBUG: アカウント登録フロー確認用（後で削除）
        logger.info('[TEMP-DEBUG] [アカウント登録] ステップ6: 認証メール送信開始 - メールアドレス: ' + newUser.email);
        
        logger.info(`ユーザー登録: 認証メール送信を開始します - ${newUser.email}`);
        await emailService.sendVerificationEmail({
          to: newUser.email,
          userName: newUser.name,
          verificationToken,
          userId: newUser.id
        });
        logger.info(`ユーザー登録: 認証メール送信が完了しました - ${newUser.email}`);
        
        // TEMP-DEBUG: アカウント登録フロー確認用（後で削除）
        logger.info('[TEMP-DEBUG] [アカウント登録] ステップ6: 認証メール送信成功 - ユーザーID: ' + newUser.id);
      } catch (emailError) {
        logger.error(`ユーザー登録: 認証メール送信に失敗しました - ${newUser.email}`, emailError);
        logger.debug('Email sending error details:', {
          userId: newUser.id,
          email: newUser.email,
          errorMessage: emailError instanceof Error ? emailError.message : 'Unknown error',
          stack: emailError instanceof Error ? emailError.stack : undefined
        });
        // エラーが発生してもユーザー作成自体は継続する
      }
      
      // パスワードを除外したユーザー情報を返却
      const { password, ...userWithoutPassword } = newUser;
      
      // TEMP-DEBUG: アカウント登録フロー確認用（後で削除）
      logger.info('[TEMP-DEBUG] [アカウント登録] ステップ7: アカウント登録プロセス完了 - ユーザーID: ' + newUser.id);
      
      return res.status(201).json({
        status: 'success',
        message: 'ユーザーが作成され、認証メールが送信されました',
        data: {
          user: userWithoutPassword,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: error.errors[0].message,
        });
      }
      
      logger.error('Register error:', error);
      logger.debug('Register error details:', { 
        requestData: { email: req.body.email, name: req.body.name },
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return res.status(500).json({
        status: 'error',
        message: 'ユーザー登録中にエラーが発生しました',
      });
    }
  },
  
  // ログイン
  login: async (req: Request, res: Response) => {
    try {
      // TEMP-DEBUG: アカウント登録フロー確認用（後で削除）
      logger.info('[TEMP-DEBUG] [アカウント登録] ステップ1: ログイン試行 - メールアドレス: ' + req.body.email);
      
      // リクエスト受信時のデバッグログ
      logger.debug('ログインリクエスト受信:', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        email: req.body.email  // パスワードは記録しない
      });

      // リクエストボディのバリデーション
      const validatedData = loginSchema.parse(req.body);
      logger.debug('バリデーション成功:', { email: validatedData.email });
      
      // ユーザーの検索
      const user = await prisma.user.findFirst({
        where: { email: validatedData.email },
      });
      
      if (!user) {
        logger.info(`ログイン失敗: ユーザーが存在しません - ${validatedData.email}`);
        return res.status(401).json({
          status: 'error',
          message: 'メールアドレスまたはパスワードが正しくありません',
        });
      }
      
      // パスワードの検証
      const isPasswordValid = await bcrypt.compare(
        validatedData.password,
        user.password
      );
      
      if (!isPasswordValid) {
        logger.info(`ログイン失敗: パスワードが不正 - ${user.email} (ID: ${user.id})`);
        return res.status(401).json({
          status: 'error',
          message: 'メールアドレスまたはパスワードが正しくありません',
        });
      }
      
      // メール認証チェック
      if (!user.isEmailVerified) {
        logger.info(`ログイン失敗: メール未認証 - ${user.email} (ID: ${user.id})`);
        return res.status(403).json({
          status: 'error',
          message: 'メールアドレスが認証されていません。認証メールを確認してください。',
          needsVerification: true,
          email: user.email,
        });
      }
      
      logger.info(`ログイン成功: ${user.email} (ID: ${user.id})`);
      
      // TEMP-DEBUG: アカウント登録フロー確認用（後で削除）
      if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
        logger.info('[TEMP-DEBUG] [アカウント登録] ステップ1: スーパー管理者/管理者ログイン成功 - ユーザーID: ' + user.id);
      }
      logger.debug('ログイン詳細:', {
        userId: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        timestamp: new Date().toISOString()
      });
      
      // パスワードを除外したユーザー情報を返却
      const { password, ...userWithoutPassword } = user;
      
      // JWTトークンの生成
      const token = generateToken(user.id, user.companyId, user.role);
      
      return res.status(200).json({
        status: 'success',
        data: {
          user: userWithoutPassword,
          token,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: error.errors[0].message,
        });
      }
      
      logger.error('Login error:', error);
      logger.debug('Login error details:', { 
        email: req.body.email,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return res.status(500).json({
        status: 'error',
        message: 'ログイン中にエラーが発生しました',
      });
    }
  },
  
  // 現在のユーザー情報取得
  getCurrentUser: async (req: Request, res: Response) => {
    try {
      // リクエストからユーザーIDを取得（認証ミドルウェアで設定）
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          status: 'error',
          message: '認証が必要です',
        });
      }
      
      // ユーザー情報の取得
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'ユーザーが見つかりません',
        });
      }
      
      // パスワードを除外したユーザー情報を返却
      const { password, ...userWithoutPassword } = user;
      
      return res.status(200).json({
        status: 'success',
        data: userWithoutPassword,
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      logger.debug('Get current user error details:', { 
        userId: req.user?.id,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return res.status(500).json({
        status: 'error',
        message: 'ユーザー情報の取得中にエラーが発生しました',
      });
    }
  },
};
