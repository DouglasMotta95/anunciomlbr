GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_license_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_license_code(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;