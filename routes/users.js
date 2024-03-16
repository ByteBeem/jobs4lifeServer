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

router.post("/data", async (req, res) => {
    const token = req.body.token;

    if (!token) {
        return res.status(401).json({ error: "Unauthorized. Token not provided." });
    }

    try {
        const decodedToken = jwt.verify(token, secretKey);

        if (!decodedToken.cell || !decodedToken.name) {
            return res.status(400).json({ error: "Malformed token. Missing required fields." });
        }


        const snapshot = await db.ref('users').once('value');
        const users = snapshot.val();
        
        // Extract user IDs and usernames
        const userData = Object.keys(users).map(userId => ({
            id: userId,
            name: users[userId].name
        }));

        return res.status(200).json(userData);
    } catch (err) {
        console.error("Error fetching user data:", err);
        if (err instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: "Invalid token." });
        }
        return res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});

// POST /users/:id/update
router.post("/:id/update", async (req, res) => {
  // Update user data logic
});

module.exports = router;
