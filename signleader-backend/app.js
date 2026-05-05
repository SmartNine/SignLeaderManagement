const express = require('express');
const cors = require('cors');
const config = require('./config');
const { sequelize } = require('./models');

const uploadRoutes = require('./routes/uploadRoutes');
const queryRoutes = require('./routes/queryRoutes');
const zipUploadRoutes = require('./routes/zipUploadRoutes');
const editableNodeRoutes = require('./routes/editableNodeRoutes');
const templateRoutes = require('./routes/templateRoutes');
const accessoryRoutes = require('./routes/accessoryRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/upload', uploadRoutes);
app.use('/query', queryRoutes);
app.use('/zip', zipUploadRoutes);
app.use('/nodes', editableNodeRoutes);
app.use('/templates', templateRoutes);
app.use('/accessories', accessoryRoutes);

sequelize.sync().then(() => {
  console.log('✅ 数据库连接成功，模型同步完成');
});

app.listen(config.port, () => {
  console.log(`🚀 Server running at http://localhost:${config.port}`);
});
