const OSS = require("ali-oss");
const config = require("../config").oss;

const client = new OSS({
  region: config.region,
  accessKeyId: config.accessKeyId,
  accessKeySecret: config.accessKeySecret,
  bucket: config.bucket,
  secure: config.secure,
});

module.exports = client;
