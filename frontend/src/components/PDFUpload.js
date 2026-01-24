import React, { useState } from 'react';
import axios from 'axios';
import './PDFUpload.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function PDFUpload({ onPDFUploaded }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Please select a valid PDF file');
      setSelectedFile(null);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Please drop a valid PDF file');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API_URL}/api/pdf/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      onPDFUploaded(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pdf-upload">
      <div
        className={`upload-area ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📄</div>
        <h3>Upload PDF</h3>
        <p>Drag and drop a PDF file here, or click to select</p>
        
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          className="file-input"
          id="file-input"
        />
        <label htmlFor="file-input" className="file-label btn-primary">
          Choose File
        </label>

        {selectedFile && (
          <div className="selected-file">
            <p>Selected: <strong>{selectedFile.name}</strong></p>
            <p className="file-size">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-success upload-button"
          >
            {uploading ? 'Uploading...' : 'Upload and Extract Fields'}
          </button>
        )}
      </div>
    </div>
  );
}

export default PDFUpload;
