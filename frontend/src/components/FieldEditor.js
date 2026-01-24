import React, { useState } from 'react';
import axios from 'axios';
import './FieldEditor.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function FieldEditor({ pdfId, fields, onFieldsUpdate }) {
  const [editingField, setEditingField] = useState(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [showAddField, setShowAddField] = useState(false);
  const [draggingField, setDraggingField] = useState(null);
  const [message, setMessage] = useState(null);

  const handleEditField = (field) => {
    setEditingField({ ...field });
  };

  const handleSaveField = async () => {
    try {
      await axios.post(`${API_URL}/api/pdf/${pdfId}/field`, {
        field: editingField
      });

      const updatedFields = fields.map(f => 
        f.name === editingField.name ? editingField : f
      );
      onFieldsUpdate(updatedFields);
      setEditingField(null);
      setMessage({ type: 'success', text: 'Field updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update field' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleAddField = async () => {
    if (!newFieldName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a field name' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const newField = {
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
      setMessage({ type: 'success', text: 'Field added successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add field' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDeleteField = async (fieldName) => {
    if (!window.confirm(`Are you sure you want to delete field "${fieldName}"?`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/pdf/${pdfId}/field/${fieldName}`);
      const updatedFields = fields.filter(f => f.name !== fieldName);
      onFieldsUpdate(updatedFields);
      setMessage({ type: 'success', text: 'Field deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete field' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDragStart = (field) => {
    setDraggingField(field);
  };

  const handleDragEnd = () => {
    setDraggingField(null);
  };

  const handleDrop = async (event, targetField) => {
    event.preventDefault();
    if (!draggingField || draggingField.name === targetField.name) {
      return;
    }

    // Swap positions in the array
    const dragIndex = fields.findIndex(f => f.name === draggingField.name);
    const dropIndex = fields.findIndex(f => f.name === targetField.name);
    
    const newFields = [...fields];
    [newFields[dragIndex], newFields[dropIndex]] = [newFields[dropIndex], newFields[dragIndex]];
    
    onFieldsUpdate(newFields);
    setMessage({ type: 'success', text: 'Fields reordered!' });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="field-editor">
      <div className="editor-header">
        <h2>Fields ({fields.length})</h2>
        <button 
          className="btn-success"
          onClick={() => setShowAddField(!showAddField)}
        >
          {showAddField ? 'Cancel' : '+ Add Field'}
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
            placeholder="Field name"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            className="field-input"
          />
          <button className="btn-success" onClick={handleAddField}>
            Add Field
          </button>
        </div>
      )}

      <div className="fields-list">
        {fields.length === 0 ? (
          <div className="no-fields">
            <p>No fields found in the PDF. Add fields manually using the button above.</p>
          </div>
        ) : (
          fields.map((field, index) => (
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
                    Edit
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteField(field.name)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              {field.value && (
                <div className="field-value">
                  Value: {field.value}
                </div>
              )}

              {field.x !== null && field.y !== null && (
                <div className="field-position">
                  Position: ({field.x}, {field.y}) | 
                  Size: {field.width}x{field.height} | 
                  Page: {field.page}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {editingField && (
        <div className="modal-overlay" onClick={() => setEditingField(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Field: {editingField.name}</h3>
            
            <div className="form-group">
              <label>Field Type:</label>
              <input
                type="text"
                value={editingField.field_type}
                onChange={(e) => setEditingField({...editingField, field_type: e.target.value})}
                className="field-input"
              />
            </div>

            <div className="form-group">
              <label>Value:</label>
              <input
                type="text"
                value={editingField.value || ''}
                onChange={(e) => setEditingField({...editingField, value: e.target.value})}
                className="field-input"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>X Position:</label>
                <input
                  type="number"
                  value={editingField.x || 0}
                  onChange={(e) => setEditingField({...editingField, x: parseFloat(e.target.value) || 0})}
                  className="field-input"
                />
              </div>

              <div className="form-group">
                <label>Y Position:</label>
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
                <label>Width:</label>
                <input
                  type="number"
                  value={editingField.width || 100}
                  onChange={(e) => setEditingField({...editingField, width: parseFloat(e.target.value) || 100})}
                  className="field-input"
                />
              </div>

              <div className="form-group">
                <label>Height:</label>
                <input
                  type="number"
                  value={editingField.height || 30}
                  onChange={(e) => setEditingField({...editingField, height: parseFloat(e.target.value) || 30})}
                  className="field-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Page:</label>
              <input
                type="number"
                value={editingField.page || 0}
                onChange={(e) => setEditingField({...editingField, page: parseInt(e.target.value)})}
                className="field-input"
              />
            </div>

            <div className="modal-actions">
              <button className="btn-success" onClick={handleSaveField}>
                Save Changes
              </button>
              <button className="btn-secondary" onClick={() => setEditingField(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FieldEditor;
