// 环境配置
// ⚠️ 重要：在 Vercel 环境变量中设置以下值：
// WECHAT_APPID       - 微信小程序 AppID
// WECHAT_APPSECRET   - 微信小程序 AppSecret  
// JWT_SECRET         - JWT 签名密钥（自定义随机字符串）
// ADMIN_OPENIDS      - 管理员 openid，多个用逗号分隔

const WECHAT_APPID = process.env.WECHAT_APPID || 'YOUR_APPID';
const WECHAT_APPSECRET = process.env.WECHAT_APPSECRET || 'YOUR_APPSECRET';
const JWT_SECRET = process.env.JWT_SECRET || 'laisheng-secret-2026';
const ADMIN_OPENIDS = (process.env.ADMIN_OPENIDS || '').split(',').filter(Boolean);

module.exports = {
  WECHAT_APPID,
  WECHAT_APPSECRET,
  JWT_SECRET,
  ADMIN_OPENIDS,
  PORT: process.env.PORT || 3000
};
