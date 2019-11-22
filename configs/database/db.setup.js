const mongoose = require('mongoose');

// mongoose.connect(process.env.MONGODB_URI, {useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true})
mongoose.connect('mongodb://localhost/file-upload-example-server', {useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true })
  .then(x => {
    console.log(`Connected to Mongo! Database name: "${x.connections[0].name}"`)
  })
  .catch(err => {
    console.error('Error connecting to mongo', err)
  });