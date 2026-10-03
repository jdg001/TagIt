import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export interface ExcelData {
  headers: string[];
  rows: { [key: string]: string }[];
  sheetName: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExcelParserService {

  constructor() { }

  /**
   * Parse Excel file and return data in the same format as CSV
   */
  parseExcelFile(file: File): Promise<ExcelData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          
          // Get the first worksheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length === 0) {
            throw new Error('Excel file is empty');
          }
          
          // First row is headers
          const headers = (jsonData[0] as string[]).map(header => 
            header ? header.toString().trim() : ''
          ).filter(header => header !== '');
          
          if (headers.length === 0) {
            throw new Error('No headers found in Excel file');
          }
          
          // Convert data rows to objects
          const rows: { [key: string]: string }[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as string[];
            if (row && row.length > 0) {
              const rowObj: { [key: string]: string } = {};
              headers.forEach((header, index) => {
                rowObj[header] = row[index] ? row[index].toString().trim() : '';
              });
              rows.push(rowObj);
            }
          }
          
          resolve({
            headers,
            rows,
            sheetName: firstSheetName
          });
        } catch (error) {
          reject(new Error(`Error parsing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading Excel file'));
      };
      
      reader.readAsBinaryString(file);
    });
  }

  /**
   * Get available sheet names from Excel file
   */
  getSheetNames(file: File): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          resolve(workbook.SheetNames);
        } catch (error) {
          reject(new Error(`Error reading Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading Excel file'));
      };
      
      reader.readAsBinaryString(file);
    });
  }

  /**
   * Parse specific sheet from Excel file
   */
  parseExcelSheet(file: File, sheetName: string): Promise<ExcelData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          
          if (!workbook.SheetNames.includes(sheetName)) {
            throw new Error(`Sheet "${sheetName}" not found`);
          }
          
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length === 0) {
            throw new Error('Excel sheet is empty');
          }
          
          // First row is headers
          const headers = (jsonData[0] as string[]).map(header => 
            header ? header.toString().trim() : ''
          ).filter(header => header !== '');
          
          if (headers.length === 0) {
            throw new Error('No headers found in Excel sheet');
          }
          
          // Convert data rows to objects
          const rows: { [key: string]: string }[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as string[];
            if (row && row.length > 0) {
              const rowObj: { [key: string]: string } = {};
              headers.forEach((header, index) => {
                rowObj[header] = row[index] ? row[index].toString().trim() : '';
              });
              rows.push(rowObj);
            }
          }
          
          resolve({
            headers,
            rows,
            sheetName
          });
        } catch (error) {
          reject(new Error(`Error parsing Excel sheet: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading Excel file'));
      };
      
      reader.readAsBinaryString(file);
    });
  }
}