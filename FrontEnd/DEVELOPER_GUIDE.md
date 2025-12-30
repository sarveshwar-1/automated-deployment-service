# Development Guide & Troubleshooting

## 🚀 Getting Started Quickly

### 1. First Time Setup
```bash
# Clone/navigate to FrontEnd directory
cd FrontEnd

# Install all dependencies
npm install

# Start development server
npm run dev
```

The app opens automatically at `http://localhost:5173`

### 2. Make Your First Change
1. Open `src/App.tsx`
2. Change the project title in the navbar
3. See the change reflected instantly (HMR - Hot Module Replacement)

## 🔧 Common Development Tasks

### Add a New Page

1. **Create the page component**:
```tsx
// src/pages/MyNewPage.tsx
import React from 'react';
import { Navbar } from '../components';

export const MyNewPage: React.FC = () => {
  return (
    <>
      <Navbar />
      <div className="p-8">
        <h1>My New Page</h1>
      </div>
    </>
  );
};
```

2. **Export from pages/index.ts**:
```tsx
export { MyNewPage } from './MyNewPage';
```

3. **Add route to App.tsx**:
```tsx
<Route path="/my-page" element={<ProtectedRoute component={<MyNewPage />} />} />
```

### Add a New Component

1. **Create the component**:
```tsx
// src/components/MyComponent.tsx
import React from 'react';

interface Props {
  title: string;
  children: React.ReactNode;
}

export const MyComponent: React.FC<Props> = ({ title, children }) => {
  return <div>{title} {children}</div>;
};
```

2. **Export from components/index.ts**:
```tsx
export { MyComponent } from './MyComponent';
```

3. **Use in pages**:
```tsx
import { MyComponent } from '../components';

<MyComponent title="Hello">Content</MyComponent>
```

### Fetch Data from API

```tsx
import { useEffect } from 'react';
import { projectAPI } from '../api/client';
import { useProjectStore } from '../store';

export const MyComponent = () => {
  const { setProjects, setLoading, setError } = useProjectStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await projectAPI.getProjects();
        setProjects(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading projects');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return <div>Projects loaded</div>;
};
```

### Add Form Validation

```tsx
const [errors, setErrors] = useState<Record<string, string>>({});

const validateForm = () => {
  const newErrors: Record<string, string> = {};

  if (!email) newErrors.email = 'Email is required';
  if (!email.includes('@')) newErrors.email = 'Invalid email format';
  if (password.length < 6) newErrors.password = 'Password must be 6+ chars';

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

const handleSubmit = (e) => {
  e.preventDefault();
  if (!validateForm()) return;
  // Submit form
};
```

### Style a Component

```tsx
// Using Tailwind classes
<div className="bg-blue-500 text-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow">
  Styled content
</div>

// Using clsx for conditional styles
import clsx from 'clsx';

<div className={clsx(
  'p-4 rounded-lg',
  {
    'bg-green-500': isSuccess,
    'bg-red-500': isError,
    'bg-yellow-500': isLoading,
  }
)}>
  Status
</div>
```

## 🐛 Troubleshooting

### Issue: Port 5173 already in use

**Solution**: Change port in `vite.config.ts`:
```tsx
server: {
  port: 3001, // or any available port
  open: true,
}
```

### Issue: API requests failing with 404

**Solution**: Check your `.env.local`:
```
REACT_APP_API_URL=http://localhost:3000/api
```

Make sure your backend is running at that URL.

### Issue: Token not being sent with requests

**Solution**: Check localStorage has the token:
```js
// In browser console
console.log(localStorage.getItem('token'))
```

If empty, log in again. Check API interceptor in `src/api/client.ts`.

### Issue: Stuck on loading screen

**Solution**: 
1. Open DevTools (F12) → Console
2. Check for JavaScript errors
3. Check Network tab for failed requests
4. Clear localStorage: `localStorage.clear()`
5. Refresh page

### Issue: Components not updating

**Solution**: Ensure you're using Zustand hooks correctly:
```tsx
// ✅ Correct
const { projects } = useProjectStore();

// ❌ Wrong - won't re-render
const store = useProjectStore;
const projects = store.getState().projects;
```

### Issue: TypeScript errors in editor

**Solution**: 
1. Restart VSCode (Cmd+Shift+P → "Developer: Restart Extension Host")
2. Run `npm run build` to check for real errors
3. Check `tsconfig.json` is correct

### Issue: Styling not applying

**Solution**:
1. Clear browser cache (Cmd+Shift+Delete)
2. Verify Tailwind classes are used correctly
3. Check PostCSS processing in build

### Issue: "Cannot find module" error

**Solution**: 
1. Check import paths - they're relative from the current file
2. Verify file exists and extension matches
3. Check barrel exports in index.ts files

### Issue: Form submission not working

**Solution**:
```tsx
const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault(); // ← Make sure this is first!
  // Your logic
};
```

## 📊 Debugging Tips

### 1. Use React DevTools
- Install React DevTools extension
- Inspect component tree
- Check props and state
- Profile performance

### 2. Console Logging
```tsx
// In components
useEffect(() => {
  console.log('Component mounted');
  console.log('Projects:', projects);
  
  return () => console.log('Component unmounted');
}, [projects]);
```

### 3. Network Debugging
- Open DevTools → Network tab
- Make API calls and inspect requests/responses
- Check request headers (Authorization token should be there)
- Check response status and body

### 4. State Debugging
```tsx
// In console
import { useAuthStore } from './store';
useAuthStore.getState() // View entire auth state
useAuthStore.getState().user // View specific value
```

### 5. Vite Debug Mode
```bash
# See detailed startup logs
DEBUG=* npm run dev
```

## 🎯 Performance Optimization

### 1. Code Splitting
```tsx
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));

// In route
<Suspense fallback={<Loading />}>
  <Route path="/dashboard" element={<Dashboard />} />
</Suspense>
```

### 2. Memoization
```tsx
import { memo } from 'react';

// Prevent re-renders if props haven't changed
export const ProjectCard = memo(({ project }: Props) => {
  return <div>{project.name}</div>;
});
```

### 3. useMemo Hook
```tsx
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);
```

### 4. useCallback Hook
```tsx
const memoizedCallback = useCallback(() => {
  doSomething();
}, [dependencies]);
```

## 📝 Best Practices

### 1. Always use TypeScript types
```tsx
// ✅ Good
interface Props {
  name: string;
  onSubmit: (name: string) => void;
}

const MyComponent: React.FC<Props> = ({ name, onSubmit }) => {
  // ...
};

// ❌ Avoid
const MyComponent = ({ name, onSubmit }) => {
  // ...
};
```

### 2. Handle loading and error states
```tsx
// ✅ Show appropriate UI states
const { projects, isLoading, error } = useProjectStore();

if (isLoading) return <Loading />;
if (error) return <Alert type="error" message={error} />;
return <ProjectList projects={projects} />;

// ❌ Avoid rendering without checks
return <ProjectList projects={projects} />;
```

### 3. Use keys in lists
```tsx
// ✅ Correct
{projects.map((project) => (
  <ProjectCard key={project.id} project={project} />
))}

// ❌ Avoid
{projects.map((project, index) => (
  <ProjectCard key={index} project={project} />
))}
```

### 4. Clean up effects
```tsx
// ✅ Good
useEffect(() => {
  const timer = setTimeout(() => {
    // ...
  }, 1000);

  return () => clearTimeout(timer); // Cleanup
}, []);

// ❌ Avoid memory leaks
useEffect(() => {
  setInterval(() => {
    // ...
  }, 1000);
  // No cleanup - causes memory leak
}, []);
```

### 5. Proper error handling
```tsx
// ✅ Show user-friendly messages
catch (err: any) {
  const message = err.response?.data?.message || 'Something went wrong';
  setError(message);
}

// ❌ Avoid exposing system errors
catch (err) {
  setError(err.toString());
}
```

## 🧪 Testing Components

### Manual Testing Checklist
- [ ] Sign up with valid data
- [ ] Sign up with invalid email
- [ ] Sign in with correct credentials
- [ ] Sign in with wrong password
- [ ] Create project successfully
- [ ] Create project with invalid URL
- [ ] View projects list
- [ ] Deploy project
- [ ] Delete project
- [ ] Logout
- [ ] Try accessing protected route as guest
- [ ] Test responsive design on mobile

## 🚀 Deployment Checklist

- [ ] Run `npm run build` successfully
- [ ] No console errors in production build
- [ ] Update `.env.local` with production API URL
- [ ] Test all features in production build
- [ ] Check responsive design
- [ ] Verify API endpoints are correct
- [ ] Test authentication flow
- [ ] Check error handling

## 📚 Useful Commands

```bash
# Check TypeScript compilation
npm run build

# Preview production build locally
npm run preview

# List all npm scripts
npm run

# Check for security vulnerabilities
npm audit

# Update dependencies
npm update
```

## 🔗 Quick Links

- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [React Router](https://reactrouter.com)
- [Vite Docs](https://vitejs.dev)
- [Axios Docs](https://axios-http.com)

## 💡 Pro Tips

1. **Use Prettier for formatting**:
   ```bash
   npm install -D prettier
   # Format code automatically
   ```

2. **Use ESLint for code quality**:
   ```bash
   npm install -D eslint
   # Catch bugs before runtime
   ```

3. **Git commits often**:
   ```bash
   git add .
   git commit -m "Add project creation feature"
   ```

4. **Keep dependencies updated**:
   ```bash
   npm outdated # See what needs updating
   npm update   # Update to latest compatible versions
   ```

5. **Monitor bundle size**:
   ```bash
   npm run build
   # Check dist folder size
   ```

---

Happy coding! 🎉

For more help, refer to the main documentation in `README.md` and architecture details in `ARCHITECTURE.md`.
