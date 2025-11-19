import { validationResult } from 'express-validator'
import createHttpError from 'http-errors'
import User from '../models/User.js'
import generateToken from '../utils/generateToken.js'

const handleValidationErrors = (req) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw createHttpError(422, { errors: errors.array() })
  }
}

export const register = async (req, res, next) => {
  try {
    handleValidationErrors(req)
    const { name, email, password, role, adminCode } = req.body

    if (role === 'admin') {
      const requiredCode = process.env.ADMIN_SIGNUP_CODE
      if (!requiredCode || adminCode !== requiredCode) {
        throw createHttpError(403, 'Invalid admin signup code')
      }
    }

    const existing = await User.findOne({ email })
    if (existing) throw createHttpError(409, 'Email already registered')

    const user = await User.create({ name, email, password, role })
    const token = generateToken(user._id, user.role)

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    next(err)
  }
}

export const login = async (req, res, next) => {
  try {
    handleValidationErrors(req)
    const { email, password } = req.body

    const user = await User.findOne({ email }).select('+password')
    if (!user) throw createHttpError(401, 'Invalid credentials')

    const passwordMatch = await user.matchPassword(password)
    if (!passwordMatch) throw createHttpError(401, 'Invalid credentials')

    user.lastLoginAt = new Date()
    await user.save({ validateBeforeSave: false })

    const token = generateToken(user._id, user.role)

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    next(err)
  }
}