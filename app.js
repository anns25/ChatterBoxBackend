import express from 'express'
import { createServer } from 'http'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import connectDB from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import userRoutes from './routes/userRoutes.js'
import chatRoutes from './routes/chatRoutes.js'
import createHttpError from 'http-errors'
import cors from 'cors'
import { initializeSocket } from './socket/socketServer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

connectDB()

const app = express()

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')))

app.get('/', (req, res) => {
  res.send('ChatterBox API is running 🚀')
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/chats', chatRoutes)

app.use((req, res, next) => {
  next(createHttpError(404, 'Route not found'))
})

app.use((err, req, res, next) => {
  console.error(err)
  const status = err.status || 500
  const message = err.message || 'Internal server error'
  res.status(status).json({
    message,
    ...(err.errors ? { errors: err.errors } : {}),
  })
})

const PORT = process.env.PORT || 5000

// Create HTTP server
const httpServer = createServer(app)

// Initialize Socket.IO
initializeSocket(httpServer)

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Socket.IO server initialized`)
})