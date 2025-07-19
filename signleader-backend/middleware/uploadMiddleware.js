const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

module.exports = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'preview', maxCount: 1 }
]);
