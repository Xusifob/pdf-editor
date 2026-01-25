from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pypdf
import io
import json
import base64
import os

app = FastAPI(title="PDF Editor API", version="1.0.0")

# Configure CORS
# Allow multiple origins for development and production
allowed_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3003").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for PDF information (replace with database in production)
pdf_storage: Dict[str, Dict[str, Any]] = {}


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
    font_family: Optional[str] = "Helvetica"  # Helvetica, Times-Roman, Courier
    font_size: Optional[int] = 12
    max_length: Optional[int] = None  # Maximum number of characters (None = unlimited)


class PDFInfo(BaseModel):
    pdf_id: str
    filename: str
    num_pages: int
    fields: List[FieldInfo]


class UpdateFieldRequest(BaseModel):
    field: FieldInfo


@app.get("/")
async def root():
    """Root endpoint"""
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
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        # Read the PDF file
        contents = await file.read()
        pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
        
        # Generate a simple ID (in production, use UUID or similar)
        pdf_id = f"pdf_{len(pdf_storage) + 1}"
        
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
            print(f"Error extracting fields: {e}")
            import traceback
            traceback.print_exc()
            # Continue without fields if extraction fails

        # Store PDF information
        pdf_info = {
            "pdf_id": pdf_id,
            "filename": file.filename,
            "num_pages": len(pdf_reader.pages),
            "fields": [field.dict() for field in fields],
            "raw_data": contents  # Store raw data for later processing
        }
        
        pdf_storage[pdf_id] = pdf_info
        
        return {
            "pdf_id": pdf_id,
            "filename": file.filename,
            "num_pages": len(pdf_reader.pages),
            "fields": [field.dict() for field in fields],
            "message": f"PDF uploaded successfully. Found {len(fields)} fields."
        }
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@app.get("/api/pdf/list")
async def list_pdfs():
    """
    List all uploaded PDFs
    """
    return {
        "pdfs": [
            {
                "pdf_id": pdf_info["pdf_id"],
                "filename": pdf_info["filename"],
                "num_pages": pdf_info["num_pages"],
                "num_fields": len(pdf_info["fields"])
            }
            for pdf_info in pdf_storage.values()
        ]
    }


@app.get("/api/pdf/{pdf_id}")
async def get_pdf_info(pdf_id: str):
    """
    Get information about a specific PDF
    """
    if pdf_id not in pdf_storage:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    pdf_info = pdf_storage[pdf_id]
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
    if pdf_id not in pdf_storage:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    pdf_info = pdf_storage[pdf_id]
    field = request.field
    
    # Get the field identifier (prefer id over name)
    field_id = field.id or field.name

    # Find and update existing field or add new one
    field_found = False
    for i, existing_field in enumerate(pdf_info["fields"]):
        existing_id = existing_field.get("id") or existing_field.get("name")
        if existing_id == field_id:
            pdf_info["fields"][i] = field.dict()
            field_found = True
            break
    
    if not field_found:
        pdf_info["fields"].append(field.dict())
    
    return {
        "message": "Field updated successfully",
        "field": field
    }


@app.delete("/api/pdf/{pdf_id}/field/{field_name}")
async def delete_field(pdf_id: str, field_name: str):
    """
    Delete a field from a PDF
    """
    if pdf_id not in pdf_storage:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    pdf_info = pdf_storage[pdf_id]
    pdf_info["fields"] = [f for f in pdf_info["fields"] if f["name"] != field_name]
    
    return {"message": f"Field {field_name} deleted successfully"}


class BulkDeleteRequest(BaseModel):
    field_ids: List[str]


class BulkUpdateRequest(BaseModel):
    field_ids: List[str]
    updates: Dict[str, Any]  # Properties to update


@app.post("/api/pdf/{pdf_id}/fields/bulk-delete")
async def bulk_delete_fields(pdf_id: str, request: BulkDeleteRequest):
    """
    Delete multiple fields from a PDF
    """
    if pdf_id not in pdf_storage:
        raise HTTPException(status_code=404, detail="PDF not found")

    pdf_info = pdf_storage[pdf_id]
    field_ids = set(request.field_ids)

    pdf_info["fields"] = [
        f for f in pdf_info["fields"]
        if (f.get("id") or f.get("name")) not in field_ids
    ]

    return {"message": f"Deleted {len(field_ids)} fields successfully"}


@app.post("/api/pdf/{pdf_id}/fields/bulk-update")
async def bulk_update_fields(pdf_id: str, request: BulkUpdateRequest):
    """
    Update multiple fields with common properties
    """
    if pdf_id not in pdf_storage:
        raise HTTPException(status_code=404, detail="PDF not found")

    pdf_info = pdf_storage[pdf_id]
    field_ids = set(request.field_ids)
    updates = request.updates

    updated_count = 0
    for i, field in enumerate(pdf_info["fields"]):
        field_id = field.get("id") or field.get("name")
        if field_id in field_ids:
            for key, value in updates.items():
                if value is not None:
                    pdf_info["fields"][i][key] = value
            updated_count += 1

    return {"message": f"Updated {updated_count} fields successfully"}


@app.get("/api/pdf/{pdf_id}/content")
async def get_pdf_content(pdf_id: str):
    """
    Get the raw PDF content as base64
    """
    if pdf_id not in pdf_storage:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    pdf_info = pdf_storage[pdf_id]
    pdf_bytes = pdf_info.get("raw_data")
    
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="PDF content not found")
    
    # Return base64 encoded PDF
    pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
    
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
    if pdf_id not in pdf_storage:
        raise HTTPException(status_code=404, detail="PDF not found")

    pdf_info = pdf_storage[pdf_id]
    pdf_bytes = pdf_info.get("raw_data")

    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="PDF content not found")

    try:
        from pypdf.generic import (
            DictionaryObject,
            ArrayObject,
            NameObject,
            NumberObject,
            TextStringObject,
            BooleanObject,
        )

        # Read the original PDF
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
                font_family = field.get("font_family", "Helvetica")
                font_size = field.get("font_size", 12)
                max_length = field.get("max_length", None)

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

                # Map font family to PDF font name
                font_map = {
                    "Helvetica": "/Helv",
                    "Times-Roman": "/TiRo",
                    "Courier": "/Cour"
                }
                pdf_font = font_map.get(font_family, "/Helv")

                # Default appearance string with font
                da_string = f"{pdf_font} {font_size} Tf 0 g"

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
            NameObject("/DA"): TextStringObject("/Helv 12 Tf 0 g"),
            NameObject("/DR"): DictionaryObject({
                NameObject("/Font"): DictionaryObject({
                    NameObject("/Helv"): DictionaryObject({
                        NameObject("/Type"): NameObject("/Font"),
                        NameObject("/Subtype"): NameObject("/Type1"),
                        NameObject("/BaseFont"): NameObject("/Helvetica"),
                    }),
                    NameObject("/TiRo"): DictionaryObject({
                        NameObject("/Type"): NameObject("/Font"),
                        NameObject("/Subtype"): NameObject("/Type1"),
                        NameObject("/BaseFont"): NameObject("/Times-Roman"),
                    }),
                    NameObject("/Cour"): DictionaryObject({
                        NameObject("/Type"): NameObject("/Font"),
                        NameObject("/Subtype"): NameObject("/Type1"),
                        NameObject("/BaseFont"): NameObject("/Courier"),
                    })
                })
            })
        })

        # Add AcroForm to the root object
        pdf_writer._root_object[NameObject("/AcroForm")] = pdf_writer._add_object(acro_form)


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

        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "application/pdf"
            }
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
