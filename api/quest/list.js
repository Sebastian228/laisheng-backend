const { getDb } = require('../../server');
const authUser = require('../auth/middleware');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 405, msg: '只支持GET' });
  }

  const payload = authUser(req);
  if (!payload) {
    return res.status(401).json({ code: 401, msg: '未授权，请重新登录' });
  }

  const { openid } = payload;
  const now = Date.now();

  try {
    const db = getDb();

    // 获取所有活跃任务（未过期或无过期时间）
    const quests = db.prepare(`
      SELECT id, name, description, type, euros_reward, bd_reward,
             sup_reward, sp_reward, target, expires_at
      FROM quests
      WHERE (expires_at IS NULL OR expires_at > ?)
    `).all(now);

    // 获取用户在 quests 表的当前值（quest.current 用于阵营任务类型）
    const questMap = Object.fromEntries(quests.map(q => [q.id, q]));

    // 获取用户任务进度
    const userQuests = db.prepare(`
      SELECT quest_id, progress, completed, claimed, claimed_at
      FROM user_quests
      WHERE openid = ?
    `).all(openid);

    const userProgressMap = Object.fromEntries(userQuests.map(uq => [uq.quest_id, uq]));

    // 组装返回数据，合并任务定义 + 用户进度
    const result = quests.map(q => {
      const uq = userProgressMap[q.id];
      return {
        questId: q.id,
        name: q.name,
        description: q.description,
        type: q.type,
        eurosReward: q.euros_reward,
        bdReward: q.bd_reward,
        supReward: q.sup_reward,
        spReward: q.sp_reward,
        target: q.target,
        current: q.current, // 阵营任务全局进度
        expiresAt: q.expires_at,
        // 用户个人进度
        progress: uq ? uq.progress : 0,
        completed: uq ? !!uq.completed : false,
        claimed: uq ? !!uq.claimed : false,
        claimedAt: uq ? uq.claimed_at : null
      };
    });

    res.json({
      code: 200,
      msg: 'ok',
      data: result
    });
  } catch (e) {
    console.error('quest/list error:', e);
    res.status(500).json({ code: 500, msg: '服务器错误: ' + e.message });
  }
};