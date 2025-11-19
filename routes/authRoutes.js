import { Router } from 'express'
import { register, login } from '../controllers/authController.js'
import { registerValidation, loginValidation } from '../validators/authValidators.js'

const router = Router()

router.post('/register', registerValidation, register)
router.post('/login', loginValidation, login)

export default router