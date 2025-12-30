# Frontend Architecture

## Component Hierarchy

```
App (BrowserRouter)
├── Public Routes
│   ├── /signup → SignUp
│   └── /signin → SignIn
└── Protected Routes
    ├── /dashboard → ProtectedRoute → Dashboard
    └── /create-project → ProtectedRoute → CreateProject
```

## Page Composition

### SignUp / SignIn
```
Page
├── Header (Title + Subtitle)
└── Card
    ├── Alert (Error)
    ├── Form
    │   ├── Input
    │   ├── Input
    │   └── Button
    └── Link (Navigation)
```

### Dashboard
```
Page
├── Navbar
├── Header Section
│   ├── Title
│   └── "New Project" Button
└── Projects Grid
    └── ProjectCard (repeated)
        ├── Project Info
        ├── Status Badge
        ├── Meta Info
        └── Action Buttons
```

### CreateProject
```
Page
├── Navbar
├── Header Section
├── Card
    ├── Form
    │   ├── Project Name Input
    │   ├── GitHub URL Input
    │   ├── Info Box
    │   └── Buttons (Cancel/Create)
    └── Alert (Error)
```

## State Management Flow

```
┌─────────────────────────────────────────┐
│          Zustand Stores                 │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐      ┌──────────────┐ │
│  │ AuthStore   │      │ ProjectStore │ │
│  ├─────────────┤      ├──────────────┤ │
│  │ • user      │      │ • projects   │ │
│  │ • token     │      │ • selected   │ │
│  │ • isLoading │      │ • isLoading  │ │
│  │ • error     │      │ • error      │ │
│  │ • setUser   │      │ • setProjects│ │
│  │ • setToken  │      │ • addProject │ │
│  │ • logout    │      │ • updateStatus
│  └─────────────┘      └──────────────┘ │
│                                         │
└─────────────────────────────────────────┘
        ↑              ↑            ↑
        │              │            │
    useAuthStore   useProjectStore
        │              │            │
   ┌────┴──────────────┴────────────┴────┐
   │      React Components              │
   │   (Pages & Components)             │
   └────────────────────────────────────┘
```

## Data Flow

### Authentication Flow
```
User Input
    ↓
SignUp/SignIn Form
    ↓
API Call (axios)
    ↓
Backend Response
    ↓
Store Update (setUser, setToken)
    ↓
Redirect to Dashboard
    ↓
ProtectedRoute validates
    ↓
Dashboard Renders
```

### Project Management Flow
```
User Action
    ↓
Create/Delete/Deploy
    ↓
API Call with Token
    ↓
Backend Processing
    ↓
Store Update
    ↓
Component Re-render
    ↓
UI Update
```

## API Integration

```
┌──────────────┐
│   React UI   │
└──────┬───────┘
       │
       ↓
┌──────────────────────┐
│   useAuthStore()     │  ← State Management
│   useProjectStore()  │
└──────┬───────────────┘
       │
       ↓
┌──────────────────────┐
│   API Functions      │  ← authAPI.signin()
│   from api/client    │     projectAPI.createProject()
└──────┬───────────────┘
       │
       ↓
┌──────────────────────┐
│   Axios Instance     │  ← Token Interceptor
│   with Interceptors  │     Error Handling
└──────┬───────────────┘
       │
       ↓
    Backend API
  (http://localhost:3000/api)
```

## Component Dependency Graph

```
App
├── SignUp
│   ├── Input (3x)
│   ├── Button
│   └── Alert
├── SignIn
│   ├── Input (2x)
│   ├── Button
│   └── Alert
├── Dashboard
│   ├── Navbar
│   ├── Card (multiple)
│   ├── Button
│   └── Alert
└── CreateProject
    ├── Navbar
    ├── Card
    ├── Input (2x)
    ├── Button (2x)
    └── Alert
```

## Token Lifecycle

```
┌─────────────────────────────┐
│   User Signs In             │
└────────────┬────────────────┘
             │
             ↓
┌─────────────────────────────┐
│   Backend Returns Token     │
└────────────┬────────────────┘
             │
             ↓
┌─────────────────────────────┐
│   Store in localStorage     │
│   & Zustand State           │
└────────────┬────────────────┘
             │
             ↓
┌─────────────────────────────┐
│   Axios Interceptor         │
│   adds to request headers   │
└────────────┬────────────────┘
             │
             ↓
┌─────────────────────────────┐
│   API calls with token      │
└────────────┬────────────────┘
             │
             ↓
┌─────────────────────────────┐
│   Backend Authenticates     │
└────────────┬────────────────┘
             │
             ↓
┌─────────────────────────────┐
│   Token Expires/Invalid     │
└────────────┬────────────────┘
             │
             ↓
┌─────────────────────────────┐
│   Logout & Clear State      │
│   Redirect to Sign In       │
└─────────────────────────────┘
```

## Error Handling Flow

```
API Call
    ↓
   Is Successful?
   /          \
 Yes          No
  │            │
  │            ↓
  │      Error Response
  │            ↓
  │      Extract Error
  │            ↓
  │      Update Store
  │      setError(message)
  │            ↓
  │      Show Alert
  │            │
  └────────────┘
       ↓
   Render Data / UI Update
```

## File Organization

```
FrontEnd/
├── Configuration Files
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── Documentation
│   ├── README.md (Complete guide)
│   ├── SETUP.md (Setup instructions)
│   └── FRONTEND_SUMMARY.md (This file)
│
├── Environment
│   ├── .env.local (Local config)
│   ├── .env.example (Template)
│   └── .gitignore
│
├── Static Assets
│   └── index.html
│
└── Source Code (src/)
    ├── api/
    │   └── client.ts (API calls & interceptors)
    │
    ├── components/
    │   ├── Button.tsx
    │   ├── Input.tsx
    │   ├── Card.tsx
    │   ├── Navbar.tsx
    │   ├── Alert.tsx
    │   └── index.ts (Barrel export)
    │
    ├── pages/
    │   ├── SignUp.tsx
    │   ├── SignIn.tsx
    │   ├── Dashboard.tsx
    │   ├── CreateProject.tsx
    │   └── index.ts (Barrel export)
    │
    ├── routes/
    │   ├── ProtectedRoute.tsx
    │   └── index.ts
    │
    ├── store/
    │   └── index.ts (Zustand stores)
    │
    ├── types/
    │   └── index.ts (TypeScript types)
    │
    ├── App.tsx (Root routing)
    ├── main.tsx (Entry point)
    ├── index.css (Global styles)
    └── vite-env.d.ts (Vite types)
```

## Request/Response Cycle

### Successful Request
```
1. User Action (Click, Submit)
   ↓
2. setLoading(true)
   ↓
3. API Call (axios)
   ↓
4. Token Added (interceptor)
   ↓
5. Backend Processes
   ↓
6. Success Response
   ↓
7. Store Updated
   ↓
8. setLoading(false)
   ↓
9. Component Re-renders
   ↓
10. User Sees Update
```

### Failed Request
```
1. API Call
   ↓
2. Error Response
   ↓
3. Error Interceptor
   ↓
4. setError(message)
   ↓
5. setLoading(false)
   ↓
6. Alert Shown
   ↓
7. User Sees Error
```

## Responsive Design Strategy

```
Mobile (< 768px)
├── Single column layouts
├── Touch-friendly buttons
├── Hamburger menu
└── Full-width inputs

Tablet (768px - 1024px)
├── 2-column grid for projects
├── Adjusted spacing
└── Flex layouts

Desktop (> 1024px)
├── 3-column grid for projects
├── Multi-panel layouts
├── Optimized spacing
└── Full features visible
```

## Performance Considerations

1. **Code Splitting**: Lazy load routes when possible
2. **Component Memoization**: Use React.memo for expensive components
3. **State Optimization**: Keep state flat and minimal
4. **API Caching**: Implement request caching if needed
5. **Bundle Size**: Monitor with Vite analysis

## Security Layers

1. **Frontend Validation**: Input validation before submission
2. **Token Management**: Secure localStorage usage
3. **API Interceptors**: Automatic token injection
4. **Protected Routes**: Unauthorized access prevention
5. **Error Handling**: No sensitive data in error messages

---

This architecture ensures:
- ✅ Scalability
- ✅ Maintainability
- ✅ Type Safety
- ✅ Performance
- ✅ Security
- ✅ Developer Experience
