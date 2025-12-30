# 📋 Quick Reference Card

## 🚀 Quick Start
```bash
npm install          # Install dependencies
npm run dev         # Start dev server (port 5173)
npm run build       # Build for production
npm run preview     # Preview production build
```

## 📁 Key Files to Know

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main routing and app structure |
| `src/api/client.ts` | API calls and interceptors |
| `src/store/index.ts` | State management (Zustand) |
| `src/components/` | Reusable UI components |
| `src/pages/` | Page components |
| `.env.local` | Environment configuration |
| `vite.config.ts` | Vite build configuration |

## 🔑 Core Concepts

### Authentication
- **SignUp**: Register new user → gets token
- **SignIn**: Login user → gets token
- **Protected Routes**: Require valid token + user profile
- **Token Storage**: localStorage + Zustand store

### State Management (Zustand)
```tsx
// Auth Store
const { user, token, isLoading, error, logout } = useAuthStore();

// Project Store
const { projects, selectedProject, setProjects, addProject } = useProjectStore();
```

### API Calls
```tsx
// All API functions auto-inject token in headers
import { authAPI, projectAPI } from '../api/client';

await authAPI.signin(email, password);
await projectAPI.getProjects();
await projectAPI.createProject(name, gitUrl);
```

### Styling
```tsx
// Tailwind CSS classes
<div className="bg-blue-500 p-4 rounded-lg text-white">
  Styled with Tailwind
</div>

// Conditional classes with clsx
<div className={clsx('p-4', isError ? 'bg-red-500' : 'bg-green-500')}>
  Conditional style
</div>
```

## 🎨 Components

### Button
```tsx
<Button variant="primary" size="md" isLoading={false}>
  Click Me
</Button>
// Variants: primary, secondary, danger
// Sizes: sm, md, lg
```

### Input
```tsx
<Input
  label="Email"
  type="email"
  placeholder="user@example.com"
  icon={<FiMail />}
  error={errorMessage}
/>
```

### Card
```tsx
<Card className="custom-class">
  Content here
</Card>
```

### Alert
```tsx
<Alert
  type="error"
  message="Error message"
  onClose={() => setError(null)}
/>
// Types: error, success, info
```

## 📂 Directory Structure
```
src/
├── api/client.ts          ← API configuration
├── components/            ← Reusable UI (Button, Input, etc)
├── pages/                 ← Full pages (Dashboard, SignUp, etc)
├── routes/                ← Route logic (ProtectedRoute)
├── store/                 ← Zustand stores
├── types/                 ← TypeScript interfaces
├── App.tsx                ← Main router
├── main.tsx               ← Entry point
└── index.css              ← Global Tailwind styles
```

## 🔐 Protected Routes
```tsx
// Automatically checks authentication
<Route
  path="/dashboard"
  element={<ProtectedRoute component={<Dashboard />} />}
/>
```

## 📝 Common Patterns

### Form Submission
```tsx
const [formData, setFormData] = useState({ /* ... */ });
const [errors, setErrors] = useState('');

const handleChange = (e) => {
  setFormData(prev => ({
    ...prev,
    [e.target.name]: e.target.value
  }));
};

const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    setLoading(true);
    await api.call(formData);
    navigate('/next-page');
  } catch (err) {
    setErrors(err.response?.data?.message);
  } finally {
    setLoading(false);
  }
};
```

### Data Fetching
```tsx
useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.getData();
      setData(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  fetchData();
}, []); // Empty array = run once on mount
```

### Conditional Rendering
```tsx
if (isLoading) return <LoadingSpinner />;
if (error) return <Alert type="error" message={error} />;
if (!data) return <EmptyState />;
return <DataDisplay data={data} />;
```

## 🌐 API Endpoints

```
POST   /api/auth/signup        Register user
POST   /api/auth/signin        Login user
GET    /api/auth/profile       Get current user

GET    /api/projects           List all projects
POST   /api/projects           Create project
GET    /api/projects/:id       Get project
POST   /api/projects/:id/deploy Trigger deploy
DELETE /api/projects/:id       Delete project
```

## 🐛 Debug Tools

```js
// View auth state in console
useAuthStore.getState()

// View project state in console
useProjectStore.getState()

// Check stored token
localStorage.getItem('token')

// Clear everything and reset
localStorage.clear()
```

## 🎯 Tailwind Color Classes

```tsx
// Text
text-gray-500, text-blue-600, text-red-700

// Background
bg-gray-100, bg-blue-500, bg-green-50

// Border
border-gray-300, border-red-500

// Hover effects
hover:bg-blue-700, hover:text-gray-800

// Responsive
md:grid-cols-2, lg:grid-cols-3
```

## 📦 Imports Cheat Sheet

```tsx
// Components
import { Button, Input, Card, Alert, Navbar } from '../components';

// API
import { authAPI, projectAPI } from '../api/client';

// Store
import { useAuthStore, useProjectStore } from '../store';

// React
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Icons
import { FiMenu, FiLogOut, FiPlus, FiTrash2 } from 'react-icons/fi';

// Utilities
import clsx from 'clsx';
```

## 🚦 Status Badges

```tsx
const getStatusColor = (status: string) => ({
  'idle': 'bg-gray-100 text-gray-700',
  'deploying': 'bg-yellow-100 text-yellow-700',
  'deployed': 'bg-green-100 text-green-700',
  'failed': 'bg-red-100 text-red-700',
}[status]);
```

## 💾 Environment Variables

```env
# .env.local
REACT_APP_API_URL=http://localhost:3000/api
```

## 📱 Responsive Prefixes

```tsx
// Mobile-first approach
<div className="p-4 md:p-8 lg:p-12">
  Responsive padding
</div>

// Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  Responsive grid
</div>
```

## ⚡ Performance Tips

1. Use `React.memo()` for expensive components
2. Use `useMemo()` for expensive computations
3. Use `useCallback()` for functions passed to children
4. Use lazy imports for large components
5. Keep component state minimal

## 🔄 Common Workflows

### Create a New Feature
1. Plan the feature and API
2. Create API function in `src/api/client.ts`
3. Add store logic in `src/store/index.ts`
4. Create components in `src/components/`
5. Create page in `src/pages/`
6. Add route in `src/App.tsx`

### Add New API Endpoint
1. Add function in `src/api/client.ts`
2. Define TypeScript types in `src/types/index.ts`
3. Create store actions in `src/store/index.ts`
4. Use in components with `useProjectStore()` or `useAuthStore()`

### Style a Component
1. Use Tailwind classes for styling
2. Use `clsx()` for conditional classes
3. Use custom CSS in `src/index.css` if needed
4. Use CSS variables for theming

## 🎨 Color Palette

| Color | Hex | Classes |
|-------|-----|---------|
| Primary | #0070F3 | blue-600 |
| Dark | #111827 | gray-900 |
| Light | #F9FAFB | gray-50 |
| Error | #EF4444 | red-500 |
| Success | #10B981 | green-500 |
| Warning | #FBBF24 | yellow-400 |

## 🔗 Resources

| Resource | Link |
|----------|------|
| React | https://react.dev |
| TypeScript | https://www.typescriptlang.org |
| Tailwind | https://tailwindcss.com |
| Zustand | https://github.com/pmndrs/zustand |
| React Router | https://reactrouter.com |
| Vite | https://vitejs.dev |

---

**Version**: 1.0.0 | **Updated**: Dec 30, 2025
