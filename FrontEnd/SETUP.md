# 🚀 Frontend Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd FrontEnd
npm install
```

### 2. Configure Backend API (Optional)
Edit `.env.local`:
```
REACT_APP_API_URL=http://localhost:3000/api
```

### 3. Start Development Server
```bash
npm run dev
```

The app will open at `http://localhost:5173`

## Project Structure

```
FrontEnd/
├── src/
│   ├── api/              # API client configuration
│   ├── components/       # Reusable UI components
│   ├── pages/            # Page components (SignUp, SignIn, Dashboard, CreateProject)
│   ├── routes/           # Route components (ProtectedRoute)
│   ├── store/            # Zustand state management
│   ├── App.tsx           # Main app component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles with Tailwind
├── index.html            # HTML template
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
├── tailwind.config.js    # Tailwind CSS configuration
└── package.json          # Dependencies
```

## 🎨 Pages Overview

### SignUp Page (`/signup`)
- User registration form
- Name, email, password fields
- Password confirmation
- Validation and error handling
- Link to sign in page

### SignIn Page (`/signin`)
- Login form
- Email and password fields
- Token-based authentication
- Error messages
- Link to sign up page

### Dashboard (`/dashboard`)
- View all user projects
- Project cards with status
- Create new project button
- Deploy/redeploy projects
- Delete projects
- View deployment URLs

### Create Project (`/create-project`)
- Project name input
- GitHub URL input
- Validation
- Submit to create and deploy
- Info box about deployment process

## 🔐 Key Features

1. **Authentication**: JWT-based with localStorage persistence
2. **Protected Routes**: Authenticated users only
3. **State Management**: Zustand stores for auth and projects
4. **API Integration**: Axios with interceptors for token injection
5. **Modern UI**: Tailwind CSS + custom components
6. **Icons**: React Icons for beautiful iconography

## 📱 Responsive Breakpoints

- **Mobile**: < 768px (single column)
- **Tablet**: 768px - 1024px (2 columns)
- **Desktop**: > 1024px (3 columns for project grid)

## 🔗 API Integration

The frontend expects these endpoints from the backend:

### Auth Endpoints
- `POST /auth/signup` - Register user
- `POST /auth/signin` - Login user
- `GET /auth/profile` - Get current user

### Project Endpoints
- `GET /projects` - List projects
- `POST /projects` - Create project
- `POST /projects/:id/deploy` - Deploy project
- `DELETE /projects/:id` - Delete project

## 🎯 Component Guide

### Button Component
```tsx
<Button variant="primary" size="lg" isLoading={false}>
  Click Me
</Button>
```

Variants: `primary`, `secondary`, `danger`
Sizes: `sm`, `md`, `lg`

### Input Component
```tsx
<Input
  label="Email"
  type="email"
  placeholder="user@example.com"
  icon={<FiMail />}
  error={error}
/>
```

### Card Component
```tsx
<Card>
  Your content here
</Card>
```

### Alert Component
```tsx
<Alert
  type="error"
  message="Something went wrong"
  onClose={() => setError(null)}
/>
```

Types: `error`, `success`, `info`

## 🔧 Build for Production

```bash
npm run build
```

This creates a `dist/` directory with optimized production build.

## 📚 Technologies Used

- **React 18**: UI library
- **TypeScript**: Type-safe JavaScript
- **Vite**: Next-gen frontend tooling
- **Tailwind CSS**: Utility-first CSS framework
- **Zustand**: Lightweight state management
- **React Router v6**: Client-side routing
- **Axios**: HTTP client
- **React Icons**: Icon library

## 🛠️ Common Tasks

### Add New Page
1. Create file in `src/pages/YourPage.tsx`
2. Add route in `src/App.tsx`
3. Wrap with `ProtectedRoute` if needed

### Add New Component
1. Create file in `src/components/YourComponent.tsx`
2. Export from `src/components/index.ts`
3. Use in pages

### Access State
```tsx
import { useAuthStore, useProjectStore } from '../store';

const { user, token, logout } = useAuthStore();
const { projects, addProject } = useProjectStore();
```

### Make API Calls
```tsx
import { authAPI, projectAPI } from '../api/client';

// Auth
const response = await authAPI.signin(email, password);

// Projects
const projects = await projectAPI.getProjects();
```

## 🐛 Troubleshooting

### Port Already in Use
Change port in `vite.config.ts`:
```ts
server: {
  port: 3001, // Change this
}
```

### API Connection Error
Check `.env.local` API URL matches your backend

### Token Issues
Clear localStorage and log in again:
```js
localStorage.clear()
```

## 📦 Environment Variables

Create `.env.local`:
```
REACT_APP_API_URL=http://localhost:3000/api
```

## 🎓 Learning Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Zustand Guide](https://github.com/pmndrs/zustand)
- [React Router Docs](https://reactrouter.com)

---

Happy coding! 🎉
