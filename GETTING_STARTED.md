# Getting Started with PDF Editor Development

This guide will help you get the PDF Editor project up and running on your local machine for development.

## Prerequisites

Before you begin, ensure you have the following installed:

### Required
- **Python 3.11+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** and npm - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)

### Optional
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/) (for containerized deployment)

## Quick Setup (5 minutes)

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd pdf-editor
```

### Step 2: Start the Backend

Open a terminal and run:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Step 3: Start the Frontend

Open a **new terminal** and run:

```bash
cd frontend
npm install
npm start
```

This will take a few minutes the first time. When ready, you'll see:
```
Compiled successfully!

You can now view pdf-editor-frontend in the browser.

  Local:            http://localhost:3000
```

### Step 4: Open the Application

Your browser should automatically open to `http://localhost:3000`. If not, navigate there manually.

🎉 **That's it!** You now have the PDF Editor running locally.

## Verify the Setup

1. **Backend API**: Visit http://localhost:8000 - You should see the API information
2. **API Docs**: Visit http://localhost:8000/docs - Interactive API documentation
3. **Frontend**: Visit http://localhost:3000 - The PDF Editor interface

## First Steps

### Upload a Test PDF

1. Click on the upload area or drag a PDF file
2. The application will extract any form fields from the PDF
3. You'll see the PDF information and fields displayed

### Try the Features

- **Add a Field**: Click "+ Add Field" and enter a name
- **Edit a Field**: Click "Edit" on any field to modify its properties
- **Reorder Fields**: Drag and drop fields to reorder them
- **Delete a Field**: Click "Delete" and confirm

## Development Workflow

### Backend Development

The backend uses FastAPI with hot-reload enabled, so changes are automatically reflected.

**Key files:**
- `backend/main.py` - All API endpoints and business logic
- `backend/requirements.txt` - Python dependencies

**Testing endpoints:**
- Use the Swagger UI at http://localhost:8000/docs
- Or use curl/Postman to test endpoints directly

**Example API call:**
```bash
# List all PDFs
curl http://localhost:8000/api/pdf/list

# Upload a PDF
curl -X POST -F "file=@sample.pdf" http://localhost:8000/api/pdf/upload
```

### Frontend Development

The frontend uses React with hot-reload, so changes appear immediately in the browser.

**Key files:**
- `frontend/src/App.js` - Main application component
- `frontend/src/components/PDFUpload.js` - Upload functionality
- `frontend/src/components/FieldEditor.js` - Field management

**Development tips:**
- Check the browser console for errors (F12 → Console)
- React DevTools extension is helpful for debugging
- Changes to CSS files also hot-reload automatically

## Common Development Tasks

### Adding a New API Endpoint

1. Open `backend/main.py`
2. Add your endpoint function:
```python
@app.get("/api/your-endpoint")
async def your_function():
    return {"message": "Hello"}
```
3. Test at http://localhost:8000/docs

### Adding a New Frontend Component

1. Create a new file in `frontend/src/components/`
2. Import and use it in `App.js` or another component
3. Add corresponding CSS file for styling

### Modifying the Data Model

1. Update the Pydantic models in `backend/main.py`
2. Update the frontend to match the new structure
3. Test the full flow

## Troubleshooting

### Port Already in Use

**Problem**: Error "Address already in use"

**Solution**: Change the port in the command:
```bash
# Backend
uvicorn main:app --reload --port 8001

# Frontend (set PORT environment variable)
PORT=3001 npm start
```

### CORS Errors

**Problem**: Frontend can't connect to backend

**Solution**: Check the CORS configuration in `backend/main.py`:
```python
allow_origins=["http://localhost:3000"]
```

Add your frontend URL if using a different port.

### Module Not Found (Python)

**Problem**: `ModuleNotFoundError: No module named 'fastapi'`

**Solution**: Install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

### Module Not Found (JavaScript)

**Problem**: `Cannot find module 'react'`

**Solution**: Install dependencies:
```bash
cd frontend
npm install
```

### PDF Upload Fails

**Problem**: PDF upload returns an error

**Solution**: 
- Check the PDF is valid and not corrupted
- Check backend logs for detailed error messages
- Ensure the PDF is not password-protected

## Next Steps

Now that you have the application running, you can:

1. **Read the Documentation**:
   - README.md - Project overview and usage
   - PROJECT_SUMMARY.md - Complete feature list
   - ARCHITECTURE.md - System architecture

2. **Explore the Code**:
   - Start with `backend/main.py` to understand the API
   - Check `frontend/src/App.js` for the main UI flow
   - Review components in `frontend/src/components/`

3. **Make Your First Change**:
   - Try modifying the UI colors in CSS files
   - Add a new field property
   - Create a new endpoint

4. **Review GitHub Copilot Instructions**:
   - `.github/copilot-instructions.md` - Coding standards and tips

## Getting Help

- **API Documentation**: http://localhost:8000/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **React Docs**: https://react.dev/
- **pypdf Docs**: https://pypdf.readthedocs.io/

## Docker Development (Optional)

If you prefer using Docker:

### Build and Run
```bash
docker compose up --build
```

### Stop
```bash
docker compose down
```

### View Logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

**Note**: The Docker setup includes volume mounts for hot-reload in development.

---

Happy coding! 🚀
