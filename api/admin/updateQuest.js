const { getDb } = require('../../server');
const config = require('../../config');
const authUser = require('../auth/middleware');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 405, msg: '只支持POST' });
  }

  const payload = authUser(req);
  if (!payload) {
    return res.status(401).json({ code: 401, msg: '未授权，请重新登录' });
  }

  if (!config.ADMIN_OPENIDS.includes(payload.openid)) {
    return res.status(403).json({ code: 403, msg: '无管理员权限' });
  }

  const { questId, openid, progress } = req.body || {};

  if (!questId || !openid || typeof progress !== 'number') {
    return res.status(400).json({ code: 400, msg: '缺少必要参数: questId, openid, progress' });
  }

  try {
    const db = getDb();

    const quest = db.prepare(`SELECT target FROM quests WHERE id=?`).get(questId);
    if (!quest) {
      return res.status(404).json({ code: 404, msg: '任务不存在' });
    }

    const completed = progress >= quest.target ? 1 : 0;

    const existing = db.prepare(`SELECT id FROM user_quests WHERE openid=? AND quest_id=?`).get(openid, questId);
    if (existing) {
      db.prepare(`UPDATE user_quests SET progress=?, completed=? WHERE openid=? AND quest_id=?`)
        .run(progress, completed, openid, questId);
    } else {
      db.prepare(`INSERT INTO user_quests (openid, quest_id, progress, completed) VALUES (?,?,?,?)`)
        .run(openid, questId, progress, completed);
    }

    const updated = db.prepare(`SELECT progress, completed FROM user_quests WHERE openid=? AND quest_id=?`).get(openid, questId);

    res.json({
      code: 200,
      msg: 'ok',
      data: {
        questId,
        openid,
        progress: updated.progress,
        completed: !!updated.completed,
        target: quest.target
      }
    });
  } catch (e) {
    console.error('admin/updateQuest error:', e);
    res.status(500).json({ code: 500, msg: '服务器错误: ' + e.message });
  }
};
