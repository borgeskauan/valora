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

import { createMqlSearchService } from "./services/ai/search/MqlSearchService";

async function main() {
  const search = await createMqlSearchService();

  const from = "2025-11-01T00:00:00.000Z";
  const to = "2026-12-01T00:00:00.000Z";

  const response = await search.queryRecurringTransactions({
    userId: '1',
    filter: {
      type: "expense",
      isActive: true,
      nextDue: {
        $gte: from,
        $lt: to,
      },
    },
    sort: { nextDue: 1 }, // soonest first
    limit: 50,
  });

  return response;
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