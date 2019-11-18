require('dotenv').config();

const cors = require('cors');
const bodyParser   = require('body-parser');
const cookieParser = require('cookie-parser');
const express      = require('express');
const session = require('express-session');
const favicon      = require('serve-favicon');
const hbs          = require('hbs');
const logger       = require('morgan');
const path         = require('path');

const dotenv = require('dotenv').config();

//enables databse connection
require('./configs/database/db.setup')

const app_name = require('./package.json').name;
const debug = require('debug')(`${app_name}:${path.basename(__filename).split('.')[0]}`);

const app = express();

// Middleware Setup
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Express View engine setup

// app.use(require('node-sass-middleware')({
//   src:  path.join(__dirname, 'public'),
//   dest: path.join(__dirname, 'public'),
//   sourceMap: true
// }));
      

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));

//SESSION
app.use(session({
  secret: process.env.secret,
  resave: true,
  saveUninitialized: true // don't save any sessions that doesn't have any data in them
}));

require('./configs/passport/passport.setup')(app);


// default value for title local
app.locals.title = 'Express - Generated with IronGenerator';


// ADD CORS HERE:
app.use(cors({
  // this could be multiple domains/origins, but we will allow just our React app
  credentials: true,
  origin: ["http://localhost:3000"]
}));


const index = require('./routes/index');
app.use('/', index);

const authRoutes = require('./routes/authService');
app.use('/', authRoutes);

// include your new routes here:
app.use('/', require('./routes/post-routes'));
app.use('/api', require('./routes/thing-routes'));
app.use('/api', require('./routes/file-upload-routes'));

app.use((req, res, next) => {
  // If no routes match, send them the React HTML.
  res.sendFile(__dirname + "/public/index.html");
});

module.exports = app;
