const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const crypto = require("crypto");
const nodemailer = require("nodemailer"); // For sending emails
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Session middleware
app.use(session({
    secret: 'your_secret_key', // Change this to a strong secret
    resave: false,
    saveUninitialized: true,
}));

// Dummy user for demonstration
let users = [
    { username: 'admin', password: 'password', email: 'admin@example.com' } // Replace with a secure method in production
];

// Reviews array to store reviews
let reviews = [];

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Home route
app.get("/", (req, res) => {
    try {
        const posts = JSON.parse(fs.readFileSync("posts.json", "utf8"));
        res.render("home", { posts, session: req.session, reviews }); // Pass reviews to the home page
    } catch (error) {
        res.status(500).render("error", { error: "Error loading posts" });
    }
});

// Login page
app.get("/login", (req, res) => {
    res.render("login");
});

// Handle login form submission
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        req.session.user = user; // Store user in session
        res.redirect("/"); // Redirect to home or dashboard
    } else {
        res.status(401).render("error", { error: "Invalid username or password" });
    }
});

// Logout route
app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect("/"); // Redirect to home on error
        }
        res.redirect("/logged-out"); // Redirect to the logged-out page on success
    });
});

// Logged Out page
app.get("/logged-out", (req, res) => {
    res.render("logged-out");
});

// Forgot Password page
app.get("/forgot-password", (req, res) => {
    res.render("forgot-password");
});

// Handle forgot password form submission
app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);

    if (!user) {
        return res.status(404).send("User  not found");
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    // Send email with reset link
    const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;
    const transporter = nodemailer.createTransport({
        service: 'gmail', // Use your email service
        auth: {
            user: 'your_email@gmail.com', // Your email
            pass: 'your_email_password' // Your email password or app password
        }
    });

    const mailOptions = {
        from: 'your_email@gmail.com',
        to: user.email,
        subject: 'Password Reset',
        text: `You requested a password reset. Click here to reset: ${resetUrl}`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.send(`Password reset link sent to ${email}.`);
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).send("Error sending email");
    }
});

// Sign Up page
app.get("/signup", (req, res) => {
    res.render("signup");
});

// Handle sign up form submission
app.post("/signup", (req, res) => {
    const { username, email, password } = req.body;

    // Check if the username already exists
    const existingUser  = users.find(u => u.username === username);
    if (existingUser ) {
        return res.status(400).render("error", { error: "Username already exists." });
    }

    // Add the new user to the dummy users array
    users.push({ username, email, password }); // In a real application, hash the password and save to a database

    // Store the user in the session
    req.session.user = { username }; // Store user in session

    // Redirect to the home page
    res.redirect("/");
});

// Post routes
app.get("/post/:id", (req, res) => {
    try {
        const posts = JSON.parse(fs.readFileSync("posts.json", "utf8"));
        const post = posts.find((p) => p.id === parseInt(req.params.id));

        if (!post) {
            return res.status(404).render("error", { error: "Post not found" });
        }

        res.render("post", { post });
    } catch (error) {
        res.status(500).render("error", { error: "Error loading post" });
    }
});

app.get("/addPost", (req, res) => {
    res.render("addPost");
});

app.post("/addPost", (req, res) => {
    try {
        const { title, content } = req.body;
        const posts = JSON.parse(fs.readFileSync("posts.json", "utf8"));

        const newPost = {
            id: posts.length > 0 ? posts[posts.length - 1].id + 1 : 1,
            title,
            content,
            date: new Date().toISOString(),
        };

        posts.push(newPost);
        fs.writeFileSync("posts.json", JSON.stringify(posts, null, 2));

        res.redirect("/");
    } catch (error) {
        res.status(500).render("error", { error: "Error adding post" });
    }
});

app.get("/editPost/:id", (req, res) => {
    try {
        const posts = JSON.parse(fs.readFileSync("posts.json", "utf8"));
        const post = posts.find((p) => p.id === parseInt(req.params.id));

        if (!post) {
            return res.status(404).render("error", { error: "Post not found" });
        }

        res.render("editPost", { post });
    } catch (error) {
        res.status(500).render("error", { error: "Error loading post for editing" });
    }
});

app.post("/editPost/:id", (req, res) => {
    try {
        const { title, content } = req.body;
        const posts = JSON.parse(fs.readFileSync("posts.json", "utf8"));
        const postIndex = posts.findIndex((p) => p.id === parseInt(req.params.id));

        if (postIndex === -1) {
            return res.status(404).render("error", { error: "Post not found" });
        }

        posts[postIndex] = {
            ...posts[postIndex],
            title,
            content,
            date: new Date().toISOString(),
        };

        fs.writeFileSync("posts.json", JSON.stringify(posts, null, 2));
        res.redirect("/");
    } catch (error) {
        res.status(500).render("error", { error: "Error updating post" });
    }
});

app.post("/deletePost/:id", (req, res) => {
    try {
        const posts = JSON.parse(fs.readFileSync("posts.json", "utf8"));
        const updatedPosts = posts.filter((p) => p.id !== parseInt(req.params.id));

        if (updatedPosts.length === posts.length) {
            return res.status(404).render("error", { error: "Post not found" });
        }

        fs.writeFileSync("posts.json", JSON.stringify(updatedPosts, null, 2));
        res.redirect("/");
    } catch (error) {
        res.status(500).render("error", { error: "Error deleting post" });
    }
});

// Review routes
app.get("/reviews", (req, res) => {
    res.render("reviews", { reviews }); // Render reviews page with reviews data
});

app.post("/reviews", (req, res) => {
    const { username, rating, comment } = req.body;
    if (!username || !rating) {
        return res.status(400).json({ error: "Username and rating are required" });
    }

    const newReview = {
        id: reviews.length + 1, // Simple ID generation
        username,
        rating,
        comment,
        createdAt: new Date(),
    };

    reviews.push(newReview);
    res.status(201).json(newReview);
});

// Catch-all route for 404 errors
app.get("*", (req, res) => {
    res.status(404).render("error", { error: "Page not found" });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
