import fs from 'node:fs';
import { PDFParse } from 'pdf-parse';

/** Extract full text from a PDF file (all pages). */
export async function extractPdfText(filePath: string): Promise<string> {
  const data = fs.readFileSync(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const text = (result?.text || '').replace(/\r/g, '');
    // Drop pdf-parse page markers like "-- 1 of 1 --"
    return text
      .replace(/\n--\s*\d+\s+of\s+\d+\s*--\n/gi, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  } finally {
    await parser.destroy?.();
  }
}
