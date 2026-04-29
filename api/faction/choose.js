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

  const { openid } = payload;
  const { faction_type, sub_faction } = req.body || {};

  if (!faction_type || !['corp', 'gang', 'solo'].includes(faction_type)) {
    return res.status(400).json({ code: 400, msg: '缺少或无效的 faction_type，支持: corp, gang, solo' });
  }

  if (!sub_faction || typeof sub_faction !== 'string' || sub_faction.trim() === '') {
    return res.status(400).json({ code: 400, msg: '缺少 sub_faction（子阵营名称）' });
  }

  try {
    const db = getDb();
    const cleanSub = sub_faction.trim();

    const user = db.prepare(`SELECT * FROM users WHERE openid = ?`).get(openid);
    if (!user) {
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }

    if (user.faction_type) {
      return res.status(400).json({ code: 400, msg: `你已经加入了阵营，无法重复选择（当前: ${user.faction_type}）` });
    }

    // 原子操作：更新用户阵营 + 增加阵营成员数
    const updateUser = db.prepare(`
      UPDATE users SET faction_type=?, sub_faction=?, updated_at=? WHERE openid=?
    `);
    const updateFaction = db.prepare(`
      UPDATE factions SET member_count=member_count+1, updated_at=? WHERE id=?
    `);

    const now = Date.now();
    const tx = db.transaction(() => {
      updateUser.run(faction_type, cleanSub, now, openid);
      updateFaction.run(now, faction_type);
    });
    tx();

    // 发放入伙奖励：+100 euros, +10 supplies
    db.prepare(`
      UPDATE users SET euros=euros+100, supplies=supplies+10, updated_at=? WHERE openid=?
    `).run(now, openid);

    const updatedUser = db.prepare(`SELECT * FROM users WHERE openid = ?`).get(openid);
    const updatedFaction = db.prepare(`SELECT * FROM factions WHERE id = ?`).get(faction_type);

    res.json({
      code: 200,
      msg: 'ok',
      data: {
        user: {
          openid: updatedUser.openid,
          faction: updatedUser.faction_type,
          subFaction: updatedUser.sub_faction,
          euros: updatedUser.euros,
          supplies: updatedUser.supplies,
          seasonPoints: updatedUser.season_points
        },
        faction: updatedFaction,
        bonusApplied: { euros: 100, supplies: 10 }
      }
    });
  } catch (e) {
    console.error('faction/choose error:', e);
    res.status(500).json({ code: 500, msg: '服务器错误: ' + e.message });
  }
};