import React, { useState } from 'react';
import './App.css';
import PDFUpload from './components/PDFUpload';
import FieldEditor from './components/FieldEditor';

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
              
              <FieldEditor 
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
