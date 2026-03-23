import { Platform } from 'react-native';

// Web-compatible SQLite fallback using AsyncStorage
let storage = null;
let memoryDb = [];

const initStorage = async () => {
  if (Platform.OS === 'web') {
    if (!storage) {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      storage = AsyncStorage;
    }
  }
};

export const openDatabaseAsync = async (name) => {
  if (Platform.OS === 'web') {
    await initStorage();
    // Load existing data from AsyncStorage
    try {
      const stored = await storage.getItem(`db_${name}`);
      if (stored) {
        memoryDb = JSON.parse(stored);
      }
    } catch {
      memoryDb = [];
    }
    return {
      execAsync: async () => {},
      getAllAsync: async (sql) => memoryDb,
      getFirstAsync: async (sql, params) => memoryDb.find(item => item.productId === params?.[0]),
      runAsync: async (sql, params) => {
        if (sql.includes('INSERT')) {
          const newItem = {
            id: Date.now(),
            productId: params[0],
            name: params[1],
            price: params[2],
            quantity: params[3],
            image: params[4] || '',
            stock: params[5] || 0,
          };
          memoryDb.push(newItem);
        } else if (sql.includes('UPDATE') && sql.includes('quantity + 1')) {
          const item = memoryDb.find(i => i.productId === params[0]);
          if (item) item.quantity += 1;
        } else if (sql.includes('UPDATE') && !sql.includes('quantity + 1')) {
          const item = memoryDb.find(i => i.productId === params[1]);
          if (item) item.quantity = params[0];
        } else if (sql.includes('DELETE')) {
          memoryDb = memoryDb.filter(i => i.productId !== params[0]);
        }
        // Persist to AsyncStorage
        await storage.setItem(`db_${name}`, JSON.stringify(memoryDb));
      },
    };
  }
  // Native: use actual expo-sqlite
  const { openDatabaseAsync } = await import('expo-sqlite');
  return openDatabaseAsync(name);
};
