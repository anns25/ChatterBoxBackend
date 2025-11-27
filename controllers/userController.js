import createHttpError from 'http-errors'
import User from '../models/User.js'
import { uploadToCloudinary, deleteFromCloudinary, extractPublicIdFromUrl } from '../utils/cloudinaryUpload.js'

export const uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      throw createHttpError(400, 'No file uploaded')
    }

    const userId = req.user._id
    const user = await User.findById(userId)

    if (!user) {
      throw createHttpError(404, 'User not found')
    }

    // Delete old profile picture from Cloudinary if it exists
    if (user.profilePicture) {
      const oldPublicId = extractPublicIdFromUrl(user.profilePicture)
      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId)
      }
    }

    // Upload new picture to Cloudinary
    const { url, public_id } = await uploadToCloudinary(
      req.file.buffer,
      'profile-pictures',
      `user-${userId}`
    )

    // Update user with new profile picture URL
    user.profilePicture = url
    await user.save()

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

export const deleteProfilePicture = async (req, res, next) => {
  try {
    const userId = req.user._id
    const user = await User.findById(userId)

    if (!user) {
      throw createHttpError(404, 'User not found')
    }

    // Delete from Cloudinary if it exists
    if (user.profilePicture) {
      const publicId = extractPublicIdFromUrl(user.profilePicture)
      if (publicId) {
        await deleteFromCloudinary(publicId)
      }
    }

    // Remove profile picture from user
    user.profilePicture = null
    await user.save()

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      profilePicture: null,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    })
  } catch (err) {
    next(err)
  }
}

export const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query
    const currentUserId = req.user._id.toString()

    let users

    if (!q || q.trim().length === 0) {
      users = await User.find({
        _id: { $ne: currentUserId },
      })
        .select('firstName lastName email role profilePicture _id')
        .limit(50)
        .sort({ firstName: 1, lastName: 1 })
    } else {
      const searchQuery = q.trim()
      users = await User.find({
        $and: [
          { _id: { $ne: currentUserId } },
          {
            $or: [
              { firstName: { $regex: searchQuery, $options: 'i' } },
              { lastName: { $regex: searchQuery, $options: 'i' } },
              { email: { $regex: searchQuery, $options: 'i' } },
            ],
          },
        ],
      })
        .select('firstName lastName email role profilePicture _id')
        .limit(20)
        .sort({ firstName: 1, lastName: 1 })
    }

    // Format users - Cloudinary URLs are already full URLs
    const formattedUsers = users.map(user => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture || null,
    }))

    res.json(formattedUsers)
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
      profilePicture: user.profilePicture || null,
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
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      role: updatedUser.role,
      profilePicture: updatedUser.profilePicture || null,
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

    if (!currentPassword || !newPassword) {
      throw createHttpError(400, 'Please provide both current and new password')
    }
    if (newPassword.length < 8) {
      throw createHttpError(400, 'Password must be at least 8 characters long')
    }
    if (newPassword === currentPassword) {
      throw createHttpError(400, 'New password cannot be the same as the current password')
    }

    const user = await User.findById(userId).select('+password')

    if (!user) {
      throw createHttpError(404, 'User not found')
    }

    const isMatch = await user.matchPassword(currentPassword)
    if (!isMatch) {
      throw createHttpError(401, 'Current password is incorrect')
    }

    user.password = newPassword
    await user.save()

    res.json({ message: 'Password changed successfully' })
  } catch (err) {
    next(err)
  }
}