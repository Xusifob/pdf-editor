from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pypdf
import io
import json
import base64

app = FastAPI(title="PDF Editor API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for PDF information (replace with database in production)
pdf_storage: Dict[str, Dict[str, Any]] = {}


class FieldInfo(BaseModel):
    name: str
    field_type: str
    value: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    page: Optional[int] = None


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
        # pypdf.PdfReader will validate the PDF format and raise an exception if invalid
        pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
        
        # Generate a simple ID (in production, use UUID or similar)
        pdf_id = f"pdf_{len(pdf_storage) + 1}"
        
        # Extract fields from the PDF
        fields = []
        
        # Check if PDF has form fields
        if "/AcroForm" in pdf_reader.trailer["/Root"]:
            form_fields = pdf_reader.get_fields()
            if form_fields:
                for field_name, field_data in form_fields.items():
                    field_info = FieldInfo(
                        name=field_name,
                        field_type=field_data.get("/FT", "Unknown"),
                        value=field_data.get("/V", ""),
                        page=0  # Would need more logic to determine actual page
                    )
                    fields.append(field_info)
        
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
            "fields": fields,
            "message": f"PDF uploaded successfully. Found {len(fields)} fields."
        }
    
    except Exception as e:
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
    
    # Find and update existing field or add new one
    field_found = False
    for i, existing_field in enumerate(pdf_info["fields"]):
        if existing_field["name"] == field.name:
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
