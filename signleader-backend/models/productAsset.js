const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "ProductAsset",
    {
      sku: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "产品 SKU",
      },
      type: {
        type: DataTypes.ENUM("3d_model", "usdz_model", "blend_model"),
        allowNull: false,
        defaultValue: "3d_model",
        comment: "模型类型（当前默认 3d_model，预留扩展）",
      },
      name: {
        type: DataTypes.STRING,
        comment: "资源名（可选）",
      },
      oss_url: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "模型文件上传到 OSS 的地址",
      },
      preview_url: {
        type: DataTypes.TEXT,
        comment: "模型缩略图（可选）",
      },
    },
    {
      tableName: "product_assets",
      underscored: true,
      timestamps: true,
    }
  );
