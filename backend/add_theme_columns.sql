-- Add theme columns to forms table
ALTER TABLE `forms` 
ADD COLUMN `primary_color` VARCHAR(255) NULL AFTER `custom_thank_you_message`,
ADD COLUMN `secondary_color` VARCHAR(255) NULL AFTER `primary_color`,
ADD COLUMN `background_color` VARCHAR(255) NULL AFTER `secondary_color`,
ADD COLUMN `header_image` LONGTEXT NULL AFTER `background_color`,
ADD COLUMN `font_family` VARCHAR(255) NULL AFTER `header_image`,
ADD COLUMN `header_font_size` VARCHAR(255) NULL AFTER `font_family`,
ADD COLUMN `question_font_size` VARCHAR(255) NULL AFTER `header_font_size`,
ADD COLUMN `text_font_size` VARCHAR(255) NULL AFTER `question_font_size`;

