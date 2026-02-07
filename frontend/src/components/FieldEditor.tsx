import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
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
    <div className="bg-white rounded-xl shadow-md p-8 border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('fieldEditor.title')} ({fields.length})</h2>
        <button 
          className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
          onClick={() => setShowAddField(!showAddField)}
        >
          {showAddField ? t('fieldEditor.cancel') : `+ ${t('fieldEditor.addField')}`}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-4 animate-slide-in ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {showAddField && (
        <div className="flex gap-4 mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
          <input
            type="text"
            placeholder={t('fieldEditor.fieldName')}
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
          <button 
            className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
            onClick={handleAddField}
          >
            {t('fieldEditor.addFieldButton')}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {fields.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
            <p className="text-lg">{t('fieldEditor.noFields')}</p>
          </div>
        ) : (
          fields.map((field) => (
            <div
              key={field.name}
              className={`bg-gradient-to-r from-gray-50 to-gray-100 border-2 rounded-xl p-4 transition-all duration-300 cursor-move ${
                draggingField?.name === field.name 
                  ? 'opacity-50 scale-95' 
                  : 'border-gray-200 hover:border-primary-400 hover:shadow-lg'
              }`}
              draggable
              onDragStart={() => handleDragStart(field)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, field)}
            >
              <div className="flex items-center gap-4">
                <div className="text-2xl text-gray-400 cursor-grab active:cursor-grabbing">⋮⋮</div>
                <div className="flex-1">
                  <strong className="text-lg text-gray-900">{field.name}</strong>
                  <span className="ml-3 text-sm text-primary-600 font-medium bg-primary-50 px-3 py-1 rounded-full">
                    {field.field_type}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors"
                    onClick={() => handleEditField(field)}
                  >
                    {t('fieldEditor.edit')}
                  </button>
                  <button
                    className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
                    onClick={() => handleDeleteField(field.name)}
                  >
                    {t('fieldEditor.delete')}
                  </button>
                </div>
              </div>
              
              {field.value && (
                <div className="mt-3 p-3 bg-white rounded-lg text-sm text-gray-700 border border-gray-200">
                  {t('fieldEditor.value')}: <span className="font-medium">{field.value}</span>
                </div>
              )}

              {field.x !== null && field.y !== null && (
                <div className="mt-3 p-3 bg-white rounded-lg text-sm text-gray-600 border border-gray-200">
                  {t('fieldEditor.position')}: <span className="font-medium">({field.x}, {field.y})</span> | 
                  {t('fieldEditor.size')}: <span className="font-medium">{field.width}x{field.height}</span> | 
                  {t('fieldEditor.page')}: <span className="font-medium">{field.page}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {editingField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 animate-fade-in" onClick={() => setEditingField(null)}>
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-11/12 max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-gray-900 mb-6">{t('fieldEditor.editField')}: {editingField.name}</h3>
            
            <div className="mb-6">
              <label className="block mb-2 text-sm font-semibold text-gray-700">{t('fieldEditor.fieldType')}:</label>
              <input
                type="text"
                value={editingField.field_type}
                onChange={(e) => setEditingField({...editingField, field_type: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="mb-6">
              <label className="block mb-2 text-sm font-semibold text-gray-700">{t('fieldEditor.value')}:</label>
              <input
                type="text"
                value={editingField.value || ''}
                onChange={(e) => setEditingField({...editingField, value: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">{t('fieldEditor.xPosition')}:</label>
                <input
                  type="number"
                  value={editingField.x || 0}
                  onChange={(e) => setEditingField({...editingField, x: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">{t('fieldEditor.yPosition')}:</label>
                <input
                  type="number"
                  value={editingField.y || 0}
                  onChange={(e) => setEditingField({...editingField, y: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">{t('fieldEditor.width')}:</label>
                <input
                  type="number"
                  value={editingField.width || 100}
                  onChange={(e) => setEditingField({...editingField, width: parseFloat(e.target.value) || 100})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">{t('fieldEditor.height')}:</label>
                <input
                  type="number"
                  value={editingField.height || 30}
                  onChange={(e) => setEditingField({...editingField, height: parseFloat(e.target.value) || 30})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block mb-2 text-sm font-semibold text-gray-700">{t('fieldEditor.page')}:</label>
              <input
                type="number"
                value={editingField.page || 0}
                onChange={(e) => setEditingField({...editingField, page: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Font selection for text fields */}
            {(editingField.field_type === 'Text' || editingField.field_type === 'Textarea' || editingField.field_type === 'Date') && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">{t('fieldEditor.fontName')}:</label>
                  <select
                    value={editingField.font_name || 'Helvetica'}
                    onChange={(e) => setEditingField({...editingField, font_name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  >
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times">Times Roman</option>
                    <option value="Courier">Courier</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">{t('fieldEditor.fontSize')}:</label>
                  <input
                    type="number"
                    min="6"
                    max="72"
                    value={editingField.font_size || 12}
                    onChange={(e) => {
                      const size = parseFloat(e.target.value) || 12;
                      const clampedSize = Math.min(72, Math.max(6, size));
                      setEditingField({...editingField, font_size: clampedSize});
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-end">
              <button 
                className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-colors"
                onClick={handleSaveField}
              >
                {t('fieldEditor.saveChanges')}
              </button>
              <button 
                className="px-6 py-3 bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600 transition-colors"
                onClick={() => setEditingField(null)}
              >
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
