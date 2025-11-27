import cloudinary from '../config/cloudinary.js'
import { Readable } from 'stream'

/**
 * Upload file buffer to Cloudinary
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} folder - Cloudinary folder (e.g., 'profile-pictures' or 'group-pictures')
 * @param {string} publicId - Optional public ID for the image
 * @returns {Promise<{url: string, public_id: string}>}
 */
export const uploadToCloudinary = (fileBuffer, folder, publicId = null) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: folder,
      resource_type: 'image',
      // Removed format: 'auto' - Cloudinary keeps original format during upload
      // Use transformation URLs when serving images if you want format optimization
      quality: 'auto', // This is valid for upload
    }

    if (publicId) {
      uploadOptions.public_id = publicId
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error)
        } else {
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
          })
        }
      }
    )

    // Convert buffer to stream
    const stream = Readable.from(fileBuffer)
    stream.pipe(uploadStream)
  })
}

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise}
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return
    
    // Extract public_id from URL if full URL is provided
    const extractedPublicId = publicId.includes('/') 
      ? publicId.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, '')
      : publicId
    
    const result = await cloudinary.uploader.destroy(extractedPublicId)
    return result
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error)
    // Don't throw - allow deletion to continue even if Cloudinary deletion fails
    return null
  }
}

/**
 * Extract public_id from Cloudinary URL
 * @param {string} url - Full Cloudinary URL
 * @returns {string|null}
 */
export const extractPublicIdFromUrl = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null
  
  try {
    // Extract public_id from URL like: https://res.cloudinary.com/xxx/image/upload/v1234567890/folder/image.jpg
    const parts = url.split('/')
    const uploadIndex = parts.findIndex(part => part === 'upload')
    if (uploadIndex === -1) return null
    
    // Get everything after 'upload' and before file extension
    const pathAfterUpload = parts.slice(uploadIndex + 2).join('/')
    return pathAfterUpload.replace(/\.[^/.]+$/, '')
  } catch (error) {
    return null
  }
}