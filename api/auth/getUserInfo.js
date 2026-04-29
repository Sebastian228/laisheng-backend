const { getDb } = require('../../server');
const authUser = require('./middleware');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 405, msg: '只支持GET' });
  }

  const payload = authUser(req);
  if (!payload) {
    return res.status(401).json({ code: 401, msg: '未授权，请重新登录' });
  }

  try {
    const { openid } = payload;
    const db = getDb();

    const user = db.prepare(`
      SELECT openid, nickname, avatar, faction_type, sub_faction, level,
             euros, braindance, supplies, season_points, total_consumed, created_at
      FROM users WHERE openid = ?
    `).get(openid);

    if (!user) {
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }

    // 获取用户已领取的赛季积分信息
    const season = db.prepare(`SELECT id, name FROM seasons WHERE status = 'active' LIMIT 1`).get();
    const seasonId = season ? season.id : null;

    // 获取用户任务进度
    const quests = db.prepare(`
      SELECT uq.quest_id, uq.progress, uq.completed, uq.claimed, uq.claimed_at,
             q.name, q.description, q.type, q.euros_reward, q.bd_reward,
             q.sup_reward, q.sp_reward, q.target, q.expires_at
      FROM user_quests uq
      JOIN quests q ON q.id = uq.quest_id
      WHERE uq.openid = ?
    `).all(openid);

    // 获取用户所在阵营信息
    let faction = null;
    if (user.faction_type) {
      faction = db.prepare(`SELECT * FROM factions WHERE id = ?`).get(user.faction_type);
    }

    res.json({
      code: 200,
      msg: 'ok',
      data: {
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
          seasonPoints: user.season_points,
          totalConsumed: user.total_consumed,
          createdAt: user.created_at,
          seasonId
        },
        faction,
        quests
      }
    });
  } catch (e) {
    console.error('getUserInfo error:', e);
    res.status(500).json({ code: 500, msg: '服务器错误: ' + e.message });
  }
};