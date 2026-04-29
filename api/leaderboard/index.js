const { getDb } = require('../../server');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 405, msg: '只支持GET' });
  }

  try {
    const db = getDb();

    // 阵营排行榜
    const factionRankings = db.prepare(`
      SELECT id, name, type, total_points, member_count
      FROM factions ORDER BY total_points DESC
    `).all().map((f, i) => ({
      rank: i + 1,
      id: f.id,
      name: f.name,
      type: f.type,
      totalPoints: f.total_points,
      memberCount: f.member_count
    }));

    // 每个阵营 top20 个人
    const topN = 20;
    const TOP_INDIVIDUALS_PER_FACTION = {};
    const FACTION_TYPES = ['corp', 'gang', 'solo'];

    for (const ft of FACTION_TYPES) {
      const rows = db.prepare(`
        SELECT openid, nickname, avatar, season_points, level
        FROM users
        WHERE faction_type = ? AND season_points > 0
        ORDER BY season_points DESC LIMIT ?
      `).all(ft, topN);

      TOP_INDIVIDUALS_PER_FACTION[ft] = rows.map((u, i) => ({
        rank: i + 1,
        openid: u.openid,
        nickname: u.nickname,
        avatar: u.avatar,
        seasonPoints: u.season_points,
        level: u.level
      }));
    }

    res.json({
      code: 200,
      msg: 'ok',
      data: {
        factions: factionRankings,
        individuals: TOP_INDIVIDUALS_PER_FACTION
      }
    });
  } catch (e) {
    console.error('leaderboard/index error:', e);
    res.status(500).json({ code: 500, msg: '服务器错误: ' + e.message });
  }
};
