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
  background_color?: string;
  max_length?: number | null;
  original_name?: string;
  radio_group?: string;
  font_name?: string;
  font_size?: number;
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
