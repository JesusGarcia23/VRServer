require('dotenv').config();

const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const session = require('express-session');
const favicon = require('serve-favicon');
const hbs = require('hbs');
const logger = require('morgan');
const path = require('path');
const Post = require("./models/Post")
const User = require('./models/User')
const Notifications = require('./models/Notification')
const uploader = require('./configs/cloudinary-setup')


const dotenv = require('dotenv').config();

//enables databse connection
require('./configs/database/db.setup')

const app_name = require('./package.json').name;
const debug = require('debug')(`${app_name}:${path.basename(__filename).split('.')[0]}`);

const app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
io.set('origins', '*:*')


// Middleware Setup
app.use(logger('dev'));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb' ,extended: true }));
app.use(cookieParser());

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
  origin: [process.env.HEROKU]
}));

const authRoutes = require('./routes/authService');
app.use('/', authRoutes);

var connectedUsers = {}
let clients = []

io.on('connection', socket => {
  const { user } = socket.handshake.query;
  connectedUsers[user] = socket.id;
  clients.push(connectedUsers)
  console.log('these are the clients', clients)
  console.log('these are the conected users', connectedUsers)
  console.log("the connected User of users is ", connectedUsers[user])
 

  // THESE EMIT GETS ALL THE POSTS FROM THE DB
  socket.on('initial_data', () => {
    try {
      Post.find()
        .populate('owner', '_id imageUrl username')
        .populate('likes', '_id imageUrl username')
        .populate('comments.user', '_id imageUrl username')
        .then(post => {
          // console.log(post)
          io.sockets.emit('get_data', post)
        })
        .catch(err => console.log(err))
    } catch (err) {
      console.log(err)
    }

    // THESE EMITS ALL USERS FROM DB
    User.find().select('username imageUrl followers following bio')
      .then(users => {
        io.sockets.emit('get_users', users)
      }).catch(err => console.log(err))

    //  FINDS ALL THE NOTIFICATIONS
    try {
      Notifications.find()
        .populate('fromWho', '_id username imageUrl')
        .populate('toWho', '_id username imageUrl')
        .populate('imageTo')
        .then(notifications => {
          io.sockets.emit('get_notifications', notifications)
        }).catch(err => console.log(err))
    } catch (err) {
      console.log(err)
    }

    // END OF ALL THE NOTIFICATIONS

    // THIS IS THE FOLLOWERES ROUTE

    app.post('/follow/:id', (req, res, next) => {
      const userId = req.body._id
      const userToFollowId = req.params.id
      const idArray = [userId, userToFollowId]

      const notification = new Notifications({
        type: "Follow",
        event: "Started following you",
        toWho: userToFollowId,
        fromWho: userId,
        imageTo: null,
        seen: false
      })
      User.find({ _id: { $in: idArray } })
        .then(theUsers => {
          let userFollower = theUsers[theUsers.findIndex(theUser => theUser.id === userId)]
          let userToFollow = theUsers[theUsers.findIndex(theUser => theUser.id === userToFollowId)]
          console.log(userFollower)
          if (userToFollow.followers.indexOf(userId) >= 0) {
            const userIndex = userToFollow.followers.indexOf(userId)
            const userToUnfollowIndex = userFollower.following.indexOf(userToFollowId)
            userFollower.following.splice(userToUnfollowIndex, 1)
            userToFollow.followers.splice(userIndex, 1)
          } else {
            userFollower.following.push(userToFollow._id)
            userToFollow.followers.push(userFollower._id)
            notification.save()
            io.sockets.emit('change_data')

          }

          theUsers[0].save((err) => {
            if (err) {
              res.json({ message: "An error just happened while following/unfollowing" })
            } else {
              theUsers[1].save((err) => {
                if (err) {
                  res.json({ message: "An error just happened while following/unfollowing" })
                } else {
                  theUsers[0].encryptedPassword = undefined
                  theUsers[1].encryptedPassword = undefined
                  res.json(theUsers)
                  io.sockets.emit('change_data')
                }
              })
            }
          })
        })
        .catch(err => {
          res.json(err)
        })

    })



    //DELETE POST ROUTE
    app.post('/delete/:id', (req, res, next) => {
      const postId = req.params.id
      Post.findByIdAndDelete(postId)
        .then(postToDelete => {
          Notifications.deleteMany({ 'imageTo': postId })
            .then(theNotification => {
              io.sockets.emit('change_data')
            })
            .catch(err => console.log(err))
        })
        .catch(err => console.log(err))
    })


    app.post('/createNewPost', uploader.single("imageUrl"), (req, res, next) => {
      const { caption, imagePost, tags } = req.body
      let tagsArray = []
      let finalArray = []
      if (tags.length !== 0) {
        tagsArray = tags.split(/[.,\/ -#]/)
        finalArray = tagsArray.filter(eachTag => { return eachTag !== "" })
      }

      Post.create({
        caption,
        image: imagePost,
        owner: req.user,
        likes: [],
        tags: finalArray,
        comments: []
      }).then(newPost => {
        res.status(200).json(newPost)
        io.sockets.emit('change_data')

      })
        .catch(err => console.log(err))
    })



    // ROUTE TO UPDATE A POST

    app.put('/updatePost/:id', async (req, res, _) => {
      const { id } = req.params
      const { caption, tags } = req.body
      let tagsArray = []
      let finalArray = []
      if (typeof tags === 'object') {
        finalArray = tags
      } else {
        tagsArray = tags.split(/[.,\/ -#]/)
        finalArray = tagsArray.filter(eachTag => { return eachTag !== "" })
      }
      if (!id) {
        res.json({ success: false, message: "cannot find post to edit" })
      } else {
        try {
          await Post.findOneAndUpdate({ _id: id }, {
            caption: caption,
            tags: finalArray
          }).populate('likes', '_id imageUrl username').populate('comments.user', '_id imageUrl username')
            .then(post => {
              res.json({
                tags: post.tags,
                caption: post.caption
              })
              io.sockets.emit('change_data', post)
            })
            .catch(err => {
              if (err) {
                res.json(err)
              }
            })
        } catch (err) {
          console.log(err)
        }
      }
    })





    // UPDATE USER PROFILE!

    app.put('/auth/updateUser/:id', uploader.single("imageUrl"), async (req, res, next) => {
      const { id } = req.params
      let { bio, imageFile, currentUser } = req.body
      if (typeof imageFile !== 'string') {
        imageFile = currentUser.imageUrl
      }

      try {
        await User.findOneAndUpdate({ _id: id }, {
          bio: bio,
          imageUrl: imageFile
        })
          .then(user => {
            res.json({
              bio: user.bio,
              imageUrl: user.imageUrl
            })

            io.sockets.emit('change_data')
          })
          .catch(err => {
            if (err) {
              res.json(err)
            }
          })
      } catch (err) {
        console.log(err)
      }
      //}
    })





    // THis IS THE ROUTE FOR THE COMMENTS
    app.put('/addComment/:id', (req, res, next) => {
      const { id } = req.params
      const { message, owner } = req.body

      try {
        Post.findByIdAndUpdate(id, {
          $push: {
            comments: {
              user: owner._id,
              comment: message
            }
          }
        })
          .then(postUpdated => {
            if (!postUpdated.owner.equals(owner._id)) {
              const notification = new Notifications({
                type: "Comment",
                event: "commented your post",
                toWho: postUpdated.owner,
                fromWho: owner._id,
                imageTo: id,
                seen: false
              })
              notification.save()

            }
            res.json(postUpdated)
            // THESE EMITS CHANGE_DATA WHICH CALLS FOR FRONTEND TO EMIT "INITIAL_DATA"
            io.sockets.emit('change_data')
          }).catch(err => console.log(err))

      } catch (err) {
        throw err
      }
    })



    // THESE IS THE LIKES ROUTE,
    app.post('/updateLikes/:id', (req, res, _) => {
      // EMITS CHANGE DATA -> SO ALL USERS CAN GET LIKES
      if (req.body._id === undefined) {
        res.json({ message: "WRONG!" })
      } else {
        const theUserId = req.body._id
        const postId = req.params.id
        Post.findById(postId)
          .populate('likes', '_id imageUrl username')
          .populate('comments.user', '_id imageUrl username')
          .then(thePost => {
            User.findById(theUserId).select('_id imageUrl username')
              .then(theUser => {
                console.log(thePost.likes.findIndex(userToFind => userToFind.id === theUser.id));
                const theIndex = thePost.likes.findIndex(userToFind => userToFind.id === theUser.id)
                if (theIndex >= 0) {
                  thePost.likes.splice(theIndex, 1);
                  thePost.save((err) => {
                    if (err) {
                      res.json({ success: false, message: "Something went wrong while Liking the post" })
                    } else {
                      res.json(thePost)
                      io.sockets.emit('change_data')
                    }
                  })
                } else {
                  if (!thePost.owner.equals(theUserId)) {
                    const notification = new Notifications({
                      type: "Like",
                      event: "Liked your post",
                      toWho: thePost.owner,
                      fromWho: theUser._id,
                      imageTo: postId,
                      seen: false
                    })
                    notification.save()
                    io.sockets.emit('change_data')
                  }
                  thePost.likes.push(theUser);
                  thePost.save((err) => {
                    if (err) {
                      res.json({ success: false, message: "Something went wrong while Liking the post" })
                    } else {
                      io.sockets.emit('change_data')
                      res.json(thePost)
                    }
                  })

                }
              }).catch(err => console.log(err))
          }).catch(err => console.log(err))
      }
    })

  })

  socket.on('disconnect', () => {
    io.sockets.emit('change_data')

    clients.splice(clients.indexOf(connectedUsers[user], 1))
    console.log(clients)



    console.log('a user disconnected', connectedUsers)
  })
  
});

app.get('/*', function(req, res) {
  res.sendFile(path.join(__dirname, './public/index.html'), function(err) {
    if (err) {
      res.status(500).send(err)
    }
  })
})

app.use((req, res, next) => {
  req.io = io
  req.connectedUsers = connectedUsers
  next()
})

const index = require('./routes/index');
app.use('/', index);

// include your new routes here:
// app.use('/', require('./routes/post-routes'));
app.use('/api', require('./routes/thing-routes'));
app.use('/api', require('./routes/file-upload-routes'));

module.exports = { app: app, server: server }



