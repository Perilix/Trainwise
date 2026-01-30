const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary explicitly
cloudinary.config({
  cloud_name: 'dncmc7vdo',
  api_key: '987571536728872',
  api_secret: 'X8Uol9go881ThMqkp9L4XQwzTPI'
});

// Configure Multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'runiq/chat';
    let resourceType = 'auto';

    if (file.mimetype.startsWith('image/')) {
      folder = 'runiq/chat/images';
      resourceType = 'image';
    } else {
      folder = 'runiq/chat/documents';
      resourceType = 'raw';
    }

    return {
      folder,
      resource_type: resourceType,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt'],
      transformation: file.mimetype.startsWith('image/')
        ? [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }]
        : undefined
    };
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorise'), false);
  }
};

// Multer upload middleware
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Avatar upload middleware (memory storage - will upload to Cloudinary in controller)
const uploadAvatarMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

// Exercise image storage
const exerciseStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'runiq/exercises',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }]
  }
});

const uploadExerciseImage = multer({
  storage: exerciseStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

module.exports = { cloudinary, upload, uploadAvatar: uploadAvatarMemory, uploadExerciseImage };
