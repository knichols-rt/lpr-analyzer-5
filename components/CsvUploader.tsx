'use client';

import { useState, useRef, useCallback } from 'react';
import { CSV_MAPPINGS, CSVMappingService } from '@/lib/csv-mappings';

interface CsvUploaderProps {}

interface UploadState {
  file: File | null;
  uploading: boolean;
  progress: number;
  uploadId: string | null;
  step: 'select' | 'configure' | 'upload' | 'complete';
}

interface CsvPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

interface ColumnMapping {
  ts: string | null;
  direction: string | null;
  plate: string | null;
  state?: string | null;
  zone?: string | null;
  camera_id?: string | null;
  quality?: string | null;
}

interface ValidationResults {
  timestampParseRate: number;
  directionValues: string[];
  zoneValues: string[];
  errors: string[];
  warnings: string[];
}

export default function CsvUploader({}: CsvUploaderProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    uploading: false,
    progress: 0,
    uploadId: null,
    step: 'select'
  });

  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    ts: null,
    direction: null,
    plate: null,
    state: null,
    zone: null,
    camera_id: null,
    quality: null
  });
  
  const [timezone, setTimezone] = useState('America/New_York');
  const [zoneScope, setZoneScope] = useState<'single' | 'per-row'>('single');
  const [singleZone, setSingleZone] = useState('');
  const [validation, setValidation] = useState<ValidationResults | null>(null);
  const [timestampFormat, setTimestampFormat] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  // File selection and drag-drop handlers
  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.csv.gz')) {
      alert('Please select a CSV or CSV.gz file');
      return;
    }

    setUploadState(prev => ({ ...prev, file, step: 'configure' }));
    parseCSVPreview(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // Parse CSV preview (first 200 rows)
  const parseCSVPreview = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').slice(0, 201); // Headers + 200 rows
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rows = lines.slice(1, 201).map(line => 
        line.split(',').map(cell => cell.trim().replace(/"/g, ''))
      ).filter(row => row.length > 1); // Filter empty rows

      setCsvPreview({
        headers,
        rows,
        totalRows: text.split('\n').length - 1 // Approximate
      });

      // Auto-detect mapping
      const detectedMapping = CSVMappingService.detectMapping(headers);
      if (detectedMapping) {
        setColumnMapping({
          ts: detectedMapping.fieldMapping.ts,
          direction: detectedMapping.fieldMapping.direction,
          plate: detectedMapping.fieldMapping.plate_raw,
          state: detectedMapping.fieldMapping.state_raw,
          zone: detectedMapping.fieldMapping.zone,
          camera_id: detectedMapping.fieldMapping.camera_id,
          quality: detectedMapping.fieldMapping.quality || null
        });
      }

      // Auto-detect timestamp format
      if (rows.length > 0 && headers.length > 0) {
        const tsColumn = detectedMapping?.fieldMapping.ts || headers[0];
        const tsIndex = headers.indexOf(tsColumn);
        if (tsIndex >= 0 && rows[0][tsIndex]) {
          const sampleTs = rows[0][tsIndex];
          detectTimestampFormat(sampleTs);
        }
      }

    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('Error parsing CSV file. Please check the format.');
    }
  };

  // Detect timestamp format
  const detectTimestampFormat = (sample: string) => {
    if (/^\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}$/.test(sample)) {
      setTimestampFormat('MM/DD/YYYY HH:MI (no offset)');
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(sample)) {
      setTimestampFormat('YYYY-MM-DD HH:MI:SS (no offset)');
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?$/.test(sample)) {
      setTimestampFormat('ISO 8601');
    } else {
      setTimestampFormat('Unknown format');
    }
  };

  // Validate column mapping and data
  const validateData = () => {
    if (!csvPreview) return;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required columns
    if (!columnMapping.ts) errors.push('Timestamp column is required');
    if (!columnMapping.direction) errors.push('Direction column is required');
    if (!columnMapping.plate) errors.push('Plate column is required');

    // Check zone configuration
    if (zoneScope === 'single' && !singleZone.trim()) {
      warnings.push('No zone specified for single zone mode');
    } else if (zoneScope === 'per-row' && !columnMapping.zone) {
      errors.push('Zone column is required when using per-row zone mode');
    }

    // Parse timestamp samples to check parse rate
    let parsedCount = 0;
    const sampleSize = Math.min(20, csvPreview.rows.length);
    const tsIndex = csvPreview.headers.indexOf(columnMapping.ts!);
    
    if (tsIndex >= 0) {
      for (let i = 0; i < sampleSize; i++) {
        const tsValue = csvPreview.rows[i]?.[tsIndex];
        if (tsValue && isValidTimestamp(tsValue)) {
          parsedCount++;
        }
      }
    }

    const timestampParseRate = sampleSize > 0 ? (parsedCount / sampleSize) * 100 : 0;
    if (timestampParseRate < 90) {
      warnings.push(`Low timestamp parse rate: ${timestampParseRate.toFixed(1)}%`);
    }

    // Get direction values
    const dirIndex = csvPreview.headers.indexOf(columnMapping.direction!);
    const directionValues = dirIndex >= 0 ? 
      [...new Set(csvPreview.rows.map(row => row[dirIndex]).filter(Boolean))] : [];

    // Get zone values
    const zoneIndex = columnMapping.zone ? csvPreview.headers.indexOf(columnMapping.zone) : -1;
    const zoneValues = zoneIndex >= 0 ? 
      [...new Set(csvPreview.rows.map(row => row[zoneIndex]).filter(Boolean))] : [];

    setValidation({
      timestampParseRate,
      directionValues,
      zoneValues,
      errors,
      warnings
    });

    return errors.length === 0;
  };

  // Simple timestamp validation
  const isValidTimestamp = (value: string): boolean => {
    const date = new Date(value);
    return !isNaN(date.getTime());
  };

  // Multipart upload for large files
  const handleMultipartUpload = async (file: File, uploadId: string, partSizeMB: number, maxConcurrency: number) => {
    const partSize = partSizeMB * 1024 * 1024; // Convert MB to bytes
    const totalParts = Math.ceil(file.size / partSize);
    const uploadedParts: Array<{partNumber: number, etag: string}> = [];
    
    let uploadedBytes = 0;
    
    // Upload parts with controlled concurrency
    for (let i = 0; i < totalParts; i += maxConcurrency) {
      const batch = [];
      
      for (let j = 0; j < maxConcurrency && (i + j) < totalParts; j++) {
        const partNumber = i + j + 1;
        const start = (i + j) * partSize;
        const end = Math.min(start + partSize, file.size);
        const chunk = file.slice(start, end);
        
        batch.push(uploadPart(uploadId, partNumber, chunk));
      }
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batch);
      
      // Update progress and collect ETags
      for (const result of batchResults) {
        uploadedParts.push(result);
        uploadedBytes += partSize;
        const progress = Math.min((uploadedBytes / file.size) * 90, 90); // Reserve 10% for completion
        setUploadState(prev => ({ ...prev, progress }));
      }
    }
    
    // Complete multipart upload
    const completeResponse = await fetch('/api/uploads/complete-multipart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        parts: uploadedParts.sort((a, b) => a.partNumber - b.partNumber)
      })
    });
    
    if (!completeResponse.ok) {
      throw new Error('Failed to complete multipart upload');
    }
    
    return await completeResponse.json();
  };
  
  // Upload a single part
  const uploadPart = async (uploadId: string, partNumber: number, chunk: Blob): Promise<{partNumber: number, etag: string}> => {
    // Get presigned URL for this part
    const presignResponse = await fetch('/api/uploads/presign-part', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, partNumber })
    });
    
    if (!presignResponse.ok) {
      throw new Error(`Failed to get presigned URL for part ${partNumber}`);
    }
    
    const { url } = await presignResponse.json();
    
    // Upload the chunk (simulated for development)
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
    
    // In a real implementation, this would be:
    // const uploadResponse = await fetch(url, {
    //   method: 'PUT',
    //   body: chunk,
    //   headers: { 'Content-Type': 'application/octet-stream' }
    // });
    // const etag = uploadResponse.headers.get('ETag');
    
    // Mock ETag for development
    const etag = `"${Math.random().toString(36).substring(2)}"`;
    
    return { partNumber, etag };
  };

  // Handle upload initiation
  const handleUpload = async () => {
    if (!uploadState.file || !validateData()) {
      return;
    }

    setUploadState(prev => ({ ...prev, uploading: true, progress: 0, step: 'upload' }));

    try {
      const file = uploadState.file;
      const fileSizeThreshold = 100 * 1024 * 1024; // 100MB threshold for multipart
      
      let uploadId: string;
      
      if (file.size > fileSizeThreshold) {
        // Use multipart upload for large files
        const initResponse = await fetch('/api/uploads/init-multipart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: 'default', // TODO: Get from auth
            csvMeta: {
              filename: file.name,
              size: file.size,
              mapping: columnMapping,
              timezone,
              zoneScope,
              singleZone: zoneScope === 'single' ? singleZone : undefined
            },
            fileSizeBytes: file.size
          })
        });

        if (!initResponse.ok) {
          throw new Error('Failed to initialize multipart upload');
        }

        const { uploadId: mpUploadId, partSizeMB, maxConcurrency } = await initResponse.json();
        uploadId = mpUploadId;
        
        setUploadState(prev => ({ ...prev, uploadId }));
        
        // Perform multipart upload
        await handleMultipartUpload(file, uploadId, partSizeMB, maxConcurrency);
        
      } else {
        // Use single upload for smaller files
        const initResponse = await fetch('/api/uploads/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: 'default', // TODO: Get from auth
            csvMeta: {
              filename: file.name,
              size: file.size,
              mapping: columnMapping,
              timezone,
              zoneScope,
              singleZone: zoneScope === 'single' ? singleZone : undefined
            }
          })
        });

        if (!initResponse.ok) {
          throw new Error('Failed to initialize upload');
        }

        const { uploadId: singleUploadId, putUrl } = await initResponse.json();
        uploadId = singleUploadId;
        
        setUploadState(prev => ({ ...prev, uploadId }));

        // Simulate single file upload progress
        const progressInterval = setInterval(() => {
          setUploadState(prev => ({
            ...prev,
            progress: Math.min(prev.progress + Math.random() * 20, 90)
          }));
        }, 500);

        // In a real implementation, this would upload to the presigned URL
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        clearInterval(progressInterval);
      }
      
      // Complete upload
      setUploadState(prev => ({ 
        ...prev, 
        progress: 100, 
        uploading: false, 
        step: 'complete' 
      }));

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadState(prev => ({ ...prev, uploading: false }));
      alert('Upload failed. Please try again.');
    }
  };

  // Reset uploader
  const handleReset = () => {
    setUploadState({
      file: null,
      uploading: false,
      progress: 0,
      uploadId: null,
      step: 'select'
    });
    setCsvPreview(null);
    setValidation(null);
    setColumnMapping({
      ts: null,
      direction: null,
      plate: null,
      state: null,
      zone: null,
      camera_id: null,
      quality: null
    });
    setTimezone('America/New_York');
    setZoneScope('single');
    setSingleZone('');
  };

  if (uploadState.step === 'select') {
    return (
      <div className="space-y-6">
        {/* File Selection */}
        <div className="bg-card border border-border rounded-lg p-8">
          <div
            ref={dragRef}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="space-y-4">
              <div className="text-4xl">📁</div>
              <div>
                <h3 className="text-lg font-semibold text-primary mb-2">
                  Select CSV File
                </h3>
                <p className="text-muted-foreground mb-4">
                  Drag and drop your CSV or CSV.gz file here, or click to browse
                </p>
                <p className="text-sm text-muted-foreground">
                  Supported formats: CSV, CSV.gz
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.csv.gz"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />
          </div>
        </div>

        {/* S3/R2 URL Option */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">
            Or provide S3/R2 URL
          </h3>
          <div className="flex gap-4">
            <input
              type="url"
              placeholder="https://your-bucket.s3.amazonaws.com/path/to/file.csv"
              className="flex-1 px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder-muted-foreground"
            />
            <button className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors">
              Load
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (uploadState.step === 'configure') {
    return (
      <div className="space-y-6">
        {/* File Info */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">File Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Filename:</span>
              <span className="ml-2 font-medium">{uploadState.file?.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Size:</span>
              <span className="ml-2 font-medium">
                {uploadState.file ? (uploadState.file.size / 1024 / 1024).toFixed(2) + ' MB' : ''}
              </span>
            </div>
            {csvPreview && (
              <>
                <div>
                  <span className="text-muted-foreground">Columns:</span>
                  <span className="ml-2 font-medium">{csvPreview.headers.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Rows (approx):</span>
                  <span className="ml-2 font-medium">{csvPreview.totalRows.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Context Configuration */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">Context</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Zone Scope */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Zone Scope
              </label>
              <select
                value={zoneScope}
                onChange={(e) => setZoneScope(e.target.value as 'single' | 'per-row')}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground"
              >
                <option value="single">Single Zone</option>
                <option value="per-row">Per Row</option>
              </select>
              {zoneScope === 'single' && (
                <input
                  type="text"
                  placeholder="Zone name"
                  value={singleZone}
                  onChange={(e) => setSingleZone(e.target.value)}
                  className="w-full mt-2 px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder-muted-foreground"
                />
              )}
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground"
              >
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Denver">America/Denver</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="UTC">UTC</option>
              </select>
              {timestampFormat && (
                <div className="mt-2 p-3 bg-secondary rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Detected timestamp format: <span className="font-medium text-foreground">{timestampFormat}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ⚠ All timestamps will be converted to UTC for storage and analytics.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column Mapping */}
        {csvPreview && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary mb-4">Map Columns</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Required columns */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Timestamp * <span className="text-red-400">required</span>
                </label>
                <select
                  value={columnMapping.ts || ''}
                  onChange={(e) => setColumnMapping(prev => ({ ...prev, ts: e.target.value || null }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground"
                >
                  <option value="">Select column...</option>
                  {csvPreview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Direction * <span className="text-red-400">required</span>
                </label>
                <select
                  value={columnMapping.direction || ''}
                  onChange={(e) => setColumnMapping(prev => ({ ...prev, direction: e.target.value || null }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground"
                >
                  <option value="">Select column...</option>
                  {csvPreview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Plate * <span className="text-red-400">required</span>
                </label>
                <select
                  value={columnMapping.plate || ''}
                  onChange={(e) => setColumnMapping(prev => ({ ...prev, plate: e.target.value || null }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground"
                >
                  <option value="">Select column...</option>
                  {csvPreview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              {/* Optional columns */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  State <span className="text-muted-foreground">optional</span>
                </label>
                <select
                  value={columnMapping.state || ''}
                  onChange={(e) => setColumnMapping(prev => ({ ...prev, state: e.target.value || null }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground"
                >
                  <option value="">Select column...</option>
                  {csvPreview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Zone <span className="text-muted-foreground">optional</span>
                  {zoneScope === 'per-row' && <span className="text-red-400"> (required for per-row)</span>}
                </label>
                <select
                  value={columnMapping.zone || ''}
                  onChange={(e) => setColumnMapping(prev => ({ ...prev, zone: e.target.value || null }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground"
                >
                  <option value="">Select column...</option>
                  {csvPreview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Camera ID <span className="text-muted-foreground">optional</span>
                </label>
                <select
                  value={columnMapping.camera_id || ''}
                  onChange={(e) => setColumnMapping(prev => ({ ...prev, camera_id: e.target.value || null }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground"
                >
                  <option value="">Select column...</option>
                  {csvPreview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Quality <span className="text-muted-foreground">optional</span>
                </label>
                <select
                  value={columnMapping.quality || ''}
                  onChange={(e) => setColumnMapping(prev => ({ ...prev, quality: e.target.value || null }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground"
                >
                  <option value="">Select column...</option>
                  {csvPreview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted p-3 border-b border-border">
                <h4 className="font-medium text-foreground">
                  Preview (first 10 rows of {csvPreview.totalRows.toLocaleString()} total)
                </h4>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      {csvPreview.headers.map(header => (
                        <th key={header} className="px-3 py-2 text-left font-medium text-foreground border-r border-border last:border-r-0">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-b-0">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-2 text-foreground border-r border-border last:border-r-0">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Validation */}
        {validation && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary mb-4">Validation</h3>
            
            <div className="space-y-4">
              {/* Timestamp Parse Rate */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-foreground">Timestamp Parse Rate</span>
                  <span className={`text-sm font-medium ${validation.timestampParseRate >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {validation.timestampParseRate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${validation.timestampParseRate >= 90 ? 'bg-green-600' : 'bg-yellow-600'}`}
                    style={{ width: `${validation.timestampParseRate}%` }}
                  />
                </div>
              </div>

              {/* Direction Values */}
              {validation.directionValues.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-foreground block mb-2">Direction Values Found</span>
                  <div className="flex flex-wrap gap-2">
                    {validation.directionValues.map(value => (
                      <span key={value} className="px-2 py-1 bg-secondary text-foreground text-xs rounded">
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Zone Values */}
              {validation.zoneValues.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-foreground block mb-2">Zone Values Found</span>
                  <div className="flex flex-wrap gap-2">
                    {validation.zoneValues.slice(0, 10).map(value => (
                      <span key={value} className="px-2 py-1 bg-secondary text-foreground text-xs rounded">
                        {value}
                      </span>
                    ))}
                    {validation.zoneValues.length > 10 && (
                      <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">
                        +{validation.zoneValues.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Errors */}
              {validation.errors.length > 0 && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-md">
                  <h4 className="font-medium text-red-400 mb-2">Errors</h4>
                  <ul className="text-sm text-red-300 space-y-1">
                    {validation.errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {validation.warnings.length > 0 && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-900/50 rounded-md">
                  <h4 className="font-medium text-yellow-400 mb-2">Warnings</h4>
                  <ul className="text-sm text-yellow-300 space-y-1">
                    {validation.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <button
            onClick={handleReset}
            className="px-6 py-2 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-secondary/80 transition-colors"
          >
            Start Over
          </button>
          <div className="flex gap-4">
            <button
              onClick={validateData}
              className="px-6 py-2 bg-accent text-accent-foreground rounded-md font-medium hover:bg-accent/80 transition-colors"
            >
              Validate
            </button>
            <button
              onClick={handleUpload}
              disabled={!validation || validation.errors.length > 0}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upload & Process
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (uploadState.step === 'upload') {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <h3 className="text-xl font-semibold text-primary mb-4">Uploading File</h3>
          
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Progress</span>
              <span className="text-sm font-medium text-foreground">{uploadState.progress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-3">
              <div
                className="h-3 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </div>

          <p className="text-muted-foreground mb-4">
            {uploadState.file && uploadState.file.size > 100 * 1024 * 1024 ? (
              uploadState.progress < 90 ? 'Uploading file parts...' : 'Finalizing multipart upload...'
            ) : (
              uploadState.progress < 50 ? 'Uploading file...' : 
              uploadState.progress < 90 ? 'Processing data...' : 
              'Finalizing upload...'
            )}
          </p>

          {uploadState.file && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>{uploadState.file.name}</p>
              <p>Size: {(uploadState.file.size / 1024 / 1024).toFixed(2)} MB</p>
              {uploadState.file.size > 100 * 1024 * 1024 && (
                <p className="text-xs">Using multipart upload for large file</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (uploadState.step === 'complete') {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-semibold text-primary mb-4">Upload Complete</h3>
          
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Your file has been successfully uploaded and is being processed.
            </p>
            
            {uploadState.uploadId && (
              <div className="bg-secondary p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Upload ID</p>
                <p className="font-mono text-sm text-foreground">{uploadState.uploadId}</p>
              </div>
            )}

            <div className="flex justify-center gap-4 pt-4">
              <button
                onClick={() => window.open(`/api/uploads/${uploadState.uploadId}/status`, '_blank')}
                className="px-6 py-2 bg-accent text-accent-foreground rounded-md font-medium hover:bg-accent/80 transition-colors"
              >
                View Status
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                Upload Another File
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}