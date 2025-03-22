import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import logger from '../utils/logger';

// Email options interface
interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  fromName?: string;
}

// Template data interface
interface TemplateData {
  [key: string]: any;
}

// Verification email interface
interface VerificationEmailParams {
  to: string;
  userName: string;
  verificationToken: string;
  userId: string;
}

// Email service
export const emailService = {
  // Create development transporter using Ethereal Email
  createDevTransport: async () => {
    try {
      // Create test account
      const testAccount = await nodemailer.createTestAccount();
      
      logger.info('Ethereal Email テストアカウント作成:');
      logger.info(`- ユーザー名: ${testAccount.user}`);
      logger.info(`- パスワード: ${testAccount.pass}`);
      logger.info(`- プレビューURL: https://ethereal.email/login`);
      
      // Create transporter
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (error) {
      logger.error('Ethereal Email アカウント作成エラー:', error);
      logger.debug('Ethereal Email アカウント作成エラー詳細:', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      // Fallback to console output
      return null;
    }
  },
  
  // Create production transporter using Amazon SES
  createProdTransport: () => {
    // Log SES configuration for debugging
    logger.debug('SES設定情報:', {
      region: process.env.AWS_REGION,
      emailFrom: process.env.EMAIL_FROM || 'noreply@example.com'
    });
    
    const sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1', // デフォルトを米国東部リージョンに変更
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });
    
    return {
      sendMail: async (options: any) => {
        try {
          const params = {
            Source: options.from,
            Destination: {
              ToAddresses: [options.to]
            },
            Message: {
              Subject: {
                Data: options.subject,
                Charset: 'UTF-8'
              },
              Body: {
                Text: options.text ? {
                  Data: options.text,
                  Charset: 'UTF-8'
                } : undefined,
                Html: options.html ? {
                  Data: options.html,
                  Charset: 'UTF-8'
                } : undefined
              }
            }
          };
          
          logger.debug('SES送信パラメータ:', JSON.stringify({
            Source: params.Source,
            Destination: params.Destination,
            Subject: params.Message.Subject.Data
          }, null, 2));
          
          const command = new SendEmailCommand(params);
          return await sesClient.send(command);
        } catch (error) {
          logger.error('SES送信エラー詳細:', error);
          logger.debug('SES送信エラー詳細情報:', {
            options,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
          throw error;
        }
      }
    };
  },
  
  // Render email template with data
  renderTemplate: (templateName: string, data: TemplateData): string => {
    try {
      // In a real implementation, templates would be stored in a templates directory
      // For now, we'll use inline templates for simplicity
      let templateContent: string;
      
      switch (templateName) {
        case 'emailVerification':
          templateContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>メールアドレス認証</title>
            <style>
              body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .container { border: 1px solid #ddd; border-radius: 5px; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .logo { max-width: 150px; height: auto; }
              .footer { margin-top: 30px; font-size: 12px; color: #777; text-align: center; }
              .button { display: inline-block; background-color: #4CAF50; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin: 20px 0; }
              @media only screen and (max-width: 480px) {
                body { padding: 10px; }
                .container { padding: 10px; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                {{#if companyLogo}}
                <img src="{{companyLogo}}" alt="{{companyName}}" class="logo">
                {{else}}
                <h2>{{companyName}}</h2>
                {{/if}}
              </div>
              
              <p>{{userName}}様</p>
              
              <p>ポケット勤怠へのご登録ありがとうございます。</p>
              
              <p>以下のリンクをクリックして、メールアドレスの認証を完了してください：</p>
              
              <p style="text-align: center;">
                <a href="{{verificationLink}}" class="button">メールアドレスを認証する</a>
              </p>
              
              <p>このリンクは24時間有効です。期限が切れた場合は、再度登録手続きを行ってください。</p>
              
              <p>もしこのメールに心当たりがない場合は、このメールを無視してください。</p>
              
              <div class="footer">
                <p>&copy; {{currentYear}} {{companyName}}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
          `;
          break;
          
        default:
          throw new Error(`Template "${templateName}" not found`);
      }
      
      // Compile template
      const template = handlebars.compile(templateContent);
      
      // Add current year to data
      const templateData = {
        ...data,
        currentYear: new Date().getFullYear()
      };
      
      // Render template with data
      return template(templateData);
    } catch (error) {
      logger.error('Template rendering error:', error);
      logger.debug('Template rendering error details:', {
        templateName,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return '';
    }
  },
  
  // Send email
  sendEmail: async (options: EmailOptions): Promise<any> => {
    try {
      // Set default from address
      const from = options.from || process.env.EMAIL_FROM || 'noreply@example.com';
      const fromName = options.fromName || process.env.EMAIL_FROM_NAME || 'ポケット勤怠';
      
      // Prepare email options
      const mailOptions = {
        from: `"${fromName}" <${from}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };
      
      logger.info(`メール送信準備 (環境: ${process.env.NODE_ENV || 'undefined'}):`);
      logger.info(`- 宛先: ${options.to}`);
      logger.info(`- 件名: ${options.subject}`);
      logger.debug('メール送信詳細:', {
        to: options.to,
        subject: options.subject,
        from: from,
        fromName: fromName,
        hasText: !!options.text,
        hasHtml: !!options.html
      });
      
      // Send email based on environment
      if (process.env.NODE_ENV === 'development') {
        // Development: Use Ethereal Email or console
        const transporter = await emailService.createDevTransport();
        
        if (transporter) {
          // Send via Ethereal Email
          const info = await transporter.sendMail(mailOptions);
          logger.info('==========================================');
          logger.info('📧 メールプレビュー:');
          const previewUrl = nodemailer.getTestMessageUrl(info);
          logger.info(previewUrl || 'プレビューURLが利用できません');
          logger.info('==========================================');
          return info;
        } else {
          // Fallback to logger output
          logger.info('==========================================');
          logger.info('📧 開発環境: メール送信をシミュレート');
          logger.info('==========================================');
          logger.info(`宛先: ${options.to}`);
          logger.info(`件名: ${options.subject}`);
          logger.info('------------------------------------------');
          logger.debug('本文:');
          logger.debug(options.html || options.text || '');
          logger.info('==========================================');
          return { messageId: 'dev-mode' };
        }
      } else {
        // Production: Use Amazon SES
        logger.info('本番環境: Amazon SESを使用してメール送信を試みます');
        const transporter = emailService.createProdTransport();
        try {
          const result = await transporter.sendMail(mailOptions);
          logger.info('SES送信成功:', result);
          logger.debug('SES送信成功詳細:', { result });
          return result;
        } catch (error) {
          logger.error('SES送信失敗:', error);
          logger.debug('SES送信失敗詳細:', {
            options: mailOptions,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
          throw error;
        }
      }
    } catch (error) {
      logger.error('Email sending error:', error);
      logger.debug('Email sending error details:', {
        options,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  },
  
  // Send verification email - 新しいインターフェースに対応
  sendVerificationEmail: async ({
    to,
    userName,
    verificationToken,
    userId
  }: VerificationEmailParams): Promise<any> => {
    try {
      logger.info(`認証メール送信開始 - 宛先: ${to}, ユーザーID: ${userId}`);
      logger.debug('認証メール送信詳細:', {
        to,
        userId,
        verificationToken,
        baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
      });
      
      // Generate verification link
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}&userId=${userId}`;
      
      // Company info
      const companyName = process.env.COMPANY_NAME || 'ポケット勤怠';
      const companyLogo = process.env.COMPANY_LOGO || '';
      
      // Render email template
      const html = emailService.renderTemplate('emailVerification', {
        userName,
        verificationLink,
        companyName,
        companyLogo
      });
      
      // Send email
      return await emailService.sendEmail({
        to,
        subject: 'メールアドレスの認証',
        html
      });
    } catch (error) {
      logger.error('Verification email sending error:', error);
      logger.debug('Verification email sending error details:', {
        to,
        userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
};
