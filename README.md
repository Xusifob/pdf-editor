# PDF Editor

A web application for uploading, parsing, and editing PDF form fields. Built with Python (FastAPI) backend and React frontend, containerized with Docker Compose.

## Quick Start

For the fastest setup, follow these steps:

1. **Start the backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python -m uvicorn main:app --reload --port 8000
   ```

2. **Start the frontend** (in a new terminal):
   ```bash
   cd frontend
   npm install
   npm start
   ```

3. **Access the application**: Open http://localhost:3000 in your browser

## Features

- 📤 **PDF Upload**: Upload PDF files with drag-and-drop support
- 🔍 **Field Extraction**: Automatically extract form fields from PDFs
- ✏️ **Field Editing**: Update field properties (type, value, position, size)
- ➕ **Add Fields**: Manually add new fields to PDFs
- 🔄 **Field Reordering**: Drag and drop to reorder fields
- 💾 **Save Changes**: Persist PDF field information

## Technology Stack

### Backend
- **Python 3.11**
- **FastAPI**: Modern, fast web framework for building APIs
- **pypdf**: PDF parsing and manipulation
- **Uvicorn**: ASGI server

### Frontend
- **React 18**: UI framework
- **Axios**: HTTP client
- **CSS3**: Modern styling with animations

### Infrastructure
- **Docker & Docker Compose**: Containerization and orchestration

## Project Structure

```
pdf-editor/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile           # Backend container
├── frontend/
│   ├── public/
│   │   └── index.html       # HTML template
│   ├── src/
│   │   ├── components/
│   │   │   ├── PDFUpload.js      # PDF upload component
│   │   │   ├── PDFUpload.css
│   │   │   ├── FieldEditor.js    # Field editor component
│   │   │   └── FieldEditor.css
│   │   ├── App.js           # Main application
│   │   ├── App.css
│   │   ├── index.js         # Entry point
│   │   └── index.css
│   ├── package.json         # Node dependencies
│   └── Dockerfile           # Frontend container
├── docker-compose.yml       # Docker Compose configuration
└── README.md               # This file
```

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Ports 3000 (frontend) and 8000 (backend) available

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pdf-editor
   ```

2. **Start the application**
   ```bash
   docker-compose up --build
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Stopping the Application

```bash
docker-compose down
```

## Development

### Running Locally Without Docker (Recommended for Development)

#### Backend Development

1. **Setup backend**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Run backend server**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Access API documentation**
   - API Docs: http://localhost:8000/docs
   - Alternative Docs: http://localhost:8000/redoc

#### Frontend Development

1. **Setup frontend**
   ```bash
   cd frontend
   npm install
   ```

2. **Run development server**
   ```bash
   npm start
   ```

3. **Access application**
   - Frontend: http://localhost:3000

The frontend will automatically proxy API requests to the backend on port 8000.

### Docker Compose (Alternative)

If you prefer using Docker Compose:

```bash
docker compose up --build
```

**Note**: The Docker Compose setup requires proper SSL certificate configuration for PyPI access. If you encounter SSL certificate errors during the build, use the local development setup described above.

## API Endpoints

### Upload PDF
- **POST** `/api/pdf/upload`
- Upload a PDF file and extract its fields
- Returns: PDF ID, filename, number of pages, and extracted fields

### Get PDF Info
- **GET** `/api/pdf/{pdf_id}`
- Retrieve information about a specific PDF
- Returns: PDF details and all fields

### Update/Add Field
- **POST** `/api/pdf/{pdf_id}/field`
- Update an existing field or add a new one
- Body: Field information (name, type, value, position, size, page)

### Delete Field
- **DELETE** `/api/pdf/{pdf_id}/field/{field_name}`
- Remove a field from a PDF

### List PDFs
- **GET** `/api/pdf/list`
- Get a list of all uploaded PDFs

## Usage

1. **Upload a PDF**: Click or drag-and-drop a PDF file to upload it
2. **View Fields**: See all extracted fields from the PDF
3. **Edit Fields**: Click "Edit" on any field to modify its properties
4. **Add Fields**: Use the "+ Add Field" button to create new fields
5. **Reorder Fields**: Drag and drop fields to change their order
6. **Delete Fields**: Remove unwanted fields with the "Delete" button

## Third-Party Library Compatibility

This application generates PDFs with proper font resource structures that are compatible with third-party PDF manipulation libraries like:

- **SetaPDF (PHP)**: Can programmatically fill form fields
- **Other PDF libraries**: Font resources are created as indirect objects following PDF specification best practices

For details on the SetaPDF compatibility fix, see [SETAPDF_FIX.md](SETAPDF_FIX.md).

## Future Enhancements

- [ ] PDF rendering/preview
- [ ] Visual field positioning on PDF canvas
- [ ] Export modified PDFs
- [ ] Database integration (PostgreSQL/MongoDB)
- [ ] User authentication
- [ ] Field validation rules
- [ ] Batch processing
- [ ] PDF templates library

## Troubleshooting

### PDF.js Worker Version Mismatch
If you see an error like "The API version does not match the Worker version", this means there's a version mismatch between PDF.js libraries. This has been fixed by:

1. **Removing standalone pdfjs-dist**: The `package.json` only uses the version bundled with `react-pdf`
2. **Automatic worker copy**: A postinstall script copies the correct worker file to the `public` directory
3. **Manual fix** (if needed):
   ```bash
   docker-compose exec frontend npm run postinstall
   ```

The worker file should always match the `pdfjs-dist` version used by `react-pdf`.

### Port Already in Use
If ports 3000 or 8000 are already in use, modify the port mappings in `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"  # Frontend
  - "8001:8000"  # Backend
```

### CORS Issues
If you encounter CORS errors, configure the allowed origins using the `CORS_ORIGINS` environment variable:

**For local development**, add to `docker-compose.yml` or `.env`:
```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:3003
```

**For production**, set it to your production domain:
```bash
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

You can also set it in the backend environment or docker-compose.yml.

### Empty PDFs Array Issue
If you get `pdfs: []` after uploading in production:

1. **Check CORS configuration**: Make sure your production domain is in `CORS_ORIGINS`
2. **Set API URL correctly**: In production, set `REACT_APP_API_URL` to your actual backend URL
3. **Check network requests**: Open browser DevTools → Network tab to see if upload request succeeds
4. **Verify backend logs**: Check if the upload endpoint is receiving requests

**Production deployment example**:
```yaml
backend:
  environment:
    - CORS_ORIGINS=https://your-frontend-domain.com
    
frontend:
  environment:
    - REACT_APP_API_URL=https://your-backend-domain.com
```

Note: The backend uses in-memory storage. Uploaded PDFs are lost when the server restarts. For production, consider implementing persistent storage (database, file system, or object storage).

### Docker Build Issues
If Docker builds fail, try rebuilding without cache:

```bash
docker-compose build --no-cache
docker-compose up
```

## Production Deployment

For production deployment instructions, including server setup, SSL configuration, and automated CI/CD with GitHub Actions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or contributions, please open an issue on the GitHub repository.
