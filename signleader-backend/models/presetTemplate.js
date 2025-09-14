const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const PresetTemplate = sequelize.define(
    "PresetTemplate",
    {
      sku: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      json_url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      preview_url: {
        type: DataTypes.STRING,
      },
      color_scheme: {
        type: DataTypes.STRING,
      },
      tags: {
        type: DataTypes.STRING,
      },
      created_by: {
        type: DataTypes.STRING,
      },
    },
    {
      tableName: "preset_template",
      underscored: true,
      timestamps: true,
    }
  );

  return PresetTemplate;
};
