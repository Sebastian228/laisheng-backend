const { getDb } = require('../../server');
const config = require('../../config');
const jwt = require('jsonwebtoken');

// 解析 JWT，验证 Authorization: Bearer <token>
function authUser(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

module.exports = authUser;