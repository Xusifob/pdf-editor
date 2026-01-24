import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import axios from 'axios';
import './PDFCanvas.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function PDFCanvas({ pdfId, fields, onFieldsUpdate }) {
  const [pdfData, setPdfData] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [draggingField, setDraggingField] = useState(null);
  const [resizingField, setResizingField] = useState(null);
  const [selectedField, setSelectedField] = useState(null);
  const [showFieldMenu, setShowFieldMenu] = useState(true);
  const canvasRef = useRef(null);
  const pageContainerRef = useRef(null);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    loadPDFContent();
  }, [pdfId]);

  const loadPDFContent = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/pdf/${pdfId}/content`);
      const pdfBase64 = response.data.content;
      // Convert base64 to data URL
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;
      setPdfData(pdfDataUrl);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const onPageLoadSuccess = (page) => {
    const { width, height } = page;
    setPageDimensions({ width: width * scale, height: height * scale });
  };

  const handleAddField = (fieldType) => {
    const newField = {
      name: `field_${Date.now()}`,
      field_type: fieldType,
      value: '',
      x: 50,
      y: 50,
      width: 150,
      height: 40,
      page: currentPage - 1
    };

    onFieldsUpdate([...fields, newField]);
    setSelectedField(newField.name);
  };

  const handleMouseDown = (e, field, action = 'drag') => {
    e.stopPropagation();
    
    if (action === 'resize') {
      setResizingField({
        field,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: field.width,
        startHeight: field.height
      });
    } else {
      setDraggingField({
        field,
        startX: e.clientX,
        startY: e.clientY,
        startFieldX: field.x,
        startFieldY: field.y
      });
    }
    setSelectedField(field.name);
  };

  const handleMouseMove = (e) => {
    if (draggingField) {
      const deltaX = e.clientX - draggingField.startX;
      const deltaY = e.clientY - draggingField.startY;
      
      const newX = Math.max(0, Math.min(pageDimensions.width - draggingField.field.width, draggingField.startFieldX + deltaX));
      const newY = Math.max(0, Math.min(pageDimensions.height - draggingField.field.height, draggingField.startFieldY + deltaY));

      const updatedFields = fields.map(f =>
        f.name === draggingField.field.name
          ? { ...f, x: newX, y: newY }
          : f
      );
      onFieldsUpdate(updatedFields);
    } else if (resizingField) {
      const deltaX = e.clientX - resizingField.startX;
      const deltaY = e.clientY - resizingField.startY;
      
      const newWidth = Math.max(50, resizingField.startWidth + deltaX);
      const newHeight = Math.max(20, resizingField.startHeight + deltaY);

      const updatedFields = fields.map(f =>
        f.name === resizingField.field.name
          ? { ...f, width: newWidth, height: newHeight }
          : f
      );
      onFieldsUpdate(updatedFields);
    }
  };

  const handleMouseUp = () => {
    setDraggingField(null);
    setResizingField(null);
  };

  const handleFieldValueChange = (fieldName, newValue) => {
    const updatedFields = fields.map(f =>
      f.name === fieldName ? { ...f, value: newValue } : f
    );
    onFieldsUpdate(updatedFields);
  };

  const handleDeleteField = (fieldName) => {
    const updatedFields = fields.filter(f => f.name !== fieldName);
    onFieldsUpdate(updatedFields);
    if (selectedField === fieldName) {
      setSelectedField(null);
    }
  };

  const currentPageFields = fields.filter(f => f.page === currentPage - 1);

  return (
    <div className="pdf-canvas-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div className="pdf-toolbar">
        <div className="toolbar-left">
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {numPages || '?'}
          </span>
          <button onClick={() => setCurrentPage(Math.min(numPages || 1, currentPage + 1))} disabled={currentPage >= numPages}>
            Next
          </button>
        </div>
        <div className="toolbar-right">
          <button onClick={() => setScale(Math.max(0.5, scale - 0.1))}>Zoom Out</button>
          <span className="zoom-info">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(Math.min(2.0, scale + 0.1))}>Zoom In</button>
          <button onClick={() => setShowFieldMenu(!showFieldMenu)}>
            {showFieldMenu ? 'Hide Menu' : 'Show Menu'}
          </button>
        </div>
      </div>

      <div className="pdf-canvas-main">
        <div className="pdf-viewer" ref={pageContainerRef}>
          {pdfData ? (
            <div className="pdf-page-wrapper">
              <Document
                file={pdfData}
                onLoadSuccess={onDocumentLoadSuccess}
                className="pdf-document"
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  onLoadSuccess={onPageLoadSuccess}
                  className="pdf-page"
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
              
              {/* Field overlays */}
              <div className="field-overlay">
                {currentPageFields.map((field) => (
                  <div
                    key={field.name}
                    className={`field-box ${selectedField === field.name ? 'selected' : ''}`}
                    style={{
                      left: `${field.x}px`,
                      top: `${field.y}px`,
                      width: `${field.width}px`,
                      height: `${field.height}px`,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, field, 'drag')}
                  >
                    <div className="field-label">{field.name}</div>
                    <input
                      type="text"
                      className="field-input-overlay"
                      value={field.value || ''}
                      onChange={(e) => handleFieldValueChange(field.name, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={`Enter ${field.field_type}...`}
                    />
                    <div
                      className="resize-handle"
                      onMouseDown={(e) => handleMouseDown(e, field, 'resize')}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="loading">Loading PDF...</div>
          )}
        </div>

        {showFieldMenu && (
          <div className="field-menu">
            <h3>Add Field</h3>
            <div className="field-type-buttons">
              <button className="field-type-btn" onClick={() => handleAddField('Text')}>
                <span className="icon">📝</span>
                Text Field
              </button>
              {/* Future field types can be added here */}
            </div>

            {selectedField && (
              <div className="selected-field-info">
                <h3>Selected Field</h3>
                {currentPageFields
                  .filter(f => f.name === selectedField)
                  .map(field => (
                    <div key={field.name} className="field-details">
                      <p><strong>Name:</strong> {field.name}</p>
                      <p><strong>Type:</strong> {field.field_type}</p>
                      <p><strong>Position:</strong> ({Math.round(field.x)}, {Math.round(field.y)})</p>
                      <p><strong>Size:</strong> {Math.round(field.width)} × {Math.round(field.height)}</p>
                      <button 
                        className="btn-delete-field"
                        onClick={() => handleDeleteField(field.name)}
                      >
                        Delete Field
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PDFCanvas;
