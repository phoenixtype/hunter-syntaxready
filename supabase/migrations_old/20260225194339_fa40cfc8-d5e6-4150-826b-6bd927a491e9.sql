
-- Drop and recreate triggers to ensure they're properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_mirror ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_notifications ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_mirror
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_mirror();

CREATE TRIGGER on_auth_user_notifications
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_notifications();

-- Backfill missing notification_preferences for existing users
INSERT INTO public.notification_preferences (user_id, notification_email)
SELECT u.id, u.email FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.notification_preferences np WHERE np.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;
