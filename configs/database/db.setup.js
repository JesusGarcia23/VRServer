const mongoose = require('mongoose');

mongoose.connect('mongodb://heroku_4dbgpb04:5gr5b9tela03oi0d5vkm75pd95@ds031657.mlab.com:31657/heroku_4dbgpb04', {useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true})
  .then(x => {
    console.log(`Connected to Mongo! Database name: "${x.connections[0].name}"`)
  })
  .catch(err => {
    console.error('Error connecting to mongo', err)
  });