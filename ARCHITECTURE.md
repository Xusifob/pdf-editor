# PDF Editor - Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
│                      (Browser - Port 3000)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTP Requests
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      REACT FRONTEND                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     App.js                               │   │
│  │  - Main application logic                               │   │
│  │  - State management (PDF, fields)                       │   │
│  └────────────┬──────────────────────────────┬─────────────┘   │
│               │                              │                   │
│  ┌────────────▼─────────────┐   ┌───────────▼──────────────┐   │
│  │   PDFUpload.js           │   │   FieldEditor.js          │   │
│  │  - Drag & drop upload    │   │  - Field list display     │   │
│  │  - File validation       │   │  - Add/Edit/Delete fields │   │
│  │  - API communication     │   │  - Drag & drop reordering │   │
│  └──────────────────────────┘   │  - Modal for editing      │   │
│                                  └───────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Axios HTTP Client
                            │ (API Requests)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      FASTAPI BACKEND                             │
│                      (Python - Port 8000)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   REST API Endpoints                      │   │
│  │                                                           │   │
│  │  POST   /api/pdf/upload              (Upload PDF)       │   │
│  │  GET    /api/pdf/list                (List PDFs)        │   │
│  │  GET    /api/pdf/{id}                (Get PDF info)     │   │
│  │  POST   /api/pdf/{id}/field          (Add/Update field) │   │
│  │  DELETE /api/pdf/{id}/field/{name}   (Delete field)     │   │
│  │                                                           │   │
│  └────────────────────────┬──────────────────────────────────┘   │
│                           │                                      │
│  ┌────────────────────────▼──────────────────────────────────┐   │
│  │                   Business Logic                          │   │
│  │  - PDF parsing (pypdf)                                   │   │
│  │  - Field extraction                                      │   │
│  │  - Field management (CRUD)                               │   │
│  │  - Data validation (Pydantic)                            │   │
│  └────────────────────────┬──────────────────────────────────┘   │
│                           │                                      │
│  ┌────────────────────────▼──────────────────────────────────┐   │
│  │                   Data Storage                            │   │
│  │  - In-memory dictionary (pdf_storage)                    │   │
│  │  - Stores PDF metadata and fields                        │   │
│  │  - Stores raw PDF data                                   │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

                            
┌─────────────────────────────────────────────────────────────────┐
│                      DEPLOYMENT OPTIONS                          │
│                                                                  │
│  Option 1: Docker Compose                                       │
│  ┌────────────────────────┐   ┌──────────────────────────┐     │
│  │  Backend Container     │   │  Frontend Container      │     │
│  │  - Python 3.11         │   │  - Node 18               │     │
│  │  - Port 8000           │   │  - Port 3000             │     │
│  └────────────────────────┘   └──────────────────────────┘     │
│           │                              │                       │
│           └──────────┬───────────────────┘                       │
│                      │                                           │
│              Docker Network                                      │
│                                                                  │
│  Option 2: Local Development                                    │
│  - Backend: uvicorn main:app --reload --port 8000              │
│  - Frontend: npm start (port 3000)                             │
└─────────────────────────────────────────────────────────────────┘


DATA FLOW
═════════

1. PDF Upload Flow:
   User selects PDF → PDFUpload component → POST /api/pdf/upload
   → Backend parses PDF with pypdf → Extract fields → Store in memory
   → Return PDF info to frontend → Update state → Show fields

2. Field Edit Flow:
   User clicks Edit → Modal opens with field data → User modifies
   → POST /api/pdf/{id}/field → Update in memory → Return success
   → Update frontend state → Close modal → Refresh display

3. Field Add Flow:
   User clicks Add Field → Enter field name → Submit
   → POST /api/pdf/{id}/field → Add to storage → Return success
   → Update frontend state → Show new field

4. Field Delete Flow:
   User clicks Delete → Confirm → DELETE /api/pdf/{id}/field/{name}
   → Remove from storage → Return success → Update frontend state
   → Remove from display

5. Field Reorder Flow:
   User drags field → Drop on new position → Reorder in state
   → Show success message → Display reordered list


KEY TECHNOLOGIES
════════════════

Backend:
  - FastAPI      : Modern Python web framework
  - pypdf        : PDF parsing and manipulation
  - Pydantic     : Data validation
  - Uvicorn      : ASGI server

Frontend:
  - React        : UI library
  - Axios        : HTTP client
  - CSS3         : Modern styling

DevOps:
  - Docker       : Containerization
  - Docker Compose : Multi-container orchestration


FEATURES
════════

✅ PDF upload with drag-and-drop
✅ Automatic field extraction
✅ Add new fields manually
✅ Edit field properties (type, value, position, size, page)
✅ Delete fields
✅ Drag-and-drop field reordering
✅ In-memory data persistence
✅ CORS-enabled API
✅ Auto-generated API documentation
✅ Responsive UI with animations
✅ Error handling and user feedback
