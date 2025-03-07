import fs from 'fs/promises';
import AdmZip from 'adm-zip';

const REMOTE_DATA_URL = 'https://mtgjson.com/api/v5/AllPrintings.json.zip';
const DATA_FILE = 'AllPrintings.json.zip';

export async function checkFileStatus() {
  try {
    const stats = await fs.stat(DATA_FILE);
    return {
      exists: true,
      lastModified: stats.mtime
    };
  } catch {
    return {
      exists: false,
      lastModified: null
    };
  }
}

export async function loadCardData() {
  const zip = new AdmZip(DATA_FILE);
  const jsonContent = zip.readAsText('AllPrintings.json');
  return JSON.parse(jsonContent);
}

export async function downloadCardData() {
  // TODO: Replace with actual download URL and logic
  const response = await fetch(REMOTE_DATA_URL);
  const data = await response.arrayBuffer();
  await fs.writeFile(DATA_FILE, Buffer.from(data));
}
