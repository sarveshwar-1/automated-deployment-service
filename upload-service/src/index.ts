import express from "express";
import cors from "cors";
import simpleGit from "simple-git";
import path from "path";
import { minioClient } from "./minio";
import { deployments } from "./store";
import {
  extractRepoName,
  generateProjectId,
  getAllFiles,
} from "./utils";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { JWT_SECRET, authMiddleware } from "./auth";
import { UserModel, ProjectModel } from "./db";
import axios from "axios";
import { error } from "console";
 
async function connectDB() {
  await mongoose.connect('mongodb://localhost:27017');
}
connectDB();

const app = express();
app.use(cors({
  origin: '*'
}));
app.use(express.json());

app.post('/signup', async function (req:any, res:any) {
  console.log('inside signup endpoint')
  console.log(req.body)
  const username = req.body.username;
  const password = req.body.password;
  const email = req.body.email;
  //we need to check for unique username
  //we need to store the username and password in the database
  //once stored in the database we can send the response back
  const hashedPassword = await bcrypt.hash(password, 5);

  await UserModel.create({
    name: username,
    email: email,
    password: hashedPassword,
  })
  res.json({
    "message": "User successfully signed up"
  })
})

app.post('/signin', async function(req:any, res:any){
    const password = req.body.password;
    const email = req.body.email;
    //we need to check if the user exists in the database
    //if the user exists in the database then we could issue a JWT for the user
    const user = await UserModel.findOne({
        email: email,
    })
    if (!user) {
        res.json({
        "message": "User does not exist in our db",
        })
        return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password)

    if (passwordMatch) {
        const token = jwt.sign({
        "id": user._id.toString(),
        }, JWT_SECRET);
        res.json({
        "message": "user signed in successfully",
        "token": token,
        })
    }
    else {
        res.json({
        "message": "invalid credentials"
        })
    }
})

/**
 * List all live projects
 */
app.get('/viewProjects', authMiddleware, async (req: any, res: any)=>{
    console.log('going to fetch all projects');
    const userId = req.id;
    console.log('finding the projects from mongoDB');
    const result = await ProjectModel.find({
        userId : userId,
    })
    console.log('returning from the function');
    //console.log('printing all file paths', filePaths);
    res.json({
        results: result
    });

})

/**
 * Delete a project
 */
app.delete('/deleteProject', authMiddleware, async (req: any, res: any)=>{
    const userId = req.id;
    const projectId = req.body.projectId;
    console.log('going to delete a project')

    try{
        const deleteFolder = async (bucket: string, prefix: string) => {
          const objects: string[] = [];
          const stream = minioClient.listObjects(bucket, prefix, true);

          for await (const obj of stream) {
            objects.push(obj.name);
          }

          if (objects.length > 0) {
            await minioClient.removeObjects(bucket, objects);
          }
        };
        await deleteFolder("source-code", `${projectId}/`);
        await deleteFolder("static-builds", `${projectId}/`);
        await ProjectModel.deleteOne({
            projectId : projectId
        })
        res.json({
          "message": "Deployment deleted successfully"
        })
    }
    catch(err){
        console.error(err)
        console.log('Error occured during deletion')
        res.status(500).json({
            "error": err
        })
    }

})


app.post('/deploy', authMiddleware, async (req: any, res: any)=>{
    const repoUrl = req.body.repoUrl;
    console.log('repoUrl is: ' + repoUrl);
    const repoMeta = repoUrl.replace('https://github.com/','https://api.github.com/repos/')
    console.log('repoMeta is: ' + repoMeta);
    const userId = req.id;
    const id = generateProjectId();
    const clonePath = path.join('/tmp',id);
    const mirrorPath = path.join(__dirname, `gitBare/${id}.git`);

    try{
        //await simpleGit().clone(repoUrl,path.join(__dirname,`output/${id}`));
        //const filePaths = getAllFiles(path.join(__dirname,`output/${id}`))
        console.log(clonePath);
        console.log(__dirname);
        //await simpleGit().clone(repoUrl, clonePath);
        await simpleGit().clone(repoUrl, mirrorPath, ["--mirror"]);
        await simpleGit().clone(mirrorPath, clonePath);
        const files = getAllFiles(clonePath);

        for (const file of files) {
          const localPath = path.join(clonePath, file);
          const objectKey = `${id}/${file}`;

          await minioClient.fPutObject(
            "source-code",
            objectKey,
            localPath
          );
        }
        console.log('Entering the uploaded project details into mongoDB');
        let defaultBranch = 'main';
        const response = await axios.get(repoMeta);
        defaultBranch = response.data.default_branch;
        const response2 = await axios.get(`${repoMeta}/branches/${defaultBranch}`);
        const commitSha = response2.data.commit.sha;
        console.log('Default branch is: ' + defaultBranch);
        console.log('Commit SHA is: ' + commitSha);
        await ProjectModel.create({
          url: repoUrl,
          userId : userId,
          projectId : id,
          commitSha: commitSha,
          defaultBranch: defaultBranch,
        }) 
        console.log('returning from the function'); 
        //console.log('printing all file paths', filePaths);
        res.json({
            url: repoUrl,
            userId : userId,
            projectId : id,
            commitSha: commitSha,
            defaultBranch: defaultBranch,
        });
    }
    catch(err:any){
        console.error(err);
      res.status(500).json({ error: "Deployment failed" });
    }
})


app.listen(3002, () => {
  console.log("🚀 Upload Service running on http://localhost:3002");
});
