# Vercel Clone Frontend

This is a React-based frontend for the Vercel Clone deployment service.

## Features

- **Authentication**: Sign up and sign in with email and password
- **Deploy Projects**: Deploy GitHub repositories directly through the UI
- **View Projects**: List all deployed projects with details
- **Delete Projects**: Remove projects you no longer need
- **Authentication Token Management**: Automatic token storage and management

## Project Structure

```
Frontend/
├── src/
│   ├── pages/
│   │   ├── SignUp.tsx          # Sign up page
│   │   ├── SignIn.tsx          # Sign in page
│   │   ├── Deploy.tsx          # Deploy new project page
│   │   └── ViewProjects.tsx    # View all projects page
│   ├── styles/
│   │   ├── Auth.css            # Styles for authentication pages
│   │   ├── Deploy.css          # Styles for deploy page
│   │   └── ViewProjects.css    # Styles for projects page
│   ├── App.tsx                 # Main app component with routing
│   ├── App.css                 # Global app styles
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## API Endpoints Used

The frontend connects to the following backend endpoints (http://localhost:3002):

- **POST /signup** - Register a new user
- **POST /signin** - Authenticate and get JWT token
- **POST /deploy** - Deploy a new project (requires auth)
- **GET /viewProjects** - Get all user's projects (requires auth)
- **DELETE /deleteProject** - Delete a project (requires auth)

## Pages

### SignUp Page
- Create a new account with username, email, and password
- Redirects to sign in after successful registration

### SignIn Page
- Authenticate with email and password
- Stores JWT token in localStorage
- Redirects to deploy page after successful login

### Deploy Page
- Input GitHub repository URL
- Sends deployment request to backend
- Displays project details after successful deployment:
  - Project ID
  - Repository URL
  - Default Branch
  - Commit SHA

### ViewProjects Page
- List all deployed projects in a grid layout
- Display project information:
  - Repository name
  - Project ID
  - Full repository URL (clickable)
  - Default branch
  - Commit SHA
- Delete projects with confirmation dialog

## How to Run

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

4. **Access the app**:
   - Default URL: http://localhost:5173

## Features

### Authentication
- User registration and login
- JWT token-based authentication
- Automatic token persistence in localStorage
- Logout functionality

### Project Management
- Deploy projects from GitHub URLs
- View all deployed projects
- Delete projects
- See detailed project information

### Navigation
- Protected routes (deploy and projects require login)
- Automatic redirection for unauthenticated users
- Navigation bar with links to main pages

## Styling
- Modern gradient-based color scheme (purple/blue)
- Responsive design for mobile and desktop
- Card-based layout for projects
- Smooth transitions and hover effects

## Requirements
- Node.js and npm
- React 19.2.0+
- React Router DOM 6.0.0+
