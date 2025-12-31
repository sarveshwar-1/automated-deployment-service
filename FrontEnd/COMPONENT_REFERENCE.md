# Frontend Component Reference

## SignUp Component (`pages/SignUp.tsx`)

### Props
```typescript
interface SignUpProps {
  setIsAuthenticated: (value: boolean) => void;
}
```

### Form Fields
- **Username**: Text input for the user's display name
- **Email**: Email input for account creation
- **Password**: Password input for account security

### API Integration
- **Endpoint**: `POST /signup`
- **Request Body**:
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string"
  }
  ```
- **Success Response**: `{ message: "User successfully signed up" }`

---

## SignIn Component (`pages/SignIn.tsx`)

### Props
```typescript
interface SignInProps {
  setIsAuthenticated: (value: boolean) => void;
}
```

### Form Fields
- **Email**: Email address for login
- **Password**: Password for authentication

### API Integration
- **Endpoint**: `POST /signin`
- **Request Body**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Success Response**: 
  ```json
  {
    "message": "user signed in successfully",
    "token": "jwt_token_string"
  }
  ```
- **Token Storage**: JWT token is automatically stored in `localStorage` under key `token`

---

## Deploy Component (`pages/Deploy.tsx`)

### Form Fields
- **GitHub Repository URL**: URL input field with GitHub URL validation

### API Integration
- **Endpoint**: `POST /deploy`
- **Authentication**: Requires Bearer token in Authorization header
- **Request Body**:
  ```json
  {
    "repoUrl": "https://github.com/username/repository"
  }
  ```
- **Success Response**:
  ```json
  {
    "url": "string",
    "userId": "string",
    "projectId": "string",
    "commitSha": "string",
    "defaultBranch": "string"
  }
  ```

### Display After Deployment
- Project ID (unique identifier)
- Repository URL
- Default Branch
- Commit SHA (abbreviated to 7 characters)

---

## ViewProjects Component (`pages/ViewProjects.tsx`)

### API Integration

#### Fetch Projects
- **Endpoint**: `GET /viewProjects`
- **Authentication**: Requires Bearer token in Authorization header
- **Response**:
  ```json
  {
    "results": [
      {
        "_id": "mongodb_id",
        "url": "string",
        "projectId": "string",
        "defaultBranch": "string",
        "commitSha": "string",
        "userId": "string"
      }
    ]
  }
  ```

#### Delete Project
- **Endpoint**: `DELETE /deleteProject`
- **Authentication**: Requires Bearer token in Authorization header
- **Request Body**:
  ```json
  {
    "projectId": "string"
  }
  ```
- **Success Response**: `{ message: "Deployment deleted successfully" }`

### Project Card Display
Each project is displayed in a card with:
- Project name (extracted from repository URL)
- Project ID (clickable code element)
- Repository URL (clickable link to GitHub)
- Default Branch
- Commit SHA (abbreviated to 7 characters)
- Delete button

---

## App Component (`App.tsx`)

### Routes
```
/signup          - SignUp page (public)
/signin          - SignIn page (public)
/deploy          - Deploy page (protected)
/projects        - ViewProjects page (protected)
/                - Redirects to /deploy (if authenticated) or /signup (if not)
```

### Authentication Flow
1. User signs up → redirected to signin
2. User signs in → token stored, redirected to deploy
3. Token stored in localStorage under key `token`
4. Unauthenticated users redirected to signin
5. Logout clears token and redirects to signin

### Navigation Bar
- **Brand**: "Vercel Clone"
- **Authenticated Users See**:
  - Deploy link
  - My Projects link
  - Logout button

---

## Authentication Headers

All protected endpoints require this header:
```
Authorization: Bearer <jwt_token>
```

The token is automatically added by the frontend from localStorage.

---

## Error Handling

All components implement error handling with:
- Error state management
- Error message display to users
- Console logging for debugging
- User-friendly error messages

### Common Error Messages
- "No authentication token found"
- "Failed to sign up. Please try again."
- "Failed to sign in. Please try again."
- "Failed to deploy. Please check the URL and try again."
- "Failed to load projects. Please try again."
- "Failed to delete project. Please try again."

---

## Loading States

Components show loading indicators:
- SignUp: "Signing Up..."
- SignIn: "Signing In..."
- Deploy: "Deploying..."
- ViewProjects: "Loading projects..."

---

## Styling Classes

### Global
- `.app-container` - Main container
- `.navbar` - Navigation bar
- `.nav-brand` - App name/logo
- `.nav-links` - Navigation links
- `.loading` - Loading state display

### Authentication
- `.auth-container` - Auth page container
- `.auth-box` - Auth form box
- `.form-group` - Form field group
- `.error-message` - Error message display
- `.success-message` - Success message display
- `.auth-link` - Link to other auth pages

### Deploy
- `.deploy-container` - Deploy page container
- `.deploy-box` - Deploy form box
- `.deploy-btn` - Deploy button
- `.project-details` - Project details display
- `.details-grid` - Grid layout for details
- `.detail-item` - Individual detail item

### Projects
- `.projects-container` - Projects page container
- `.projects-box` - Projects container box
- `.no-projects` - No projects message
- `.projects-grid` - Grid layout for project cards
- `.project-card` - Individual project card
- `.card-header` - Card header section
- `.card-body` - Card body section
- `.card-footer` - Card footer section
- `.delete-btn` - Delete button
