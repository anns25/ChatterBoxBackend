import { Router } from 'express'
import { searchUsers, getUserById, updateProfile, changePassword, uploadProfilePicture, deleteProfilePicture } from '../controllers/userController.js'
import { protect } from '../middleware/authMiddleware.js'
import upload from "../middleware/multer.js";

const router = Router()

router.use(protect)

// All user routes require authentication
router.get('/search', searchUsers)
router.patch('/profile', updateProfile)
router.patch('/password', changePassword)
router.post('/profile-picture', upload.single('profilePicture'), uploadProfilePicture)
router.delete('/profile-picture', deleteProfilePicture)
router.get('/:id', getUserById)

export default router