export interface PDFField {
  id?: string;
  name: string;
  label?: string;
  field_type: string;
  value?: string;
  checked?: boolean;
  date_format?: string | null;
  monospace?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  border_style?: string;
  border_width?: number;
  border_color?: number[];
  font_family?: string;
  font_size?: number;
  max_length?: number | null;
  original_name?: string;
  radio_group?: string;
}

export interface PDFData {
  pdf_id: string;
  filename: string;
  num_pages: number;
  fields: PDFField[];
}

export interface MessageState {
  type: 'success' | 'error';
  text: string;
}
