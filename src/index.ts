// import express from 'express';
// import cors from 'cors';
// import { dependencyService } from './services/dependencyService';
// import { createRoutes } from './routes';
// import { config } from './config';

// // Create Express app
// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Routes
// app.use('/', createRoutes(dependencyService.aiMessageService));

// // Start server
// const PORT = config.port;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
//   console.log(`📱 WhatsApp webhook endpoint: http://localhost:${PORT}/whatsapp`);
// });

// export default app;

import { TransactionSearchService } from "./services/ai/TransactionSearchService";

async function main() {
  const svc = new TransactionSearchService();
  return await svc.searchTransactions('1', {
    filters: {
      categories: ['Bills & Utilities', 'Gifts & Donations'],
      types: ['expense'],
      dateRange: { from: '2025-01-01', to: '2025-11-21' },
      kinds: ['oneTime', 'recurring'],
      text: 'gift for girlfriend',
    },
    sort: [{ field: 'semanticScore', direction: 'desc' }, { field: 'date', direction: 'desc' }],
    limit: 25,
    aggregation: {
      groupBy: ['month', 'category'],
      metrics: ['count', 'sum'],
    },
    presentation: {
      locale: 'en-US',
      timezone: 'America/Los_Angeles',
      dateStyle: 'medium',
      currencyCode: 'USD',
    },
  });
}

main()
  .then((result) => {
    if (result.success) {
      console.log('Search successful:', JSON.stringify(result.data, null, 2));
    } else {
      console.error('Search failed:', result.error);
    }
  })
  .catch((error) => {
    console.error('Error in main:', error);
    process.exit(1);
  });