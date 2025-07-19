const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "PresetTemplate",
    {
      sku: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: DataTypes.STRING,
      oss_json_url: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      preview_url: DataTypes.TEXT,
      tags: DataTypes.STRING,
      created_by: DataTypes.STRING,
    },
    {
      tableName: "preset_templates",
      underscored: true,
    }
  );
};
