'use strict';

const path = require('node:path');
const express = require('express');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', apiRouter);
app.use(express.static(path.join(__dirname, '..', 'public')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Third Umpire (Phase 1) listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
