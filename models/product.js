var mongoose = require("mongoose");
var Comment = require("./comment");
var Review = require("./review");
var User = require("./user");

// SCHEMA SETUP
var productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: "Product name cannot be blank",
    },
    slug: {
        type: String,
        unique: true,
    },
    price: String,
    image: String,
    imageId: String,
    description: String,
    location: String,
    lat: Number,
    lng: Number,
    createdAt: { type: Date, default: Date.now },
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        username: String,
        avatar: String,
    },
    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment",
        },
    ],
    reviews: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Review",
        },
    ],
    rating: {
        type: Number,
        default: 0,
    },
    likes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    ],
});

// PRE HOOK THE MODEL, SO IF A PRODUCT IS DELETED,
// THE COMMENTS FOR THAT PRODUCT GET DELETED TOO.
productSchema.pre("remove", async function (next) {
    try {
        await Comment.deleteMany({
            _id: {
                $in: this.comments,
            },
        });
        next();
    } catch (err) {
        next(err);
    }
});

// add a slug before the product gets saved to the database
productSchema.pre("save", async function (next) {
    try {
        // check if a new product is being saved, or if the product name is being modified
        if (this.isNew || this.isModified("name")) {
            this.slug = await generateUniqueSlug(this._id, this.name);
        }
        next();
    } catch (err) {
        next(err);
    }
});

Product = mongoose.model("Product", productSchema);
module.exports = Product;

async function generateUniqueSlug(id, productName, slug) {
    try {
        // generate the initial slug
        if (!slug) {
            slug = slugify(productName);
        }
        // check if a product with the slug already exists
        var product = await Product.findOne({ slug: slug });
        // check if a product was found or if the found product is the current product
        if (!product || product._id.equals(id)) {
            return slug;
        }
        // if not unique, generate a new slug
        var newSlug = slugify(productName);
        // check again by calling the function recursively
        return await generateUniqueSlug(id, productName, newSlug);
    } catch (err) {
        throw new Error(err);
    }
}

function slugify(text) {
    var slug = text
        .toString()
        .toLowerCase()
        .replace(/\s+/g, "-") // Replace spaces with -
        .replace(/[^\w\-]+/g, "") // Remove all non-word chars
        .replace(/\-\-+/g, "-") // Replace multiple - with single -
        .replace(/^-+/, "") // Trim - from start of text
        .replace(/-+$/, "") // Trim - from end of text
        .substring(0, 75); // Trim at 75 characters
    return slug + "-" + Math.floor(1000 + Math.random() * 9000); // Add 4 random digits to improve uniqueness
}
