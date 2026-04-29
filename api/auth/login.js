const { getDb } = require('../../server');
const config = require('../../config');
const jwt = require('jsonwebtoken');
const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 405, msg: '只支持POST' });
  }

  try {
    const { code, nickname, avatar } = req.body;

    // 如果没有code（开发/测试模式），生成一个临时用户
    let openid;
    if (!code) {
      // 开发测试模式：用设备ID或随机ID
      openid = 'dev_' + (req.body.openid || req.headers['x-device-id'] || 'anonymous');
    } else {
      // 正式模式：通过code换取openid
      const appid = config.WECHAT_APPID;
      const appsecret = config.WECHAT_APPSECRET;
      
      if (appid !== 'YOUR_APPID') {
        const wxRes = await axios.get(
          `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${appsecret}&js_code=${code}&grant_type=authorization_code`
        );
        if (wxRes.data.errcode) {
          return res.status(401).json({ code: 401, msg: '微信登录失败', err: wxRes.data });
        }
        openid = wxRes.data.openid;
      } else {
        // 未配置微信，用code本身作为临时ID
        openid = 'test_' + code;
      }
    }

    const db = getDb();
    let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);
    const isNew = !user;

    if (isNew) {
      db.prepare(`
        INSERT INTO users (openid, nickname, avatar, created_at)
        VALUES (?, ?, ?, ?)
      `).run(openid, nickname || '', avatar || '', Date.now());
      user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);
    } else {
      // 更新昵称头像
      if (nickname || avatar) {
        db.prepare(`
          UPDATE users SET nickname=COALESCE(?,nickname), avatar=COALESCE(?,avatar), updated_at=? WHERE openid=?
        `).run(nickname||null, avatar||null, Date.now(), openid);
        user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);
      }
    }

    const token = jwt.sign({ openid }, config.JWT_SECRET, { expiresIn: '30d' });

    res.json({
      code: 200,
      msg: 'ok',
      data: {
        token,
        isNewUser: isNew,
        user: {
          openid: user.openid,
          nickname: user.nickname,
          avatar: user.avatar,
          faction: user.faction_type,
          subFaction: user.sub_faction,
          level: user.level,
          euros: user.euros,
          braindance: user.braindance,
          supplies: user.supplies,
          seasonPoints: user.season_points
        }
      }
    });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ code: 500, msg: e.message });
  }
};
