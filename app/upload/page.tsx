'use client';

import { useState } from 'react';
import CsvUploader from '@/components/CsvUploader';

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-primary">CSV Upload</h1>
        <p className="text-muted-foreground">
          Upload LPR data files for processing and analysis
        </p>
      </div>
      
      <CsvUploader />
    </div>
  );
}