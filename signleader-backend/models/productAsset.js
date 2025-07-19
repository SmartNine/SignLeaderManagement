const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "ProductAsset",
    {
      sku: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("3d_model", "2d_template"),
        allowNull: false,
      },
      name: DataTypes.STRING,
      oss_url: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      preview_url: DataTypes.TEXT,
    },
    {
      tableName: "product_assets",
      underscored: true,
    }
  );
};
