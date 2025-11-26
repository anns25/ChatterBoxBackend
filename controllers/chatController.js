import createHttpError from 'http-errors'
import Chat from '../models/Chat.js'
import Message from '../models/Message.js'
import User from '../models/User.js'

export const createOrGetChat = async (req, res, next) => {
  try {
    const { participantId } = req.body
    const currentUserId = req.user._id.toString()

    if (!participantId) {
      throw createHttpError(400, 'Participant ID is required')
    }

    if (participantId === currentUserId) {
      throw createHttpError(400, 'Cannot create chat with yourself')
    }

    // Check if participant exists
    const participant = await User.findById(participantId)
    if (!participant) {
      throw createHttpError(404, 'Participant not found')
    }

    // Check if chat already exists between these two users
    let chat = await Chat.findOne({
      isGroupChat: false,
      participants: { $all: [currentUserId, participantId] },
      $expr: { $eq: [{ $size: '$participants' }, 2] },
    }).populate('participants', 'firstName lastName email')

    if (chat) {
      // Return existing chat
      return res.json(chat)
    }

    // Create new chat
    chat = await Chat.create({
      participants: [currentUserId, participantId],
      isGroupChat: false,
    })

    // Populate participants
    await chat.populate('participants', 'firstName lastName email')

    res.status(201).json(chat)
  } catch (err) {
    next(err)
  }
}

export const getUserChats = async (req, res, next) => {
  try {
    const currentUserId = req.user._id.toString()

    const chats = await Chat.find({
      participants: currentUserId,
    })
      .populate('participants', 'firstName lastName email profilePicture')
      .populate({
        path: 'lastMessage',
        select: 'content sender createdAt',
        populate: {
          path: 'sender',
          select: 'firstName lastName email profilePicture',
        },
      })
      .sort({ updatedAt: -1 })
      .limit(50)

    // Format chats to include timestamp in lastMessage
    const formattedChats = chats.map(chat => {
      const chatObj = chat.toObject()

      if (chatObj.participants) {
        chatObj.participants = chatObj.participants.map(participant => ({
          ...participant,
          _id: participant._id.toString(),
          profilePicture: participant.profilePicture 
            ? `${req.protocol}://${req.get('host')}${participant.profilePicture}`
            : null,
        }))
      }
      if (chatObj.lastMessage) {
        chatObj.lastMessage = {
          ...chatObj.lastMessage,
          sender: chatObj.lastMessage.sender._id.toString(),
          senderName: `${chatObj.lastMessage.sender.firstName} ${chatObj.lastMessage.sender.lastName}`,
          senderEmail: chatObj.lastMessage.sender.email,
          timestamp: chatObj.lastMessage.createdAt,
        }
      }
      return chatObj
    })

    res.json(formattedChats)
  } catch (err) {
    next(err)
  }
}

export const getChatMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params
    const currentUserId = req.user._id.toString()

    // Verify user is a participant in this chat
    const chat = await Chat.findById(chatId)
    if (!chat) {
      throw createHttpError(404, 'Chat not found')
    }

    if (!chat.participants.includes(currentUserId)) {
      throw createHttpError(403, 'Not authorized to access this chat')
    }

    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'firstName lastName email profilePicture')
      .sort({ createdAt: 1 })
      .limit(100)

    // Format messages to include timestamp field
    const formattedMessages = messages.map(msg => ({
      _id: msg._id.toString(),
      sender: msg.sender._id.toString(),
      senderName: `${msg.sender.firstName} ${msg.sender.lastName}`,
      senderEmail: msg.sender.email,
      content: msg.content,
      timestamp: msg.createdAt,
      chatId: chatId,
    }))

    res.json(formattedMessages)
  } catch (err) {
    next(err)
  }
}

// Add these new functions to chatController.js

export const createGroupChat = async (req, res, next) => {
  try {
    // Access fields from req.body (multer parses FormData text fields)
    const groupName = req.body?.groupName
    const participantIds = req.body?.participantIds
    
    const currentUserId = req.user._id.toString()

    if (!groupName || !groupName.trim()) {
      throw createHttpError(400, 'Group name is required')
    }

    // Parse participantIds if it's a string (from FormData)
    let parsedParticipantIds = participantIds
    if (typeof participantIds === 'string') {
      try {
        parsedParticipantIds = JSON.parse(participantIds)
      } catch {
        throw createHttpError(400, 'Invalid participantIds format')
      }
    }

    if (!parsedParticipantIds || !Array.isArray(parsedParticipantIds) || parsedParticipantIds.length === 0) {
      throw createHttpError(400, 'At least one participant is required')
    }

    // Add current user to participants
    const allParticipants = [currentUserId, ...parsedParticipantIds]

    // Remove duplicates
    const uniqueParticipants = [...new Set(allParticipants)]

    // Verify all participants exist
    const users = await User.find({ _id: { $in: uniqueParticipants } })
    if (users.length !== uniqueParticipants.length) {
      throw createHttpError(400, 'One or more participants not found')
    }

    // Get the uploaded file URL if present
    const groupPicture = req.file 
      ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
      : undefined

    // Create group chat
    const chat = await Chat.create({
      participants: uniqueParticipants,
      isGroupChat: true,
      groupName: groupName.trim(),
      admin: currentUserId,
      groupPicture: groupPicture,
    })

    // Populate participants
    await chat.populate('participants', 'firstName lastName email profilePicture')
    await chat.populate('admin', 'firstName lastName email profilePicture')

    res.status(201).json(chat)
  } catch (err) {
    next(err)
  }
}

export const getUserAdminGroups = async (req, res, next) => {
  try {
    const currentUserId = req.user._id.toString()

    const groups = await Chat.find({
      isGroupChat: true,
      admin: currentUserId,
    })
      .populate('participants', 'firstName lastName email profilePicture')
      .populate({
        path: 'admin',
        select: 'firstName lastName email profilePicture',
      })
      .sort({ updatedAt: -1 })

    // Format groups to include full URLs for profile pictures
    const formattedGroups = groups.map(group => {
      const groupObj = group.toObject()
      
      if (groupObj.participants) {
        groupObj.participants = groupObj.participants.map(participant => ({
          ...participant,
          _id: participant._id.toString(),
          profilePicture: participant.profilePicture 
            ? `${req.protocol}://${req.get('host')}${participant.profilePicture}`
            : null,
        }))
      }
      
      if (groupObj.groupPicture && !groupObj.groupPicture.startsWith('http')) {
        groupObj.groupPicture = `${req.protocol}://${req.get('host')}${groupObj.groupPicture}`
      }
      
      if (groupObj.admin) {
        groupObj.admin = {
          ...groupObj.admin,
          _id: groupObj.admin._id.toString(),
          profilePicture: groupObj.admin.profilePicture 
            ? `${req.protocol}://${req.get('host')}${groupObj.admin.profilePicture}`
            : null,
        }
      }
      
      return groupObj
    })

    res.json(formattedGroups)
  } catch (err) {
    next(err)
  }
}

export const addParticipantsToGroup = async (req, res, next) => {
  try {
    const { chatId } = req.params
    const { participantIds } = req.body
    const currentUserId = req.user._id.toString()

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      throw createHttpError(400, 'At least one participant is required')
    }

    // Find chat and verify it's a group chat
    const chat = await Chat.findById(chatId)
    if (!chat) {
      throw createHttpError(404, 'Chat not found')
    }

    if (!chat.isGroupChat) {
      throw createHttpError(400, 'This is not a group chat')
    }

    // Verify current user is a participant
    if (!chat.participants.some(p => p.toString() === currentUserId)) {
      throw createHttpError(403, 'Not authorized to add participants')
    }

    // Verify new participants exist
    const users = await User.find({ _id: { $in: participantIds } })
    if (users.length !== participantIds.length) {
      throw createHttpError(400, 'One or more participants not found')
    }

    // Add new participants (avoid duplicates)
    const existingParticipantIds = chat.participants.map(p => p.toString())
    const newParticipants = participantIds.filter(id => !existingParticipantIds.includes(id))
    
    if (newParticipants.length === 0) {
      return res.json({ message: 'All participants are already in the group', chat })
    }

    chat.participants.push(...newParticipants)
    await chat.save()

    await chat.populate('participants', 'name email')

    res.json(chat)
  } catch (err) {
    next(err)
  }
}

export const removeParticipantFromGroup = async (req, res, next) => {
  try {
    const { chatId, userId } = req.params
    const currentUserId = req.user._id.toString()

    // Find chat and verify it's a group chat
    const chat = await Chat.findById(chatId)
    if (!chat) {
      throw createHttpError(404, 'Chat not found')
    }

    if (!chat.isGroupChat) {
      throw createHttpError(400, 'This is not a group chat')
    }

    // Verify current user is a participant
    if (!chat.participants.some(p => p.toString() === currentUserId)) {
      throw createHttpError(403, 'Not authorized')
    }

    // Can't remove yourself if you're the only participant
    if (userId === currentUserId && chat.participants.length <= 1) {
      throw createHttpError(400, 'Cannot remove the last participant')
    }

    // Remove participant
    chat.participants = chat.participants.filter(
      p => p.toString() !== userId
    )
    await chat.save()

    await chat.populate('participants', 'firstName lastName email')

    res.json(chat)
  } catch (err) {
    next(err)
  }
}

export const updateGroupName = async (req, res, next) => {
  try {
    const { chatId } = req.params
    const { groupName } = req.body
    const currentUserId = req.user._id.toString()

    if (!groupName || !groupName.trim()) {
      throw createHttpError(400, 'Group name is required')
    }

    // Find chat and verify it's a group chat
    const chat = await Chat.findById(chatId)
    if (!chat) {
      throw createHttpError(404, 'Chat not found')
    }

    if (!chat.isGroupChat) {
      throw createHttpError(400, 'This is not a group chat')
    }

    // Verify current user is the admin
    if (chat.admin.toString() !== currentUserId) {
      throw createHttpError(403, 'Only group admin can update group name')
    }

    chat.groupName = groupName.trim()
    await chat.save()

    await chat.populate('participants', 'firstName lastName email profilePicture')
    await chat.populate('admin', 'firstName lastName email profilePicture')

    // Format group picture URL if needed
    const groupObj = chat.toObject()
    if (groupObj.groupPicture && !groupObj.groupPicture.startsWith('http')) {
      groupObj.groupPicture = `${req.protocol}://${req.get('host')}${groupObj.groupPicture}`
    }

    res.json(groupObj)
  } catch (err) {
    next(err)
  }
}

export const updateGroupPicture = async (req, res, next) => {
  try {
    const { chatId } = req.params
    const currentUserId = req.user._id.toString()

    // Find chat and verify it's a group chat
    const chat = await Chat.findById(chatId)
    if (!chat) {
      throw createHttpError(404, 'Chat not found')
    }

    if (!chat.isGroupChat) {
      throw createHttpError(400, 'This is not a group chat')
    }

    // Verify current user is the admin
    if (chat.admin.toString() !== currentUserId) {
      throw createHttpError(403, 'Only group admin can update group picture')
    }

    if (!req.file) {
      throw createHttpError(400, 'No image file provided')
    }

    // Get the uploaded file URL
    const groupPicture = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`

    // Delete old picture if it exists
    if (chat.groupPicture) {
      const fs = await import('fs')
      const path = await import('path')
      const { fileURLToPath } = await import('url')
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)
      
      const oldPicturePath = chat.groupPicture.replace(`${req.protocol}://${req.get('host')}`, '')
      const fullPath = path.join(__dirname, '..', 'public', oldPicturePath)
      
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    }

    chat.groupPicture = groupPicture
    await chat.save()

    await chat.populate('participants', 'firstName lastName email profilePicture')
    await chat.populate('admin', 'firstName lastName email profilePicture')

    const groupObj = chat.toObject()
    res.json(groupObj)
  } catch (err) {
    next(err)
  }
}

export const deleteGroupPicture = async (req, res, next) => {
  try {
    const { chatId } = req.params
    const currentUserId = req.user._id.toString()

    // Find chat and verify it's a group chat
    const chat = await Chat.findById(chatId)
    if (!chat) {
      throw createHttpError(404, 'Chat not found')
    }

    if (!chat.isGroupChat) {
      throw createHttpError(400, 'This is not a group chat')
    }

    // Verify current user is the admin
    if (chat.admin.toString() !== currentUserId) {
      throw createHttpError(403, 'Only group admin can delete group picture')
    }

    if (!chat.groupPicture) {
      return res.json({ message: 'Group has no picture to delete', chat })
    }

    // Delete the file from filesystem
    const fs = await import('fs')
    const path = await import('path')
    const { fileURLToPath } = await import('url')
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    
    const picturePath = chat.groupPicture.replace(`${req.protocol}://${req.get('host')}`, '')
    const fullPath = path.join(__dirname, '..', 'public', picturePath)
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }

    chat.groupPicture = null
    await chat.save()

    await chat.populate('participants', 'firstName lastName email profilePicture')
    await chat.populate('admin', 'firstName lastName email profilePicture')

    const groupObj = chat.toObject()
    res.json(groupObj)
  } catch (err) {
    next(err)
  }
}