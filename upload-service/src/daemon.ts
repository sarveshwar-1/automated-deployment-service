const mongoose = require('mongoose');
const { simpleGit } = require('simple-git');
const path = require('path');
const { UserModel, ProjectModel } = require('./db.js');
const axios = require('axios');

async function connectDB() {
  await mongoose.connect('mongodb://localhost:27017');
}
connectDB();

async function getAllProjects(){
    console.log("Fetching all projects from the database");
    //console.log(typeof projects)
    //console.log(projects.length)
    const projects =  await ProjectModel.find({});
    //console.log(projects)
    //console.log(typeof projects)
    return projects;
}

async function daemonTask(){
    console.log("Daemon task running every 5 minutes");
    const projects = await getAllProjects();
    for(let project of projects){
      console.log(project);
      const currentSha = project.commitSha;
      const repoUrl = project.url;
      const repoMeta = repoUrl.replace('https://github.com/','https://api.github.com/repos/')
      //console.log('repoMeta is: ' + repoMeta);
      const branchName = project.defaultBranch;
      try{
         const response = await axios.get(`${repoMeta}/branches/${branchName}`);
         const latestSha = response.data.commit.sha;
         if(currentSha !== latestSha){
             console.log(`New commit detected for project ${project.projectId}. Updating commit SHA from ${currentSha} to ${latestSha}`);
             project.commitSha = latestSha;
             await project.save();
             //Here we can trigger the deployment process
         }
         else{
             console.log(`No new commits for project ${project.projectId}`);
         }
      }
      catch(err:any){
          console.log('Error while fetching branch metadata for project ' + project.projectId);
          console.log(err.message)
      }
    }
}

daemonTask();
