# Frontend Setup & Running Instructions

## Quick Start

### 1. Prerequisites
- Ensure the backend server is running on `http://localhost:3002`
- Node.js and npm should be installed

### 2. Install Dependencies
```bash
cd Frontend
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## API Configuration

The frontend is configured to connect to the backend at `http://localhost:3002`. If you need to change this, update the fetch URLs in:
- `src/pages/SignUp.tsx`
- `src/pages/SignIn.tsx`
- `src/pages/Deploy.tsx`
- `src/pages/ViewProjects.tsx`

Change `'http://localhost:3002'` to your backend URL.

## Usage Flow

1. **First Time User**:
   - Navigate to `/signup`
   - Create an account with username, email, and password
   - After signup, redirect to sign in

2. **Returning User**:
   - Navigate to `/signin`
   - Enter email and password
   - Get authenticated with JWT token

3. **Deploy Project**:
   - Once logged in, go to `/deploy`
   - Enter a GitHub repository URL (e.g., `https://github.com/username/repo`)
   - Click Deploy
   - See project details upon success

4. **View Projects**:
   - Navigate to `/projects`
   - See all your deployed projects in a card layout
   - Click on the repository link to view on GitHub
   - Click Delete to remove a project

## File Descriptions

### Pages
- **SignUp.tsx** - Registration form with username, email, and password fields
- **SignIn.tsx** - Login form that stores JWT token in localStorage
- **Deploy.tsx** - Deploy new projects by entering GitHub repository URL
- **ViewProjects.tsx** - Display all user's projects with delete functionality

### Styles
- **Auth.css** - Styling for authentication pages (signup/signin)
- **Deploy.css** - Styling for the deploy page with project details display
- **ViewProjects.css** - Grid layout for displaying projects as cards

### Core Files
- **App.tsx** - Main component with routing and authentication state management
- **App.css** - Navigation bar and global styling
- **main.tsx** - React app entry point
- **index.css** - Global CSS reset and base styles

## Features Implemented

✅ User Registration (Signup)
✅ User Authentication (Signin with JWT)
✅ Protected Routes (Redirect to signin if not authenticated)
✅ Deploy Projects (Connect to /deploy endpoint)
✅ View All Projects (Connect to /viewProjects endpoint)
✅ Delete Projects (Connect to /deleteProject endpoint)
✅ Responsive Design (Mobile and desktop friendly)
✅ Error Handling (Display error messages)
✅ Loading States (Show loading indicators)
✅ Token Management (Automatic localStorage handling)

## Build for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` folder.

## Troubleshooting

### "Cannot connect to backend"
- Ensure the backend server is running on port 3002
- Check if CORS is enabled in the backend
- Verify the API endpoint URLs in the page components

### "Token not found"
- Check if localStorage is enabled in your browser
- Sign out and sign in again to refresh the token

### Build errors
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Ensure you're using Node.js version 16 or higher
