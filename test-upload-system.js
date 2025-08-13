// test-upload-system.js
const fs = require('fs');

async function testUploadSystem() {
  const baseUrl = 'http://localhost:3000';
  
  // Create a small test CSV
  const testCsv = `Utc Time,Lane Type,License Plate,Zone,Camera Id
2025-08-01 10:00:00,IN,TEST001,TestZone,CAM1
2025-08-01 11:00:00,OUT,TEST001,TestZone,CAM1
2025-08-01 10:30:00,IN,TEST002,TestZone,CAM2
2025-08-01 12:00:00,OUT,TEST002,TestZone,CAM2`;
  
  const blob = new Blob([testCsv], { type: 'text/csv' });
  
  console.log('1. Testing /api/uploads/init...');
  const initResponse = await fetch(`${baseUrl}/api/uploads/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: 'test.csv',
      bytes: blob.size
    })
  });
  
  if (!initResponse.ok) {
    console.error('❌ Init failed:', await initResponse.text());
    return;
  }
  
  const { uploadId } = await initResponse.json();
  console.log(`✅ Got upload ID: ${uploadId}`);
  
  console.log('2. Testing /api/uploads/chunk...');
  const formData = new FormData();
  formData.append('uploadId', uploadId);
  formData.append('chunkIndex', '0');
  formData.append('totalChunks', '1');
  formData.append('chunk', blob);
  
  const chunkResponse = await fetch(`${baseUrl}/api/uploads/chunk`, {
    method: 'POST',
    body: formData
  });
  
  if (!chunkResponse.ok) {
    console.error('❌ Chunk upload failed:', await chunkResponse.text());
    return;
  }
  console.log('✅ Chunk uploaded');
  
  console.log('3. Testing /api/uploads/[id]/status...');
  const statusResponse = await fetch(`${baseUrl}/api/uploads/${uploadId}/status`);
  
  if (!statusResponse.ok) {
    console.error('❌ Status check failed:', await statusResponse.text());
    return;
  }
  
  const status = await statusResponse.json();
  console.log('✅ Status:', status);
  
  console.log('4. Testing /api/uploads/commit...');
  const commitResponse = await fetch(`${baseUrl}/api/uploads/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      action: 'COMMIT'
    })
  });
  
  if (!commitResponse.ok) {
    console.error('❌ Commit failed:', await commitResponse.text());
    return;
  }
  console.log('✅ Upload committed');
  
  console.log('\n✅ All upload endpoints working!');
}

// Run test
testUploadSystem().catch(console.error);