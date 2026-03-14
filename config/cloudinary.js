const cloudinary = require('cloudinary').v2;
const {
    CloudinaryStorage
} = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dhqih0txj',
    api_key: process.env.CLOUDINARY_API_KEY || '768711335699391',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'Trvy26meoa_1XQ70qTsCrFWGq2w'
});

// Create storage for student pictures
const studentStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'islamic-school/students',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
        transformation: [{
            width: 300,
            height: 300,
            crop: 'fill'
        }]
    }
});

// Create storage for documents
const documentStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'islamic-school/documents',
        allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
    }
});

module.exports = {
    cloudinary,
    studentStorage,
    documentStorage
};
