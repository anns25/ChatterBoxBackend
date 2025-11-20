import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Message from '../models/Message.js'
import Chat from '../models/Chat.js'

let io

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
  })

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.sub).select('-password')
      
      if (!user) {
        return next(new Error('Authentication error: User not found'))
      }

      socket.userId = user._id.toString()
      socket.user = user
      next()
    } catch (error) {
      next(new Error('Authentication error: Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.user.firstName} ${socket.user.lastName} (${socket.userId})`)

    // Emit user online status to all clients
    socket.broadcast.emit('userOnline', socket.userId)

    // Handle joining a chat room
    socket.on('joinChat', async (chatId) => {
      try {
        // Verify user is a participant in this chat
        const chat = await Chat.findById(chatId)
        if (chat && chat.participants.some(p => p.toString() === socket.userId)) {
          socket.join(`chat:${chatId}`)
          console.log(`User ${socket.userId} joined chat ${chatId}`)
        }
      } catch (error) {
        console.error('Error joining chat:', error)
      }
    })

    // Handle leaving a chat room
    socket.on('leaveChat', (chatId) => {
      socket.leave(`chat:${chatId}`)
      console.log(`User ${socket.userId} left chat ${chatId}`)
    })

    // Handle sending a message
    socket.on('sendMessage', async (messageData) => {
      try {
        const { chatId, content, sender } = messageData

        // Verify user is the sender
        if (sender !== socket.userId) {
          return socket.emit('error', { message: 'Unauthorized' })
        }

        // Verify chat exists and user is a participant
        const chat = await Chat.findById(chatId)
        if (!chat) {
          return socket.emit('error', { message: 'Chat not found' })
        }

        if (!chat.participants.some(p => p.toString() === socket.userId)) {
          return socket.emit('error', { message: 'Not authorized to send messages in this chat' })
        }

        // Create message in database
        const message = await Message.create({
          chat: chatId,
          sender: sender,
          content: content,
        })

        // Populate message with sender info
        await message.populate('sender', 'firstName lastName email')

        // Update chat's last message and timestamp
        await Chat.findByIdAndUpdate(chatId, {
          lastMessage: message._id,
          updatedAt: new Date(),
        })

              // Format message for client
              const messageToSend = {
                _id: message._id.toString(),
                sender: message.sender._id.toString(),
                senderName: `${message.sender.firstName} ${message.sender.lastName}`,
                senderEmail: message.sender.email,
                content: message.content,
                timestamp: message.createdAt,
                chatId: chatId,
              }

        // Emit message to all users in the chat room
        io.to(`chat:${chatId}`).emit('message', messageToSend)

        // Also emit to sender to confirm message was sent (even if not in room)
        socket.emit('messageSent', messageToSend)

        console.log(`Message sent in chat ${chatId} by ${socket.userId}`)
      } catch (error) {
        console.error('Error sending message:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // Handle typing indicator
    socket.on('typing', (data) => {
      const { chatId, isTyping } = data
      // Emit typing status to other users in the chat (not to sender)
      socket.to(`chat:${chatId}`).emit('typing', {
        userId: socket.userId,
        isTyping: isTyping,
      })
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.user.firstName} ${socket.user.lastName} (${socket.userId})`)
      // Emit user offline status
      socket.broadcast.emit('userOffline', socket.userId)
    })
  })

  return io
}

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized')
  }
  return io
}