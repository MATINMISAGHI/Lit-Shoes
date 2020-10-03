var mongoose = require("mongoose");
var User = require("./user");

var commentSchema = mongoose.Schema({
  text: String,
  createdAt: { type: Date, default: Date.now },
  author: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
      },
    avatar: String,
    username: String
  }
});

module.exports = mongoose.model("Comment", commentSchema);
