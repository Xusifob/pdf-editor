import React, { useState } from 'react';
import './App.css';
import PDFUpload from './components/PDFUpload';
import PDFCanvas from './components/PDFCanvas';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const [currentPDF, setCurrentPDF] = useState(null);
  const [fields, setFields] = useState([]);

  const handlePDFUploaded = (pdfData) => {
    setCurrentPDF(pdfData);
    setFields(pdfData.fields || []);
  };

  const handleFieldUpdate = (updatedFields) => {
    setFields(updatedFields);
  };

  const handleDownloadPDF = async () => {
    if (!currentPDF) return;

    try {
      const response = await fetch(`${API_URL}/api/pdf/${currentPDF.pdf_id}/download`);

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentPDF.filename || 'document.pdf';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>📄 PDF Editor</h1>
        <p>Upload a PDF, extract fields, and edit them</p>
      </header>
      
      <main className="App-main">
        <div className="container">
          {!currentPDF ? (
            <PDFUpload onPDFUploaded={handlePDFUploaded} />
          ) : (
            <div>
              <div className="pdf-info">
                <h2>{currentPDF.filename}</h2>
                <p>Pages: {currentPDF.num_pages} | Fields: {fields.length}</p>
                <div className="pdf-actions">
                  <button
                    className="btn-primary"
                    onClick={handleDownloadPDF}
                  >
                    📥 Download PDF
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setCurrentPDF(null);
                      setFields([]);
                    }}
                  >
                    Upload Another PDF
                  </button>
                </div>
              </div>
              
              <PDFCanvas 
                pdfId={currentPDF.pdf_id}
                fields={fields}
                onFieldsUpdate={handleFieldUpdate}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
