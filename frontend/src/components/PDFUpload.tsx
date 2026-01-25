import { useState, ChangeEvent, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './PDFUpload.css';
import { PDFData } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface PDFUploadProps {
  onPDFUploaded: (pdfData: PDFData) => void;
}

function PDFUpload({ onPDFUploaded }: PDFUploadProps) {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError(null);
    } else {
      setError(t('upload.errorInvalidFile'));
      setSelectedFile(null);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError(null);
    } else {
      setError(t('upload.errorDropInvalid'));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError(t('upload.errorNoFile'));
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post<PDFData>(`${API_URL}/api/pdf/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      onPDFUploaded(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('upload.errorUploadFailed'));
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
        <h3>{t('upload.title')}</h3>
        <p>{t('upload.subtitle')}</p>
        
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          className="file-input"
          id="file-input"
        />
        <label htmlFor="file-input" className="file-label btn-primary">
          📁 {t('upload.chooseFile')}
        </label>

        {selectedFile && (
          <div className="selected-file">
            <p>{t('upload.selected')}: <strong>{selectedFile.name}</strong></p>
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
            {uploading ? t('upload.uploading') : t('upload.uploadButton')}
          </button>
        )}
      </div>
    </div>
  );
}

export default PDFUpload;
