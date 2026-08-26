DELETE FROM public.ml_notifications older
USING public.ml_notifications newer
WHERE older.notification_id IS NOT NULL
  AND older.notification_id = newer.notification_id
  AND older.created_at > newer.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS ml_notifications_notification_id_idx
ON public.ml_notifications (notification_id)
WHERE notification_id IS NOT NULL;