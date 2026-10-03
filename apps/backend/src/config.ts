import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  panelUrl: process.env.PANEL_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-octopus-panel-jwt-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  wsTokenExpiresInSeconds: 60, // Short-lived token for WebSocket connection
  databaseUrl: process.env.DATABASE_URL || 'postgresql://octopus:octopus@localhost:5432/octopuspanel',
};
