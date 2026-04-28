/*
  # Add file attachment support to chat messages

  1. Changes to `chat_messages`
    - `file_url` (text, nullable) - public URL of the uploaded file
    - `file_name` (text, nullable) - original filename
    - `file_size` (bigint, nullable) - file size in bytes
    - `file_type` (text, nullable) - MIME type of the file

  2. Storage
    - Create `chat-attachments` bucket for storing uploaded files
    - 25 MB file size limit
    - Allow authenticated users to upload and read files

  3. Notes
    - Messages can have both text content and a file attachment
    - Messages can also be file-only (content may be empty string)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN file_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN file_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN file_size bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN file_type text;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  26214400,
  NULL
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload chat attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Anyone can view chat attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can delete their own chat attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
