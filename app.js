require("dotenv").config();

var express = require("express"),
    app = express(),
    bodyParser = require("body-parser"),
    mongoose = require("mongoose"),
    flash = require("connect-flash"),
    passport = require("passport"),
    LocalStrategy = require("passport-local"),
    methodOverride = require("method-override"),
    Product = require("./models/product"),
    Comment = require("./models/comment"),
    User = require("./models/user"),
    seedDB = require("./seeds");

// requiring routes
var commentRoutes = require("./routes/comments"),
    reviewRoutes = require("./routes/reviews"),
    productRoutes = require("./routes/products"),
    indexRoutes = require("./routes/index");

// ===========================
// PASSPORT CONFIGURATION
// ===========================

app.use(
    require("express-session")({
        secret: "Once again I win",
        resave: false,
        saveUninitialized: false,
    }),
);

app.locals.moment = require("moment");
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(async function (req, res, next) {
    res.locals.currentUser = req.user;
    if (req.user) {
        try {
            let user = await User.findById(req.user._id)
                .populate("notifications", null, { isRead: false })
                .exec();
            res.locals.notifications = user.notifications.reverse();
        } catch (err) {
            console.log(err.message);
        }
    }
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});
// seedDB();  // Seed the database
var url = process.env.DATABASEURL || "mongodb://localhost:27017/shoes_db";
mongoose
    .connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
        useCreateIndex: true,
    })
    .then(() => {
        console.log("Connected to DB!");
    })
    .catch((err) => {
        console.log("Error:", err.message);
    });

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));

app.use("/", indexRoutes);
app.use("/products", productRoutes);
app.use("/products/:slug/comments", commentRoutes);
app.use("/products/:slug/reviews", reviewRoutes);

// app.listen(3000, () => console.log("DAMN! YOU TRIPPED THE WIRE!"));
var port = process.env.PORT || 3000;
app.listen(port, function () {
    console.log("Server Has Started!");
});
