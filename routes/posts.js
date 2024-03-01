
const express = require('express');
const router = express.Router();
const firebase = require("firebase-admin");
const jwt = require("jsonwebtoken");

const db = firebase.database();
const secretKey = process.env.secret_key || "DonaldMxolisiRSA04?????";


router.use(async(req, res, next) => {
    const appCheckToken = req.header("CustomAppCheck");


    if (!appCheckToken) {
        res.status(401).send("Unauthorized");
        return;
    }

    try {

        const hashedTokenFromRequest = await bcrypt.hash(appCheckToken, saltRoundsTokenApp);

        const isMatch = await bcrypt.compare(apptoken, hashedTokenFromRequest);


        if (isMatch) {
            next();
        } else {
            res.status(401).send("Unauthorized");
        }
    } catch (err) {
        console.error("Error during app token verification:", err);
        res.status(500).send("Internal Server Error");
    }
});


router.get("/", async (req, res) => {
    try {
    
        const authHeader = req.headers['authorization'];
        let postsArray;
    
        if (authHeader) {
          const token = authHeader.substring(7);
          if (token === "") {
            const postsSnapshot = await db.ref('posts').once('value');
            const postsData = postsSnapshot.val();
            postsArray = Object.keys(postsData).map(key => ({ id: key, ...postsData[key] }));
          } else {
            const postsSnapshot = await db.ref('posts').once('value');
            const postsData = postsSnapshot.val();
            const filteredPosts = Object.keys(postsData)
              .filter(key => postsData[key].stream === token)
              .map(key => ({ id: key, ...postsData[key] }));
            postsArray = filteredPosts;
          }
        } else {
          const postsSnapshot = await db.ref('posts').once('value');
          const postsData = postsSnapshot.val();
          postsArray = Object.keys(postsData).map(key => ({ id: key, ...postsData[key] }));
        }
    
        postsArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
        res.json(postsArray);
      } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
});


router.post("/create", async (req, res) => {
    const postData = req.body;
  

    if (!postData.caption) {
      postData.caption = "";
    }
  
    const userRef = db.ref('userposts').push();
    userRef.set({
      imageUrl: postData.imageUrl,
      caption: postData.caption,
      time: postData.timestamp,
      user: postData.token,
      content_type: postData.content_type,
  
    });
  
    res.status(200).json({ message: "Post created successfully." });
});

module.exports = router;
