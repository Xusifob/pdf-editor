import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './FieldEditor.css';
import { PDFField, MessageState } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface FieldEditorProps {
  pdfId: string;
  fields: PDFField[];
  onFieldsUpdate: (fields: PDFField[]) => void;
}

function FieldEditor({ pdfId, fields, onFieldsUpdate }: FieldEditorProps) {
  const { t } = useTranslation();
  const [editingField, setEditingField] = useState<PDFField | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [showAddField, setShowAddField] = useState(false);
  const [draggingField, setDraggingField] = useState<PDFField | null>(null);
  const [message, setMessage] = useState<MessageState | null>(null);

  const handleEditField = (field: PDFField) => {
    setEditingField({ ...field });
  };

  const handleSaveField = async () => {
    if (!editingField) return;

    try {
      await axios.post(`${API_URL}/api/pdf/${pdfId}/field`, {
        field: editingField
      });

      const updatedFields = fields.map(f => 
        f.name === editingField.name ? editingField : f
      );
      onFieldsUpdate(updatedFields);
      setEditingField(null);
      setMessage({ type: 'success', text: t('fieldEditor.fieldUpdated') });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: t('fieldEditor.errorUpdateFailed') });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleAddField = async () => {
    if (!newFieldName.trim()) {
      setMessage({ type: 'error', text: t('fieldEditor.errorFieldName') });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const newField: PDFField = {
      name: newFieldName,
      field_type: 'Text',
      value: '',
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      page: 0
    };

    try {
      await axios.post(`${API_URL}/api/pdf/${pdfId}/field`, {
        field: newField
      });

      onFieldsUpdate([...fields, newField]);
      setNewFieldName('');
      setShowAddField(false);
      setMessage({ type: 'success', text: t('fieldEditor.fieldAdded') });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: t('fieldEditor.errorAddFailed') });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDeleteField = async (fieldName: string) => {
    if (!window.confirm(t('fieldEditor.deleteConfirm', { fieldName }))) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/pdf/${pdfId}/field/${fieldName}`);
      const updatedFields = fields.filter(f => f.name !== fieldName);
      onFieldsUpdate(updatedFields);
      setMessage({ type: 'success', text: t('fieldEditor.fieldDeleted') });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: t('fieldEditor.errorDeleteFailed') });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDragStart = (field: PDFField) => {
    setDraggingField(field);
  };

  const handleDragEnd = () => {
    setDraggingField(null);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>, targetField: PDFField) => {
    event.preventDefault();
    if (!draggingField || draggingField.name === targetField.name) {
      return;
    }

    const dragIndex = fields.findIndex(f => f.name === draggingField.name);
    const dropIndex = fields.findIndex(f => f.name === targetField.name);
    
    const newFields = [...fields];
    [newFields[dragIndex], newFields[dropIndex]] = [newFields[dropIndex], newFields[dragIndex]];
    
    onFieldsUpdate(newFields);
    setMessage({ type: 'success', text: t('fieldEditor.fieldsReordered') });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="field-editor">
      <div className="editor-header">
        <h2>{t('fieldEditor.title')} ({fields.length})</h2>
        <button 
          className="btn-success"
          onClick={() => setShowAddField(!showAddField)}
        >
          {showAddField ? t('fieldEditor.cancel') : `+ ${t('fieldEditor.addField')}`}
        </button>
      </div>

      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      {showAddField && (
        <div className="add-field-form">
          <input
            type="text"
            placeholder={t('fieldEditor.fieldName')}
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            className="field-input"
          />
          <button className="btn-success" onClick={handleAddField}>
            {t('fieldEditor.addFieldButton')}
          </button>
        </div>
      )}

      <div className="fields-list">
        {fields.length === 0 ? (
          <div className="no-fields">
            <p>{t('fieldEditor.noFields')}</p>
          </div>
        ) : (
          fields.map((field) => (
            <div
              key={field.name}
              className={`field-item ${draggingField?.name === field.name ? 'dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(field)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, field)}
            >
              <div className="field-header">
                <div className="drag-handle">⋮⋮</div>
                <div className="field-info">
                  <strong>{field.name}</strong>
                  <span className="field-type">{field.field_type}</span>
                </div>
                <div className="field-actions">
                  <button
                    className="btn-edit"
                    onClick={() => handleEditField(field)}
                  >
                    {t('fieldEditor.edit')}
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteField(field.name)}
                  >
                    {t('fieldEditor.delete')}
                  </button>
                </div>
              </div>
              
              {field.value && (
                <div className="field-value">
                  {t('fieldEditor.value')}: {field.value}
                </div>
              )}

              {field.x !== null && field.y !== null && (
                <div className="field-position">
                  {t('fieldEditor.position')}: ({field.x}, {field.y}) | 
                  {t('fieldEditor.size')}: {field.width}x{field.height} | 
                  {t('fieldEditor.page')}: {field.page}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {editingField && (
        <div className="modal-overlay" onClick={() => setEditingField(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('fieldEditor.editField')}: {editingField.name}</h3>
            
            <div className="form-group">
              <label>{t('fieldEditor.fieldType')}:</label>
              <input
                type="text"
                value={editingField.field_type}
                onChange={(e) => setEditingField({...editingField, field_type: e.target.value})}
                className="field-input"
              />
            </div>

            <div className="form-group">
              <label>{t('fieldEditor.value')}:</label>
              <input
                type="text"
                value={editingField.value || ''}
                onChange={(e) => setEditingField({...editingField, value: e.target.value})}
                className="field-input"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('fieldEditor.xPosition')}:</label>
                <input
                  type="number"
                  value={editingField.x || 0}
                  onChange={(e) => setEditingField({...editingField, x: parseFloat(e.target.value) || 0})}
                  className="field-input"
                />
              </div>

              <div className="form-group">
                <label>{t('fieldEditor.yPosition')}:</label>
                <input
                  type="number"
                  value={editingField.y || 0}
                  onChange={(e) => setEditingField({...editingField, y: parseFloat(e.target.value) || 0})}
                  className="field-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('fieldEditor.width')}:</label>
                <input
                  type="number"
                  value={editingField.width || 100}
                  onChange={(e) => setEditingField({...editingField, width: parseFloat(e.target.value) || 100})}
                  className="field-input"
                />
              </div>

              <div className="form-group">
                <label>{t('fieldEditor.height')}:</label>
                <input
                  type="number"
                  value={editingField.height || 30}
                  onChange={(e) => setEditingField({...editingField, height: parseFloat(e.target.value) || 30})}
                  className="field-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label>{t('fieldEditor.page')}:</label>
              <input
                type="number"
                value={editingField.page || 0}
                onChange={(e) => setEditingField({...editingField, page: parseInt(e.target.value) || 0})}
                className="field-input"
              />
            </div>

            <div className="modal-actions">
              <button className="btn-success" onClick={handleSaveField}>
                {t('fieldEditor.saveChanges')}
              </button>
              <button className="btn-secondary" onClick={() => setEditingField(null)}>
                {t('fieldEditor.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FieldEditor;
