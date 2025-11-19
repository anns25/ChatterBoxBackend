import jwt from 'jsonwebtoken'
import createHttpError from 'http-errors'
import User from '../models/User.js'

export const protect = async (req, res, next) => {
  try {
    let token

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      throw createHttpError(401, 'Not authorized, no token')
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.user = await User.findById(decoded.sub).select('-password')
      
      if (!req.user) {
        throw createHttpError(401, 'User not found')
      }
      
      next()
    } catch (error) {
      throw createHttpError(401, 'Not authorized, token failed')
    }
  } catch (err) {
    next(err)
  }
}