const { getDb } = require('../../server');
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

    const userQuest = db.prepare(`SELECT * FROM user_quests WHERE openid=? AND quest_id=?`).get(openid, questId);
    if (!userQuest) {
      return res.status(404).json({ code: 404, msg: '未找到任务进度，请先提交进度' });
    }
    if (!userQuest.completed) {
      return res.status(400).json({ code: 400, msg: '任务未完成，无法领取' });
    }
    if (userQuest.claimed) {
      return res.status(400).json({ code: 400, msg: '奖励已领取，请勿重复操作' });
    }

    const quest = db.prepare(`SELECT * FROM quests WHERE id = ?`).get(questId);
    const user = db.prepare(`SELECT * FROM users WHERE openid = ?`).get(openid);

    if (!quest || !user) {
      return res.status(404).json({ code: 404, msg: '任务或用户不存在' });
    }

    const now = Date.now();

    // 更新用户钱包
    db.prepare(`
      UPDATE users SET
        euros=euros+?,
        braindance=braindance+?,
        supplies=supplies+?,
        season_points=season_points+?,
        updated_at=?
      WHERE openid=?
    `).run(quest.euros_reward, quest.bd_reward, quest.sup_reward, quest.sp_reward, now, openid);

    // 更新阵营总分（如果是阵营类型任务，按任务 sp_reward 分配阵营分）
    if (user.faction_type && quest.sp_reward > 0) {
      const col = user.faction_type + '_points'; // corp_points, gang_points, solo_points
      db.prepare(`UPDATE seasons SET ${col}=${col}+? WHERE status='active'`).run(quest.sp_reward);

      db.prepare(`
        UPDATE factions SET total_points=total_points+?, updated_at=? WHERE id=?
      `).run(quest.sp_reward, now, user.faction_type);
    }

    // 标记已领取
    db.prepare(`UPDATE user_quests SET claimed=1, claimed_at=? WHERE openid=? AND quest_id=?`)
      .run(now, openid, questId);

    const updatedUser = db.prepare(`SELECT euros, braindance, supplies, season_points FROM users WHERE openid=?`).get(openid);

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
