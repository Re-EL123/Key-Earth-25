const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDirs = {
  products: './uploads/products',
  stores: './uploads/stores',
  users: './uploads/users',
  drivers: './uploads/drivers',
  reports: './uploads/reports',
  temp: './uploads/temp',
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadType = req.params.uploadType || req.body.uploadType || 'temp';
    const destination = uploadDirs[uploadType] || uploadDirs.temp;
    cb(null, destination);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed image types
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  // Allowed document types
  const documentTypes = /pdf|doc|docx|xls|xlsx|csv/;
  
  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  if (file.fieldname.includes('image') || file.fieldname.includes('photo') || file.fieldname.includes('logo')) {
    const isValidImage = imageTypes.test(extname) && /image/.test(mimetype);
    if (isValidImage) {
      return cb(null, true);
    } else {
      return cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }

  if (file.fieldname.includes('document') || file.fieldname.includes('file')) {
    const isValidDocument = documentTypes.test(extname.substring(1));
    if (isValidDocument) {
      return cb(null, true);
    } else {
      return cb(new Error('Only document files are allowed (pdf, doc, docx, xls, xlsx, csv)'));
    }
  }

  cb(null, true);
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || 5242880), // 5MB default
  },
});

// Upload configurations
const uploadSingle = (fieldName) => upload.single(fieldName);
const uploadMultiple = (fieldName, maxCount = 5) => upload.array(fieldName, maxCount);
const uploadFields = (fields) => upload.fields(fields);

// Error handler for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  
  next();
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  handleUploadError,
  uploadDirs,
};