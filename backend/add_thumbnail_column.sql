-- Add thumbnail column to forms table
-- Run this SQL in phpMyAdmin or MySQL client

ALTER TABLE `forms` 
ADD COLUMN `thumbnail` LONGTEXT NULL AFTER `description`;

-- Verify the column was added
DESCRIBE `forms`;

