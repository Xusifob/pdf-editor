# GitHub Copilot Instructions for PDF Editor Project

## Project Overview

This is a PDF editor web application that allows users to upload PDF files, extract form fields, and edit field properties. The project consists of:

- **Backend**: Python FastAPI application for PDF processing and API endpoints
- **Frontend**: React application for user interface
- **Infrastructure**: Docker Compose for containerization

## Code Style & Conventions

### Python (Backend)
- Use Python 3.11+ features
- Follow PEP 8 style guidelines
- Use type hints for function parameters and return values
- Use FastAPI's dependency injection and Pydantic models
- Keep API endpoints RESTful
- Use async/await for I/O operations
- Handle errors with HTTPException and appropriate status codes

### JavaScript/React (Frontend)
- Use functional components with hooks
- Use arrow functions for component definitions
- Keep components focused and single-purpose
- Use CSS modules or separate CSS files for styling
- Use async/await for API calls with axios
- Handle loading and error states in components
- Use meaningful variable and function names

### General
- Write clear, descriptive commit messages
- Comment complex logic
- Keep functions small and focused
- Avoid code duplication (DRY principle)

## Architecture Guidelines

### Backend Structure
- `main.py`: Main FastAPI application with all endpoints
- Keep models as Pydantic classes
- Use in-memory storage for now (can be replaced with database later)
- CORS configured for local development

### Frontend Structure
- `src/App.js`: Main application component
- `src/components/`: Reusable components
  - `PDFUpload.js`: PDF upload functionality
  - `FieldEditor.js`: Field editing interface
- Keep state management at the App level for now
- Pass props down to child components

### API Design
- All endpoints under `/api/` prefix
- Use appropriate HTTP methods (GET, POST, DELETE)
- Return consistent JSON responses
- Include error handling and validation

## Development Workflow

### Adding New Features
1. Backend first: Create API endpoint in `main.py`
2. Test endpoint with FastAPI docs (`/docs`)
3. Frontend: Create/update React components
4. Test UI functionality
5. Update README if necessary
6. Do not ever create a Md file to explain the code. Always add comments in the code itself and update the Readme if necessary.

### Testing
- Test backend endpoints using FastAPI automatic docs
- Test frontend with browser DevTools
- Test Docker Compose setup regularly
- Verify CORS and API connectivity

## Common Tasks

### Adding a New API Endpoint
```python
@app.post("/api/your-endpoint")
async def your_function(param: Model):
    """
    Endpoint description
    """
    try:
        # Implementation
        return {"result": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Adding a New React Component
```javascript
import React, { useState } from 'react';
import './ComponentName.css';

function ComponentName({ prop1, prop2 }) {
  const [state, setState] = useState(null);
  
  // Component logic
  
  return (
    <div className="component-name">
      {/* JSX */}
    </div>
  );
}

export default ComponentName;
```

### Making API Calls from Frontend
```javascript
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

try {
  const response = await axios.post(`${API_URL}/api/endpoint`, data);
  // Handle response
} catch (error) {
  // Handle error
  console.error(error);
}
```

## Key Technologies

### Backend
- **FastAPI**: Modern Python web framework
- **pypdf**: PDF parsing library
- **Uvicorn**: ASGI server
- **Pydantic**: Data validation

### Frontend
- **React**: UI library
- **Axios**: HTTP client
- **CSS3**: Styling with flexbox/grid

### DevOps
- **Docker**: Containerization
- **Docker Compose**: Multi-container orchestration

## Important Notes

- Backend runs on port 8000
- Frontend runs on port 3000
- CORS is configured for local development
- PDF data is stored in memory (no persistence)
- File uploads use multipart/form-data
- Field editing includes position, size, type, and value

## Future Considerations

When extending the project, consider:
- Adding a database (PostgreSQL/MongoDB)
- Implementing user authentication
- Adding PDF rendering/preview
- Implementing actual PDF modification (not just metadata)
- Adding file storage (S3/local filesystem)
- Implementing field validation rules
- Adding unit and integration tests

## Debugging Tips

- Use FastAPI's `/docs` endpoint for API testing
- Check browser console for frontend errors
- Use Docker logs: `docker-compose logs backend` or `docker-compose logs frontend`
- Verify CORS settings if API calls fail
- Check Docker network connectivity between services

## Environment Variables

### Backend
- `PYTHONUNBUFFERED=1`: Python output buffering

### Frontend
- `REACT_APP_API_URL`: Backend API URL
- `CHOKIDAR_USEPOLLING=true`: File watching in Docker

## Best Practices

1. Always validate user input
2. Handle errors gracefully
3. Provide user feedback (loading states, success/error messages)
4. Keep components modular and reusable
5. Use semantic HTML
6. Make UI responsive
7. Test in Docker environment before committing
8. Keep dependencies up to date
9. Document complex logic
10. Follow REST API conventions
