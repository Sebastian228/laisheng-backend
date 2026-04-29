# 来生酒吧小程序 · Vercel 部署指南

## 快速部署（5分钟）

### 第一步：注册 Vercel
1. 打开 https://vercel.com
2. 用 GitHub 账号登录（推荐）
3. 如果没有 GitHub，先去 github.com 注册

### 第二步：上传代码到 GitHub
**方法A：手动上传（最简单）**
1. 下载本项目所有文件
2. 在 GitHub 新建一个空仓库，例如：`laisheng-backend`
3. 把文件上传到这个仓库

**方法B：命令行**
```bash
# 在项目根目录执行
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的用户名/laisheng-backend.git
git push -u origin main
```

### 第三步：连接到 Vercel
1. 登录 Vercel → Dashboard → "Add New Project"
2. 选择刚创建的 GitHub 仓库
3. Framework Preset: **Other**
4. 点击 **Deploy**

### 第四步：配置环境变量
在 Vercel 项目 Dashboard → Settings → Environment Variables 添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `WECHAT_APPID` | 你的微信小程序AppID | 在微信公众平台获取 |
| `WECHAT_APPSECRET` | 你的微信小程序AppSecret | 在微信公众平台获取 |
| `JWT_SECRET` | 自定义随机字符串 | 例如：`your-secret-key-2026` |
| `ADMIN_OPENIDS` | admin的openid | 管理员微信openid，多个用逗号分隔 |

> ⚠️ 如果暂时没有微信小程序账号，可以先留空，登录功能会使用测试模式（生成随机ID）

### 第五步：重新部署
添加完环境变量后，点击 **Redeploy**

---

## API 接口列表

| 方法 | 地址 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录（微信code换openid） |
| GET | `/api/auth/getUserInfo` | 获取用户信息+任务 |
| POST | `/api/faction/choose` | 选择阵营 |
| GET | `/api/faction/stats` | 阵营数据 |
| GET | `/api/quest/list` | 任务列表 |
| POST | `/api/quest/submit` | 提交任务进度 |
| POST | `/api/quest/claim` | 领取任务奖励 |
| GET | `/api/season/info` | 赛季信息 |
| GET | `/api/leaderboard` | 排行榜 |
| POST | `/api/economy/consume` | 消费抵扣 |
| POST | `/api/admin/updateQuest` | 管理员更新任务 |
| POST | `/api/admin/resetSeason` | 重置赛季 |

所有接口返回格式：
```json
{
  "code": 200,
  "msg": "ok",
  "data": { ... }
}
```

---

## 小程序前端接入

### 初始化
```javascript
// app.js
App({
  onLaunch: function () {
    wx.cloud.init({ env: '你的云开发环境ID' })
  }
})
```

### 登录并获取Token
```javascript
wx.login({
  success: res => {
    wx.request({
      url: 'https://你的域名/api/auth/login',
      method: 'POST',
      data: { code: res.code },
      success: loginRes => {
        if (loginRes.data.code === 200) {
          wx.setStorageSync('token', loginRes.data.data.token);
          wx.setStorageSync('userInfo', loginRes.data.data.user);
        }
      }
    })
  }
})
```

### 请求封装
```javascript
function request(url, data = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://你的域名' + url,
      method,
      data,
      header: { Authorization: 'Bearer ' + wx.getStorageSync('token') },
      success: resolve,
      fail: reject
    })
  })
}

// 调用示例
request('/api/auth/getUserInfo').then(res => {
  if (res.data.code === 200) {
    console.log('用户数据:', res.data.data)
  }
})
```

---

## 获取微信小程序 AppID

1. 打开 https://mp.weixin.qq.com/
2. 登录 → 设置 → 基本设置
3. 找到 **AppID** 和 **AppSecret**

> 如果还没有小程序，可以先使用开发模式（不填AppID）进行测试

---

## 常见问题

**Q: 部署后显示 Database locked**
A: SQLite 不支持并发写入，切换到 PostgreSQL 或 MySQL 可以解决这个问题（当前版本适合小规模使用）

**Q: 微信登录返回40029**
A: code 已过期或 AppID/AppSecret 错误，code 有效期5分钟

**Q: 如何添加管理员？**
A: 在 Vercel 环境变量添加 `ADMIN_OPENIDS`，值为管理员的微信openid（多个用英文逗号分隔）
