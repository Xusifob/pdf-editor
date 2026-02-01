-- Initial database schema for PDF Editor
-- Created: 2026-02-01
-- Description: Creates pdfs and fields tables with indexes
CREATE TABLE IF NOT EXISTS pdfs (
    id VARCHAR(36) PRIMARY KEY COMMENT 'UUID for the PDF',
    filename VARCHAR(255) NOT NULL COMMENT 'Original filename',
    num_pages INT NOT NULL COMMENT 'Number of pages in PDF',
    raw_data LONGBLOB NOT NULL COMMENT 'PDF binary data',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at),
    INDEX idx_filename (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores uploaded PDF files and metadata';
CREATE TABLE IF NOT EXISTS fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pdf_id VARCHAR(36) NOT NULL COMMENT 'Reference to PDF',
    field_id VARCHAR(255) COMMENT 'Field identifier',
    field_name VARCHAR(255) NOT NULL COMMENT 'Field name',
    label VARCHAR(255) COMMENT 'Display label',
    original_name VARCHAR(255) COMMENT 'Original qualified name',
    field_type VARCHAR(50) COMMENT 'Field type (Text, Checkbox, etc)',
    value TEXT COMMENT 'Field value',
    checked BOOLEAN DEFAULT FALSE COMMENT 'For checkbox/radio',
    radio_group VARCHAR(255) COMMENT 'Radio button group name',
    date_format VARCHAR(50) COMMENT 'Date format string',
    monospace BOOLEAN DEFAULT FALSE COMMENT 'Comb field indicator',
    x FLOAT COMMENT 'X position',
    y FLOAT COMMENT 'Y position',
    width FLOAT COMMENT 'Field width',
    height FLOAT COMMENT 'Field height',
    page INT COMMENT 'Page number',
    border_style VARCHAR(50) COMMENT 'Border style',
    border_width FLOAT COMMENT 'Border width',
    border_color JSON COMMENT 'RGB border color',
    font_family VARCHAR(100) COMMENT 'Font family',
    font_size INT COMMENT 'Font size',
    max_length INT COMMENT 'Maximum characters',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE,
    INDEX idx_pdf_id (pdf_id),
    INDEX idx_field_name (field_name),
    INDEX idx_field_id (field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores form fields for each PDF';
