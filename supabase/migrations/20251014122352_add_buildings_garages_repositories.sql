/*
  # Add buildings, garages, and repositories tables

  ## Overview
  This migration adds hierarchical structure for real estate projects:
  - Buildings can contain apartments, garages, and repositories
  - Apartments can be linked to garages and repositories
  
  ## New Tables
  
  ### `buildings`
  - `id` (uuid, primary key)
  - `project_id` (uuid, foreign key to projects)
  - `name` (text) - Building name/number
  - `description` (text, optional) - Additional details
  - `total_floors` (integer) - Number of floors
  - `created_at` (timestamptz)
  
  ### `garages`
  - `id` (uuid, primary key)
  - `building_id` (uuid, foreign key to buildings)
  - `number` (text) - Garage number/identifier
  - `floor` (integer) - Floor location
  - `size_m2` (numeric) - Size in square meters
  - `price` (numeric) - Price
  - `status` (text) - Available/Reserved/Sold
  - `buyer_name` (text, optional) - Buyer name if sold
  - `created_at` (timestamptz)
  
  ### `repositories`
  - `id` (uuid, primary key)
  - `building_id` (uuid, foreign key to buildings)
  - `number` (text) - Repository number/identifier
  - `floor` (integer) - Floor location
  - `size_m2` (numeric) - Size in square meters
  - `price` (numeric) - Price
  - `status` (text) - Available/Reserved/Sold
  - `buyer_name` (text, optional) - Buyer name if sold
  - `created_at` (timestamptz)
  
  ## Table Modifications
  
  ### `apartments`
  - Add `building_id` (uuid, foreign key to buildings)
  - Add `garage_id` (uuid, nullable, foreign key to garages) - Linked garage
  - Add `repository_id` (uuid, nullable, foreign key to repositories) - Linked repository
  
  ## Security
  - Enable RLS on all new tables
  - Add policies for authenticated users to manage their data
*/

-- Create buildings table
CREATE TABLE IF NOT EXISTS buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  total_floors integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);


-- Create garages table
CREATE TABLE IF NOT EXISTS garages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  number text NOT NULL,
  floor integer NOT NULL DEFAULT 0,
  size_m2 numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Available',
  buyer_name text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT garages_status_check CHECK (status IN ('Available', 'Reserved', 'Sold'))
);


-- Create repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  number text NOT NULL,
  floor integer NOT NULL DEFAULT 0,
  size_m2 numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Available',
  buyer_name text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT repositories_status_check CHECK (status IN ('Available', 'Reserved', 'Sold'))
);


-- Add building_id to apartments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'building_id'
  ) THEN
    ALTER TABLE apartments ADD COLUMN building_id uuid REFERENCES buildings(id) ON DELETE CASCADE;

  END IF;

END $$;


-- Add garage_id to apartments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'garage_id'
  ) THEN
    ALTER TABLE apartments ADD COLUMN garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;

  END IF;

END $$;


-- Add repository_id to apartments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'repository_id'
  ) THEN
    ALTER TABLE apartments ADD COLUMN repository_id uuid REFERENCES repositories(id) ON DELETE SET NULL;

  END IF;

END $$;


-- Enable RLS
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

ALTER TABLE garages ENABLE ROW LEVEL SECURITY;

ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;


-- RLS Policies for buildings
CREATE POLICY "Authenticated users can view buildings"
  ON buildings FOR SELECT
  TO authenticated
  USING (true);


CREATE POLICY "Authenticated users can insert buildings"
  ON buildings FOR INSERT
  TO authenticated
  WITH CHECK (true);


CREATE POLICY "Authenticated users can update buildings"
  ON buildings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);


CREATE POLICY "Authenticated users can delete buildings"
  ON buildings FOR DELETE
  TO authenticated
  USING (true);


-- RLS Policies for garages
CREATE POLICY "Authenticated users can view garages"
  ON garages FOR SELECT
  TO authenticated
  USING (true);


CREATE POLICY "Authenticated users can insert garages"
  ON garages FOR INSERT
  TO authenticated
  WITH CHECK (true);


CREATE POLICY "Authenticated users can update garages"
  ON garages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);


CREATE POLICY "Authenticated users can delete garages"
  ON garages FOR DELETE
  TO authenticated
  USING (true);


-- RLS Policies for repositories
CREATE POLICY "Authenticated users can view repositories"
  ON repositories FOR SELECT
  TO authenticated
  USING (true);


CREATE POLICY "Authenticated users can insert repositories"
  ON repositories FOR INSERT
  TO authenticated
  WITH CHECK (true);


CREATE POLICY "Authenticated users can update repositories"
  ON repositories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);


CREATE POLICY "Authenticated users can delete repositories"
  ON repositories FOR DELETE
  TO authenticated
  USING (true);
;