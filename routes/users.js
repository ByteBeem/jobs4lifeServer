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


router.get("/data", async (req, res) => {
    const token = req.header("Authorization");
  

    if (!token || !token.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized. Token not provided." });
    }
  
    const tokenValue = token.replace("Bearer ", "");
  
    try {
      const decodedToken = jwt.verify(tokenValue, secretKey);
  
  
      if (!decodedToken.cell || !decodedToken.name) {
        return res.status(400).json({ error: "Malformed token. Missing required fields." });
      }
  
      const cell = decodedToken.cell;
      const name = decodedToken.name;
  
      return res.status(200).json({ username: name, cellphone: cell });
    } catch (err) {
      console.error("Error fetching user info:", err);
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
