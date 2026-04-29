const { getDb, saveDb } = require('../db');
const authUser = require('../auth/middleware');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 405, msg: '只支持POST' });
  }

  const payload = authUser(req);
  if (!payload) {
    return res.status(401).json({ code: 401, msg: '未授权，请重新登录' });
  }

  const { openid } = payload;
  const { questId } = req.body || {};

  if (!questId) {
    return res.status(400).json({ code: 400, msg: '缺少 questId' });
  }

  try {
    const db = getDb();

    const userQuestIdx = db.userQuests.findIndex(uq => uq.openid === openid && uq.quest_id === questId);
    if (userQuestIdx < 0) {
      return res.status(404).json({ code: 404, msg: '未找到任务进度，请先提交进度' });
    }

    const userQuest = db.userQuests[userQuestIdx];
    if (!userQuest.completed) {
      return res.status(400).json({ code: 400, msg: '任务未完成，无法领取' });
    }
    if (userQuest.claimed) {
      return res.status(400).json({ code: 400, msg: '奖励已领取，请勿重复操作' });
    }

    const quest = db.quests.find(q => q.id === questId);
    const userIdx = db.users.findIndex(u => u.openid === openid);

    if (!quest || userIdx < 0) {
      return res.status(404).json({ code: 404, msg: '任务或用户不存在' });
    }

    const user = db.users[userIdx];
    const now = Date.now();

    // 更新用户钱包
    db.users[userIdx].euros = (db.users[userIdx].euros || 0) + (quest.euros_reward || 0);
    db.users[userIdx].braindance = (db.users[userIdx].braindance || 0) + (quest.bd_reward || 0);
    db.users[userIdx].supplies = (db.users[userIdx].supplies || 0) + (quest.sup_reward || 0);
    db.users[userIdx].season_points = (db.users[userIdx].season_points || 0) + (quest.sp_reward || 0);
    db.users[userIdx].updated_at = now;

    // 更新阵营总分
    if (user.faction_type && quest.sp_reward > 0) {
      const seasonIdx = db.seasons.findIndex(s => s.status === 'active');
      if (seasonIdx >= 0) {
        const col = user.faction_type + '_points';
        if (db.seasons[seasonIdx][col] !== undefined) {
          db.seasons[seasonIdx][col] += quest.sp_reward;
        }
      }

      const factionIdx = db.factions.findIndex(f => f.id === user.faction_type);
      if (factionIdx >= 0) {
        db.factions[factionIdx].total_points = (db.factions[factionIdx].total_points || 0) + quest.sp_reward;
        db.factions[factionIdx].updated_at = now;
      }
    }

    // 标记已领取
    db.userQuests[userQuestIdx].claimed = 1;
    db.userQuests[userQuestIdx].claimed_at = now;

    saveDb(db);

    const updatedUser = db.users.find(u => u.openid === openid);

    res.json({
      code: 200,
      msg: 'ok',
      data: {
        rewards: {
          euros: quest.euros_reward,
          braindance: quest.bd_reward,
          supplies: quest.sup_reward,
          seasonPoints: quest.sp_reward
        },
        user: {
          euros: updatedUser.euros,
          braindance: updatedUser.braindance,
          supplies: updatedUser.supplies,
          seasonPoints: updatedUser.season_points
        }
      }
    });
  } catch (e) {
    console.error('quest/claim error:', e);
    res.status(500).json({ code: 500, msg: '服务器错误: ' + e.message });
  }
};
