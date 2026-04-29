const { getDb } = require('../db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 405, msg: '只支持GET' });
  }

  try {
    const db = getDb();

    // 阵营排行榜
    const factionRankings = [...db.factions]
      .sort((a, b) => b.total_points - a.total_points)
      .map((f, i) => ({
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
      const rows = db.users
        .filter(u => u.faction_type === ft && u.season_points > 0)
        .sort((a, b) => b.season_points - a.season_points)
        .slice(0, topN)
        .map((u, i) => ({
          rank: i + 1,
          openid: u.openid,
          nickname: u.nickname,
          avatar: u.avatar,
          seasonPoints: u.season_points,
          level: u.level
        }));
      TOP_INDIVIDUALS_PER_FACTION[ft] = rows;
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
