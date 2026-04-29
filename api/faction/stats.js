const { getDb } = require('../db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 405, msg: '只支持GET' });
  }

  try {
    const db = getDb();
    const factions = [...db.factions].sort((a, b) => b.total_points - a.total_points);

    res.json({
      code: 200,
      msg: 'ok',
      data: factions.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        totalPoints: f.total_points,
        memberCount: f.member_count,
        updatedAt: f.updated_at
      }))
    });
  } catch (e) {
    console.error('faction/stats error:', e);
    res.status(500).json({ code: 500, msg: '服务器错误: ' + e.message });
  }
};
