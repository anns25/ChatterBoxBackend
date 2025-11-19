import { Router } from 'express'
import { createOrGetChat, getUserChats, getChatMessages, createGroupChat, updateGroupName, addParticipantsToGroup, removeParticipantFromGroup } from '../controllers/chatController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = Router()

// All chat routes require authentication
router.use(protect)

router.post('/', createOrGetChat)
router.get('/', getUserChats)
router.get('/:chatId/messages', getChatMessages)

// Group chat routes
router.post('/group', createGroupChat)
router.patch('/group/:chatId/name', updateGroupName)
router.post('/group/:chatId/participants', addParticipantsToGroup)
router.delete('/group/:chatId/participants/:userId', removeParticipantFromGroup)

export default router