import { useState, ChangeEvent, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
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
    <div className="flex justify-center items-center min-h-[500px]">
      <div
        className={`bg-white border-4 border-dashed rounded-2xl p-12 text-center w-full max-w-2xl transition-all duration-300 shadow-lg ${
          dragOver 
            ? 'border-green-500 bg-blue-50 scale-105 shadow-xl' 
            : 'border-primary-400 hover:border-primary-500 hover:shadow-xl'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-7xl mb-6">📄</div>
        <h3 className="text-2xl font-bold text-gray-800 mb-3">{t('upload.title')}</h3>
        <p className="text-lg text-gray-600 mb-8">{t('upload.subtitle')}</p>
        
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          className="hidden"
          id="file-input"
        />
        <label 
          htmlFor="file-input" 
          className="inline-flex items-center gap-3 px-8 py-4 bg-primary-500 text-white text-lg font-semibold rounded-xl cursor-pointer transition-all duration-300 hover:bg-primary-600 hover:-translate-y-1 hover:shadow-2xl shadow-lg active:translate-y-0"
        >
          <span className="text-2xl">📁</span>
          {t('upload.chooseFile')}
        </label>

        {selectedFile && (
          <div className="mt-6 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
            <p className="text-gray-800 mb-2">
              {t('upload.selected')}: <strong className="text-primary-600">{selectedFile.name}</strong>
            </p>
            <p className="text-sm text-gray-600">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-xl animate-pulse">
            {error}
          </div>
        )}

        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-6 w-full max-w-md px-8 py-4 bg-green-500 text-white text-lg font-semibold rounded-xl shadow-lg hover:bg-green-600 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-green-500 transition-all duration-300 hover:-translate-y-0.5"
          >
            {uploading ? t('upload.uploading') : t('upload.uploadButton')}
          </button>
        )}
      </div>
    </div>
  );
}

export default PDFUpload;
