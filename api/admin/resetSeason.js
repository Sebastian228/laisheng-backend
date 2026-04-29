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

  try {
    const db = getDb();

    // 获取当前赛季
    const currentSeason = db.prepare(`SELECT * FROM seasons WHERE status='active' LIMIT 1`).get();
    if (!currentSeason) {
      return res.status(404).json({ code: 404, msg: '当前无活跃赛季' });
    }

    // 归档赛季前三名玩家
    const winners = {};
    for (const type of ['corp', 'gang', 'solo']) {
      const top = db.prepare(`
        SELECT openid, nickname, avatar, season_points
        FROM users WHERE faction_type=? AND season_points > 0
        ORDER BY season_points DESC LIMIT 3
      `).all(type);
      winners[type] = top;
    }

    // 更新旧赛季状态为 archived，保存 winners
    db.prepare(`UPDATE seasons SET status='archived', winners=? WHERE id=?`)
      .run(JSON.stringify(winners), currentSeason.id);

    // 重置所有用户赛季积分
    db.prepare(`UPDATE users SET season_points=0`);

    // 重置阵营总分
    db.prepare(`UPDATE factions SET total_points=0`);

    // 创建新赛季
    const newId = 's' + (parseInt(currentSeason.id.replace('s', ''), 10) + 1);
    const now = Date.now();
    const newEnd = now + 60 * 24 * 60 * 60 * 1000; // 60 days
    const seasonNames = ['夜之城争霸', '霓虹风暴', '银手归来', '武侍复兴', '来生序章'];
    const nameIdx = parseInt(currentSeason.id.replace('s', ''), 10) % seasonNames.length;
    const newName = `第${parseInt(currentSeason.id.replace('s', ''), 10) + 1}赛季 · ${seasonNames[nameIdx]}`;

    db.prepare(`
      INSERT INTO seasons (id, name, start_date, end_date, status)
      VALUES (?, ?, ?, ?, 'active')
    `).run(newId, newName, now, newEnd);

    const newSeason = db.prepare(`SELECT * FROM seasons WHERE id=?`).get(newId);

    res.json({
      code: 200,
      msg: 'ok',
      data: {
        archivedSeason: {
          id: currentSeason.id,
          name: currentSeason.name,
          winners
        },
        newSeason: {
          id: newSeason.id,
          name: newSeason.name,
          startDate: newSeason.start_date,
          endDate: newSeason.end_date,
          status: newSeason.status
        }
      }
    });
  } catch (e) {
    console.error('admin/resetSeason error:', e);
    res.status(500).json({ code: 500, msg: '服务器错误: ' + e.message });
  }
};
