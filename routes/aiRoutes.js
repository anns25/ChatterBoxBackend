import { Router } from 'express'
import { rewriteMessage } from '../controllers/aiController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = Router()

router.use(protect)
router.post('/rewrite', rewriteMessage)

export default router