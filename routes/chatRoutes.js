import { Router } from 'express'
import { 
  createOrGetChat, 
  getUserChats, 
  getChatMessages, 
  createGroupChat, 
  updateGroupName, 
  updateGroupPicture,
  deleteGroupPicture,
  addParticipantsToGroup, 
  removeParticipantFromGroup,
  getUserAdminGroups 
} from '../controllers/chatController.js'
import { protect } from '../middleware/authMiddleware.js'
import upload from '../middleware/multer.js'

const router = Router()

// All chat routes require authentication
router.use(protect)

router.post('/', createOrGetChat)
// Place specific routes before parameterized routes
router.get('/admin-groups', getUserAdminGroups)
router.get('/', getUserChats)
router.get('/:chatId/messages', getChatMessages)

// Group chat routes
router.post('/group', upload.single('groupPicture'), createGroupChat)
router.patch('/group/:chatId/name', updateGroupName)
router.patch('/group/:chatId/picture', upload.single('groupPicture'), updateGroupPicture)
router.delete('/group/:chatId/picture', deleteGroupPicture)
router.post('/group/:chatId/participants', addParticipantsToGroup)
router.delete('/group/:chatId/participants/:userId', removeParticipantFromGroup)

export default router
