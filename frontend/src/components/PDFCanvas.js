import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import axios from 'axios';
import './PDFCanvas.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function PDFCanvas({ pdfId, fields, onFieldsUpdate }) {
  const [pdfData, setPdfData] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [draggingField, setDraggingField] = useState(null);
  const [resizingField, setResizingField] = useState(null);
  const [selectedFields, setSelectedFields] = useState([]);
  const [showFieldMenu, setShowFieldMenu] = useState(true);
  const pageContainerRef = useRef(null);
  const containerRef = useRef(null);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });

  const getFieldId = (field) => field.id || field.name;

  useEffect(() => {
    loadPDFContent();
  }, [pdfId]);

  const handleDeleteSelectedFields = useCallback(async () => {
    if (selectedFields.length === 0) return;
    try {
      await axios.post(`${API_URL}/api/pdf/${pdfId}/fields/bulk-delete`, { field_ids: selectedFields });
      const updatedFields = fields.filter(f => !selectedFields.includes(getFieldId(f)));
      onFieldsUpdate(updatedFields);
      setSelectedFields([]);
    } catch (error) {
      console.error('Error deleting fields:', error);
    }
  }, [selectedFields, fields, pdfId, onFieldsUpdate]);

  const handleKeyDown = useCallback((e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFields.length > 0) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      e.preventDefault();
      handleDeleteSelectedFields();
    }
  }, [selectedFields, handleDeleteSelectedFields]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const loadPDFContent = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/pdf/${pdfId}/content`);
      setPdfData(`data:application/pdf;base64,${response.data.content}`);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages);
  const onPageLoadSuccess = (page) => setPageDimensions({ width: page.width * scale, height: page.height * scale });

  const saveFieldToBackend = async (field) => {
    try {
      await axios.post(`${API_URL}/api/pdf/${pdfId}/field`, { field });
    } catch (error) {
      console.error('Error saving field:', error);
    }
  };

  const handleAddField = (fieldType) => {
    const fieldId = `field_${Date.now()}`;
    let width = 150, height = 30;
    if (fieldType === 'Signature') { width = 200; height = 60; }
    else if (fieldType === 'Textarea') { height = 80; }
    else if (fieldType === 'Checkbox' || fieldType === 'Radio') { width = 20; height = 20; }
    else if (fieldType === 'Date') { width = 120; }

    const newField = {
      id: fieldId, name: fieldId, label: 'New Field', field_type: fieldType,
      value: (fieldType === 'Checkbox' || fieldType === 'Radio') ? 'Yes' : '',
      checked: false, date_format: fieldType === 'Date' ? 'DD/MM/YYYY' : null,
      monospace: false, x: 50, y: 50, width, height, page: currentPage - 1,
      border_style: 'solid', border_width: 1, border_color: [0, 0, 0],
      font_family: 'Helvetica', font_size: 12, max_length: null
    };
    onFieldsUpdate([...fields, newField]);
    setSelectedFields([newField.id]);
    saveFieldToBackend(newField);
  };

  const handleFieldClick = (e, field) => {
    e.stopPropagation();
    const fieldId = getFieldId(field);
    if (e.ctrlKey || e.metaKey) {
      setSelectedFields(prev => prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]);
    } else if (e.shiftKey && selectedFields.length > 0) {
      const currentPageFields = fields.filter(f => f.page === currentPage - 1);
      const fieldIds = currentPageFields.map(f => getFieldId(f));
      const lastSelectedIdx = fieldIds.indexOf(selectedFields[selectedFields.length - 1]);
      const currentIdx = fieldIds.indexOf(fieldId);
      if (lastSelectedIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastSelectedIdx, currentIdx);
        const end = Math.max(lastSelectedIdx, currentIdx);
        setSelectedFields([...new Set([...selectedFields, ...fieldIds.slice(start, end + 1)])]);
      } else setSelectedFields([fieldId]);
    } else setSelectedFields([fieldId]);
  };

  const handleMouseDown = (e, field, action = 'drag') => {
    e.stopPropagation();
    const fieldId = getFieldId(field);
    if (!selectedFields.includes(fieldId) && !e.ctrlKey && !e.metaKey) setSelectedFields([fieldId]);
    if (action === 'resize') {
      setResizingField({ field, startX: e.clientX, startY: e.clientY, startWidth: field.width, startHeight: field.height });
    } else {
      setDraggingField({ field, startX: e.clientX, startY: e.clientY, startFieldX: field.x, startFieldY: field.y });
    }
  };

  const handleMouseMove = (e) => {
    if (draggingField) {
      const deltaX = (e.clientX - draggingField.startX) / scale;
      const deltaY = (e.clientY - draggingField.startY) / scale;
      const unscaledW = pageDimensions.width / scale, unscaledH = pageDimensions.height / scale;
      const updatedFields = fields.map(f => {
        if (selectedFields.includes(getFieldId(f)) && f.page === draggingField.field.page) {
          const newX = Math.max(0, Math.min(unscaledW - f.width, f.x + deltaX));
          const newY = Math.max(0, Math.min(unscaledH - f.height, f.y + deltaY));
          return { ...f, x: newX, y: newY };
        }
        return f;
      });
      setDraggingField({ ...draggingField, startX: e.clientX, startY: e.clientY });
      onFieldsUpdate(updatedFields);
    } else if (resizingField) {
      const deltaX = (e.clientX - resizingField.startX) / scale;
      const deltaY = (e.clientY - resizingField.startY) / scale;
      const newWidth = Math.max(50, resizingField.startWidth + deltaX);
      const newHeight = Math.max(20, resizingField.startHeight + deltaY);
      onFieldsUpdate(fields.map(f => getFieldId(f) === getFieldId(resizingField.field) ? { ...f, width: newWidth, height: newHeight } : f));
    }
  };

  const handleMouseUp = () => {
    if (draggingField || resizingField) {
      selectedFields.forEach(fieldId => {
        const field = fields.find(f => getFieldId(f) === fieldId);
        if (field) saveFieldToBackend(field);
      });
    }
    setDraggingField(null);
    setResizingField(null);
  };

  const handleFieldValueChange = (fieldId, newValue, property = 'value') => {
    const updated = fields.map(f => getFieldId(f) === fieldId ? { ...f, [property]: newValue } : f);
    onFieldsUpdate(updated);
    const field = updated.find(f => getFieldId(f) === fieldId);
    if (field) saveFieldToBackend(field);
  };

  const handleFieldNameChange = (fieldId, newName) => {
    if (!newName.trim()) return;
    const updated = fields.map(f => getFieldId(f) === fieldId ? { ...f, name: newName } : f);
    onFieldsUpdate(updated);
    const field = updated.find(f => getFieldId(f) === fieldId);
    if (field) saveFieldToBackend(field);
  };

  const handleFieldLabelChange = (fieldId, newLabel) => {
    const updated = fields.map(f => getFieldId(f) === fieldId ? { ...f, label: newLabel } : f);
    onFieldsUpdate(updated);
    const field = updated.find(f => getFieldId(f) === fieldId);
    if (field) saveFieldToBackend(field);
  };

  const handlePropertyChange = (fieldId, property, value) => {
    const updated = fields.map(f => getFieldId(f) === fieldId ? { ...f, [property]: value } : f);
    onFieldsUpdate(updated);
    const field = updated.find(f => getFieldId(f) === fieldId);
    if (field) saveFieldToBackend(field);
  };

  const handleBulkUpdate = async (property, value) => {
    if (selectedFields.length === 0) return;
    try {
      await axios.post(`${API_URL}/api/pdf/${pdfId}/fields/bulk-update`, { field_ids: selectedFields, updates: { [property]: value } });
      onFieldsUpdate(fields.map(f => selectedFields.includes(getFieldId(f)) ? { ...f, [property]: value } : f));
    } catch (error) { console.error('Error updating fields:', error); }
  };

  const handleDeleteField = async (fieldId) => {
    onFieldsUpdate(fields.filter(f => getFieldId(f) !== fieldId));
    setSelectedFields(prev => prev.filter(id => id !== fieldId));
    try { await axios.delete(`${API_URL}/api/pdf/${pdfId}/field/${fieldId}`); }
    catch (error) { console.error('Error deleting field:', error); }
  };

  const handleDuplicateField = (fieldId) => {
    const field = fields.find(f => getFieldId(f) === fieldId);
    if (!field) return;
    const newId = `field_${Date.now()}`;
    const dup = { ...field, id: newId, x: (field.x || 0) + 20, y: (field.y || 0) + 20 };
    onFieldsUpdate([...fields, dup]);
    setSelectedFields([newId]);
    saveFieldToBackend(dup);
  };

  const handleDuplicateSelected = () => {
    if (selectedFields.length === 0) return;
    const newFields = [], newIds = [];
    selectedFields.forEach((fieldId, i) => {
      const field = fields.find(f => getFieldId(f) === fieldId);
      if (field) {
        const newId = `field_${Date.now()}_${i}`;
        const dup = { ...field, id: newId, x: (field.x || 0) + 20, y: (field.y || 0) + 20 };
        newFields.push(dup);
        newIds.push(newId);
        saveFieldToBackend(dup);
      }
    });
    onFieldsUpdate([...fields, ...newFields]);
    setSelectedFields(newIds);
  };

  const handleChangeFieldsPage = (newPage) => {
    if (selectedFields.length === 0) return;
    const updated = fields.map(f => selectedFields.includes(getFieldId(f)) ? { ...f, page: newPage } : f);
    onFieldsUpdate(updated);
    selectedFields.forEach(fieldId => {
      const field = updated.find(f => getFieldId(f) === fieldId);
      if (field) saveFieldToBackend(field);
    });
  };

  const handleCanvasClick = (e) => {
    if (e.target === e.currentTarget || e.target.classList.contains('pdf-page-wrapper')) setSelectedFields([]);
  };

  const currentPageFields = fields.filter(f => f.page === currentPage - 1);
  const selectedFieldData = selectedFields.length === 1 ? fields.find(f => getFieldId(f) === selectedFields[0]) : null;

  return (
    <div className="pdf-canvas-container" ref={containerRef} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} tabIndex={0}>
      <div className="pdf-toolbar">
        <div className="toolbar-group">
          <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage <= 1}>◄ Prev</button>
          <span>Page {currentPage} of {numPages || '?'}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(numPages || prev, prev + 1))} disabled={currentPage >= (numPages || 1)}>Next ►</button>
        </div>
        <div className="toolbar-group">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>-</button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2, s + 0.1))}>+</button>
        </div>
        <div className="toolbar-group">
          <button onClick={() => setShowFieldMenu(!showFieldMenu)}>{showFieldMenu ? 'Hide Panel' : 'Show Panel'}</button>
        </div>
        <div className="toolbar-group">
          <a href={`${API_URL}/api/pdf/${pdfId}/download`} className="download-btn" download>📥 Download PDF</a>
        </div>
      </div>

      <div className="pdf-workspace">
        <div className="pdf-viewer" ref={pageContainerRef} onClick={handleCanvasClick}>
          {pdfData ? (
            <div className="pdf-page-wrapper" onClick={handleCanvasClick}>
              <Document file={pdfData} onLoadSuccess={onDocumentLoadSuccess} className="pdf-document">
                <Page pageNumber={currentPage} scale={scale} onLoadSuccess={onPageLoadSuccess} className="pdf-page" renderTextLayer={false} renderAnnotationLayer={false} />
              </Document>
              <div className="field-overlay">
                {currentPageFields.map((field) => {
                  const borderStyleMap = { 'solid': 'solid', 'dashed': 'dashed', 'beveled': 'outset', 'inset': 'inset', 'underline': 'none', 'none': 'none' };
                  const cssBorderStyle = borderStyleMap[field.border_style] || 'solid';
                  const borderWidth = field.border_style === 'none' ? 0 : (field.border_width || 1);
                  const borderColor = field.border_color ? `rgb(${Math.round(field.border_color[0] * 255)}, ${Math.round(field.border_color[1] * 255)}, ${Math.round(field.border_color[2] * 255)})` : '#667eea';
                  const isSignature = field.field_type === 'Signature';
                  const isCheckbox = field.field_type === 'Checkbox';
                  const isRadio = field.field_type === 'Radio';
                  const isSelected = selectedFields.includes(getFieldId(field));

                  return (
                    <div key={getFieldId(field)} className={`field-box ${isSelected ? 'selected' : ''} ${field.border_style === 'underline' ? 'underline-border' : ''} ${isSignature ? 'signature-field' : ''} ${isCheckbox || isRadio ? 'checkbox-field' : ''}`}
                      style={{ left: `${field.x * scale}px`, top: `${field.y * scale}px`, width: `${field.width * scale}px`, height: `${field.height * scale}px`, borderStyle: cssBorderStyle, borderWidth: `${borderWidth}px`, borderColor: borderColor, borderBottomStyle: field.border_style === 'underline' ? 'solid' : cssBorderStyle, borderBottomWidth: field.border_style === 'underline' ? `${field.border_width || 1}px` : `${borderWidth}px` }}
                      onClick={(e) => handleFieldClick(e, field)} onMouseDown={(e) => handleMouseDown(e, field, 'drag')}>
                      <div className="field-label">{field.label || field.name}</div>
                      {isSelected && selectedFields.length === 1 && (
                        <div className="field-actions">
                          <button className="field-action-btn duplicate-btn" onClick={(e) => { e.stopPropagation(); handleDuplicateField(getFieldId(field)); }} title="Duplicate">📋</button>
                          <button className="field-action-btn delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteField(getFieldId(field)); }} title="Delete">🗑️</button>
                        </div>
                      )}
                      {isSignature ? (<div className="signature-placeholder" onClick={(e) => e.stopPropagation()}><span className="signature-icon">✍️</span><span className="signature-text">Signature</span></div>)
                       : isCheckbox ? (<div className="checkbox-placeholder" onClick={(e) => { e.stopPropagation(); handleFieldValueChange(getFieldId(field), !field.checked, 'checked'); }}><span className="checkbox-icon">{field.checked ? '☑️' : '⬜'}</span></div>)
                       : isRadio ? (<div className="radio-placeholder" onClick={(e) => { e.stopPropagation(); handleFieldValueChange(getFieldId(field), !field.checked, 'checked'); }}><span className="radio-icon">{field.checked ? '🔘' : '⚪'}</span></div>)
                       : field.field_type === 'Textarea' ? (<textarea className="field-textarea-overlay" value={field.value || ''} onChange={(e) => handleFieldValueChange(getFieldId(field), e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="Enter text..." maxLength={field.max_length || undefined} />)
                       : field.field_type === 'Date' ? (<input type="text" className="field-input-overlay date-field" value={field.value || ''} onChange={(e) => handleFieldValueChange(getFieldId(field), e.target.value)} onClick={(e) => e.stopPropagation()} placeholder={field.date_format || 'DD/MM/YYYY'} maxLength={field.max_length || undefined} />)
                       : (<input type="text" className={`field-input-overlay ${field.monospace ? 'monospace' : ''}`} value={field.value || ''} onChange={(e) => handleFieldValueChange(getFieldId(field), e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="Enter text..." maxLength={field.max_length || undefined} />)}
                      <div className="resize-handle" onMouseDown={(e) => handleMouseDown(e, field, 'resize')} />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (<div className="loading">Loading PDF...</div>)}
        </div>

        {showFieldMenu && (
          <div className="field-menu">
            <h3>Add Field</h3>
            <div className="field-type-buttons">
              <button className="field-type-btn" onClick={() => handleAddField('Text')}><span className="icon">📝</span> Text Field</button>
              <button className="field-type-btn" onClick={() => handleAddField('Textarea')}><span className="icon">📄</span> Textarea</button>
              <button className="field-type-btn" onClick={() => handleAddField('Signature')}><span className="icon">✍️</span> Signature</button>
              <button className="field-type-btn" onClick={() => handleAddField('Checkbox')}><span className="icon">☑️</span> Checkbox</button>
              <button className="field-type-btn" onClick={() => handleAddField('Radio')}><span className="icon">🔘</span> Radio</button>
              <button className="field-type-btn" onClick={() => handleAddField('Date')}><span className="icon">📅</span> Date</button>
            </div>

            {selectedFields.length > 1 && (
              <div className="multi-select-info">
                <h3>{selectedFields.length} Fields Selected</h3>
                <div className="multi-select-actions">
                  <button className="btn-action" onClick={handleDuplicateSelected}>📋 Duplicate All</button>
                  <button className="btn-action btn-danger" onClick={handleDeleteSelectedFields}>🗑️ Delete All</button>
                </div>
                <div className="field-property">
                  <label><strong>Move to Page:</strong></label>
                  <select className="field-select" onChange={(e) => handleChangeFieldsPage(parseInt(e.target.value))} defaultValue="">
                    <option value="" disabled>Select page...</option>
                    {Array.from({ length: numPages || 1 }, (_, i) => (<option key={i} value={i}>Page {i + 1}</option>))}
                  </select>
                </div>
                <div className="field-property">
                  <label><strong>Set Label (all):</strong></label>
                  <input type="text" className="field-name-input" placeholder="Enter common label..." onBlur={(e) => e.target.value && handleBulkUpdate('label', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.target.value && handleBulkUpdate('label', e.target.value)} />
                </div>
                <div className="field-property">
                  <label><strong>Set Name (all):</strong></label>
                  <input type="text" className="field-name-input" placeholder="Enter common name..." onBlur={(e) => e.target.value && handleBulkUpdate('name', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.target.value && handleBulkUpdate('name', e.target.value)} />
                </div>
                <div className="field-property">
                  <label><strong>Border Style (all):</strong></label>
                  <select className="field-select" onChange={(e) => handleBulkUpdate('border_style', e.target.value)} defaultValue="">
                    <option value="" disabled>Select style...</option>
                    <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="beveled">Beveled</option><option value="inset">Inset</option><option value="underline">Underline</option><option value="none">None</option>
                  </select>
                </div>
              </div>
            )}

            {selectedFields.length === 1 && selectedFieldData && (
              <div className="selected-field-info">
                <h3>Selected Field</h3>
                <div className="field-details">
                  <div className="field-property"><label><strong>Label:</strong></label><input type="text" className="field-name-input" value={selectedFieldData.label || ''} onChange={(e) => handleFieldLabelChange(getFieldId(selectedFieldData), e.target.value)} placeholder="Field label..." /></div>
                  <div className="field-property"><label><strong>Name:</strong></label><input type="text" className="field-name-input" value={selectedFieldData.name || ''} onChange={(e) => handleFieldNameChange(getFieldId(selectedFieldData), e.target.value)} placeholder="Field name..." /></div>
                  {selectedFieldData.original_name && <p className="original-name"><strong>Original:</strong> {selectedFieldData.original_name}</p>}
                  <p><strong>Type:</strong> {selectedFieldData.field_type}</p>
                  <p><strong>Position:</strong> ({Math.round(selectedFieldData.x)}, {Math.round(selectedFieldData.y)})</p>
                  <p><strong>Size:</strong> {Math.round(selectedFieldData.width)} × {Math.round(selectedFieldData.height)}</p>
                  <div className="field-property"><label><strong>Page:</strong></label><select className="field-select" value={selectedFieldData.page || 0} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'page', parseInt(e.target.value))}>{Array.from({ length: numPages || 1 }, (_, i) => (<option key={i} value={i}>Page {i + 1}</option>))}</select></div>

                  {(selectedFieldData.field_type === 'Checkbox' || selectedFieldData.field_type === 'Radio') && (<>
                    <div className="field-property"><label><strong>Checked:</strong></label><input type="checkbox" className="field-checkbox-input" checked={selectedFieldData.checked || false} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'checked', e.target.checked)} /></div>
                    <div className="field-property"><label><strong>Export Value:</strong></label><input type="text" className="field-name-input" value={selectedFieldData.value || 'Yes'} onChange={(e) => handleFieldValueChange(getFieldId(selectedFieldData), e.target.value)} placeholder="Value when checked..." /></div>
                    {selectedFieldData.field_type === 'Radio' && (<div className="field-property"><label><strong>Radio Group:</strong></label><input type="text" className="field-name-input" value={selectedFieldData.radio_group || ''} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'radio_group', e.target.value)} placeholder="Group name..." /></div>)}
                  </>)}

                  {selectedFieldData.field_type === 'Date' && (<div className="field-property"><label><strong>Date Format:</strong></label><select className="field-select" value={selectedFieldData.date_format || 'DD/MM/YYYY'} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'date_format', e.target.value)}><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option><option value="DD-MM-YYYY">DD-MM-YYYY</option><option value="DD.MM.YYYY">DD.MM.YYYY</option><option value="YYYY/MM/DD">YYYY/MM/DD</option></select></div>)}

                  {(selectedFieldData.field_type === 'Text' || selectedFieldData.field_type === 'Textarea' || selectedFieldData.field_type === 'Date') && (<>
                    <div className="field-property"><label><strong>Font Family:</strong></label><select className="field-select" value={selectedFieldData.font_family || 'Helvetica'} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'font_family', e.target.value)}><option value="Helvetica">Helvetica</option><option value="Times-Roman">Times Roman</option><option value="Courier">Courier</option></select></div>
                    <div className="field-property"><label><strong>Font Size:</strong></label><input type="number" className="field-number-input" value={selectedFieldData.font_size || 12} min="6" max="72" onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'font_size', parseInt(e.target.value) || 12)} /></div>
                    <div className="field-property"><label><strong>Max Characters:</strong></label><input type="number" className="field-number-input" value={selectedFieldData.max_length || ''} min="1" placeholder="Unlimited" onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'max_length', e.target.value ? parseInt(e.target.value) : null)} /></div>
                    {(selectedFieldData.field_type === 'Text' || selectedFieldData.field_type === 'Date') && (<div className="field-property"><label><strong>Monospace (Comb):</strong></label><input type="checkbox" className="field-checkbox-input" checked={selectedFieldData.monospace || false} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'monospace', e.target.checked)} /><span className="field-hint">Requires Max Characters</span></div>)}
                  </>)}

                  <div className="field-property"><label><strong>Border Style:</strong></label><select className="field-select" value={selectedFieldData.border_style || 'solid'} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'border_style', e.target.value)}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="beveled">Beveled</option><option value="inset">Inset</option><option value="underline">Underline</option><option value="none">None</option></select></div>
                  <div className="field-property"><label><strong>Border Width:</strong></label><input type="number" className="field-number-input" value={selectedFieldData.border_width || 1} min="0" max="10" onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'border_width', parseFloat(e.target.value) || 0)} /></div>
                  <button className="btn-delete-field" onClick={() => handleDeleteField(getFieldId(selectedFieldData))}>Delete Field</button>
                </div>
              </div>
            )}

            {selectedFields.length === 0 && (<div className="no-selection-info"><p>Click on a field to select it</p><p><small>Ctrl+Click for multi-select</small></p><p><small>Press Delete to remove selected fields</small></p></div>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default PDFCanvas;
