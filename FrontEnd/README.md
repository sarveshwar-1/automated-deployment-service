# Deployment Platform Frontend

A modern, responsive React TypeScript frontend for a Vercel-like deployment platform. Users can sign up, sign in, create projects, and manage deployments with an intuitive interface.

## 🎨 Features

- **Authentication**: Sign up and sign in with email/password
- **Project Management**: Create, view, and delete projects
- **GitHub Integration**: Connect GitHub repositories for deployment
- **Real-time Status**: Track deployment status (idle, deploying, deployed, failed)
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS
- **State Management**: Zustand for efficient state management
- **Protected Routes**: Secure authentication flow with token management
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Backend API running on `http://localhost:3000/api`

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   Update `.env.local` with your backend API URL if needed.

3. **Start the development server**:
   ```bash
   npm start
   ```

The application will open at `http://localhost:3000`

## 📁 Project Structure

```
src/
├── api/
│   └── client.ts          # Axios API client with interceptors
├── components/
│   ├── Alert.tsx          # Alert component
│   ├── Button.tsx         # Reusable button component
│   ├── Card.tsx           # Card component
│   ├── Input.tsx          # Form input component
│   ├── Navbar.tsx         # Navigation bar
│   └── index.ts           # Component exports
├── pages/
│   ├── SignUp.tsx         # Sign up page
│   ├── SignIn.tsx         # Sign in page
│   ├── Dashboard.tsx      # Projects dashboard
│   ├── CreateProject.tsx  # Create project page
│   └── index.ts           # Page exports
├── routes/
│   ├── ProtectedRoute.tsx # Protected route wrapper
│   └── index.ts           # Route exports
├── store/
│   └── index.ts           # Zustand stores (auth & projects)
├── App.tsx                # Main application component
├── main.tsx               # Application entry point
└── index.css              # Global styles
```

## 🔐 Authentication Flow

1. **Sign Up**: User registers with name, email, and password
2. **Sign In**: User logs in with email and password
3. **Token Storage**: JWT token stored in localStorage
4. **Protected Routes**: Routes require valid token and user profile
5. **Auto Logout**: Invalid or expired token redirects to sign in

## 🌐 API Endpoints

The frontend expects these backend endpoints:

### Auth
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login
- `GET /api/auth/profile` - Get current user profile

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `POST /api/projects/:id/deploy` - Trigger deployment
- `DELETE /api/projects/:id` - Delete project

## 🎯 Component API

### Button
```tsx
<Button
  variant="primary" | "secondary" | "danger"
  size="sm" | "md" | "lg"
  isLoading={false}
>
  Click me
</Button>
```

### Input
```tsx
<Input
  label="Email"
  type="email"
  name="email"
  placeholder="user@example.com"
  icon={<FiMail />}
  error="Invalid email"
/>
```

### Card
```tsx
<Card className="custom-class">
  Content goes here
</Card>
```

## 🔄 State Management

### Auth Store (Zustand)
```tsx
const { user, token, isLoading, error, setUser, setToken, logout } = useAuthStore();
```

### Project Store (Zustand)
```tsx
const { projects, selectedProject, isLoading, error, setProjects, addProject } = useProjectStore();
```

## 🛠️ Build for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` directory.

## 📦 Dependencies

- **react**: UI library
- **react-dom**: DOM rendering
- **react-router-dom**: Routing
- **axios**: HTTP client
- **zustand**: State management
- **tailwindcss**: Styling
- **react-icons**: Icon library
- **clsx**: Utility for conditional classnames

## 🎨 Styling

The project uses Tailwind CSS for styling. Configuration is in `tailwind.config.js`.

### Theme Colors
- Primary: `#0070F3` (blue)
- Dark: `#111827` (dark gray)

## 🚨 Error Handling

- API errors are caught and displayed in alert components
- Validation errors are shown inline with form fields
- Network errors fallback to generic messages
- Failed deployments update project status to "failed"

## 🔄 State Persistence

- JWT tokens are persisted in localStorage
- Projects are loaded on dashboard mount
- User profile is verified on app startup

## 📱 Responsive Design

All components are mobile-first and responsive:
- Mobile: Single column layouts
- Tablet: 2 column grid for projects
- Desktop: 3 column grid for projects

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📝 License

This project is part of the Vercel Clone deployment platform.
