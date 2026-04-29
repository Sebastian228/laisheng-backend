module.exports = async (req, res) => {
  res.json({ code: 200, msg: 'ok', data: { status: 'ok', ts: Date.now() } });
};
