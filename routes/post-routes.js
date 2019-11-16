const express = require('express');
const postroutes = express.Router();
const Post = require('../models/Post');
const mongoose = require('mongoose')
mongoose.set('useFindAndModify', false);
const User = require('../models/User');
const Notifications = require('../models/Notification'); 
// include CLOUDINARY:
const uploader = require('../configs/cloudinary-setup');

postroutes.post('/createNewPost', uploader.single("imageUrl"), (req, res, next) => {
 // console.log(req.body)
  const {caption, imagePost, tags} = req.body
  let tagsArray = []
  let finalArray = []
  if(tags.length !== 0 ){
    tagsArray = tags.split(/[.,\/ -#]/)
    finalArray = tagsArray.filter(eachTag =>{ return eachTag !== "" })
  }
  
  Post.create({
    caption,
    image: imagePost,
    owner: req.user,
    likes: [],
    tags: finalArray,
    comments: []
  }).then(newPost => {
    console.log("NEW POST!", newPost)
    res.status(200).json(newPost)
  })
  .catch(err => console.log(err))
})



postroutes.get('/createNewPost', (req, res, next) => {
  try{ 
    Post.find().populate('owner', '_id imageUrl username').populate('likes', '_id imageUrl username').populate('comments.user', '_id imageUrl username')
   .then(theData => {res.status(200).json(theData)})
   .catch(err => next(err))
 }catch(err){
   console.log(err);
 }
 })


//UPDATE LIKES ROUTE
 postroutes.post('/updateLikes/:id', (req, res, _) => {
  //  console.log(req.params.id)
  if(req.body._id === undefined){
    res.json({message: "WRONG!"})
  }else{
   const theUserId = req.body._id
   const postId = req.params.id
   Post.findById(postId).populate('likes', '_id imageUrl username').populate('comments.user', '_id imageUrl username')
   .then(thePost => {
     User.findById(theUserId).select('_id imageUrl username')
     .then(theUser => {
      //  console.log(theUser._id)
      //  console.log(thePost.owner)
   //CHECK IF THE USER IS ALREADY IN THE LIKE ARRAY
   console.log(thePost.likes.findIndex(userToFind => userToFind.id === theUser.id));
      const theIndex = thePost.likes.findIndex(userToFind => userToFind.id === theUser.id)
      if(theIndex >= 0){
        thePost.likes.splice(theIndex, 1);
        thePost.save((err)=>{
         if(err){
           res.json({success: false, message: "Something went wrong while Liking the post"})
         }else{
           res.json(thePost)
         }
       })
 // IF THE USER IS NOT IN THE ARRAY, WE PUSH THE USER TO THE ARRAY
      }else{
        console.log(theUserId)
       console.log(thePost.owner)
        console.log(thePost.owner.equals(theUserId)) 
//WE SEND THE NOTIFICATION TO THE POST OWNER

     if(!thePost.owner.equals(theUserId)){
       console.log("IT NOT THE SAME")     
     const notification = new Notifications({
      type: "Like",
      event: "Liked your post",
      toWho: thePost.owner,
      fromWho: theUser._id,
      imageTo: postId,
      seen: false
     })

        notification.save()
       }
      


      thePost.likes.push(theUser);
      thePost.save((err)=>{
        if(err){
          res.json({success: false, message: "Something went wrong while Liking the post"})
        }else{
          res.json(thePost)
        }
     })

      }
    }).catch(err => console.log(err))
   }).catch(err => console.log(err))
  }
})  

 //EDIT POST ROUTE
 postroutes.put('/updatePost/:id', async (req, res, _) => {
   const { id } = req.params
   const {caption, tags} = req.body
   let tagsArray = []
   let finalArray = []
   if(typeof tags === 'object'){
    finalArray = tags
   }else{
    tagsArray = tags.split(/[.,\/ -#]/)
    finalArray = tagsArray.filter(eachTag =>{ return eachTag !== "" })
}
   if(!id){
     res.json({success: false ,message: "cannot find post to edit"})
   }else{
     try{
       await Post.findOneAndUpdate({_id: id}, {
         caption: caption,
         tags: finalArray
       }).populate('likes', '_id imageUrl username').populate('comments.user', '_id imageUrl username')
       .then(post => {
         res.json({
           tags: post.tags,
           caption: post.caption
         })
       })
       .catch(err => {
         if(err){
           res.json(err)
         }
       })
     }catch(err){
       console.log(err)
     }
  }
 })


 //DELETE POST ROUTE
 postroutes.post('/delete/:id', (req, res, next) => {
   const postId = req.params.id
   console.log(postId)
   Post.findByIdAndDelete(postId)
   .then(postToDelete => {
     Notifications.deleteMany({'imageTo': postId})
     .then(theNotification => {
     }).catch(err => console.log(err))
   })
   .catch(err => console.log(err))
 })


 //COMMENTS ROUTE
 postroutes.put('/addComment/:id', (req, res, next) => {
console.log(req.params.id)
console.log(req.body)
const { id } = req.params  
const { message, owner} = req.body

try{
  Post.findByIdAndUpdate(id, {
    $push: {
      comments: {
        user: owner._id,
        comment: message
      }
    }
  } )
  .then(postUpdated => {
     if(!postUpdated.owner.equals(owner._id)){
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
  }).catch(err => console.log(err))

}catch (err){
throw err
}

 }) 


module.exports = postroutes