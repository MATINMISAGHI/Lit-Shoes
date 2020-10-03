var express = require("express");
var router = express.Router({ mergeParams: true });
var Product = require("../models/product");
var Comment = require("../models/comment");
var middleware = require("../middleware");

// ===================
// COMMENTS ROUTES
// ===================

// create new comment
router.get("/new", middleware.isLoggedIn, function (req, res) {
    // find product by id
    Product.findOne({ slug: req.params.slug }, function (err, product) {
        if (err) {
            console.log(err);
        } else {
            res.render("comments/new", { product: product });
        }
    });
});

// connect new comment to product
router.post("/", middleware.isLoggedIn, function (req, res) {
    // lookup product using ID
    Product.findOne({ slug: req.params.slug }, function (err, product) {
        if (err) {
            req.flash("error", "Something went wrong");
            console.log(err);
            res.redirect("/products");
        } else {
            Comment.create(req.body.comment, function (err, comment) {
                if (err) {
                    req.flash("error", err);
                    console.log(err);
                } else {
                    // add username and id to comment
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;

                    // save comment
                    comment.save();
                    product.comments.push(comment);
                    console.log(comment);
                    product.save();

                    req.flash("success", "Successfully added comment");
                    res.redirect("/products/" + product.slug);
                }
            });
        }
    });
});

// COMMENTS EDIT ROUTE
router.get("/:comment_id/edit", middleware.checkCommentOwnership, function (
    req,
    res,
) {
    Comment.findById(req.params.comment_id, function (err, foundComment) {
        if (err) {
            res.redirect("back");
        } else {
            res.render("comments/edit", {
                product_slug: req.params.slug,
                comment: foundComment,
            });
        }
    });
});

// COMMENT UPDATE
router.put("/:comment_id", middleware.checkCommentOwnership, function (
    req,
    res,
) {
    Comment.findByIdAndUpdate(
        req.params.comment_id,
        req.body.comment,
        function (err, updatedComment) {
            if (err) {
                res.redirect("back");
            } else {
                res.redirect("/products/" + req.params.slug);
            }
        },
    );
});

// COMMENTS DESTROY ROUTE
router.delete("/:comment_id", middleware.checkCommentOwnership, function (
    req,
    res,
) {
    // find
    Comment.findByIdAndRemove(req.params.comment_id, function (err) {
        if (err) {
            res.redirect("back");
        } else {
            req.flash("success", "Comment deleted");
            res.redirect("/products/" + req.params.slug);
        }
    });
});

module.exports = router;
