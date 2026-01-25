import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { PDFField } from '../types';
import './PDFCanvas.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface PDFCanvasProps {
  pdfId: string;
  fields: PDFField[];
  onFieldsUpdate: (fields: PDFField[]) => void;
}

interface DraggingState {
  field: PDFField;
  startX: number;
  startY: number;
  startFieldX: number;
  startFieldY: number;
}

interface ResizingState {
  field: PDFField;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

interface PageDimensions {
  width: number;
  height: number;
}

interface PageInfo {
  numPages: number;
}

interface PageLoadSuccess {
  width: number;
  height: number;
}

function PDFCanvas({ pdfId, fields, onFieldsUpdate }: PDFCanvasProps) {
  const { t } = useTranslation();
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [draggingField, setDraggingField] = useState<DraggingState | null>(null);
  const [resizingField, setResizingField] = useState<ResizingState | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [showFieldMenu, setShowFieldMenu] = useState<boolean>(true);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageDimensions, setPageDimensions] = useState<PageDimensions>({ width: 0, height: 0 });

  const getFieldId = (field: PDFField): string => field.id || field.name;

  const loadPDFContent = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/pdf/${pdfId}/content`);
      setPdfData(`data:application/pdf;base64,${response.data.content}`);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  }, [pdfId]);

  useEffect(() => {
    loadPDFContent();
  }, [loadPDFContent]);

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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFields.length > 0) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      e.preventDefault();
      handleDeleteSelectedFields();
    }
  }, [selectedFields, handleDeleteSelectedFields]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const onDocumentLoadSuccess = ({ numPages }: PageInfo) => setNumPages(numPages);
  const onPageLoadSuccess = (page: PageLoadSuccess) => setPageDimensions({ width: page.width * scale, height: page.height * scale });

  const saveFieldToBackend = async (field: PDFField) => {
    try {
      await axios.post(`${API_URL}/api/pdf/${pdfId}/field`, { field });
    } catch (error) {
      console.error('Error saving field:', error);
    }
  };

  const handleAddField = (fieldType: string) => {
    const fieldId = `field_${Date.now()}`;
    let width = 150, height = 30;
    if (fieldType === 'Signature') { width = 200; height = 60; }
    else if (fieldType === 'Textarea') { height = 80; }
    else if (fieldType === 'Checkbox' || fieldType === 'Radio') { width = 20; height = 20; }
    else if (fieldType === 'Date') { width = 120; }

    const newField: PDFField = {
      id: fieldId, name: fieldId, label: 'New Field', field_type: fieldType,
      value: (fieldType === 'Checkbox' || fieldType === 'Radio') ? 'Yes' : '',
      checked: false, date_format: fieldType === 'Date' ? 'DD/MM/YYYY' : null,
      monospace: false, x: 50, y: 50, width, height, page: currentPage - 1,
      border_style: 'solid', border_width: 1, border_color: [0, 0, 0],
      font_family: 'Helvetica', font_size: 12, max_length: null
    };
    onFieldsUpdate([...fields, newField]);
    setSelectedFields([newField.id!]);
    saveFieldToBackend(newField);
  };

  const handleFieldClick = (e: React.MouseEvent, field: PDFField) => {
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

  const handleMouseDown = (e: React.MouseEvent, field: PDFField, action: 'drag' | 'resize' = 'drag') => {
    e.stopPropagation();
    const fieldId = getFieldId(field);
    if (!selectedFields.includes(fieldId) && !e.ctrlKey && !e.metaKey) setSelectedFields([fieldId]);
    if (action === 'resize') {
      setResizingField({ field, startX: e.clientX, startY: e.clientY, startWidth: field.width, startHeight: field.height });
    } else {
      setDraggingField({ field, startX: e.clientX, startY: e.clientY, startFieldX: field.x, startFieldY: field.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
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

  const handleFieldValueChange = (fieldId: string, newValue: string | boolean, property: string = 'value') => {
    const updated = fields.map(f => getFieldId(f) === fieldId ? { ...f, [property]: newValue } : f);
    onFieldsUpdate(updated);
    const field = updated.find(f => getFieldId(f) === fieldId);
    if (field) saveFieldToBackend(field);
  };

  const handleFieldNameChange = (fieldId: string, newName: string) => {
    if (!newName.trim()) return;
    const updated = fields.map(f => getFieldId(f) === fieldId ? { ...f, name: newName } : f);
    onFieldsUpdate(updated);
    const field = updated.find(f => getFieldId(f) === fieldId);
    if (field) saveFieldToBackend(field);
  };

  const handleFieldLabelChange = (fieldId: string, newLabel: string) => {
    const updated = fields.map(f => getFieldId(f) === fieldId ? { ...f, label: newLabel } : f);
    onFieldsUpdate(updated);
    const field = updated.find(f => getFieldId(f) === fieldId);
    if (field) saveFieldToBackend(field);
  };

  const handlePropertyChange = (fieldId: string, property: string, value: any) => {
    const updated = fields.map(f => getFieldId(f) === fieldId ? { ...f, [property]: value } : f);
    onFieldsUpdate(updated);
    const field = updated.find(f => getFieldId(f) === fieldId);
    if (field) saveFieldToBackend(field);
  };

  const handleBulkUpdate = async (property: string, value: any) => {
    if (selectedFields.length === 0) return;
    try {
      await axios.post(`${API_URL}/api/pdf/${pdfId}/fields/bulk-update`, { field_ids: selectedFields, updates: { [property]: value } });
      onFieldsUpdate(fields.map(f => selectedFields.includes(getFieldId(f)) ? { ...f, [property]: value } : f));
    } catch (error) { console.error('Error updating fields:', error); }
  };

  const handleDeleteField = async (fieldId: string) => {
    onFieldsUpdate(fields.filter(f => getFieldId(f) !== fieldId));
    setSelectedFields(prev => prev.filter(id => id !== fieldId));
    try { await axios.delete(`${API_URL}/api/pdf/${pdfId}/field/${fieldId}`); }
    catch (error) { console.error('Error deleting field:', error); }
  };

  const handleDuplicateField = (fieldId: string) => {
    const field = fields.find(f => getFieldId(f) === fieldId);
    if (!field) return;
    const newId = `field_${Date.now()}`;
    const dup: PDFField = { ...field, id: newId, x: (field.x || 0) + 20, y: (field.y || 0) + 20 };
    onFieldsUpdate([...fields, dup]);
    setSelectedFields([newId]);
    saveFieldToBackend(dup);
  };

  const handleDuplicateSelected = () => {
    if (selectedFields.length === 0) return;
    const newFields: PDFField[] = [], newIds: string[] = [];
    selectedFields.forEach((fieldId, i) => {
      const field = fields.find(f => getFieldId(f) === fieldId);
      if (field) {
        const newId = `field_${Date.now()}_${i}`;
        const dup: PDFField = { ...field, id: newId, x: (field.x || 0) + 20, y: (field.y || 0) + 20 };
        newFields.push(dup);
        newIds.push(newId);
        saveFieldToBackend(dup);
      }
    });
    onFieldsUpdate([...fields, ...newFields]);
    setSelectedFields(newIds);
  };

  const handleChangeFieldsPage = (newPage: number) => {
    if (selectedFields.length === 0) return;
    const updated = fields.map(f => selectedFields.includes(getFieldId(f)) ? { ...f, page: newPage } : f);
    onFieldsUpdate(updated);
    selectedFields.forEach(fieldId => {
      const field = updated.find(f => getFieldId(f) === fieldId);
      if (field) saveFieldToBackend(field);
    });
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (e.target === e.currentTarget || target.classList.contains('pdf-page-wrapper')) setSelectedFields([]);
  };

  const currentPageFields = fields.filter(f => f.page === currentPage - 1);
  const selectedFieldData = selectedFields.length === 1 ? fields.find(f => getFieldId(f) === selectedFields[0]) : null;

  return (
    <div className="pdf-canvas-container" ref={containerRef} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} tabIndex={0}>
      <div className="pdf-toolbar">
        <div className="toolbar-group">
          <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage <= 1}>◄ {t('pdfCanvas.toolbar.prev')}</button>
          <span>{t('pdfCanvas.toolbar.page')} {currentPage} {t('pdfCanvas.toolbar.of')} {numPages || '?'}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(numPages || prev, prev + 1))} disabled={currentPage >= (numPages || 1)}>{t('pdfCanvas.toolbar.next')} ►</button>
        </div>
        <div className="toolbar-group">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>-</button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2, s + 0.1))}>+</button>
        </div>
        <div className="toolbar-group">
          <button onClick={() => setShowFieldMenu(!showFieldMenu)}>{showFieldMenu ? t('pdfCanvas.toolbar.hidePanel') : t('pdfCanvas.toolbar.showPanel')}</button>
        </div>
        <div className="toolbar-group">
          <a href={`${API_URL}/api/pdf/${pdfId}/download`} className="download-btn" download>📥 {t('pdfCanvas.toolbar.downloadPDF')}</a>
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
                  const borderStyleMap: Record<string, string> = { 'solid': 'solid', 'dashed': 'dashed', 'beveled': 'outset', 'inset': 'inset', 'underline': 'none', 'none': 'none' };
                  const cssBorderStyle = borderStyleMap[field.border_style || 'solid'] || 'solid';
                  const borderWidth = field.border_style === 'none' ? 0 : (field.border_width || 1);
                  const borderColor = field.border_color ? `rgb(${Math.round(field.border_color[0] * 255)}, ${Math.round(field.border_color[1] * 255)}, ${Math.round(field.border_color[2] * 255)})` : '#667eea';
                  const isSignature = field.field_type === 'Signature';
                  const isCheckbox = field.field_type === 'Checkbox';
                  const isRadio = field.field_type === 'Radio';
                  const isSelected = selectedFields.includes(getFieldId(field));

                  return (
                    <div key={getFieldId(field)} className={`field-box ${isSelected ? 'selected' : ''} ${field.border_style === 'underline' ? 'underline-border' : ''} ${isSignature ? 'signature-field' : ''} ${isCheckbox || isRadio ? 'checkbox-field' : ''}`}
                      style={{ left: `${field.x * scale}px`, top: `${field.y * scale}px`, width: `${field.width * scale}px`, height: `${field.height * scale}px`, borderStyle: cssBorderStyle as any, borderWidth: `${borderWidth}px`, borderColor: borderColor, borderBottomStyle: (field.border_style === 'underline' ? 'solid' : cssBorderStyle) as any, borderBottomWidth: field.border_style === 'underline' ? `${field.border_width || 1}px` : `${borderWidth}px` }}
                      onClick={(e) => handleFieldClick(e, field)} onMouseDown={(e) => handleMouseDown(e, field, 'drag')}>
                      <div className="field-label">{field.label || field.name}</div>
                      {isSelected && selectedFields.length === 1 && (
                        <div className="field-actions">
                          <button className="field-action-btn duplicate-btn" onClick={(e) => { e.stopPropagation(); handleDuplicateField(getFieldId(field)); }} title="Duplicate">📋</button>
                          <button className="field-action-btn delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteField(getFieldId(field)); }} title="Delete">🗑️</button>
                        </div>
                      )}
                      {isSignature ? (<div className="signature-placeholder" onClick={(e) => e.stopPropagation()}><span className="signature-icon">✍️</span><span className="signature-text">{t('pdfCanvas.placeholder.signature')}</span></div>)
                       : isCheckbox ? (<div className="checkbox-placeholder" onClick={(e) => { e.stopPropagation(); handleFieldValueChange(getFieldId(field), !field.checked, 'checked'); }}><span className="checkbox-icon">{field.checked ? '☑️' : '⬜'}</span></div>)
                       : isRadio ? (<div className="radio-placeholder" onClick={(e) => { e.stopPropagation(); handleFieldValueChange(getFieldId(field), !field.checked, 'checked'); }}><span className="radio-icon">{field.checked ? '🔘' : '⚪'}</span></div>)
                       : field.field_type === 'Textarea' ? (<textarea className="field-textarea-overlay" value={field.value || ''} onChange={(e) => handleFieldValueChange(getFieldId(field), e.target.value)} onClick={(e) => e.stopPropagation()} placeholder={t('pdfCanvas.placeholder.enterText')} maxLength={field.max_length || undefined} />)
                       : field.field_type === 'Date' ? (<input type="text" className="field-input-overlay date-field" value={field.value || ''} onChange={(e) => handleFieldValueChange(getFieldId(field), e.target.value)} onClick={(e) => e.stopPropagation()} placeholder={field.date_format || 'DD/MM/YYYY'} maxLength={field.max_length || undefined} />)
                       : (<input type="text" className={`field-input-overlay ${field.monospace ? 'monospace' : ''}`} value={field.value || ''} onChange={(e) => handleFieldValueChange(getFieldId(field), e.target.value)} onClick={(e) => e.stopPropagation()} placeholder={t('pdfCanvas.placeholder.enterText')} maxLength={field.max_length || undefined} />)}
                      <div className="resize-handle" onMouseDown={(e) => handleMouseDown(e, field, 'resize')} />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (<div className="loading">{t('pdfCanvas.loading')}</div>)}
        </div>

        {showFieldMenu && (
          <div className="field-menu">
            <h3>{t('pdfCanvas.fieldMenu.addField')}</h3>
            <div className="field-type-buttons">
              <button className="field-type-btn" onClick={() => handleAddField('Text')}><span className="icon">📝</span> {t('pdfCanvas.fieldMenu.textField')}</button>
              <button className="field-type-btn" onClick={() => handleAddField('Textarea')}><span className="icon">📄</span> {t('pdfCanvas.fieldMenu.textarea')}</button>
              <button className="field-type-btn" onClick={() => handleAddField('Signature')}><span className="icon">✍️</span> {t('pdfCanvas.fieldMenu.signature')}</button>
              <button className="field-type-btn" onClick={() => handleAddField('Checkbox')}><span className="icon">☑️</span> {t('pdfCanvas.fieldMenu.checkbox')}</button>
              <button className="field-type-btn" onClick={() => handleAddField('Radio')}><span className="icon">🔘</span> {t('pdfCanvas.fieldMenu.radio')}</button>
              <button className="field-type-btn" onClick={() => handleAddField('Date')}><span className="icon">📅</span> {t('pdfCanvas.fieldMenu.date')}</button>
            </div>

            {selectedFields.length > 1 && (
              <div className="multi-select-info">
                <h3>{selectedFields.length} {t('pdfCanvas.fieldMenu.multiSelect')}</h3>
                <div className="multi-select-actions">
                  <button className="btn-action" onClick={handleDuplicateSelected}>📋 {t('pdfCanvas.fieldMenu.duplicateAll')}</button>
                  <button className="btn-action btn-danger" onClick={handleDeleteSelectedFields}>🗑️ {t('pdfCanvas.fieldMenu.deleteAll')}</button>
                </div>
                <div className="field-property">
                  <label><strong>{t('pdfCanvas.fieldMenu.moveToPage')}:</strong></label>
                  <select className="field-select" onChange={(e) => handleChangeFieldsPage(parseInt(e.target.value))} defaultValue="">
                    <option value="" disabled>{t('pdfCanvas.fieldMenu.selectPage')}</option>
                    {Array.from({ length: numPages || 1 }, (_, i) => (<option key={i} value={i}>{t('pdfCanvas.toolbar.page')} {i + 1}</option>))}
                  </select>
                </div>
                <div className="field-property">
                  <label><strong>{t('pdfCanvas.fieldMenu.setLabelAll')}:</strong></label>
                  <input type="text" className="field-name-input" placeholder={t('pdfCanvas.fieldMenu.enterCommonLabel')} onBlur={(e) => e.target.value && handleBulkUpdate('label', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.value && handleBulkUpdate('label', e.currentTarget.value)} />
                </div>
                <div className="field-property">
                  <label><strong>{t('pdfCanvas.fieldMenu.setNameAll')}:</strong></label>
                  <input type="text" className="field-name-input" placeholder={t('pdfCanvas.fieldMenu.enterCommonName')} onBlur={(e) => e.target.value && handleBulkUpdate('name', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.value && handleBulkUpdate('name', e.currentTarget.value)} />
                </div>
                <div className="field-property">
                  <label><strong>{t('pdfCanvas.fieldMenu.borderStyleAll')}:</strong></label>
                  <select className="field-select" onChange={(e) => handleBulkUpdate('border_style', e.target.value)} defaultValue="">
                    <option value="" disabled>{t('pdfCanvas.fieldMenu.selectStyle')}</option>
                    <option value="solid">{t('pdfCanvas.borderStyles.solid')}</option>
                    <option value="dashed">{t('pdfCanvas.borderStyles.dashed')}</option>
                    <option value="beveled">{t('pdfCanvas.borderStyles.beveled')}</option>
                    <option value="inset">{t('pdfCanvas.borderStyles.inset')}</option>
                    <option value="underline">{t('pdfCanvas.borderStyles.underline')}</option>
                    <option value="none">{t('pdfCanvas.borderStyles.none')}</option>
                  </select>
                </div>
              </div>
            )}

            {selectedFields.length === 1 && selectedFieldData && (
              <div className="selected-field-info">
                <h3>{t('pdfCanvas.fieldMenu.selectedField')}</h3>
                <div className="field-details">
                  <div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.label')}:</strong></label><input type="text" className="field-name-input" value={selectedFieldData.label || ''} onChange={(e) => handleFieldLabelChange(getFieldId(selectedFieldData), e.target.value)} placeholder={t('pdfCanvas.fieldMenu.fieldLabel')} /></div>
                  <div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.name')}:</strong></label><input type="text" className="field-name-input" value={selectedFieldData.name || ''} onChange={(e) => handleFieldNameChange(getFieldId(selectedFieldData), e.target.value)} placeholder={t('pdfCanvas.fieldMenu.fieldName')} /></div>
                  {selectedFieldData.original_name && <p className="original-name"><strong>{t('pdfCanvas.fieldMenu.original')}:</strong> {selectedFieldData.original_name}</p>}
                  <p><strong>{t('pdfCanvas.fieldMenu.type')}:</strong> {selectedFieldData.field_type}</p>
                  <p><strong>{t('pdfCanvas.fieldMenu.position')}:</strong> ({Math.round(selectedFieldData.x)}, {Math.round(selectedFieldData.y)})</p>
                  <p><strong>{t('pdfCanvas.fieldMenu.size')}:</strong> {Math.round(selectedFieldData.width)} × {Math.round(selectedFieldData.height)}</p>
                  <div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.page')}:</strong></label><select className="field-select" value={selectedFieldData.page || 0} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'page', parseInt(e.target.value))}>{Array.from({ length: numPages || 1 }, (_, i) => (<option key={i} value={i}>{t('pdfCanvas.toolbar.page')} {i + 1}</option>))}</select></div>

                  {(selectedFieldData.field_type === 'Checkbox' || selectedFieldData.field_type === 'Radio') && (<>
                    <div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.checked')}:</strong></label><input type="checkbox" className="field-checkbox-input" checked={selectedFieldData.checked || false} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'checked', e.target.checked)} /></div>
                    <div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.exportValue')}:</strong></label><input type="text" className="field-name-input" value={selectedFieldData.value || 'Yes'} onChange={(e) => handleFieldValueChange(getFieldId(selectedFieldData), e.target.value)} placeholder={t('pdfCanvas.fieldMenu.valueWhenChecked')} /></div>
                    {selectedFieldData.field_type === 'Radio' && (<div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.radioGroup')}:</strong></label><input type="text" className="field-name-input" value={selectedFieldData.radio_group || ''} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'radio_group', e.target.value)} placeholder={t('pdfCanvas.fieldMenu.groupName')} /></div>)}
                  </>)}

                  {selectedFieldData.field_type === 'Date' && (<div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.dateFormat')}:</strong></label><select className="field-select" value={selectedFieldData.date_format || 'DD/MM/YYYY'} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'date_format', e.target.value)}><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option><option value="DD-MM-YYYY">DD-MM-YYYY</option><option value="DD.MM.YYYY">DD.MM.YYYY</option><option value="YYYY/MM/DD">YYYY/MM/DD</option></select></div>)}

                  {(selectedFieldData.field_type === 'Text' || selectedFieldData.field_type === 'Textarea' || selectedFieldData.field_type === 'Date') && (<>
                    <div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.fontFamily')}:</strong></label><select className="field-select" value={selectedFieldData.font_family || 'Helvetica'} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'font_family', e.target.value)}><option value="Helvetica">{t('pdfCanvas.fonts.helvetica')}</option><option value="Times-Roman">{t('pdfCanvas.fonts.timesRoman')}</option><option value="Courier">{t('pdfCanvas.fonts.courier')}</option></select></div>
                    <div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.fontSize')}:</strong></label><input type="number" className="field-number-input" value={selectedFieldData.font_size || 12} min="6" max="72" onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'font_size', parseInt(e.target.value) || 12)} /></div>
                    <div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.maxCharacters')}:</strong></label><input type="number" className="field-number-input" value={selectedFieldData.max_length || ''} min="1" placeholder={t('pdfCanvas.fieldMenu.unlimited')} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'max_length', e.target.value ? parseInt(e.target.value) : null)} /></div>
                    {(selectedFieldData.field_type === 'Text' || selectedFieldData.field_type === 'Date') && (<div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.monospace')}:</strong></label><input type="checkbox" className="field-checkbox-input" checked={selectedFieldData.monospace || false} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'monospace', e.target.checked)} /><span className="field-hint">{t('pdfCanvas.fieldMenu.requiresMaxChars')}</span></div>)}
                  </>)}

                  <div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.borderStyle')}:</strong></label><select className="field-select" value={selectedFieldData.border_style || 'solid'} onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'border_style', e.target.value)}><option value="solid">{t('pdfCanvas.borderStyles.solid')}</option><option value="dashed">{t('pdfCanvas.borderStyles.dashed')}</option><option value="beveled">{t('pdfCanvas.borderStyles.beveled')}</option><option value="inset">{t('pdfCanvas.borderStyles.inset')}</option><option value="underline">{t('pdfCanvas.borderStyles.underline')}</option><option value="none">{t('pdfCanvas.borderStyles.none')}</option></select></div>
                  <div className="field-property"><label><strong>{t('pdfCanvas.fieldMenu.borderWidth')}:</strong></label><input type="number" className="field-number-input" value={selectedFieldData.border_width || 1} min="0" max="10" onChange={(e) => handlePropertyChange(getFieldId(selectedFieldData), 'border_width', parseFloat(e.target.value) || 0)} /></div>
                  <button className="btn-delete-field" onClick={() => handleDeleteField(getFieldId(selectedFieldData))}>{t('pdfCanvas.fieldMenu.deleteField')}</button>
                </div>
              </div>
            )}

            {selectedFields.length === 0 && (<div className="no-selection-info"><p>{t('pdfCanvas.fieldMenu.noSelection')}</p><p><small>{t('pdfCanvas.fieldMenu.ctrlClickMulti')}</small></p><p><small>{t('pdfCanvas.fieldMenu.pressDelete')}</small></p></div>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default PDFCanvas;
