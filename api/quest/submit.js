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
  const { questId, progressDelta } = req.body || {};

  if (!questId) {
    return res.status(400).json({ code: 400, msg: '缺少 questId' });
  }
  if (typeof progressDelta !== 'number' || progressDelta <= 0) {
    return res.status(400).json({ code: 400, msg: 'progressDelta 必须为正整数' });
  }

  try {
    const db = getDb();

    const quest = db.quests.find(q => q.id === questId);
    if (!quest) {
      return res.status(404).json({ code: 404, msg: '任务不存在' });
    }

    const existingIdx = db.userQuests.findIndex(uq => uq.openid === openid && uq.quest_id === questId);

    if (existingIdx < 0) {
      const newProgress = progressDelta;
      const completed = newProgress >= quest.target ? 1 : 0;
      db.userQuests.push({ openid, quest_id: questId, progress: newProgress, completed, claimed: 0, claimed_at: null });
    } else {
      const existing = db.userQuests[existingIdx];
      if (existing.claimed) {
        return res.status(400).json({ code: 400, msg: '该任务已领取奖励，无法继续提交' });
      }
      const newProgress = existing.progress + progressDelta;
      const completed = newProgress >= quest.target ? 1 : 0;
      db.userQuests[existingIdx].progress = newProgress;
      db.userQuests[existingIdx].completed = completed;
    }

    saveDb(db);

    const updated = db.userQuests.find(uq => uq.openid === openid && uq.quest_id === questId);

    res.json({
      code: 200,
      msg: 'ok',
      data: {
        questId,
        progress: updated.progress,
        completed: !!updated.completed,
        target: quest.target
      }
    });
  } catch (e) {
    console.error('quest/submit error:', e);
    res.status(500).json({ code: 500, msg: '服务器错误: ' + e.message });
  }
};
