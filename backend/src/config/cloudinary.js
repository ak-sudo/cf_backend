const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'civicflow-dev';
const apiKey = process.env.CLOUDINARY_API_KEY || 'dev-api-key';
const apiSecret = process.env.CLOUDINARY_API_SECRET || 'dev-api-secret';

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

/**
 * Generates an HMAC SHA-256 signature for secure direct client-to-Cloudinary upload
 */
function generateUploadSignature(userId, folder = 'civicflow/reports') {
  const timestamp = Math.round(new Date().getTime() / 1000);

  const paramsToSign = {
    folder,
    timestamp,
    tags: `civicflow,user_${userId}`,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
    tags: paramsToSign.tags,
  };
}

module.exports = {
  cloudinary,
  generateUploadSignature,
};
