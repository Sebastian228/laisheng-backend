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

  try {
    const db = getDb();

    // 获取当前赛季
    const currentSeasonIdx = db.seasons.findIndex(s => s.status === 'active');
    if (currentSeasonIdx < 0) {
      return res.status(404).json({ code: 404, msg: '当前无活跃赛季' });
    }
    const currentSeason = db.seasons[currentSeasonIdx];

    // 归档赛季前三名玩家
    const winners = {};
    for (const type of ['corp', 'gang', 'solo']) {
      const top = db.users
        .filter(u => u.faction_type === type && u.season_points > 0)
        .sort((a, b) => b.season_points - a.season_points)
        .slice(0, 3)
        .map(u => ({ openid: u.openid, nickname: u.nickname, avatar: u.avatar, season_points: u.season_points }));
      winners[type] = top;
    }

    // 更新旧赛季状态为 archived
    db.seasons[currentSeasonIdx].status = 'archived';
    db.seasons[currentSeasonIdx].winners = JSON.stringify(winners);

    // 重置所有用户赛季积分
    db.users.forEach(u => { u.season_points = 0; });

    // 重置阵营总分
    db.factions.forEach(f => { f.total_points = 0; });

    // 创建新赛季
    const newId = 's' + (parseInt(currentSeason.id.replace('s', ''), 10) + 1);
    const now = Date.now();
    const newEnd = now + 60 * 24 * 60 * 60 * 1000;
    const seasonNames = ['夜之城争霸', '霓虹风暴', '银手归来', '武侍复兴', '来生序章'];
    const nameIdx = parseInt(currentSeason.id.replace('s', ''), 10) % seasonNames.length;
    const newName = `第${parseInt(currentSeason.id.replace('s', ''), 10) + 1}赛季 · ${seasonNames[nameIdx]}`;

    db.seasons.push({
      id: newId,
      name: newName,
      start_date: now,
      end_date: newEnd,
      status: 'active',
      corp_points: 0,
      gang_points: 0,
      solo_points: 0,
      winners: '[]'
    });

    saveDb(db);

    const newSeason = db.seasons.find(s => s.id === newId);

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
