import express from 'express';
import cors from 'cors';
import { DependencyService } from './services/dependencyService';
import { createWhatsAppRoutes } from './routes/whatsapp';
import { config } from './config/config';

async function main() {
  // Initialize dependency service (async)
  const dependencyService = DependencyService.getInstance();
  await dependencyService.initialize();

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Routes
  app.use('/whatsapp', createWhatsAppRoutes(
    dependencyService.aiMessageService,
    dependencyService.whatsappService,
    dependencyService.conversationService
  ));

  // Start server
  const PORT = config.port;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 WhatsApp webhook endpoint: http://localhost:${PORT}/whatsapp`);
  });

  return app;
}

main()
  .then(() => {
    console.log('✅ Application started successfully');
  })
  .catch((error) => {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  });