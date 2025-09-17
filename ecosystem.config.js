module.exports = {
  apps: [
    {
      name: "signleader-management",
      script: "./app.js",
      cwd: "/var/www/signleader-management/signleader-backend",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
