const path = require("path");

// 根据 NODE_ENV 确定要加载的环境文件
const env = process.env.NODE_ENV || "development";
const envFile = `.env.${env}`;
const fallbackFile = ".env";

// 先尝试加载特定环境的配置文件，如果不存在则使用 .env
require("dotenv").config({
  path: path.resolve(process.cwd(), envFile),
});

// 如果特定环境文件不存在，加载默认的 .env 作为备用
if (!require("fs").existsSync(envFile)) {
  console.log(`⚠️  ${envFile} 不存在，使用默认的 .env 文件`);
  require("dotenv").config({
    path: path.resolve(process.cwd(), fallbackFile),
  });
} else {
  console.log(`🌍 加载环境配置: ${envFile}`);
}

module.exports = {
  environment: env,
  port: process.env.PORT || 4200,
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    dialect: "mysql",
  },
  oss: {
    region: process.env.OSS_REGION,
    endpoint: process.env.OSS_ENDPOINT,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    secure: true, // 强制使用 HTTPS
  },
};
