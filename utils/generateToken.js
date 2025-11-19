import jwt from 'jsonwebtoken'

const generateToken = (userId, role) => {
  const secret = process.env.JWT_SECRET
  
  if (!secret) {
    throw new Error('JWT_SECRET is not configured. Please set JWT_SECRET in your .env file.')
  }

  return jwt.sign(
    { sub: userId, role },
    secret,
    { expiresIn: process.env.TOKEN_EXPIRES_IN || '1d' }
  )
}

export default generateToken