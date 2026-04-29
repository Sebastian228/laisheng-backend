const { getDb } = require('../../server');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 405, msg: '只支持GET' });
  }

  try {
    const db = getDb();

    const season = db.prepare(`SELECT * FROM seasons WHERE status='active' LIMIT 1`).get();
    if (!season) {
      return res.status(404).json({ code: 404, msg: '当前无活跃赛季' });
    }

    const factions = db.prepare(`
      SELECT id, name, type, total_points, member_count
      FROM factions ORDER BY total_points DESC
    `).all();

    res.json({
      code: 200,
      msg: 'ok',
      data: {
        season: {
          id: season.id,
          name: season.name,
          startDate: season.start_date,
          endDate: season.end_date,
          status: season.status,
          corpPoints: season.corp_points,
          gangPoints: season.gang_points,
          soloPoints: season.solo_points,
          winners: JSON.parse(season.winners || '[]')
        },
        factions: factions.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          totalPoints: f.total_points,
          memberCount: f.member_count
        }))
      }
    });
  } catch (e) {
    console.error('season/info error:', e);
    res.status(500).json({ code: 500, msg: '服务器错误: ' + e.message });
  }
};
