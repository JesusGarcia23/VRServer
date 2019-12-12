const express = require('express');

const router = express.Router();

const User = require('../models/User');

const bcrypt = require('bcryptjs');

const passport = require('passport');

// include CLOUDINARY:
const uploader = require('../configs/cloudinary-setup');


//GET ALL NOTIFICATIONS FROM DB
// router.get('/getNotifications/:id', (req, res, next) => {
//   console.log(req.params.id)
//   const { id } = req.params
//   Notifications.find({ toWho: id }).populate('fromWho', '_id username imageUrl').populate('toWho', '_id username imageUrl').populate('imageTo')
//     .then(theNotifications => {
//       res.status(200).json(theNotifications)
//     }).catch(err => console.log(err))
// })

//GET ALL USERS FROM DB
// router.get('/users', (req, res ,next) => {
//   User.find().select('username imageUrl followers following bio')
//   .then(allUser => {
//   // const protectUsers = []
//   // for(let i = 0; i < allUser.length; i++){
//   //   allUser[i].encryptedPassword = undefined
//   //   protectUsers.push(allUser[i])
//   // } 

//     res.json(allUser)
//   })
// })
// END OF GET ALL OF USERS FROM DB


//SIGN UP ROUTE
router.post('/auth/signup', uploader.single("imageUrl"), (req, res, next) => {
  const { username, email, password, imagePost, profileImgDefault } = req.body;

  if (username === "" || password === "") {
    res.status(401).json({ message: "All field need to be filled and password must contain a number!" })
    return;
  }

  User.findOne({ username })
    .then(foundUser => {
      if (foundUser !== null) {
        res.status(401).json({ message: "A user with the same username is already registered! " });
        return;
      }

      const bcryptsalt = 10;
      const salt = bcrypt.genSaltSync(bcryptsalt);
      const encryptedPassword = bcrypt.hashSync(password, salt);
      let imageUrl = ''

      if (imagePost === "") {
        imageUrl = profileImgDefault
      } else {
        imageUrl = imagePost
      }

      User.create({ username, email, encryptedPassword, imageUrl, bio: "Hello, I'm new here!", followers: [], following: [] })
        .then(userDoc => {

          // if all good, log in the user automatically
          // "req.login()" is a Passport method that calls "serializeUser()"
          // (that saves the USER ID in the session)

          req.login(userDoc, (err) => {
            if (err) {
              res.status(401).json({ message: "Something happened logging in after the signup" })
              return;
            }

            userDoc.encryptedPassword = undefined;
            res.status(200).json({ userDoc });
          })
        })
        .catch(err => next(err)); // close User.create()
    })
    .catch(err => next(err));// close User.findOne()
})
//END OF SIGNUP ROUTE

//LOGIN ROUTE
router.post('/auth/login', (req, res, next) => {
  passport.authenticate('local', (err, userDoc, failureDetails) => {
    if (err) {
      res.status(500).json({ message: "Something went wrong with login" })
    }
    if (!userDoc) {
      res.status(401).json(failureDetails)
    }

    req.login(userDoc, (err) => {
      if (err) {
        res.status(500).json({ message: 'Something went wrong with getting user object from DB' })
        return;
      }
      userDoc.encryptedPassword = undefined;
      res.status(200).json({ userDoc })
    })
  })(req, res, next);
})
//END OF LOGIN ROUTE

//LOGGED IN CHECK ROUTE
router.get('/auth/loggedin', (req, res, next) => {
  if (req.user) {
    req.user.encryptedPassword = undefined;
    // res.io.sockets.emit('loggedin', { userDoc: req.user })
    res.status(200).json({ userDoc: req.user })
  } else {
    res.status(401).json({ userDoc: null })
  }
})
//END OF LOGGED IN CHECK ROUTE

//LOGOUT ROUTE
router.delete('/auth/logout', (req, res, next) => {
  req.logout();
  res.json({ userDoc: null })

})
//END OF LOGOUT ROUTE

//FOLLOWING FUNCTIONALITY
//ANOTHER VERSION (SHORTER)
// router.post('/follow/:id', (req, res, next) => {
//   const userId = req.body._id
//   const userToFollowId = req.params.id
//   const idArray = [userId, userToFollowId]

//   const notification = new Notifications({
//     type: "Follow",
//     event: "Started following you",
//     toWho: userToFollowId,
//     fromWho: userId,
//     imageTo: null,
//     seen: false
//   })
//   //OLD WAY .populate('followers following', 'username imageUrl followers following')
//   //theUsers.findIndex(theUser => theUser.id === userId)
//   //theUsers.findIndex(theUser => theUser.id === userToFollowId)
//   User.find({ _id: { $in: idArray } })
//     .then(theUsers => {
//       let userFollower = theUsers[theUsers.findIndex(theUser => theUser.id === userId)]
//       let userToFollow = theUsers[theUsers.findIndex(theUser => theUser.id === userToFollowId)]
//       console.log(userFollower)
//       if (userToFollow.followers.indexOf(userId) >= 0) {
//         const userIndex = userToFollow.followers.indexOf(userId)
//         const userToUnfollowIndex = userFollower.following.indexOf(userToFollowId)
//         userFollower.following.splice(userToUnfollowIndex, 1)
//         userToFollow.followers.splice(userIndex, 1)
//       } else {
//         //OLD WAY {_id: userToFollow._id, username: userToFollow.username, imageUrl: userToFollow.imageUrl}
//         // {_id: userFollower._id, username: userFollower.username, imageUrl: userFollower.imageUrl}
//         userFollower.following.push(userToFollow._id)
//         userToFollow.followers.push(userFollower._id)
//         notification.save()
//       }

//       theUsers[0].save((err) => {
//         if (err) {
//           res.json({ message: "An error just happened while following/unfollowing" })
//         } else {
//           theUsers[1].save((err) => {
//             if (err) {
//               res.json({ message: "An error just happened while following/unfollowing" })
//             } else {
//               theUsers[0].encryptedPassword = undefined
//               theUsers[1].encryptedPassword = undefined
//               res.json(theUsers)
//             }
//           })
//         }
//       })


//     })
//     .catch(err => {
//       res.json(err)
//     })

// })

//UPDATE USER PROFILE
// router.put('/auth/updateUser/:id', uploader.single("imageUrl"), async (req, res, next) => {
//   const { id } = req.params
//   let { bio, imageFile, currentUser } = req.body
//   console.log(typeof imageFile)
//   // if(!id){
//   //   res.json({success: false ,message: "cannot find user to edit"})
//   // }else{

//   if (typeof imageFile !== 'string') {
//     imageFile = currentUser.imageUrl
//   }

//   try {
//     await User.findOneAndUpdate({ _id: id }, {
//       bio: bio,
//       imageUrl: imageFile
//     })
//       .then(user => {
//         console.log(user)
//         res.json({
//           bio: user.bio,
//           imageUrl: user.imageUrl
//         })
//       })
//       .catch(err => {
//         if (err) {
//           res.json(err)
//         }
//       })
//   } catch (err) {
//     console.log(err)
//   }
//   //}
// })


module.exports = router;



//VERSION F
//FOLLOWING FUNCTIONALITY
// router.post('/follow/:id', (req, res, _) => {
//   const userToFollow = req.params.id
//   const userFollowing = req.body._id


//   User.findById(userToFollow, (err, user) => {
//     if(user.followers.some(follower => follower.equals(userFollowing))){
//       const index = user.followers.indexOf(userFollowing)
//       user.followers.splice(index, 1)
//       user.save((err, __user) => {
//         if(err){
//           res.json({success: false, message: "unexpected error following/unfollowing"})
//         }else{

//           User.findById(userFollowing, (err, user) => {
//             if(user.following.some(followed => followed.equals(userToFollow))){
//               const index = user.following.indexOf(userToFollow)
//               user.following.splice(index, 1)
//               user.save((err, user) => {
//                 if(err){
//                   res.json({success: false, message: "unexpected error when following/unfollowing"})
//                 }else{
//                   res.json({
//                     followers: __user.followers,
//                     following: user.following
//                   })
//                 }
//               })
//             }
//           })
//         }
//       })
//     }else{
//       user.followers.push(userFollowing)
//       user.save((err, __user) => {
//         if(err){
//           res.json({success: false, message: "unexpected error when following/unfollowing"})
//         }else{
//           User.findById(userFollowing, (err, user) => {
//             user.following.push(userToFollow)
//             user.save((err, user) => {
//               if(err){
//                 res.json({success: false, message: "unexpected error when following/unfollowing"})
//               }else{
//                 res.json({
//                   followers: __user.followers,
//                   following: user.following
//                 })
//               }
//             })
//           })
//         }
//       })
//     }
//   })
// })