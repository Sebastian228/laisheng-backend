const { getDb, saveDb } = require('../../db');
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

    const quest = db.quests.find(q => q.id === questId);
    if (!quest) {
      return res.status(404).json({ code: 404, msg: '任务不存在' });
    }

    const completed = progress >= quest.target ? 1 : 0;

    const existingIdx = db.userQuests.findIndex(uq => uq.openid === openid && uq.quest_id === questId);
    if (existingIdx >= 0) {
      db.userQuests[existingIdx].progress = progress;
      db.userQuests[existingIdx].completed = completed;
    } else {
      db.userQuests.push({ openid, quest_id: questId, progress, completed, claimed: 0, claimed_at: null });
    }

    saveDb(db);

    const updated = db.userQuests.find(uq => uq.openid === openid && uq.quest_id === questId);

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
