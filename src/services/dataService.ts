import AdmZip from 'adm-zip';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import CardDataStore from '../store/cardData';
import { loadMetadata, loadSetList, loadCards } from '../database/db';

const DATA_DIR = 'data';
const CARD_DB_FILE = 'AllPrintings.sqlite';
const SYMBOLS_FILE = 'symbols.json';
const REMOTE_DATA_URL = 'https://mtgjson.com/api/v5/AllPrintings.sqlite.zip';
const REMOTE_SYMBOLS_URL = 'https://api.scryfall.com/symbology';
const CARD_DB_PATH = path.join(DATA_DIR, CARD_DB_FILE);
const SYMBOLS_PATH = path.join(DATA_DIR, SYMBOLS_FILE);

/**
 * Check if remote data file has been modified
 */
export async function checkRemoteFileModified(): Promise<Date | null> {
    const response = await fetch(REMOTE_DATA_URL, { method: 'HEAD' });
    const lastModified = response.headers.get('last-modified');
    if (!lastModified) {
        return null;
    }
    return new Date(lastModified);
}

/**
 * Check if local data file has been modified
 */
export async function checkLocalFileModified(): Promise<Date | null> {
    try {
        const stats = await fs.stat(CARD_DB_PATH);
        return new Date(stats.mtime);
    } catch {
        return null;
    }
}

/**
 * Download symbol data from Scryfall
 */
export async function downloadSymbolData(): Promise<void> {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const response = await fetch(REMOTE_SYMBOLS_URL);
        const data = await response.json() as Record<string, any>;
        const symbols = data.data;
        await fs.writeFile(SYMBOLS_PATH, JSON.stringify(symbols, null, 2));
    } catch (error) {
        console.error('Failed to download symbol data:', error);
        throw error;
    }
}

/**
 * Download and extract card database
 */
export async function downloadCardData(): Promise<void> {
    try {
        console.log('Downloading card data in SQLite format...');
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        const response = await fetch(REMOTE_DATA_URL);
        const data = await response.arrayBuffer();
        
        // Create temporary zip file
        const tempZipPath = path.join(DATA_DIR, `${CARD_DB_FILE}.zip`);
        await fs.writeFile(tempZipPath, Buffer.from(data));
        
        // Extract SQLite file from zip
        const zip = new AdmZip(tempZipPath);
        const zipEntries = zip.getEntries();
        
        if (zipEntries.length > 0) {
            // Find SQLite file in the archive
            const sqliteEntry = zipEntries.find(entry => 
                entry.name.endsWith('.sqlite') || 
                entry.name === 'AllPrintings.sqlite'
            );
            
            if (sqliteEntry) {
                console.log(`Extracting ${sqliteEntry.name} to ${CARD_DB_PATH}`);
                zip.extractEntryTo(sqliteEntry.entryName, DATA_DIR, false, true, false, CARD_DB_FILE);
            } else {
                throw new Error('No SQLite file found in the card data zip file');
            }
        } else {
            throw new Error('No entries found in card data zip file');
        }
        
        // Clean up temp zip file
        await fs.unlink(tempZipPath);
        console.log('Card data downloaded and extracted successfully.');
    } catch (error) {
        console.error('Failed to download card data:', error);
        throw error;
    }
}

/**
 * Load symbol data from JSON file
 */
export async function loadSymbolData(): Promise<boolean> {
    try {
        if (!existsSync(SYMBOLS_PATH)) {
            console.warn(`Symbols file not found at ${SYMBOLS_PATH}. Downloading...`);
            await downloadSymbolData();
        }
        
        const symbolData = JSON.parse(await fs.readFile(SYMBOLS_PATH, 'utf8'));
        const cardStore = CardDataStore.getInstance();
        cardStore.setSymbols(symbolData);
        return true;
    } catch (error) {
        console.error('Failed to load symbol data:', error);
        throw error;
    }
}

/**
 * Initialize the card data store
 */
export async function initializeCardStore(): Promise<boolean> {
    try {
        console.log('Initializing card data store...');
        const cardStore = CardDataStore.getInstance();
        
        // Load metadata
        const meta = await loadMetadata();
        cardStore.setMetadata(meta);
        
        // Load sets
        const sets = await loadSetList();
        cardStore.setAvailableSets(sets);
        console.log(`Loaded ${sets.length} sets`);
        
        // Load cards
        const cards = await loadCards();
        cardStore.setAvailableCards(cards);
        console.log(`Loaded ${cards.length} cards`);
        
        return true;
    } catch (error) {
        console.error('Failed to initialize card store:', error);
        return false;
    }
}
