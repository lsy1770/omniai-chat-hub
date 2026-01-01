import Dexie, { type Table } from 'dexie';
// 注意这里加了 type 关键字
import type { ChatSession } from '../types'; 


// ... 剩下的代码不变

class OmniAIDatabase extends Dexie {
  sessions!: Table<ChatSession>;

  constructor() {
    super('OmniAIDB');
    this.version(1).stores({
      sessions: 'id, title, modelId, createdAt, updatedAt' // 索引字段
    });
  }
}

export const db = new OmniAIDatabase();