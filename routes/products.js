var express = require("express");
var router = express.Router();
var Product = require("../models/product");
var middleware = require("../middleware"); // automatically looks for index.js by default. per node_modules
var multer = require("multer");
var User = require("../models/user");
var Comment = require("../models/comment");
var Notification = require("../models/notification");
var Review = require("../models/review");
var rp = require("request-promise");

// Image Upload
var storage = multer.diskStorage({
    filename: function (req, file, callback) {
        callback(null, Date.now() + file.originalname);
    },
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter });

var cloudinary = require("cloudinary").v2;
cloudinary.config({
    cloud_name: "dbb2sfgjh",
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Google Maps
var NodeGeocoder = require("node-geocoder");
var options = {
    provider: "google",
    httpAdapter: "https",
    apiKey: process.env.GEOCODER_API_KEY,
    formatter: null,
};

var geocoder = NodeGeocoder(options);

// Index - show all products + SEARCH
router.get("/", (req, res) => {
    var perPage = 8;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    if (req.query.search) {
        const regex = new RegExp(escapeRegex(req.query.search), "gi");
        // Get all products from DB
        Product.find({
            $or: [
                { name: regex },
                { location: regex },
                { "author.username": regex },
            ],
        })
            .skip(perPage * pageNumber - perPage)
            .limit(perPage)
            .exec(function (err, searchResults) {
                Product.countDocuments({
                    name: regex,
                    location: regex,
                    "author.username": regex,
                }).exec(function (err, count) {
                    if (err) {
                        console.log(err);
                        res.redirect("back");
                    } else {
                        if (searchResults.length > 0) {
                            res.render("products/index", {
                                products: searchResults,
                                current: pageNumber,
                                pages: Math.ceil(count / perPage),
                                search: req.query.search,
                            });
                        } else {
                            req.flash(
                                "error",
                                "No match found in this search. Please try again!",
                            );
                            res.redirect("back");
                        }
                    }
                });
            });
    } else {
        // Get all products from DB & sort them by the latest
        Product.find({})
            .sort({ createdAt: -1 })
            .skip(perPage * pageNumber - perPage)
            .limit(perPage)
            .exec(function (err, searchResults) {
                Product.countDocuments().exec(function (err, count) {
                    if (err) {
                        console.log(err);
                    } else {
                        res.render("products/index", {
                            products: searchResults,
                            page: "products",
                            current: pageNumber,
                            pages: Math.ceil(count / perPage),
                            search: false,
                        });
                    }
                });
            });
    }
});

// CREATE - add new product to DB
router.post("/", middleware.isLoggedIn, upload.single("image"), async function (
    req,
    res,
) {
    try {
        // add author object to product on req.body
        req.body.product.author = {
            id: req.user._id,
            username: req.user.username,
        };
        // check if file uploaded
        if (req.file) {
            // upload file to cloudinary
            let result = await cloudinary.uploader.upload(req.file.path);
            // assign to product object
            req.body.product.image = result.secure_url;
            req.body.product.imageId = result.public_id;
        }
        // geocode location
        let data = await geocoder.geocode(req.body.product.location);
        // assign lat and lng and update location with formatted address
        req.body.product.lat = data[0].latitude;
        req.body.product.lng = data[0].longitude;
        req.body.product.location = data[0].formattedAddress;
        // create product from updated req.body.product object
        let product = await Product.create(req.body.product);

        let user = await User.findById(req.user._id)
            .populate("followers")
            .exec();
        let newNotification = {
            username: req.user.username,
            productId: product.slug,
        };
        for (const follower of user.followers) {
            let notification = await Notification.create(newNotification);
            follower.notifications.push(notification);
            follower.save();
        }
        // redirect to product show page
        res.redirect(`/products/${product.slug}`);
    } catch (err) {
        // flash error and redirect to previous page
        console.log(err);
        req.flash("error", err.message);
        res.redirect("back");
    }
});

// NEW - show form to create new product
router.get("/new", middleware.isLoggedIn, (req, res) => {
    res.render("products/new");
});

// Weather API
// rp(`https://api.openweathermap.org/data/2.5/weather?q=${req.body.product.location},US&units=imperial&appid=719cfe89510928451763000b57b52ab5`)
//   .then((data) => {
//     const parsedData = JSON.parse(data);
//     console.log(`Temp of ${req.body.product.location} is ${parsedData.main.temp}`)
//   })
//   .catch ((err) => {
//     console.log('error in weather API', err);
//   });
// SHOW - shows more info about one product
router.get("/:slug", function (req, res) {
    // find the product with provided ID & sort them by the latest
    Product.findOne({ slug: req.params.slug })
        .populate({
            path: "comments likes reviews", // tried to add author here or as a separate .populate and didn't work
            options: { sort: { createdAt: -1 } },
        })
        .exec(function (err, foundProduct) {
            weather = rp(
                `https://api.openweathermap.org/data/2.5/weather?q=${foundProduct.location},US&units=imperial&appid=719cfe89510928451763000b57b52ab5`,
            ).then((data) => {
                var parsedData = JSON.parse(data);
                var weatherTemp = parsedData.main.temp;
                console.log(
                    `Temp of ${foundProduct.location} is ${parsedData.main.temp} ˚F`,
                );

                if (err || !foundProduct) {
                    console.log(err);
                    req.flash("error", "Sorry, that product does not exist!");
                    return res.redirect("/products");
                }
                console.log(foundProduct);
                res.render("products/show", {
                    slug: req.params.slug,
                    product: foundProduct,
                    weatherData: parsedData,
                });
                // console.log(foundProduct);
                // Comment.find({})
                //   .populate({
                //     path: "author",
                //     model: "User"
                //   })
                //   .where("product")
                //   .equals(foundProduct._id)
                //   .sort({ created: -1 })
                //   .exec(function(err, foundComments) {
                //     if (err) {
                //       console.log(err);
                //     } else {
                //       // render show template with that product
                //         res.render("products/show", {
                //           product: foundProduct,
                //           comment: foundComments,
                //           user: user
                //         });
                //       }
                //     });
            });
        });
});

// EDIT PRODUCT ROUTE
router.get("/:slug/edit", middleware.checkProductOwnershipOwnership, function (
    req,
    res,
) {
    Product.findOne({ slug: req.params.slug }, function (err, foundProduct) {
        res.render("products/edit", { product: foundProduct });
    });
});

// UPDATE the data & image
router.put(
    "/:slug",
    middleware.checkProductOwnershipOwnership,
    upload.single("image"),
    function (req, res) {
        delete req.body.product.rating;
        // Google Maps geocoder
        geocoder.geocode(req.body.product.location, async function (err, data) {
            try {
                req.body.product.lat = data[0].latitude;
                req.body.product.lng = data[0].longitude;
                req.body.product.location = data[0].formattedAddress;
            } catch (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            // find the product and update it
            Product.findOne({ slug: req.params.slug }, async function (
                err,
                product,
            ) {
                try {
                    if (req.file) {
                        // destroy the image that exists
                        await cloudinary.uploader.destroy(
                            product.imageId,
                            function (err) {
                                if (err) {
                                    req.flash("error", err.message);
                                }
                            },
                        );
                        // upload a new selected image
                        var result = await cloudinary.uploader.upload(
                            req.file.path,
                        );
                        product.imageId = result.public_id;
                        product.image = result.secure_url;
                    }
                } catch (err) {
                    console.log("product.js :" + err);
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
                product.name = req.body.product.name;
                product.description = req.body.product.description;
                product.price = req.body.product.price;
                product.lat = data[0].latitude;
                product.lng = data[0].longitude;
                product.location = data[0].formattedAddress;
                product.save();
                req.flash("success", "Successfully Updated!");
                res.redirect("/products/" + product.slug);
            });
        });
    },
);

// DESTROY PRODUCT ROUTE
router.delete("/:slug", middleware.checkProductOwnershipOwnership, function (
    req,
    res,
    next,
) {
    Product.findOne({ slug: req.params.slug }, async function (err, product) {
        // Product.findByIdAndRemove(req.params.id, function(err){
        if (err) {
            req.flash("error", next(err));
            return res.redirect("/products");
        }
        try {
            // deletes all reviews associated with the product
            Review.remove({ _id: { $in: product.reviews } });
            await cloudinary.uploader.destroy(product.imageId);
            product.deleteOne();
            console.log("removed the product & comments");
            req.flash("success", "Product deleted successfully!");
            res.redirect("/products");
        } catch (err) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("/products");
            }
        }
    });
});

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// Product Like Route
router.post("/:slug/like", middleware.isLoggedIn, function (req, res) {
    Product.findOne({ slug: req.params.slug }, function (err, foundProduct) {
        if (err) {
            console.log(err);
            return res.redirect("/products");
        }

        // check if req.user._id exists in foundProduct.likes
        var foundUserLike = foundProduct.likes.some(function (like) {
            return like.equals(req.user._id);
        });

        if (foundUserLike) {
            // user already liked, removing like
            foundProduct.likes.pull(req.user._id);
        } else {
            // adding the new user like
            foundProduct.likes.push(req.user);
        }

        foundProduct.save(function (err) {
            if (err) {
                console.log(err);
                return res.redirect("/products");
            }
            return res.redirect("/products/" + foundProduct.slug);
        });
    });
});

module.exports = router;
