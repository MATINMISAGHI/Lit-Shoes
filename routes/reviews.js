var express = require("express");
var router = express.Router({ mergeParams: true });
var Product = require("../models/product");
var Review = require("../models/review");
var middleware = require("../middleware");

// Reviews Index
router.get("/", function (req, res) {
    Product.findOne({ slug: req.params.slug })
        .populate({
            path: "reviews",
            options: { sort: { createdAt: -1 } }, // sorting the populated reviews array to show the latest first
        })
        .exec(function (err, product) {
            if (err || !product) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            res.render("reviews/index", {
                slug: req.params.slug,
                product: product,
            });
        });
});

// Reviews New
router.get(
    "/new",
    middleware.isLoggedIn,
    middleware.checkReviewExistence,
    function (req, res) {
        // middleware.checkReviewExistence checks if a user already reviewed the product, only one review per user is allowed
        Product.findOne({ slug: req.params.slug }, function (err, product) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            res.render("reviews/new", {
                slug: req.params.slug,
                product: product,
            });
        });
    },
);

// Reviews Create
router.post(
    "/",
    middleware.isLoggedIn,
    middleware.checkReviewExistence,
    function (req, res) {
        //lookup product using ID
        Product.findOne({ slug: req.params.slug })
            .populate("reviews")
            .exec(function (err, product) {
                if (err) {
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
                Review.create(req.body.review, function (err, review) {
                    if (err) {
                        req.flash("error", err.message);
                        return res.redirect("back");
                    }
                    //add author username/id and associated product to the review
                    review.author.id = req.user._id;
                    review.author.username = req.user.username;
                    review.product = product;
                    //save review
                    review.save();
                    product.reviews.push(review);
                    // calculate the new average review for the product
                    product.rating = calculateAverage(product.reviews);
                    //save product
                    product.save();
                    req.flash(
                        "success",
                        "Your review has been successfully added.",
                    );
                    res.redirect("/products/" + product.slug);
                });
            });
    },
);

// Reviews Edit
router.get("/:review_id/edit", middleware.checkReviewOwnership, function (
    req,
    res,
) {
    Review.findById(req.params.review_id, function (err, foundReview) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        res.render("reviews/edit", {
            product_slug: req.params.slug,
            review: foundReview,
        });
    });
});

// Reviews Update
router.put("/:review_id", middleware.checkReviewOwnership, function (req, res) {
    Review.findByIdAndUpdate(
        req.params.review_id,
        req.body.review,
        { new: true },
        function (err, updatedReview) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            Product.findOne({ slug: req.params.slug })
                .populate("reviews")
                .exec(function (err, product) {
                    if (err) {
                        req.flash("error", err.message);
                        return res.redirect("back");
                    }
                    // recalculate product average
                    product.rating = calculateAverage(product.reviews);
                    //save changes
                    product.save();
                    req.flash(
                        "success",
                        "Your review was successfully edited.",
                    );
                    res.redirect("/products/" + product.slug);
                });
        },
    );
});

// Reviews Delete
router.delete("/:review_id", middleware.checkReviewOwnership, function (
    req,
    res,
) {
    Review.findByIdAndRemove(req.params.review_id, function (err) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        Product.findOneAndUpdate(
            req.params.slug,
            { $pull: { reviews: req.params.review_id } },
            { new: true },
        )
            .populate("reviews")
            .exec(function (err, product) {
                if (err) {
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
                // recalculate product average
                product.rating = calculateAverage(product.reviews);
                //save changes
                product.save();
                req.flash("success", "Your review was deleted successfully.");
                res.redirect("/products/" + req.params.slug);
            });
    });
});

function calculateAverage(reviews) {
    if (reviews.length === 0) {
        return 0;
    }
    var sum = 0;
    reviews.forEach(function (element) {
        sum += element.rating;
    });
    return sum / reviews.length;
}

module.exports = router;
