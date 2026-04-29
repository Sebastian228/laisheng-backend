const { getDb } = require('../db');
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

    const user = db.users.find(u => u.openid === openid);

    if (!user) {
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }

    // 获取活跃赛季
    const season = db.seasons.find(s => s.status === 'active');
    const seasonId = season ? season.id : null;

    // 获取用户任务进度
    const userQuestRows = db.userQuests.filter(uq => uq.openid === openid);
    const quests = userQuestRows.map(uq => {
      const q = db.quests.find(qq => qq.id === uq.quest_id);
      if (!q) return null;
      return {
        quest_id: uq.quest_id,
        progress: uq.progress,
        completed: uq.completed,
        claimed: uq.claimed,
        claimed_at: uq.claimed_at,
        name: q.name,
        description: q.description,
        type: q.type,
        euros_reward: q.euros_reward,
        bd_reward: q.bd_reward,
        sup_reward: q.sup_reward,
        sp_reward: q.sp_reward,
        target: q.target,
        expires_at: q.expires_at
      };
    }).filter(Boolean);

    // 获取用户所在阵营信息
    let faction = null;
    if (user.faction_type) {
      faction = db.factions.find(f => f.id === user.faction_type);
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
