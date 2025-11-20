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
      .populate('participants', 'firstName lastName email')
      .populate({
        path: 'lastMessage',
        select: 'content sender createdAt',
        populate: {
          path: 'sender',
          select: 'firstName lastName email',
        },
      })
      .sort({ updatedAt: -1 })
      .limit(50)

    // Format chats to include timestamp in lastMessage
    const formattedChats = chats.map(chat => {
      const chatObj = chat.toObject()
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
      .populate('sender', 'firstName lastName email')
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
    const { groupName, participantIds } = req.body
    const currentUserId = req.user._id.toString()

    if (!groupName || !groupName.trim()) {
      throw createHttpError(400, 'Group name is required')
    }

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      throw createHttpError(400, 'At least one participant is required')
    }

    // Add current user to participants
    const allParticipants = [currentUserId, ...participantIds]

    // Remove duplicates
    const uniqueParticipants = [...new Set(allParticipants)]

    // Verify all participants exist
    const users = await User.find({ _id: { $in: uniqueParticipants } })
    if (users.length !== uniqueParticipants.length) {
      throw createHttpError(400, 'One or more participants not found')
    }

    // Create group chat
    const chat = await Chat.create({
      participants: uniqueParticipants,
      isGroupChat: true,
      groupName: groupName.trim(),
    })

    // Populate participants
    await chat.populate('participants', 'firstName lastName email')

    res.status(201).json(chat)
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

    // Verify current user is a participant
    if (!chat.participants.some(p => p.toString() === currentUserId)) {
      throw createHttpError(403, 'Not authorized')
    }

    chat.groupName = groupName.trim()
    await chat.save()

    await chat.populate('participants', 'firstName lastName email')

    res.json(chat)
  } catch (err) {
    next(err)
  }
}