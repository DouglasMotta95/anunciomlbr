insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ai-listing-images',
  'ai-listing-images',
  true,
  12582912,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
