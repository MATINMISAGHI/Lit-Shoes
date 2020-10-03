var Product = require("../models/product");
var Comment = require("../models/comment");
var Review = require("../models/review");

// ALL THE MIDDLEWARE GOES HERE
var middlewareObj = {};

middlewareObj.checkProductOwnershipOwnership = function (req, res, next) {
    // is user logged in
    if (req.isAuthenticated()) {
        Product.findOne({ slug: req.params.slug }, function (
            err,
            foundProduct,
        ) {
            if (err) {
                req.flash("error", "Product not found");
                res.redirect("back");
            } else {
                // does user own the product?
                if (
                    foundProduct.author.id.equals(req.user._id) ||
                    req.user.isAdmin
                ) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that!");
                    res.redirect("back");
                }
            }
        });
    } else {
        res.redirect("back");
    }
};

middlewareObj.checkCommentOwnership = function (req, res, next) {
    // is user logged in
    if (req.isAuthenticated()) {
        Comment.findById(req.params.comment_id, function (err, foundComment) {
            if (err) {
                req.flash("error", "Product not found");
                res.redirect("back");
            } else {
                // does user own the comment?
                if (
                    foundComment.author.id.equals(req.user._id) ||
                    req.user.isAdmin
                ) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that!");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in to do that!");
        res.redirect("back");
    }
};

// Checking if the user is owner of the review
middlewareObj.checkReviewOwnership = function (req, res, next) {
    if (req.isAuthenticated()) {
        Review.findById(req.params.review_id, function (err, foundReview) {
            if (err || !foundReview) {
                res.redirect("back");
            } else {
                // does user own the comment?
                if (
                    foundReview.author.id.equals(req.user._id) ||
                    req.user.isAdmin
                ) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in to do that");
        res.redirect("back");
    }
};

middlewareObj.checkReviewExistence = function (req, res, next) {
    if (req.isAuthenticated()) {
        Product.findOne({ slug: req.params.slug })
            .populate("reviews")
            .exec(function (err, foundProduct) {
                if (err || !foundProduct) {
                    req.flash("error", "Product not found.");
                    res.redirect("back");
                } else {
                    // check if req.user._id exists in foundProduct.reviews
                    var foundUserReview = foundProduct.reviews.some(function (
                        review,
                    ) {
                        return review.author.id.equals(req.user._id);
                    });
                    if (foundUserReview) {
                        req.flash("error", "You already wrote a review.");
                        return res.redirect("/products/" + foundProduct._slug);
                    }
                    // if the review was not found, go to the next middleware
                    next();
                }
            });
    } else {
        req.flash("error", "You need to login first.");
        res.redirect("back");
    }
};

// middleware
middlewareObj.isLoggedIn = function (req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.session.redirectTo = req.originalUrl;
    req.flash("error", "You need to be logged in to do that!");
    res.redirect("/login");
};

module.exports = middlewareObj;
