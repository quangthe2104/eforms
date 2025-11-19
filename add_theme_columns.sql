-- Add theme columns to forms table
ALTER TABLE `forms` 
ADD COLUMN `primary_color` VARCHAR(255) DEFAULT '#4285F4' AFTER `thumbnail`,
ADD COLUMN `secondary_color` VARCHAR(255) DEFAULT '#C6DAFC' AFTER `primary_color`,
ADD COLUMN `background_color` VARCHAR(255) DEFAULT '#FFFFFF' AFTER `secondary_color`,
ADD COLUMN `header_image` LONGTEXT NULL AFTER `background_color`,
ADD COLUMN `font_family` VARCHAR(255) DEFAULT 'system-ui, -apple-system, sans-serif' AFTER `header_image`,
ADD COLUMN `header_font_size` VARCHAR(255) DEFAULT '32px' AFTER `font_family`,
ADD COLUMN `question_font_size` VARCHAR(255) DEFAULT '16px' AFTER `header_font_size`,
ADD COLUMN `text_font_size` VARCHAR(255) DEFAULT '14px' AFTER `question_font_size`;

