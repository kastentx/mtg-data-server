import { existsSync } from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { CardSet, SetList, Meta, PriceHistoryEntry } from '../types';

const DATA_DIR = 'data';
const CARD_DB_FILE = 'AllPrintings.sqlite';
const PRICING_DB_FILE = 'AllPricesToday.sqlite';
const HISTORICAL_PRICING_DB_FILE = 'AllPrices.sqlite';
const CARD_DB_PATH = path.join(DATA_DIR, CARD_DB_FILE);
const PRICING_DB_PATH = path.join(DATA_DIR, PRICING_DB_FILE);
const HISTORICAL_PRICING_DB_PATH = path.join(DATA_DIR, HISTORICAL_PRICING_DB_FILE);

// Database connection cache
let cardDb: Database | null = null;
let pricingDb: Database | null = null;
let historicalPricingDb: Database | null = null;

/**
 * Gets or creates a connection to the card database
 */
export async function getCardDatabase(): Promise<Database> {
    if (!cardDb) {
        if (!existsSync(CARD_DB_PATH)) {
            throw new Error(`Card database not found at ${CARD_DB_PATH}. Please download it first.`);
        }
        
        console.log(`Opening SQLite database at ${CARD_DB_PATH}`);
        cardDb = await open({
            filename: CARD_DB_PATH,
            driver: sqlite3.Database,
            mode: sqlite3.OPEN_READONLY
        });
        console.log('Database connection established');
    }
    return cardDb;
}

/**
 * Gets or creates a connection to the pricing database
 */
export async function getPricingDatabase(): Promise<Database> {
    if (!pricingDb) {
        if (!existsSync(PRICING_DB_PATH)) {
            throw new Error(`Pricing database not found at ${PRICING_DB_PATH}. Please download it first.`);
        }
        
        console.log(`Opening pricing SQLite database at ${PRICING_DB_PATH}`);
        pricingDb = await open({
            filename: PRICING_DB_PATH,
            driver: sqlite3.Database,
            mode: sqlite3.OPEN_READONLY
        });
        console.log('Pricing database connection established');
    }
    return pricingDb;
}

/**
 * Gets or creates a connection to the historical pricing database
 */
export async function getHistoricalPricingDatabase(): Promise<Database> {
    if (!historicalPricingDb) {
        if (!existsSync(HISTORICAL_PRICING_DB_PATH)) {
            throw new Error(`Historical pricing database not found at ${HISTORICAL_PRICING_DB_PATH}. Please download it first.`);
        }

        console.log(`Opening historical pricing SQLite database at ${HISTORICAL_PRICING_DB_PATH}`);
        historicalPricingDb = await open({
            filename: HISTORICAL_PRICING_DB_PATH,
            driver: sqlite3.Database,
            mode: sqlite3.OPEN_READONLY
        });
        console.log('Historical pricing database connection established');
    }
    return historicalPricingDb;
}

/**
 * Load metadata from the database
 */
export async function loadMetadata(): Promise<Meta> {
    try {
        const db = await getCardDatabase();
        const metaRow = await db.get('SELECT date, version FROM meta LIMIT 1');
        if (metaRow) {
            return metaRow as Meta;
        }
        return { date: '', version: '' };
    } catch (error) {
        console.error('Error loading metadata:', error);
        return { date: '', version: '' };
    }
}

/**
 * Load the list of all available sets from the database
 */
export async function loadSetList(): Promise<SetList[]> {
    try {
        const db = await getCardDatabase();
        const tableCheck = await db.get(
            `SELECT name FROM sqlite_master 
            WHERE type='table' AND name='sets'`
        );
        
        if (!tableCheck) {
            console.warn("Sets table doesn't exist in the database");
            return [];
        }
        
        const sets = await db.all('SELECT * FROM sets');
        return sets as SetList[];
    } catch (error) {
        console.error('Error loading set list:', error);
        return [];
    }
}

/**
 * Load card data with optional pricing information
 */
export async function loadCards(): Promise<CardSet[]> {
    try {
        const db = await getCardDatabase();
        const tableCheck = await db.get(
            `SELECT name FROM sqlite_master
            WHERE type='table' AND name='cards'`
        );

        if (!tableCheck) {
            console.warn("Cards table doesn't exist in the database");
            return [];
        }

        // Get all cards from the cards table
        const cards = await db.all('SELECT * FROM cards');
        
        // Get card identifiers and create a lookup map
        const cardIdentifiers = await db.all('SELECT * FROM cardIdentifiers');
        const cardIdentifiersMap = cardIdentifiers.reduce((acc: Record<string, any>, row) => {
            acc[row.uuid] = row;
            return acc;
        }, {});
        
        // Load pricing data if available
        const pricingDataMap = await loadPricingData();
        
        // Combine all data and return the complete card list
        return cards.map((card) => {
            return {
                ...card,
                identifiers: cardIdentifiersMap[card.uuid] || null,
                pricing: pricingDataMap[card.uuid] || null
            } as CardSet;
        });
    } catch (error) {
        console.error('Error loading card list:', error);
        return [];
    }
}

/**
 * Load pricing data for all cards
 */
async function loadPricingData(): Promise<Record<string, any>> {
    let pricingDataMap: Record<string, any> = {};
    
    try {
        const pricingDb = await getPricingDatabase();
        
        // Check if the pricing database has the necessary table
        const pricingTableCheck = await pricingDb.get(
            `SELECT name FROM sqlite_master
            WHERE type='table' AND name='prices'`
        );
        
        if (pricingTableCheck) {
            console.log('Loading pricing information...');
            // Get the latest pricing information for paper
            const prices = await pricingDb.all(
                'SELECT * FROM prices WHERE source="paper" AND currency="USD" AND date = (SELECT MAX(date) FROM prices)'
            );
            
            // Create a simpler pricing data structure
            pricingDataMap = prices.reduce((acc, row) => {
                if (!acc[row.uuid]) {
                    acc[row.uuid] = {};
                }
                
                // Get the listing type (retail or buylist) and use as top level key
                const listingType = row.priceType?.toLowerCase() === 'buylist' ? 'buylist' : 'retail';
                if (!acc[row.uuid][listingType]) {
                    acc[row.uuid][listingType] = {};
                }
                
                // Use card finish as second level
                const cardFinish = row.finish?.toLowerCase() || 'normal';
                if (acc[row.uuid][listingType][cardFinish] === undefined) {
                    acc[row.uuid][listingType][cardFinish] = {};
                }
                
                // Store price provider and price directly
                if (row.price !== null && row.price !== undefined) {
                    const priceProvider = String(row.provider || 'unknown').toLowerCase();
                    acc[row.uuid][listingType][cardFinish][priceProvider] = row.price;
                }
                
                return acc;
            }, {});
            
            console.log(`Loaded pricing data for ${Object.keys(pricingDataMap).length} cards`);
        } else {
            console.warn("Pricing table doesn't exist in the pricing database");
        }
    } catch (error) {
        console.warn('Failed to load pricing data:', error);
    }
    
    return pricingDataMap;
}

/**
 * Get cards by their UUIDs with pricing information
 */
export async function getCardsByUuid(uuids: string[]): Promise<CardSet[]> {
    if (!uuids.length) return [];
    
    try {
        const db = await getCardDatabase();
        
        // Get cards by UUIDs
        const placeholders = uuids.map(() => '?').join(',');
        const cards = await db.all(
            `SELECT * FROM cards WHERE uuid IN (${placeholders})`,
            uuids
        );
        
        // Get identifiers
        const identifiers = await db.all(
            `SELECT * FROM cardIdentifiers WHERE uuid IN (${placeholders})`,
            uuids
        );
        const identifiersMap = identifiers.reduce((acc: Record<string, any>, row) => {
            acc[row.uuid] = row;
            return acc;
        }, {});
        
        // Get pricing data
        let pricingDataMap: Record<string, any> = {};
        try {
            const pricingDb = await getPricingDatabase();
            const prices = await pricingDb.all(
                `SELECT * FROM prices WHERE source="paper" AND currency="USD" AND date = (SELECT MAX(date) FROM prices) AND uuid IN (${placeholders})`, 
                uuids
            );
            
            prices.forEach((row) => {
                if (!pricingDataMap[row.uuid]) {
                    pricingDataMap[row.uuid] = {};
                }
                
                const listingType = row.priceType?.toLowerCase() === 'buylist' ? 'buylist' : 'retail';
                if (!pricingDataMap[row.uuid][listingType]) {
                    pricingDataMap[row.uuid][listingType] = {};
                }
                
                const cardFinish = row.finish?.toLowerCase() || 'normal';
                if (pricingDataMap[row.uuid][listingType][cardFinish] === undefined) {
                    pricingDataMap[row.uuid][listingType][cardFinish] = {};
                }
                
                if (row.price !== null && row.price !== undefined) {
                    const priceProvider = String(row.provider || 'unknown').toLowerCase();
                    pricingDataMap[row.uuid][listingType][cardFinish][priceProvider] = row.price;
                }
            });
        } catch (error) {
            console.warn('Failed to get pricing data:', error);
        }
        
        // Combine data
        return cards.map((card) => ({
            ...card,
            identifiers: identifiersMap[card.uuid] || null,
            pricing: pricingDataMap[card.uuid] || null
        }) as CardSet);
    } catch (error) {
        console.error('Failed to get cards by UUID:', error);
        return [];
    }
}

export type PriceHistoryFilters = {
    provider?: string;
    priceType?: string;
    finish?: string;
};

/**
 * Get historical paper USD prices for a card UUID, newest first
 */
export async function getPriceHistoryByUuid(
    uuid: string,
    filters: PriceHistoryFilters = {}
): Promise<PriceHistoryEntry[]> {
    if (!uuid) {
        return [];
    }

    try {
        const db = await getHistoricalPricingDatabase();
        const tableCheck = await db.get(
            `SELECT name FROM sqlite_master
            WHERE type='table' AND name='prices'`
        );

        if (!tableCheck) {
            console.warn("Prices table doesn't exist in the historical pricing database");
            return [];
        }

        const whereClauses: string[] = [
            'uuid = ?',
            "source = 'paper'",
            "currency = 'USD'"
        ];
        const params: Array<string> = [uuid];

        if (filters.provider) {
            whereClauses.push('LOWER(provider) = ?');
            params.push(filters.provider.toLowerCase());
        }

        if (filters.priceType) {
            whereClauses.push('LOWER(priceType) = ?');
            params.push(filters.priceType.toLowerCase());
        }

        if (filters.finish) {
            whereClauses.push('LOWER(finish) = ?');
            params.push(filters.finish.toLowerCase());
        }

        const rows = await db.all(
            `SELECT uuid, date, source, provider, priceType, finish, price, currency
             FROM prices
             WHERE ${whereClauses.join(' AND ')}
             ORDER BY date DESC`,
            params
        );

        return rows as PriceHistoryEntry[];
    } catch (error) {
        console.error(`Failed to get price history for UUID "${uuid}":`, error);
        return [];
    }
}

/**
 * Get historical paper USD prices for multiple card UUIDs in a single query,
 * grouped by UUID and sorted newest first within each group. Used by the
 * batch historic pricing endpoint to compute per-card moving averages
 * without issuing one query per card.
 */
export async function getPriceHistoryByUuids(
    uuids: string[],
    filters: PriceHistoryFilters = {}
): Promise<Record<string, PriceHistoryEntry[]>> {
    if (!uuids.length) {
        return {};
    }

    try {
        const db = await getHistoricalPricingDatabase();
        const tableCheck = await db.get(
            `SELECT name FROM sqlite_master
            WHERE type='table' AND name='prices'`
        );

        if (!tableCheck) {
            console.warn("Prices table doesn't exist in the historical pricing database");
            return {};
        }

        const placeholders = uuids.map(() => '?').join(', ');
        const whereClauses: string[] = [
            `uuid IN (${placeholders})`,
            "source = 'paper'",
            "currency = 'USD'"
        ];
        const params: Array<string> = [...uuids];

        if (filters.provider) {
            whereClauses.push('LOWER(provider) = ?');
            params.push(filters.provider.toLowerCase());
        }

        if (filters.priceType) {
            whereClauses.push('LOWER(priceType) = ?');
            params.push(filters.priceType.toLowerCase());
        }

        if (filters.finish) {
            whereClauses.push('LOWER(finish) = ?');
            params.push(filters.finish.toLowerCase());
        }

        const rows = await db.all(
            `SELECT uuid, date, source, provider, priceType, finish, price, currency
             FROM prices
             WHERE ${whereClauses.join(' AND ')}
             ORDER BY uuid, date DESC`,
            params
        );

        const grouped: Record<string, PriceHistoryEntry[]> = {};
        for (const row of rows as PriceHistoryEntry[]) {
            if (!grouped[row.uuid]) {
                grouped[row.uuid] = [];
            }
            grouped[row.uuid].push(row);
        }

        return grouped;
    } catch (error) {
        console.error('Failed to get price history for UUID batch:', error);
        return {};
    }
}

/**
 * Search for cards by name
 */
export async function searchCardsByName(name: string, limit = 20): Promise<CardSet[]> {
    try {
        const db = await getCardDatabase();
        const cards = await db.all(
            `SELECT * FROM cards 
             WHERE name LIKE ? 
             LIMIT ?`,
            [`%${name}%`, limit]
        );
        
        // Get UUIDs to fetch identifiers and pricing
        const uuids = cards.map(c => c.uuid);
        if (uuids.length === 0) return [];
        
        return await getCardsByUuid(uuids);
    } catch (error) {
        console.error(`Failed to search cards by name "${name}":`, error);
        return [];
    }
}

/**
 * Close database connections when the application is shutting down
 */
export async function closeConnections(): Promise<void> {
    if (cardDb) {
        await cardDb.close();
        cardDb = null;
        console.log('Card database connection closed.');
    }
    
    if (pricingDb) {
        await pricingDb.close();
        pricingDb = null;
        console.log('Pricing database connection closed.');
    }

    if (historicalPricingDb) {
        await historicalPricingDb.close();
        historicalPricingDb = null;
        console.log('Historical pricing database connection closed.');
    }
    
    console.log('All database connections closed.');
}
