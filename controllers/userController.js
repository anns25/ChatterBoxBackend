import createHttpError from 'http-errors'
import User from '../models/User.js'

export const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query
    const currentUserId = req.user._id.toString()

    // If no query, return all users (excluding current user)
    if (!q || q.trim().length === 0) {
      const allUsers = await User.find({
        _id: { $ne: currentUserId }, // Exclude current user
      })
        .select('firstName lastName email role profilePicture _id') // Explicitly select fields
        .limit(50) // Limit results to 50
        .sort({ firstName: 1, lastName: 1 }) // Sort alphabetically by name

      return res.json(allUsers)
    }

    const searchQuery = q.trim()

    // Search by firstName, lastName, or email (case-insensitive)
    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } }, // Exclude current user
        {
          $or: [
            { firstName: { $regex: searchQuery, $options: 'i' } },
            { lastName: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } },
          ],
        },
      ],
    })
      .select('firstName lastName email role profilePicture _id') // Explicitly select fields
      .limit(20) // Limit results to 20
      .sort({ firstName: 1, lastName: 1 }) // Sort alphabetically by name

    res.json(users)
  } catch (err) {
    next(err)
  }
}

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params

    const user = await User.findById(id).select('-password')

    if (!user) {
      throw createHttpError(404, 'User not found')
    }

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    })
  } catch (err) {
    next(err)
  }
}

export const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, email } = req.body
    const userId = req.user._id

    // Check if email is being changed and if it's already taken
    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        throw createHttpError(409, 'Email already in use')
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { firstName, lastName, email },
      { new: true, runValidators: true }
    ).select('-password')

    res.json({
      _id: updatedUser._id,
      firstName: updatedUser.firstName, // Fixed: was updatedUser.name
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      role: updatedUser.role,
      profilePicture: updatedUser.profilePicture,
      createdAt: updatedUser.createdAt,
      lastLoginAt: updatedUser.lastLoginAt,
    })
  } catch (err) {
    next(err)
  }
}

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    const userId = req.user._id

    // Validation
    if (!currentPassword || !newPassword) {
      throw createHttpError(400, 'Please provide both current and new password')
    }
    if (newPassword.length < 8) {
      throw createHttpError(400, 'Password must be at least 8 characters long')
    }
    if (newPassword === currentPassword) {
      throw createHttpError(400, 'New password cannot be the same as the current password')
    }

    // Get user with password
    const user = await User.findById(userId).select('+password')

    if (!user) {
      throw createHttpError(404, 'User not found')
    }

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword)
    if (!isMatch) {
      throw createHttpError(401, 'Current password is incorrect')
    }

    // Update password
    user.password = newPassword
    await user.save()

    res.json({ message: 'Password changed successfully' })
  } catch (err) {
    next(err)
  }
}