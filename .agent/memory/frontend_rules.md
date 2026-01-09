# Frontend Development Guidelines

## Technology Stack
- **Framework**: React 18+ (Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn UI (Radix Primitives)
- **Icons**: Lucide React
- **State Management**: React Context (Global), `useState` (Local)
- **Data Fetching**: `useEffect` + Async/Await (Move to TanStack Query recommended for V2)

## Component Principles
1.  **Atomic Design**: functionality should be broken down into small, reusable components.
2.  **Strict Typing**: Every prop must have an interface. Avoid `any`.
3.  **Safety**: All `async` event handlers must assume failure and wrap calls in `try/catch`.
4.  **Feedback**: Use `sonner` toast for all async results (Success/Error).

## Styling Rules
- **Utility First**: Use Tailwind classes for layout, spacing, and typography.
- **Shadcn UI**: Use standard components from `@/components/ui`. Do not reinvent buttons, inputs, or dialogs.
- **Glassmorphism**: Use the `.glass` or `.glass-card` utility classes for containers to maintain the "Hunter" aesthetic.
- **Dark Mode**: All components must support `dark:` variants.

## File Structure
- `src/components/ui/*`: Generic, reusable UI primitives (Buttons, Cards).
- `src/components/*`: Feature-specific components (JobFeed, ResumeUploader).
- `src/pages/*`: Route-level views.
- `src/lib/*`: Business logic, engines, and helpers.
- `src/hooks/*`: Custom React hooks (`useAuth`, `useResume`).

## Critical Patterns
### Async Data Loading
Always handle the 3 states: `loading`, `error`, `data`.
```tsx
const [loading, setLoading] = useState(false);
const fetchData = async () => {
    setLoading(true);
    try {
        await apiCall();
    } catch (e) {
        toast.error("Failed");
    } finally {
        setLoading(false);
    }
}
```

### Authentication
Protected routes must check `user` from `useAuth()`.
```tsx
const { user, loading } = useAuth();
if (loading) return <Skeleton />;
if (!user) return <Redirect to="/login" />;
```
