// import multer from 'multer'
// import path from 'path'
// import { fileURLToPath } from 'url'
// import fs from 'fs'

// const __filename = fileURLToPath(import.meta.url)
// const __dirname = path.dirname(__filename)

// // Create uploads directory if it doesn't exist
// const uploadsDir = path.join(__dirname, '../public/uploads')
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir, { recursive: true })
// }

// // Configure storage
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadsDir)
//   },
//   filename: (req, file, cb) => {
//     // Generate unique filename: type-timestamp-random.extension
//     const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`
//     const ext = path.extname(file.originalname)
//     // Determine file type based on field name
//     const prefix = file.fieldname === 'groupPicture' ? 'group' : 'profile'
//     cb(null, `${prefix}-${uniqueSuffix}${ext}`)
//   },
// })

// // File filter - only images
// const fileFilter = (req, file, cb) => {
//   const allowedTypes = /jpeg|jpg|png|gif|webp/
//   const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
//   const mimetype = allowedTypes.test(file.mimetype)

//   if (mimetype && extname) {
//     return cb(null, true)
//   } else {
//     cb(new Error('Only image files are allowed!'))
//   }
// }

// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
//   fileFilter,
// })

// export default upload

import multer from 'multer'
import path from 'path'

// Configure multer to use memory storage (Cloudinary needs buffer)
const storage = multer.memoryStorage()

// File filter - only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if (mimetype && extname) {
    return cb(null, true)
  } else {
    cb(new Error('Only image files are allowed!'))
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
})

export default upload