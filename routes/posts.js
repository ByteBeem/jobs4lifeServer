const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const firebase = require("firebase-admin");
const saltRounds = 12;
const saltRoundsTokenApp = 10;

const apptoken = process.env.appToken || 'DonaldRSA04?';

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


router.get("/fetch", async (req, res) => {
    try {
    
        const tokenValue = req.header("Authorization");
        let postsArray;
    
        if (tokenValue) {
            
          const token = tokenValue.replace("Bearer ", "");
            console.log(token);
          if (token === "") {
            const postsSnapshot = await db.ref('userposts').once('value');
            const postsData = postsSnapshot.val();
            postsArray = Object.keys(postsData).map(key => ({ id: key, ...postsData[key] }));
          } else {
            const postsSnapshot = await db.ref('userposts').once('value');
            const postsData = postsSnapshot.val();
            const filteredPosts = Object.keys(postsData)
              .filter(key => postsData[key].user === token)
              .map(key => ({ id: key, ...postsData[key] }));
            postsArray = filteredPosts;
          }
        } else {
          const postsSnapshot = await db.ref('userposts').once('value');
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


router.post("/Post", async (req, res) => {
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
