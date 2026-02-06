# Font Selection Feature

## Overview

Font selection has been successfully added back to the PDF editor application. This feature allows users to customize the font family and size for each text field while maintaining full compatibility with third-party PDF libraries like SetaPDF.

## Features

### Available Fonts
- **Helvetica** - Clean, sans-serif font (default)
- **Times Roman** - Classic serif font
- **Courier** - Monospace font

### Font Size Range
- Minimum: 6 points
- Maximum: 72 points
- Default: 12 points

### Field Types Supporting Font Selection
- Text fields
- Textarea fields  
- Date fields

## User Interface

### Font Selection Controls

In the Field Editor, when editing a text-based field, users will see:

1. **Font dropdown**: Select from Helvetica, Times Roman, or Courier
2. **Font size input**: Enter size between 6-72 points with automatic clamping

These controls appear only for applicable field types (Text, Textarea, Date).

## Technical Implementation

### Data Model

**Backend (FieldInfo model)**:
```python
font_name: Optional[str] = "Helvetica"  # Helvetica, Times, or Courier
font_size: Optional[float] = 12  # 6-72 points
```

**Frontend (PDFField interface)**:
```typescript
font_name?: string;
font_size?: number;
```

### Font Resources

All fonts are created as **indirect objects** in the PDF structure:

```python
# Helvetica
helvetica_font = DictionaryObject({
    NameObject("/Type"): NameObject("/Font"),
    NameObject("/Subtype"): NameObject("/Type1"),
    NameObject("/BaseFont"): NameObject("/Helvetica"),
    NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
})
helvetica_font_ref = pdf_writer._add_object(helvetica_font)

# Times-Roman
times_font = DictionaryObject({...})
times_font_ref = pdf_writer._add_object(times_font)

# Courier  
courier_font = DictionaryObject({...})
courier_font_ref = pdf_writer._add_object(courier_font)
```

All three fonts are registered in the AcroForm's DR (Default Resources) dictionary:

```python
font_dict = DictionaryObject({
    NameObject("/Helv"): helvetica_font_ref,
    NameObject("/Times"): times_font_ref,
    NameObject("/Cour"): courier_font_ref,
})
```

### PDF Generation

Each field's Default Appearance (DA) string uses the selected font:

```python
pdf_font_name = font_name_map.get(font_name, "/Helv")
da_string = f"{pdf_font_name} {font_size} Tf 0 g"
```

## Validation

### Backend Validation (Pydantic)

**Font Name Validator**:
```python
@validator('font_name')
def validate_font_name(cls, v):
    if v is not None and v not in ['Helvetica', 'Times', 'Courier']:
        raise ValueError('font_name must be one of: Helvetica, Times, Courier')
    return v
```

**Font Size Validator**:
```python
@validator('font_size')
def validate_font_size(cls, v):
    if v is not None:
        if v < 6 or v > 72:
            raise ValueError('font_size must be between 6 and 72 points')
    return v
```

### Frontend Validation

Font size input includes automatic clamping:

```typescript
const size = parseFloat(e.target.value) || 12;
const clampedSize = Math.min(72, Math.max(6, size));
setEditingField({...editingField, font_size: clampedSize});
```

## SetaPDF Compatibility

The font selection feature maintains full compatibility with SetaPDF and other third-party PDF libraries:

✅ **All fonts are indirect objects** - Can be resolved via `getIndirectObject()`  
✅ **WinAnsiEncoding** - Standard encoding for consistent character rendering  
✅ **Proper DR structure** - Font resources properly registered in AcroForm  
✅ **No document parameter required** - Indirect objects can be resolved independently

## Backwards Compatibility

- Default font: Helvetica 12pt
- Existing PDFs without font settings will use defaults
- All existing functionality preserved

## Internationalization

Translations added for:
- English: "Font", "Font Size"
- French: "Police", "Taille de police"

## Testing

Comprehensive tests verify:
- Multiple fonts created as indirect objects
- Per-field font selection working
- Font size validation (6-72pt)
- SetaPDF compatibility maintained
- All font resources properly structured

## Usage Example

### Creating a Field with Custom Font

**Frontend (FieldEditor)**:
1. Click "Edit" on a text field
2. Select font from dropdown (e.g., "Times Roman")
3. Enter font size (e.g., 16)
4. Click "Save Changes"

**Backend Processing**:
```python
field_name = "Title"
font_name = "Times"  # From field data
font_size = 16  # From field data

# Generate DA string
pdf_font_name = "/Times"
da_string = f"{pdf_font_name} {font_size} Tf 0 g"  # "/Times 16 Tf 0 g"
```

**Result**: Field "Title" will use Times Roman font at 16 points in the generated PDF.

## Future Enhancements

Potential additions:
- More font options (Helvetica-Bold, Times-Bold, etc.)
- Font color selection
- Font style (bold, italic)
- Preview of font appearance in UI

## Related Documentation

- [SETAPDF_FIX.md](SETAPDF_FIX.md) - SetaPDF compatibility fix details
- [SETAPDF_FIX_SUMMARY.md](SETAPDF_FIX_SUMMARY.md) - Quick reference for font resource structure
