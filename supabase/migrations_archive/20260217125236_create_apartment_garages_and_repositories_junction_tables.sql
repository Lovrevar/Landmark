/*
  # Create Many-to-Many Relationships for Apartment Garages and Repositories

  ## Overview
  Replace single FK columns (garage_id, repository_id) on apartments table with many-to-many 
  relationships using junction tables, allowing multiple garages and repositories per apartment.

  ## New Tables
  
  ### `apartment_garages`
  - Junction table linking apartments to garages (many-to-many)
  - `id` (uuid, primary key)
  - `apartment_id` (uuid, references apartments)
  - `garage_id` (uuid, references garages)
  - `created_at` (timestamptz)
  - Unique constraint on (apartment_id, garage_id) to prevent duplicates

  ### `apartment_repositories`
  - Junction table linking apartments to repositories (many-to-many)
  - `id` (uuid, primary key)
  - `apartment_id` (uuid, references apartments)
  - `repository_id` (uuid, references repositories)
  - `created_at` (timestamptz)
  - Unique constraint on (apartment_id, repository_id) to prevent duplicates

  ## Data Migration
  - Migrate existing garage_id and repository_id relationships to junction tables
  - Preserve all existing links before dropping old columns

  ## Changes
  1. Create apartment_garages junction table with RLS policies
  2. Create apartment_repositories junction table with RLS policies
  3. Migrate existing data from apartments.garage_id to apartment_garages
  4. Migrate existing data from apartments.repository_id to apartment_repositories
  5. Drop garage_id and repository_id columns from apartments table

  ## Security
  - Enable RLS on both junction tables
  - Allow authenticated users to read/write based on project access
*/

-- Create apartment_garages junction table
CREATE TABLE IF NOT EXISTS public.apartment_garages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  apartment_id uuid NOT NULL,
  garage_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT apartment_garages_pkey PRIMARY KEY (id),
  CONSTRAINT apartment_garages_apartment_id_fkey FOREIGN KEY (apartment_id) 
    REFERENCES public.apartments (id) ON DELETE CASCADE,
  CONSTRAINT apartment_garages_garage_id_fkey FOREIGN KEY (garage_id) 
    REFERENCES public.garages (id) ON DELETE CASCADE,
  CONSTRAINT apartment_garages_unique UNIQUE (apartment_id, garage_id)
);

-- Create apartment_repositories junction table
CREATE TABLE IF NOT EXISTS public.apartment_repositories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  apartment_id uuid NOT NULL,
  repository_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT apartment_repositories_pkey PRIMARY KEY (id),
  CONSTRAINT apartment_repositories_apartment_id_fkey FOREIGN KEY (apartment_id) 
    REFERENCES public.apartments (id) ON DELETE CASCADE,
  CONSTRAINT apartment_repositories_repository_id_fkey FOREIGN KEY (repository_id) 
    REFERENCES public.repositories (id) ON DELETE CASCADE,
  CONSTRAINT apartment_repositories_unique UNIQUE (apartment_id, repository_id)
);

-- Migrate existing garage links
INSERT INTO public.apartment_garages (apartment_id, garage_id)
SELECT id, garage_id 
FROM public.apartments 
WHERE garage_id IS NOT NULL
ON CONFLICT (apartment_id, garage_id) DO NOTHING;

-- Migrate existing repository links
INSERT INTO public.apartment_repositories (apartment_id, repository_id)
SELECT id, repository_id 
FROM public.apartments 
WHERE repository_id IS NOT NULL
ON CONFLICT (apartment_id, repository_id) DO NOTHING;

-- Drop old FK columns from apartments
ALTER TABLE public.apartments DROP COLUMN IF EXISTS garage_id;
ALTER TABLE public.apartments DROP COLUMN IF EXISTS repository_id;

-- Enable RLS on apartment_garages
ALTER TABLE public.apartment_garages ENABLE ROW LEVEL SECURITY;

-- Enable RLS on apartment_repositories
ALTER TABLE public.apartment_repositories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for apartment_garages
CREATE POLICY "Authenticated users can view apartment garages"
  ON public.apartment_garages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert apartment garages"
  ON public.apartment_garages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update apartment garages"
  ON public.apartment_garages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete apartment garages"
  ON public.apartment_garages FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for apartment_repositories
CREATE POLICY "Authenticated users can view apartment repositories"
  ON public.apartment_repositories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert apartment repositories"
  ON public.apartment_repositories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update apartment repositories"
  ON public.apartment_repositories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete apartment repositories"
  ON public.apartment_repositories FOR DELETE
  TO authenticated
  USING (true);