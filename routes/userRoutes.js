import { Router } from 'express'
import { searchUsers, getUserById, updateProfile, changePassword } from '../controllers/userController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = Router()

router.use(protect)

// All user routes require authentication
router.get('/search', searchUsers)
router.patch('/profile', updateProfile)
router.patch('/password', changePassword)
router.get('/:id', getUserById)

export default router