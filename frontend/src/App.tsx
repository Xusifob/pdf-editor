import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-gradient-to-r from-primary-500 to-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <span className="text-5xl">📄</span>
            {t('app.title')}
          </h1>
          <p className="text-lg text-purple-100">{t('app.subtitle')}</p>
        </div>
      </header>
      
      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {!currentPDF ? (
            <PDFUpload onPDFUploaded={handlePDFUploaded} />
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentPDF.filename}</h2>
                <p className="text-gray-600 mb-4">
                  {t('pdfInfo.pages')}: <span className="font-semibold text-gray-900">{currentPDF.num_pages}</span> | {t('pdfInfo.fields')}: <span className="font-semibold text-gray-900">{fields.length}</span>
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-lg shadow-md hover:bg-primary-600 hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
                    onClick={handleDownloadPDF}
                  >
                    <span className="text-xl">📥</span>
                    {t('pdfInfo.downloadPDF')}
                  </button>
                  <button
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
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
