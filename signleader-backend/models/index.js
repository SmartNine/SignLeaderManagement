const { Sequelize } = require('sequelize');
const config = require('../config').db;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  logging: false
});

const ProductAsset = require('./productAsset')(sequelize);
const PresetTemplate = require('./presetTemplate')(sequelize);
const GlobalAsset = require('./globalAsset')(sequelize);
const EditableNode = require('./editableNode')(sequelize);

module.exports = {
  sequelize,
  ProductAsset,
  PresetTemplate,
  GlobalAsset,
  EditableNode
};
