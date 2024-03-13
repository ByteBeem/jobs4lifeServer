const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const firebase = require("firebase-admin");
const saltRounds = 12;
const admin = require('firebase-admin');
const saltRoundsTokenApp = 10;
const bucket = admin.storage().bucket();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const apptoken = process.env.appToken || 'DonaldRSA04?';
const serviceAccount = require('../key.json');
const db = firebase.database();
const secretKey = process.env.secret_key || "DonaldMxolisiRSA04?????";
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://jobs4life-d6926.appspot.com',
});

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
router.post('/postJobs',  async (req, res) => {
    const { title, description, requirements, address, salary, jobLink } = req.body;

    try {
        // Validate job details
        if (!title || !description || !requirements || !address || !salary || !jobLink) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Create job post object
        const jobPost = {
            title: title,
            description: description,
            requirements: requirements,
            address: address,
            salary: salary,
            jobLink: jobLink
        };

        // Store job post data in Firebase
        const jobRef = db.ref('jobPosts').push();
        await jobRef.set(jobPost);

        res.status(201).json({ message: "Job post added successfully." });
    } catch (err) {
        console.error("Error adding job post:", err);
        return res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});

router.post('/like/:postId', async (req, res) => {
  const postId = req.params.postId;
  const userId = req.body.userId;

  try {
    // Update the likes count and include the user ID in the Firebase Realtime Database
    await firebase.database().ref(`userposts/${postId}`).transaction(post => {
      if (post) {
        if (!post.likes) post.likes = 0;
        if (!post.likedBy) post.likedBy = {};
        
        
        if (!post.likedBy[userId]) {
          post.likes++;
          post.likedBy[userId] = true;
        }

        return post;
      } else {
        return null;
      }
    });

    res.status(200).send('Post liked successfully.');
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).send('An error occurred while liking the post.');
  }
});

router.get("/fetch", async (req, res) => {
    try {
        const postsSnapshot = await db.ref('userposts').once('value');
        const postsData = postsSnapshot.val();

        // Check if postsData is null or empty
        if (!postsData || Object.keys(postsData).length === 0) {
            return res.status(404).json({ error: 'No posts found' });
        }

        const postsArray = Object.keys(postsData).map(key => ({ id: key, ...postsData[key] }));
        console.log(postsArray)

        // Fetch likes and user IDs for each post
        const postsWithLikes = await Promise.all(postsArray.map(async post => {
            const likesSnapshot = await db.ref(`userposts/${post.id}/likes`).once('value');
            console.log(likesSnapshot)
            const likesData = likesSnapshot.val() || {};
            const userLikes = Object.keys(likesData); 

            return { ...post, likes: userLikes.length, likedBy: userLikes };
        }));

        postsWithLikes.sort((a, b) => b.time - a.time);

        res.json(postsWithLikes);
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});




router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const originalName = req.file.originalname;

    
    const filename = `${Date.now()}-${originalName}`;

    // Create a reference to the Firebase Storage bucket
    const file = bucket.file(filename);

    // Create a write stream to upload the image
    const stream = file.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    stream.on('error', (err) => {
      return res.status(500).send({ error: 'Error uploading file' });
    });

    stream.on('finish', async () => {
      // Make the image publicly accessible and get its download URL
      await file.makePublic();
      const downloadURL = `https://storage.googleapis.com/${bucket.name}/${filename}`;

      // Send the download URL back to the client
      res.status(200).send({ downloadURL });
    });

    // Write the image data to the Firebase Storage bucket
    stream.end(req.file.buffer);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});


router.post("/PostSell", async (req, res) => {
    const token = req.header("Authorization");
    const tokenValue = token.replace("Bearer ", "");
    const postData = req.body;

    
    try {
        const decodedToken = jwt.verify(tokenValue, secretKey);
        
        const cell = decodedToken.cell;


        const userRef = db.ref('userposts').push();
        userRef.set({
            
            post: postData.text || '', 
            time: Date.now(),
            user: cell, 
            userId: postData.userId,
            price:postData.price,
            location:postData.location,
            phone:postData.phone,
            imageLink:postData.imageLink,
        });
         const newPostData = {
            
            post: postData.text,
            user: cell,
        };

        res.status(200).json(newPostData); 
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(500).json({ error: 'Error verifying token.' });
    }
});



router.post("/Post", async (req, res) => {
    const token = req.header("Authorization");
    const tokenValue = token.replace("Bearer ", "");
    const postData = req.body;

    
    try {
        const decodedToken = jwt.verify(tokenValue, secretKey);
        
        const cell = decodedToken.cell;


        const userRef = db.ref('selling').push();
        userRef.set({
            
            post: postData.text || '', 
            time: Date.now(),
            user: cell, 
        });
         const newPostData = {
            
            post: postData.text,
            user: cell,
        };

        res.status(200).json(newPostData); 
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(500).json({ error: 'Error verifying token.' });
    }
});

module.exports = router;
