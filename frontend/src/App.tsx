import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './App.css';
import PDFUpload from './components/PDFUpload';
import PDFCanvas from './components/PDFCanvas';
import { PDFData, PDFField } from './types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const { t } = useTranslation();
  const [currentPDF, setCurrentPDF] = useState<PDFData | null>(null);
  const [fields, setFields] = useState<PDFField[]>([]);

  const handlePDFUploaded = (pdfData: PDFData) => {
    setCurrentPDF(pdfData);
    setFields(pdfData.fields || []);
  };

  const handleFieldUpdate = (updatedFields: PDFField[]) => {
    setFields(updatedFields);
  };

  const handleDownloadPDF = async () => {
    if (!currentPDF) return;

    try {
      const response = await fetch(`${API_URL}/api/pdf/${currentPDF.pdf_id}/download`);

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentPDF.filename || 'document.pdf';
      document.body.appendChild(a);
      a.click();

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
        <h1>📄 {t('app.title')}</h1>
        <p>{t('app.subtitle')}</p>
      </header>
      
      <main className="App-main">
        <div className="container">
          {!currentPDF ? (
            <PDFUpload onPDFUploaded={handlePDFUploaded} />
          ) : (
            <div>
              <div className="pdf-info">
                <h2>{currentPDF.filename}</h2>
                <p>{t('pdfInfo.pages')}: {currentPDF.num_pages} | {t('pdfInfo.fields')}: {fields.length}</p>
                <div className="pdf-actions">
                  <button
                    className="btn-primary"
                    onClick={handleDownloadPDF}
                  >
                    📥 {t('pdfInfo.downloadPDF')}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setCurrentPDF(null);
                      setFields([]);
                    }}
                  >
                    {t('pdfInfo.uploadAnother')}
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
