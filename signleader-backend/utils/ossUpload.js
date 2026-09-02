const fs = require('fs').promises
const ossClient = require('../services/ossClient')

async function putTemporaryUpload(objectKey, file) {
  try {
    return await ossClient.put(objectKey, file.path)
  } finally {
    await fs.unlink(file.path).catch(() => {})
  }
}

module.exports = {putTemporaryUpload}
