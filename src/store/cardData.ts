import { AllPrintingsFile, AllPricesFile, Meta, SetList, CardSet } from '../types';
import { 
//   getSetData, 
  // getPriceData,       // Commented out pricing data function
  getCardByUuid, 
  searchCardsByName 
} from '../helpers/mtgJsonHelpers';

/**
 * Singleton class to store and access MTG card data
 */
class CardDataStore {
  private static instance: CardDataStore;
  private metadata: Meta | null = null;
  private availableSets: SetList[] = [];
  private availableCards: CardSet[] = [];
  private symbols: any[] = [];
//   private pricingMeta: any = {};

  private constructor() {}

  public static getInstance(): CardDataStore {
    if (!CardDataStore.instance) {
      CardDataStore.instance = new CardDataStore();
    }
    return CardDataStore.instance;
  }

  public setData(data: AllPrintingsFile): void {
    this.metadata = data.meta;
  }

  public setAvailableSets(sets: SetList[]): void {
    this.availableSets = sets;
  }

  public setAvailableCards(cards: CardSet[]): void {
      this.availableCards = cards;
  }

  public getCardsBySetCode(code: string): CardSet[] {
    return this.availableCards.filter((card) => card.setCode === code);
  }

  // Comment out pricing data setter
  /* 
  public setPricingData(data: AllPricesFile): void {
    this.pricingMeta = data.meta;
  }
  */

  public setSymbols(symbols: any[]): void {
    this.symbols = symbols;
  }

  public setMetadata(meta: Meta): void {
    this.metadata = meta;
  }

  public getMetadata(): any {
    return this.metadata;
  }

  // Comment out pricing metadata getter
  /*
  public getPricingMetadata(): any {
    return this.pricingMeta;
  }
  */

  public getSymbols(): any[] {
    return this.symbols;
  }

  public getAvailableSets(exclude_online_only: boolean = true): SetList[] {
    if (exclude_online_only) {
      return this.availableSets.filter((set) => !set.isOnlineOnly);
    }
    return this.availableSets;
  }

  public getSetbyCode(code: string): SetList | undefined {
    return this.availableSets.find((set) => set.code === code);
}

  /**
   * Gets data for a specific set using SQLite database
   */
//   public async getSet(setCode: string): Promise<any> {
//     return await getSetData(setCode);
//   }

  /**
   * Gets pricing data for a specific card UUID using SQLite database
   */
  /*
  public async getCardPrice(uuid: string): Promise<any> {
    return await getPriceData(uuid);
  }
  */

  /**
   * Gets a card by UUID using SQLite database
   */
  public async getCard(uuid: string): Promise<any> {
    return await getCardByUuid(uuid);
  }

  /**
   * Searches for cards by name using SQLite database
   */
  public async searchCards(name: string, limit = 20): Promise<any[]> {
    return await searchCardsByName(name, limit);
  }
}

export default CardDataStore;
