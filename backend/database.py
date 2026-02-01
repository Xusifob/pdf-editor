"""
Database module for PDF Editor
Supports MySQL/MariaDB with connection pooling and migrations
"""
import os
import json
from typing import List, Dict, Any, Optional
from contextlib import contextmanager
import mysql.connector
from mysql.connector import Error
from mysql.connector.pooling import MySQLConnectionPool
from pathlib import Path
# Database configuration from environment variables
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '3306')),
    'user': os.getenv('DB_USER', 'pdf_editor'),
    'password': os.getenv('DB_PASSWORD', 'pdf_editor_password'),
    'database': os.getenv('DB_NAME', 'pdf_editor'),
}
# Connection pool
connection_pool: Optional[MySQLConnectionPool] = None
def init_connection_pool():
    """Initialize MySQL connection pool"""
    global connection_pool
    try:
        connection_pool = MySQLConnectionPool(
            pool_name="pdf_editor_pool",
            pool_size=int(os.getenv('DB_POOL_SIZE', '5')),
            pool_reset_session=True,
            **DB_CONFIG
        )
        print(f"✅ Database connection pool initialized: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
        return True
    except Error as e:
        print(f"❌ Error creating connection pool: {e}")
        print(f"⚠️  Database config: host={DB_CONFIG['host']}, user={DB_CONFIG['user']}, database={DB_CONFIG['database']}")
        raise
@contextmanager
def get_db_connection():
    """Get a database connection from the pool"""
    connection = None
    try:
        connection = connection_pool.get_connection()
        yield connection
    except Error as e:
        print(f"❌ Database connection error: {e}")
        raise
    finally:
        if connection and connection.is_connected():
            connection.close()
def run_migrations():
    """
    Run all pending database migrations
    Creates migrations table if it doesn't exist
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            # Create migrations tracking table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS migrations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    migration_name VARCHAR(255) UNIQUE NOT NULL,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            conn.commit()
            # Get list of applied migrations
            cursor.execute("SELECT migration_name FROM migrations ORDER BY id")
            applied_migrations = {row['migration_name'] for row in cursor.fetchall()}
            # Find migration files
            migrations_dir = Path(__file__).parent / 'migrations'
            if not migrations_dir.exists():
                print("⚠️  No migrations directory found")
                return
            migration_files = sorted(migrations_dir.glob('*.sql'))
            if not migration_files:
                print("⚠️  No migration files found")
                return
            # Run pending migrations
            for migration_file in migration_files:
                migration_name = migration_file.name
                if migration_name in applied_migrations:
                    continue
                print(f"🔄 Running migration: {migration_name}")
                # Read and execute migration
                with open(migration_file, 'r') as f:
                    sql_content = f.read()
                # Split by semicolons and execute each statement
                statements = [s.strip() for s in sql_content.split(';') if s.strip()]
                for statement in statements:
                    if statement:
                        cursor.execute(statement)
                # Record migration as applied
                cursor.execute(
                    "INSERT INTO migrations (migration_name) VALUES (%s)",
                    (migration_name,)
                )
                conn.commit()
                print(f"✅ Migration applied: {migration_name}")
            print("✅ All migrations completed")
    except Error as e:
        print(f"❌ Error running migrations: {e}")
        raise
# PDF CRUD Operations
def db_save_pdf(pdf_id: str, filename: str, num_pages: int, raw_data: bytes, fields: List[Dict[str, Any]]) -> bool:
    """Save PDF and its fields to database"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Insert PDF
            cursor.execute("""
                INSERT INTO pdfs (id, filename, num_pages, raw_data)
                VALUES (%s, %s, %s, %s)
            """, (pdf_id, filename, num_pages, raw_data))
            # Insert fields
            for field in fields:
                cursor.execute("""
                    INSERT INTO fields (
                        pdf_id, field_id, field_name, label, original_name, field_type, value,
                        checked, radio_group, date_format, monospace,
                        x, y, width, height, page,
                        border_style, border_width, border_color,
                        font_family, font_size, max_length
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    pdf_id,
                    field.get('id'),
                    field.get('name'),
                    field.get('label'),
                    field.get('original_name'),
                    field.get('field_type'),
                    field.get('value'),
                    field.get('checked', False),
                    field.get('radio_group'),
                    field.get('date_format'),
                    field.get('monospace', False),
                    field.get('x'),
                    field.get('y'),
                    field.get('width'),
                    field.get('height'),
                    field.get('page'),
                    field.get('border_style'),
                    field.get('border_width'),
                    json.dumps(field.get('border_color')) if field.get('border_color') else None,
                    field.get('font_family'),
                    field.get('font_size'),
                    field.get('max_length')
                ))
            conn.commit()
            print(f"✅ Saved PDF {pdf_id} with {len(fields)} fields")
            return True
    except Error as e:
        print(f"❌ Error saving PDF: {e}")
        return False
def db_get_pdf(pdf_id: str) -> Optional[Dict[str, Any]]:
    """Get PDF and its fields from database"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            # Get PDF
            cursor.execute("""
                SELECT id, filename, num_pages, raw_data, created_at, updated_at
                FROM pdfs WHERE id = %s
            """, (pdf_id,))
            pdf = cursor.fetchone()
            if not pdf:
                return None
            # Get fields
            cursor.execute("""
                SELECT field_id, field_name, label, original_name, field_type, value,
                       checked, radio_group, date_format, monospace,
                       x, y, width, height, page,
                       border_style, border_width, border_color,
                       font_family, font_size, max_length
                FROM fields WHERE pdf_id = %s
                ORDER BY id
            """, (pdf_id,))
            fields = cursor.fetchall()
            # Convert fields to proper format
            formatted_fields = []
            for field in fields:
                formatted_field = {
                    'id': field['field_id'],
                    'name': field['field_name'],
                    'label': field['label'],
                    'original_name': field['original_name'],
                    'field_type': field['field_type'],
                    'value': field['value'],
                    'checked': field['checked'],
                    'radio_group': field['radio_group'],
                    'date_format': field['date_format'],
                    'monospace': field['monospace'],
                    'x': field['x'],
                    'y': field['y'],
                    'width': field['width'],
                    'height': field['height'],
                    'page': field['page'],
                    'border_style': field['border_style'],
                    'border_width': field['border_width'],
                    'font_family': field['font_family'],
                    'font_size': field['font_size'],
                    'max_length': field['max_length'],
                }
                if field['border_color']:
                    formatted_field['border_color'] = json.loads(field['border_color'])
                formatted_fields.append(formatted_field)
            return {
                'pdf_id': pdf['id'],
                'filename': pdf['filename'],
                'num_pages': pdf['num_pages'],
                'raw_data': pdf['raw_data'],
                'fields': formatted_fields,
                'created_at': pdf['created_at'],
                'updated_at': pdf['updated_at']
            }
    except Error as e:
        print(f"❌ Error getting PDF {pdf_id}: {e}")
        return None
def db_list_pdfs() -> List[Dict[str, Any]]:
    """List all PDFs (without raw data)"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
                SELECT p.id, p.filename, p.num_pages, p.created_at,
                       COUNT(f.id) as num_fields
                FROM pdfs p
                LEFT JOIN fields f ON p.id = f.pdf_id
                GROUP BY p.id, p.filename, p.num_pages, p.created_at
                ORDER BY p.created_at DESC
            """)
            pdfs = cursor.fetchall()
            return [
                {
                    'pdf_id': pdf['id'],
                    'filename': pdf['filename'],
                    'num_pages': pdf['num_pages'],
                    'num_fields': pdf['num_fields'],
                    'created_at': pdf['created_at'].isoformat() if pdf['created_at'] else None
                }
                for pdf in pdfs
            ]
    except Error as e:
        print(f"❌ Error listing PDFs: {e}")
        return []
def db_update_field(pdf_id: str, field_data: Dict[str, Any]) -> bool:
    """Update or insert a field"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Check if field exists
            field_identifier = field_data.get('id') or field_data.get('name')
            cursor.execute("""
                SELECT id FROM fields 
                WHERE pdf_id = %s AND (field_id = %s OR field_name = %s)
                LIMIT 1
            """, (pdf_id, field_identifier, field_identifier))
            existing = cursor.fetchone()
            if existing:
                # Update existing field
                cursor.execute("""
                    UPDATE fields SET
                        field_id = %s, field_name = %s, label = %s, original_name = %s,
                        field_type = %s, value = %s, checked = %s, radio_group = %s,
                        date_format = %s, monospace = %s,
                        x = %s, y = %s, width = %s, height = %s, page = %s,
                        border_style = %s, border_width = %s, border_color = %s,
                        font_family = %s, font_size = %s, max_length = %s
                    WHERE id = %s
                """, (
                    field_data.get('id'), field_data.get('name'), field_data.get('label'),
                    field_data.get('original_name'), field_data.get('field_type'),
                    field_data.get('value'), field_data.get('checked', False),
                    field_data.get('radio_group'), field_data.get('date_format'),
                    field_data.get('monospace', False),
                    field_data.get('x'), field_data.get('y'), field_data.get('width'),
                    field_data.get('height'), field_data.get('page'),
                    field_data.get('border_style'), field_data.get('border_width'),
                    json.dumps(field_data.get('border_color')) if field_data.get('border_color') else None,
                    field_data.get('font_family'), field_data.get('font_size'),
                    field_data.get('max_length'),
                    existing[0]
                ))
            else:
                # Insert new field
                cursor.execute("""
                    INSERT INTO fields (
                        pdf_id, field_id, field_name, label, original_name, field_type, value,
                        checked, radio_group, date_format, monospace,
                        x, y, width, height, page,
                        border_style, border_width, border_color,
                        font_family, font_size, max_length
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    pdf_id, field_data.get('id'), field_data.get('name'), field_data.get('label'),
                    field_data.get('original_name'), field_data.get('field_type'),
                    field_data.get('value'), field_data.get('checked', False),
                    field_data.get('radio_group'), field_data.get('date_format'),
                    field_data.get('monospace', False),
                    field_data.get('x'), field_data.get('y'), field_data.get('width'),
                    field_data.get('height'), field_data.get('page'),
                    field_data.get('border_style'), field_data.get('border_width'),
                    json.dumps(field_data.get('border_color')) if field_data.get('border_color') else None,
                    field_data.get('font_family'), field_data.get('font_size'),
                    field_data.get('max_length')
                ))
            conn.commit()
            return True
    except Error as e:
        print(f"❌ Error updating field: {e}")
        return False
def db_delete_field(pdf_id: str, field_name: str) -> bool:
    """Delete a field by name"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                DELETE FROM fields WHERE pdf_id = %s AND field_name = %s
            """, (pdf_id, field_name))
            conn.commit()
            return True
    except Error as e:
        print(f"❌ Error deleting field: {e}")
        return False
def db_bulk_delete_fields(pdf_id: str, field_ids: List[str]) -> bool:
    """Delete multiple fields"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Use IN clause for multiple IDs
            placeholders = ', '.join(['%s'] * len(field_ids))
            cursor.execute(f"""
                DELETE FROM fields 
                WHERE pdf_id = %s AND (field_id IN ({placeholders}) OR field_name IN ({placeholders}))
            """, [pdf_id] + field_ids + field_ids)
            conn.commit()
            return True
    except Error as e:
        print(f"❌ Error bulk deleting fields: {e}")
        return False
def db_bulk_update_fields(pdf_id: str, field_ids: List[str], updates: Dict[str, Any]) -> int:
    """Update multiple fields with common properties"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Build dynamic UPDATE query
            set_clauses = []
            params = []
            # Map frontend field names to database column names
            field_mapping = {
                'field_type': 'field_type',
                'value': 'value',
                'checked': 'checked',
                'maxLength': 'max_length',
                'fontFamily': 'font_family',
                'fontSize': 'font_size',
                'borderStyle': 'border_style',
                'borderWidth': 'border_width',
                'borderColor': 'border_color',
            }
            for key, value in updates.items():
                if value is not None:
                    db_column = field_mapping.get(key, key)
                    if key in ['borderColor', 'border_color']:
                        set_clauses.append(f"border_color = %s")
                        params.append(json.dumps(value))
                    else:
                        set_clauses.append(f"{db_column} = %s")
                        params.append(value)
            if not set_clauses:
                return 0
            # Build WHERE clause
            placeholders = ', '.join(['%s'] * len(field_ids))
            query = f"""
                UPDATE fields 
                SET {', '.join(set_clauses)}
                WHERE pdf_id = %s AND (field_id IN ({placeholders}) OR field_name IN ({placeholders}))
            """
            params.extend([pdf_id] + field_ids + field_ids)
            cursor.execute(query, params)
            updated_count = cursor.rowcount
            conn.commit()
            return updated_count
    except Error as e:
        print(f"❌ Error bulk updating fields: {e}")
        return 0
def db_delete_pdf(pdf_id: str) -> bool:
    """Delete a PDF and all its fields (CASCADE)"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM pdfs WHERE id = %s", (pdf_id,))
            conn.commit()
            return True
    except Error as e:
        print(f"❌ Error deleting PDF: {e}")
        return False
