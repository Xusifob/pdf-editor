from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, validator
from typing import List, Dict, Any, Optional
import pypdf
import io
import json
import base64
import os
from pathlib import Path
import uuid
import logging
from logging.handlers import RotatingFileHandler
import sys
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
# override=False ensures existing environment variables take precedence
load_dotenv(override=False)

# Import database functions
from database import (
    init_connection_pool,
    run_migrations,
    db_save_pdf,
    db_get_pdf,
    db_list_pdfs,
    db_update_field,
    db_delete_field,
    db_bulk_delete_fields,
    db_bulk_update_fields,
    db_delete_pdf
)

# ===================================================================================
# LOGGING CONFIGURATION
# ===================================================================================

# Create logs directory if it doesn't exist
LOG_DIR = Path("/var/www/html/2026/pdf-editor/backend/logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Configure logging format
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Create formatters
formatter = logging.Formatter(LOG_FORMAT, DATE_FORMAT)

# Setup main application logger
logger = logging.getLogger("pdf_editor")
logger.setLevel(logging.INFO)

# Console handler for development
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# Rotating file handler for general application logs
# Max size: 10MB, Keep 5 backup files
app_log_file = LOG_DIR / "app.log"
app_file_handler = RotatingFileHandler(
    app_log_file,
    maxBytes=10 * 1024 * 1024,  # 10 MB
    backupCount=5,
    encoding='utf-8'
)
app_file_handler.setLevel(logging.INFO)
app_file_handler.setFormatter(formatter)
logger.addHandler(app_file_handler)

# Rotating file handler for error logs
# Max size: 10MB, Keep 10 backup files
error_log_file = LOG_DIR / "error.log"
error_file_handler = RotatingFileHandler(
    error_log_file,
    maxBytes=10 * 1024 * 1024,  # 10 MB
    backupCount=10,
    encoding='utf-8'
)
error_file_handler.setLevel(logging.ERROR)
error_file_handler.setFormatter(formatter)
logger.addHandler(error_file_handler)

# Rotating file handler for PDF processing logs
# Max size: 20MB, Keep 5 backup files
pdf_log_file = LOG_DIR / "pdf_processing.log"
pdf_file_handler = RotatingFileHandler(
    pdf_log_file,
    maxBytes=20 * 1024 * 1024,  # 20 MB
    backupCount=5,
    encoding='utf-8'
)
pdf_file_handler.setLevel(logging.DEBUG)
pdf_file_handler.setFormatter(formatter)

# Create a separate logger for PDF processing
pdf_logger = logging.getLogger("pdf_editor.pdf_processing")
pdf_logger.setLevel(logging.DEBUG)
pdf_logger.addHandler(pdf_file_handler)
pdf_logger.addHandler(console_handler)

logger.info("=" * 80)
logger.info("PDF Editor API - Logging initialized")
logger.info(f"Log directory: {LOG_DIR}")
logger.info("=" * 80)

app = FastAPI(title="PDF Editor API", version="1.0.0")

# Configure CORS
# Allow multiple origins for development and production
allowed_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3003").split(",")]

logger.info(f"Configuring CORS with allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===================================================================================
# APPLICATION STARTUP - Initialize Database
# ===================================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize database connection and run migrations on startup"""
    try:
        logger.info("Starting PDF Editor API...")
        init_connection_pool()
        logger.info("Database connection pool initialized")
        run_migrations()
        logger.info("Database migrations completed")
        logger.info("Application started successfully")
    except Exception as e:
        logger.error(f"Fatal error during startup: {e}", exc_info=True)
        # Don't raise - allow app to start even if DB is down (for health checks)


# ===================================================================================
# PYDANTIC MODELS
# ===================================================================================


class FieldInfo(BaseModel):
    id: Optional[str] = None
    name: str
    label: Optional[str] = None
    original_name: Optional[str] = None  # Original qualified name from PDF
    field_type: str  # Text, Textarea, Signature, Checkbox, Radio, Date
    value: Optional[str] = None
    checked: Optional[bool] = False  # For checkbox and radio fields
    radio_group: Optional[str] = None  # For radio buttons - group name
    date_format: Optional[str] = "DD/MM/YYYY"  # Date format for Date fields
    monospace: Optional[bool] = False  # Comb field - fixed character spacing
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    page: Optional[int] = None
    border_style: Optional[str] = "solid"  # solid, dashed, beveled, inset, underline, none
    border_width: Optional[float] = 1
    border_color: Optional[List[float]] = [0, 0, 0]  # RGB values 0-1
    max_length: Optional[int] = None  # Maximum number of characters (None = unlimited)
    font_name: Optional[str] = "Helvetica"  # Font name: Helvetica, Times, or Courier
    font_size: Optional[float] = 12  # Font size in points (6-72)
    
    @validator('font_name')
    def validate_font_name(cls, v):
        """Validate that font_name is one of the supported fonts"""
        if v is not None and v not in ['Helvetica', 'Times', 'Courier']:
            raise ValueError('font_name must be one of: Helvetica, Times, Courier')
        return v
    
    @validator('font_size')
    def validate_font_size(cls, v):
        """Validate that font_size is within acceptable range"""
        if v is not None:
            if v < 6 or v > 72:
                raise ValueError('font_size must be between 6 and 72 points')
        return v


class PDFInfo(BaseModel):
    pdf_id: str
    filename: str
    num_pages: int
    fields: List[FieldInfo]


class UpdateFieldRequest(BaseModel):
    field: FieldInfo


class BulkDeleteRequest(BaseModel):
    field_ids: List[str]


class BulkUpdateRequest(BaseModel):
    field_ids: List[str]
    updates: Dict[str, Any]


# ===================================================================================
# API ENDPOINTS
# ===================================================================================

@app.get("/")
async def root():
    """Root endpoint"""
    logger.info("Root endpoint accessed")
    return {
        "message": "PDF Editor API",
        "version": "1.0.0",
        "endpoints": {
            "upload": "/api/pdf/upload",
            "get_pdf": "/api/pdf/{pdf_id}",
            "update_field": "/api/pdf/{pdf_id}/field",
            "list_pdfs": "/api/pdf/list"
        }
    }


def decode_pdf_string(value) -> str:
    """
    Properly decode a PDF string value, handling various encodings.
    PDF strings can be in PDFDocEncoding, UTF-16BE, or UTF-8.
    """
    if value is None:
        return ""

    # If it's already a string, return as-is (it's already been decoded by pypdf)
    if isinstance(value, str):
        return value

    # If it's bytes, decode properly
    if isinstance(value, bytes):
        # Check for UTF-16BE BOM
        if value.startswith(b'\xfe\xff'):
            try:
                return value[2:].decode('utf-16-be')
            except:
                pass
        # Try UTF-8
        try:
            return value.decode('utf-8')
        except:
            pass
        # Fall back to latin-1 (PDFDocEncoding is similar)
        try:
            return value.decode('latin-1')
        except:
            return str(value)

    return str(value)


def is_date_field(field_name: str) -> bool:
    """
    Check if a field is likely a date field based on its name.
    """
    name_lower = field_name.lower()
    # Check for common date-related keywords, but exclude "lettres" (text representation)
    date_keywords = ['date', 'jour', 'day', 'mois', 'month', 'annee', 'année', 'year', 'naissance', 'birth']
    exclude_keywords = ['lettres', 'letter', 'text']

    has_date_keyword = any(keyword in name_lower for keyword in date_keywords)
    has_exclude_keyword = any(keyword in name_lower for keyword in exclude_keywords)

    return has_date_keyword and not has_exclude_keyword


@app.post("/api/pdf/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload a PDF file and extract its fields
    """
    logger.info(f"Upload request received - Filename: {file.filename}, Content-Type: {file.content_type}")

    if not file.filename.endswith('.pdf'):
        logger.warning(f"Invalid file type rejected: {file.filename}")
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        # Read the PDF file
        pdf_logger.info(f"Reading PDF file: {file.filename}")
        contents = await file.read()
        file_size = len(contents)
        pdf_logger.info(f"PDF size: {file_size / 1024:.2f} KB")

        pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
        num_pages = len(pdf_reader.pages)
        pdf_logger.info(f"PDF has {num_pages} page(s)")

        # Generate a unique ID using UUID
        pdf_id = str(uuid.uuid4())
        logger.info(f"Generated PDF ID: {pdf_id}")

        # Extract fields from the PDF
        fields = []
        
        # Check if PDF has form fields using AcroForm
        try:
            # Build a list of all field annotations with their positions
            # This handles multiple widgets with the same field name (checkboxes/radios)
            field_annotations = []

            for page_num, page in enumerate(pdf_reader.pages):
                page_height = float(page.mediabox.height)

                if "/Annots" in page:
                    annotations = page["/Annots"]
                    for annot_idx, annot in enumerate(annotations):
                        try:
                            annot_obj = annot.get_object()

                            # Check if it's a widget annotation (form field)
                            if annot_obj.get("/Subtype") != "/Widget":
                                continue

                            # Get field name - build full qualified name
                            field_name = None
                            parent_name = ""
                            tooltip = ""
                            field_type_raw = "/Tx"
                            field_flags = 0
                            field_value = ""
                            export_value = "Yes"

                            # Get info from annotation or parent
                            if "/Parent" in annot_obj:
                                parent = annot_obj["/Parent"].get_object()
                                if "/T" in parent:
                                    parent_name = decode_pdf_string(parent["/T"])
                                if "/FT" in parent:
                                    field_type_raw = str(parent.get("/FT", "/Tx"))
                                if "/Ff" in parent:
                                    try:
                                        field_flags = int(parent.get("/Ff", 0))
                                    except:
                                        field_flags = 0
                                if "/V" in parent:
                                    field_value = decode_pdf_string(parent.get("/V", ""))
                                if "/TU" in parent:
                                    tooltip = decode_pdf_string(parent["/TU"])

                            # Get info from annotation itself (overrides parent)
                            if "/T" in annot_obj:
                                annot_name = decode_pdf_string(annot_obj["/T"])
                                if parent_name:
                                    field_name = f"{parent_name}.{annot_name}"
                                else:
                                    field_name = annot_name
                            elif parent_name:
                                field_name = parent_name

                            if "/FT" in annot_obj:
                                field_type_raw = str(annot_obj.get("/FT", field_type_raw))
                            if "/Ff" in annot_obj:
                                try:
                                    field_flags = int(annot_obj.get("/Ff", field_flags))
                                except:
                                    pass
                            if "/V" in annot_obj:
                                field_value = decode_pdf_string(annot_obj.get("/V", field_value))
                            if "/TU" in annot_obj:
                                tooltip = decode_pdf_string(annot_obj["/TU"])

                            # Get export value for buttons (AP/N keys or /AS)
                            if "/AP" in annot_obj:
                                ap = annot_obj["/AP"]
                                if hasattr(ap, "get_object"):
                                    ap = ap.get_object()
                                if "/N" in ap:
                                    n_dict = ap["/N"]
                                    if hasattr(n_dict, "get_object"):
                                        n_dict = n_dict.get_object()
                                    if hasattr(n_dict, "keys"):
                                        for key in n_dict.keys():
                                            key_str = str(key)
                                            if key_str not in ("/Off", "Off"):
                                                export_value = decode_pdf_string(key_str.lstrip("/"))
                                                break
                            if "/AS" in annot_obj:
                                as_val = str(annot_obj["/AS"])
                                if as_val not in ("/Off", "Off"):
                                    export_value = decode_pdf_string(as_val.lstrip("/"))

                            if not field_name:
                                continue

                            # Get rectangle
                            if "/Rect" not in annot_obj:
                                continue

                            rect = annot_obj["/Rect"]
                            x1, y1, x2, y2 = [float(v) for v in rect]

                            # Convert to top-left origin for HTML canvas
                            width = x2 - x1
                            height = y2 - y1
                            x = x1
                            y = page_height - y2

                            field_annotations.append({
                                "name": field_name,
                                "original_name": field_name,
                                "tooltip": tooltip,
                                "field_type_raw": field_type_raw,
                                "field_flags": field_flags,
                                "field_value": field_value,
                                "export_value": export_value,
                                "page": page_num,
                                "x": x,
                                "y": y,
                                "width": width,
                                "height": height,
                                "annot_idx": annot_idx
                            })
                        except Exception as e:
                            print(f"Error processing annotation: {e}")
                            continue

            # Process collected annotations into fields
            for idx, annot_data in enumerate(field_annotations):
                field_type_raw = annot_data["field_type_raw"]
                field_flags = annot_data["field_flags"]

                is_multiline = bool(field_flags & (1 << 12))
                is_radio = bool(field_flags & (1 << 15))
                is_pushbutton = bool(field_flags & (1 << 16))

                # Determine field type
                if field_type_raw == "/Btn":
                    if is_pushbutton:
                        field_type = "Button"
                    elif is_radio:
                        field_type = "Radio"
                    else:
                        field_type = "Checkbox"
                elif field_type_raw == "/Tx":
                    field_type = "Textarea" if is_multiline else "Text"
                elif field_type_raw == "/Ch":
                    field_type = "Choice"
                elif field_type_raw == "/Sig":
                    field_type = "Signature"
                else:
                    field_type = "Text"

                # For text fields, check height to determine if it's likely multiline
                if field_type == "Text" and annot_data["height"] > 40:
                    field_type = "Textarea"

                # Check if it's a date field based on name
                if field_type == "Text" and is_date_field(annot_data["name"]):
                    field_type = "Date"

                # Determine checked state for checkboxes/radios
                checked = False
                value = annot_data["field_value"]
                export_value = annot_data["export_value"]

                if field_type in ("Checkbox", "Radio"):
                    # Field is checked if current value matches export value
                    if value:
                        value_clean = value.lstrip("/")
                        checked = value_clean not in ("Off", "") and value_clean == export_value
                    value = export_value  # Use export value as the field value

                # Generate unique ID - simple incremental to avoid duplicates
                field_id = f"field_{annot_data['page']}_{annot_data['annot_idx']}"

                # Use tooltip as label if available, otherwise use field name
                label = annot_data["tooltip"] if annot_data["tooltip"] else annot_data["name"]

                # Set default dimensions for checkbox/radio
                width = annot_data["width"]
                height = annot_data["height"]

                field_info = FieldInfo(
                    id=field_id,
                    name=annot_data["name"],
                    label=label,
                    original_name=annot_data["original_name"],
                    field_type=field_type,
                    value=value if value else ("Yes" if field_type in ("Checkbox", "Radio") else ""),
                    checked=checked,
                    x=annot_data["x"],
                    y=annot_data["y"],
                    width=width,
                    height=height,
                    page=annot_data["page"],
                    max_length=None
                )
                fields.append(field_info)
        except Exception as e:
            pdf_logger.error(f"Error extracting fields from PDF: {e}", exc_info=True)
            # Continue without fields if extraction fails

        pdf_logger.info(f"Extracted {len(fields)} field(s) from PDF")

        # Save to database
        fields_dict = [field.dict() for field in fields]
        logger.info(f"Saving PDF to database: {pdf_id}")
        success = db_save_pdf(pdf_id, file.filename, len(pdf_reader.pages), contents, fields_dict)

        if not success:
            logger.error(f"Failed to save PDF to database: {pdf_id}")
            raise HTTPException(status_code=500, detail="Failed to save PDF to database")

        logger.info(f"PDF saved successfully: {pdf_id} ({file.filename}, {len(fields)} fields)")
        return {
            "pdf_id": pdf_id,
            "filename": file.filename,
            "num_pages": len(pdf_reader.pages),
            "fields": fields_dict,
            "message": f"PDF uploaded successfully. Found {len(fields)} fields."
        }
    
    except Exception as e:
        logger.error(f"Error processing PDF: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@app.get("/api/pdf/list")
async def list_pdfs():
    """
    List all uploaded PDFs
    """
    logger.info("Listing all PDFs")
    pdfs = db_list_pdfs()
    logger.info(f"Found {len(pdfs)} PDF(s)")
    return {"pdfs": pdfs}


@app.get("/api/pdf/{pdf_id}")
async def get_pdf_info(pdf_id: str):
    """
    Get information about a specific PDF
    """
    logger.info(f"Fetching PDF info: {pdf_id}")
    pdf_info = db_get_pdf(pdf_id)
    if not pdf_info:
        logger.warning(f"PDF not found: {pdf_id}")
        raise HTTPException(status_code=404, detail="PDF not found")
    
    logger.info(f"PDF info retrieved: {pdf_id} ({pdf_info['filename']}, {len(pdf_info['fields'])} fields)")
    # Remove raw_data from response (too large)
    return {
        "pdf_id": pdf_info["pdf_id"],
        "filename": pdf_info["filename"],
        "num_pages": pdf_info["num_pages"],
        "fields": pdf_info["fields"]
    }


@app.post("/api/pdf/{pdf_id}/field")
async def update_field(pdf_id: str, request: UpdateFieldRequest):
    """
    Update or add a field to a PDF
    """
    logger.info(f"Updating field in PDF: {pdf_id}")
    # Check if PDF exists
    pdf_info = db_get_pdf(pdf_id)
    if not pdf_info:
        logger.warning(f"PDF not found for field update: {pdf_id}")
        raise HTTPException(status_code=404, detail="PDF not found")
    
    field = request.field
    field_dict = field.dict()
    logger.debug(f"Field data: {field.name} (type: {field.field_type})")

    # Update or insert field in database
    success = db_update_field(pdf_id, field_dict)
    if not success:
        logger.error(f"Failed to update field: {field.name} in PDF {pdf_id}")
        raise HTTPException(status_code=500, detail="Failed to update field")

    logger.info(f"Field updated successfully: {field.name}")
    return {
        "message": "Field updated successfully",
        "field": field
    }


@app.delete("/api/pdf/{pdf_id}/field/{field_name}")
async def delete_field(pdf_id: str, field_name: str):
    """
    Delete a field from a PDF
    """
    logger.info(f"Deleting field: {field_name} from PDF: {pdf_id}")
    # Check if PDF exists
    pdf_info = db_get_pdf(pdf_id)
    if not pdf_info:
        logger.warning(f"PDF not found for field deletion: {pdf_id}")
        raise HTTPException(status_code=404, detail="PDF not found")
    
    success = db_delete_field(pdf_id, field_name)
    if not success:
        logger.error(f"Failed to delete field: {field_name} from PDF {pdf_id}")
        raise HTTPException(status_code=500, detail="Failed to delete field")

    logger.info(f"Field deleted successfully: {field_name}")
    return {"message": f"Field {field_name} deleted successfully"}


@app.post("/api/pdf/{pdf_id}/fields/bulk-delete")
async def bulk_delete_fields(pdf_id: str, request: BulkDeleteRequest):
    """
    Delete multiple fields from a PDF
    """
    logger.info(f"Bulk deleting {len(request.field_ids)} fields from PDF: {pdf_id}")
    # Check if PDF exists
    pdf_info = db_get_pdf(pdf_id)
    if not pdf_info:
        logger.warning(f"PDF not found for bulk delete: {pdf_id}")
        raise HTTPException(status_code=404, detail="PDF not found")

    success = db_bulk_delete_fields(pdf_id, request.field_ids)
    if not success:
        logger.error(f"Failed to bulk delete fields from PDF {pdf_id}")
        raise HTTPException(status_code=500, detail="Failed to delete fields")

    logger.info(f"Bulk deleted {len(request.field_ids)} fields successfully")
    return {"message": f"Deleted {len(request.field_ids)} fields successfully"}


@app.post("/api/pdf/{pdf_id}/fields/bulk-update")
async def bulk_update_fields(pdf_id: str, request: BulkUpdateRequest):
    """
    Update multiple fields with common properties
    """
    logger.info(f"Bulk updating {len(request.field_ids)} fields in PDF: {pdf_id}")
    logger.debug(f"Update properties: {request.updates}")
    # Check if PDF exists
    pdf_info = db_get_pdf(pdf_id)
    if not pdf_info:
        logger.warning(f"PDF not found for bulk update: {pdf_id}")
        raise HTTPException(status_code=404, detail="PDF not found")

    updated_count = db_bulk_update_fields(pdf_id, request.field_ids, request.updates)
    if updated_count == 0:
        logger.error(f"Failed to bulk update fields in PDF {pdf_id}")
        raise HTTPException(status_code=500, detail="Failed to update fields")

    logger.info(f"Bulk updated {updated_count} fields successfully")
    return {"message": f"Updated {updated_count} fields successfully"}


@app.get("/api/pdf/{pdf_id}/content")
async def get_pdf_content(pdf_id: str):
    """
    Get the raw PDF content as base64
    """
    logger.info(f"Getting PDF content: {pdf_id}")
    pdf_info = db_get_pdf(pdf_id)
    if not pdf_info:
        logger.warning(f"PDF not found: {pdf_id}")
        raise HTTPException(status_code=404, detail="PDF not found")
    
    pdf_bytes = pdf_info.get("raw_data")
    
    if not pdf_bytes:
        logger.error(f"PDF content not found: {pdf_id}")
        raise HTTPException(status_code=404, detail="PDF content not found")
    
    # Return base64 encoded PDF
    pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
    logger.info(f"PDF content retrieved: {pdf_id} ({len(pdf_bytes) / 1024:.2f} KB)")

    return {
        "pdf_id": pdf_id,
        "content": pdf_base64,
        "content_type": "application/pdf"
    }


@app.get("/api/pdf/{pdf_id}/download")
async def download_pdf(pdf_id: str):
    """
    Download the PDF with fillable form fields
    """
    logger.info(f"Download request for PDF: {pdf_id}")
    pdf_info = db_get_pdf(pdf_id)
    if not pdf_info:
        logger.warning(f"PDF not found for download: {pdf_id}")
        raise HTTPException(status_code=404, detail="PDF not found")

    pdf_bytes = pdf_info.get("raw_data")

    if not pdf_bytes:
        logger.error(f"PDF content not found for download: {pdf_id}")
        raise HTTPException(status_code=404, detail="PDF content not found")

    try:
        pdf_logger.info(f"Starting PDF generation for download: {pdf_id}")
        from pypdf.generic import (
            DictionaryObject,
            ArrayObject,
            NameObject,
            NumberObject,
            TextStringObject,
            BooleanObject,
        )

        # Read the original PDF
        pdf_logger.debug(f"Reading original PDF: {pdf_id}")
        pdf_reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        pdf_writer = pypdf.PdfWriter()

        # Clone all pages from original PDF, but remove existing form field annotations
        for page in pdf_reader.pages:
            # Remove existing widget annotations (form fields) from the page
            if "/Annots" in page:
                new_annots = ArrayObject()
                for annot in page["/Annots"]:
                    try:
                        annot_obj = annot.get_object()
                        # Keep non-widget annotations (links, comments, etc.)
                        if annot_obj.get("/Subtype") != "/Widget":
                            new_annots.append(annot)
                    except:
                        pass
                if len(new_annots) > 0:
                    page[NameObject("/Annots")] = new_annots
                else:
                    # Remove empty Annots array
                    del page["/Annots"]
            pdf_writer.add_page(page)

        # Remove existing AcroForm from the document if present
        if "/AcroForm" in pdf_writer._root_object:
            del pdf_writer._root_object["/AcroForm"]

        # Get fields from storage grouped by page
        fields = pdf_info.get("fields", [])
        fields_by_page = {}
        for field in fields:
            page_num = field.get("page", 0)
            if page_num not in fields_by_page:
                fields_by_page[page_num] = []
            fields_by_page[page_num].append(field)

        # Create AcroForm dictionary for the PDF
        acro_form = DictionaryObject()
        field_refs = ArrayObject()

        # Create standard PDF fonts as indirect objects
        # This is required for compatibility with third-party PDF libraries like SetaPDF
        
        # Helvetica font
        helvetica_font = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
            NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
        })
        helvetica_font_ref = pdf_writer._add_object(helvetica_font)
        
        # Times-Roman font
        times_font = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Times-Roman"),
            NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
        })
        times_font_ref = pdf_writer._add_object(times_font)
        
        # Courier font
        courier_font = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Courier"),
            NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
        })
        courier_font_ref = pdf_writer._add_object(courier_font)
        
        # Map font names to references
        font_refs_map = {
            "Helvetica": helvetica_font_ref,
            "Times": times_font_ref,
            "Courier": courier_font_ref,
        }
        
        # Map font names to PDF resource names
        font_name_map = {
            "Helvetica": "/Helv",
            "Times": "/Times",
            "Courier": "/Cour",
        }
        
        # Create the Font dictionary as an indirect object with all available fonts
        # This is created early so it can be referenced by individual field widgets
        font_dict = DictionaryObject({
            NameObject("/Helv"): helvetica_font_ref,
            NameObject("/Times"): times_font_ref,
            NameObject("/Cour"): courier_font_ref,
        })
        font_dict_ref = pdf_writer._add_object(font_dict)

        # Create the DR (Default Resources) dictionary with proper indirect references
        # This is created early so it can be referenced by individual field widgets
        dr_dict = DictionaryObject({
            NameObject("/Font"): font_dict_ref
        })
        dr_dict_ref = pdf_writer._add_object(dr_dict)

        # Process each page and add form fields
        for page_num in range(len(pdf_writer.pages)):
            if page_num not in fields_by_page:
                continue

            page = pdf_writer.pages[page_num]
            page_height = float(page.mediabox.height)

            # Initialize annotations array if not present
            if "/Annots" not in page:
                page[NameObject("/Annots")] = ArrayObject()

            for field in fields_by_page[page_num]:
                field_name = field.get("name", "field")
                field_label = field.get("label", field_name)
                field_value = field.get("value", "")
                field_type = field.get("field_type", "Text")
                x = float(field.get("x", 0))
                y = float(field.get("y", 0))
                width = float(field.get("width", 150))
                height = float(field.get("height", 30))
                border_style = field.get("border_style", "solid")
                border_width = float(field.get("border_width", 1))
                border_color = field.get("border_color", [0, 0, 0])  # RGB values 0-1
                max_length = field.get("max_length", None)
                font_name = field.get("font_name", "Helvetica")  # Get font name from field
                font_size = float(field.get("font_size", 12))  # Get font size from field

                # Convert from top-left origin (HTML) to bottom-left origin (PDF)
                pdf_y = page_height - y - height

                # Map border style to PDF border style
                border_style_map = {
                    "solid": "/S",
                    "dashed": "/D",
                    "beveled": "/B",
                    "inset": "/I",
                    "underline": "/U",
                    "none": "/S"  # Will use width 0
                }
                pdf_border_style = border_style_map.get(border_style, "/S")

                # If border is "none", set width to 0
                if border_style == "none":
                    border_width = 0

                # Build default appearance string with selected font and size
                pdf_font_name = font_name_map.get(font_name, "/Helv")
                da_string = f"{pdf_font_name} {font_size} Tf 0 g"

                # Create the field widget annotation
                field_dict = DictionaryObject()

                # Common field properties
                common_props = {
                    NameObject("/Type"): NameObject("/Annot"),
                    NameObject("/Subtype"): NameObject("/Widget"),
                    NameObject("/T"): TextStringObject(field_name),  # Field name
                    NameObject("/TU"): TextStringObject(field_label),  # Tooltip (shows label)
                    NameObject("/Rect"): ArrayObject([
                        NumberObject(int(x)),
                        NumberObject(int(pdf_y)),
                        NumberObject(int(x + width)),
                        NumberObject(int(pdf_y + height))
                    ]),
                    NameObject("/F"): NumberObject(4),  # Print flag
                    NameObject("/MK"): DictionaryObject({
                        NameObject("/BC"): ArrayObject([NumberObject(bc) for bc in border_color]),  # Border color
                        NameObject("/BG"): ArrayObject([NumberObject(1), NumberObject(1), NumberObject(1)]),  # Background (white)
                    }),
                    NameObject("/BS"): DictionaryObject({
                        NameObject("/W"): NumberObject(int(border_width)),  # Border width
                        NameObject("/S"): NameObject(pdf_border_style),  # Border style
                    }),
                }

                if field_type == "Signature":
                    # Signature field
                    field_dict.update(common_props)
                    field_dict.update({
                        NameObject("/FT"): NameObject("/Sig"),  # Signature field
                        NameObject("/Ff"): NumberObject(0),  # Field flags
                    })
                elif field_type == "Checkbox":
                    # Checkbox field
                    field_dict.update(common_props)
                    checked = field.get("checked", False)
                    export_value = field.get("value", "Yes")
                    field_dict.update({
                        NameObject("/FT"): NameObject("/Btn"),  # Button field
                        NameObject("/Ff"): NumberObject(0),  # Not pushbutton, not radio
                        NameObject("/V"): NameObject(f"/{export_value}") if checked else NameObject("/Off"),
                        NameObject("/DV"): NameObject(f"/{export_value}") if checked else NameObject("/Off"),
                        NameObject("/AS"): NameObject(f"/{export_value}") if checked else NameObject("/Off"),
                        NameObject("/AP"): DictionaryObject({
                            NameObject("/N"): DictionaryObject({
                                NameObject(f"/{export_value}"): NameObject("null"),
                                NameObject("/Off"): NameObject("null"),
                            })
                        }),
                    })
                elif field_type == "Radio":
                    # Radio button field
                    field_dict.update(common_props)
                    checked = field.get("checked", False)
                    export_value = field.get("value", "Yes")
                    field_dict.update({
                        NameObject("/FT"): NameObject("/Btn"),  # Button field
                        NameObject("/Ff"): NumberObject(1 << 15),  # Radio flag (bit 16)
                        NameObject("/V"): NameObject(f"/{export_value}") if checked else NameObject("/Off"),
                        NameObject("/DV"): NameObject(f"/{export_value}") if checked else NameObject("/Off"),
                        NameObject("/AS"): NameObject(f"/{export_value}") if checked else NameObject("/Off"),
                        NameObject("/AP"): DictionaryObject({
                            NameObject("/N"): DictionaryObject({
                                NameObject(f"/{export_value}"): NameObject("null"),
                                NameObject("/Off"): NameObject("null"),
                            })
                        }),
                    })
                elif field_type == "Textarea":
                    # Multiline text field
                    field_dict.update(common_props)
                    field_flags = (1 << 12)  # Bit 13 = Multiline flag
                    text_props = {
                        NameObject("/FT"): NameObject("/Tx"),  # Text field
                        NameObject("/V"): TextStringObject(field_value) if field_value else TextStringObject(""),
                        NameObject("/DV"): TextStringObject(field_value) if field_value else TextStringObject(""),
                        NameObject("/Ff"): NumberObject(field_flags),  # Multiline flag
                        NameObject("/DA"): TextStringObject(da_string),  # Default appearance with font
                        NameObject("/DR"): dr_dict_ref,  # Add font resources to field for SetaPDF compatibility
                        NameObject("/Q"): NumberObject(0),  # Left alignment
                    }
                    if max_length:
                        text_props[NameObject("/MaxLen")] = NumberObject(int(max_length))
                    field_dict.update(text_props)
                else:
                    # Single-line text field (default) - includes Text and Date
                    field_dict.update(common_props)
                    monospace = field.get("monospace", False)

                    # Build field flags
                    field_flags = 0
                    if monospace and max_length:
                        field_flags |= (1 << 24)  # Bit 25 = Comb flag (requires MaxLen)

                    text_props = {
                        NameObject("/FT"): NameObject("/Tx"),  # Text field
                        NameObject("/V"): TextStringObject(field_value) if field_value else TextStringObject(""),
                        NameObject("/DV"): TextStringObject(field_value) if field_value else TextStringObject(""),
                        NameObject("/Ff"): NumberObject(field_flags),
                        NameObject("/DA"): TextStringObject(da_string),  # Default appearance with font
                        NameObject("/DR"): dr_dict_ref,  # Add font resources to field for SetaPDF compatibility
                        NameObject("/Q"): NumberObject(0),  # Left alignment
                    }
                    if max_length and max_length > 0:
                        text_props[NameObject("/MaxLen")] = NumberObject(int(max_length))
                    field_dict.update(text_props)

                # Add field as indirect object and add to page annotations
                field_ref = pdf_writer._add_object(field_dict)
                page["/Annots"].append(field_ref)
                field_refs.append(field_ref)

        # Set up AcroForm in the document catalog
        acro_form.update({
            NameObject("/Fields"): field_refs,
            NameObject("/NeedAppearances"): BooleanObject(True),
            NameObject("/DA"): TextStringObject("/Helv 12 Tf 0 g"),  # Default font
            NameObject("/DR"): dr_dict_ref  # Use indirect reference instead of direct dictionary
        })

        # Add AcroForm to the root object as a direct dictionary
        # Note: AcroForm itself must be direct, not indirect, for SetaPDF compatibility
        # The resources inside (DR, fonts) are indirect, which is correct
        pdf_writer._root_object[NameObject("/AcroForm")] = acro_form


        # Write the modified PDF to bytes
        output_buffer = io.BytesIO()
        pdf_writer.write(output_buffer)
        output_buffer.seek(0)
        pdf_data = output_buffer.read()

        # Return as downloadable file
        filename = pdf_info.get("filename", "document.pdf")
        # Add "_edited" to filename
        if filename.endswith('.pdf'):
            filename = filename[:-4] + "_edited.pdf"
        else:
            filename = filename + "_edited.pdf"

        pdf_logger.info(f"PDF generated successfully: {pdf_id} ({len(pdf_data) / 1024:.2f} KB)")
        logger.info(f"Sending download: {filename}")

        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "application/pdf"
            }
        )

    except Exception as e:
        logger.error(f"Error generating PDF for download: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
