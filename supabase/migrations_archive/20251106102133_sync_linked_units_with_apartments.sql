/*
  # Sync Linked Units with Apartment Status

  1. Purpose
    - Update garages and repositories that are linked to sold apartments
    - Set their status to 'Sold' and copy the buyer_name from the apartment
    
  2. Changes
    - Update garages where linked to sold apartments
    - Update repositories where linked to sold apartments
    
  3. Important Notes
    - This is a one-time data fix for existing linked units
    - Future links will be handled automatically by the application
*/

-- Update garages linked to sold apartments
UPDATE garages g
SET 
  status = 'Sold',
  buyer_name = a.buyer_name
FROM apartments a
WHERE a.garage_id = g.id
  AND a.status = 'Sold'
  AND a.buyer_name IS NOT NULL
  AND (g.status != 'Sold' OR g.buyer_name IS NULL OR g.buyer_name != a.buyer_name);

-- Update repositories linked to sold apartments
UPDATE repositories r
SET 
  status = 'Sold',
  buyer_name = a.buyer_name
FROM apartments a
WHERE a.repository_id = r.id
  AND a.status = 'Sold'
  AND a.buyer_name IS NOT NULL
  AND (r.status != 'Sold' OR r.buyer_name IS NULL OR r.buyer_name != a.buyer_name);
