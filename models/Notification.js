const mongoose = require('mongoose');

const Schema  = mongoose.Schema;

const notificationSchema = new Schema({

})

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification