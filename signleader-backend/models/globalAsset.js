const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "GlobalAsset",
    {
      category: {
        type: DataTypes.ENUM("image", "font", "pattern", "text_template"),
        allowNull: false,
      },
      name: DataTypes.STRING,
      oss_url: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      tags: DataTypes.STRING,
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "global_assets",
      underscored: true,
    }
  );
};
