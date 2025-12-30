const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.ObjectId;
const userSchema = new Schema({
  email: { type: String, unique: true, },
  name: String,
  password: String,
})
const projectSchema = new Schema({
  url: String,
  projectId: String,
  userId: ObjectId,
  commitSha: String,
  defaultBranch: String,

})
//let's define the collection models that give the access to high level functions 

export const UserModel = mongoose.model('users', userSchema);
export const ProjectModel = mongoose.model('projects', projectSchema)
